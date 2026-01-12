import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from "@google/genai";

// --- Types ---
export type Direction = 'N' | 'S' | 'E' | 'W';

export enum TileType {
  AIR = 'AIR',
  DUST = 'DUST',
  TORCH = 'TORCH',
  REPEATER = 'REPEATER',
  LEVER = 'LEVER',
  BUTTON = 'BUTTON',
  LAMP = 'LAMP',
  BLOCK = 'BLOCK',
  GLASS = 'GLASS',
  SLIME = 'SLIME',
  PISTON = 'PISTON',
  STICKY_PISTON = 'STICKY_PISTON',
  PISTON_HEAD = 'PISTON_HEAD',
  OBSERVER = 'OBSERVER',
  NOTE_BLOCK = 'NOTE_BLOCK',
  REDSTONE_BLOCK = 'REDSTONE_BLOCK',
  COMPARATOR = 'COMPARATOR',
  TNT = 'TNT',
  TARGET = 'TARGET',
  OBSIDIAN = 'OBSIDIAN',
  DAYLIGHT_SENSOR = 'DAYLIGHT_SENSOR',
  PRESSURE_PLATE = 'PRESSURE_PLATE',
  COUNTER = 'COUNTER'
}

export interface TileState {
  type: TileType;
  power: number;
  direction: Direction;
  active: boolean;
  tickCooldown?: number; 
  pitch?: number; 
  delay?: number; 
  pendingActive?: boolean; 
  comparatorMode?: 'COMPARE' | 'SUBTRACT';
  isInverted?: boolean; 
  internalCounter?: number; 
}

export type GridData = Record<string, TileState>;

export interface AppSettings {
  tntDestructive: boolean;
  simulationSpeed: number;
  dayTime: number; 
}

type ToolMode = 'CURSOR' | 'BUILD' | 'DELETE' | 'MOVE';

// --- Constants ---
const GRID_SIZE = 24;
const TILE_SIZE = 40;

// --- Redstone Engine ---
const getNeighbors = (x: number, y: number) => [
  { x, y: y - 1, dir: 'N' as Direction },
  { x, y: y + 1, dir: 'S' as Direction },
  { x: x - 1, y, dir: 'W' as Direction },
  { x: x + 1, y, dir: 'E' as Direction },
];

const getOpposite = (dir: Direction): Direction => {
  return { N: 'S', S: 'N', E: 'W', W: 'E' }[dir] as Direction;
};

const updateRedstone = (grid: GridData, settings: AppSettings): GridData => {
  let nextGrid: GridData = {};
  const keys = Object.keys(grid);

  // PASS 1: Logic & Sources
  keys.forEach(key => {
    const tile = grid[key];
    const [x, y] = key.split(',').map(Number);
    let power = 0, active = tile.active, extra: Partial<TileState> = {};

    if (tile.type === TileType.REDSTONE_BLOCK) power = 15;
    else if (tile.type === TileType.LEVER) power = tile.active ? 15 : 0;
    else if (tile.type === TileType.BUTTON) power = tile.active ? 15 : 0;
    else if (tile.type === TileType.COUNTER) {
      const nextVal = ((tile.internalCounter || 0) % 15) + 1;
      power = nextVal;
      extra = { internalCounter: nextVal };
    }
    else if (tile.type === TileType.DAYLIGHT_SENSOR) {
      const isDay = settings.dayTime < 1200;
      const peak = isDay ? 600 : 1800;
      const dist = Math.abs(settings.dayTime - peak);
      const raw = Math.max(0, 15 - Math.floor(dist / 40));
      power = tile.isInverted ? (!isDay ? raw : 0) : (isDay ? raw : 0);
      active = power > 0;
    }
    else if (tile.type === TileType.TORCH) {
      const opp = getOpposite(tile.direction);
      const vec = { N: {dx:0, dy:-1}, S: {dx:0, dy:1}, E: {dx:1, dy:0}, W: {dx:-1, dy:0} }[opp];
      const parent = grid[`${x + vec.dx},${y + vec.dy}`];
      active = !(parent && parent.power > 0);
      power = active ? 15 : 0;
    }
    else if (tile.type === TileType.REPEATER) {
      const bVec = { N: {dx:0, dy:1}, S: {dx:0, dy:-1}, E: {dx:-1, dy:0}, W: {dx:1, dy:0} }[tile.direction];
      const input = grid[`${x + bVec.dx},${y + bVec.dy}`];
      const inputOn = !!(input && input.power > 0);
      let cd = tile.tickCooldown || 0, pend = tile.pendingActive ?? tile.active, state = tile.active;
      if (inputOn !== pend) { pend = inputOn; cd = tile.delay || 1; }
      if (cd > 0) { cd--; if (cd === 0) state = pend; }
      active = state; power = active ? 15 : 0; extra = { tickCooldown: cd, pendingActive: pend };
    }

    nextGrid[key] = { ...tile, power, active, ...extra };
  });

  // PASS 2: Dust Propagation
  const powerMap: Record<string, number> = {};
  const queue: { k: string, p: number }[] = [];
  Object.keys(nextGrid).forEach(k => {
    if (nextGrid[k].power > 0 && nextGrid[k].type !== TileType.DUST) {
      powerMap[k] = nextGrid[k].power;
      queue.push({ k, p: nextGrid[k].power });
    }
  });

  let head = 0;
  while (head < queue.length) {
    const { k, p } = queue[head++];
    const [x, y] = k.split(',').map(Number);
    getNeighbors(x, y).forEach(n => {
      const nk = `${n.x},${n.y}`;
      if (nextGrid[nk]?.type === TileType.DUST) {
        const np = Math.max(0, p - 1);
        if (np > (powerMap[nk] || 0)) {
          powerMap[nk] = np;
          queue.push({ k: nk, p: np });
        }
      }
    });
  }

  // PASS 3: Consumers
  const finalGrid = { ...nextGrid };
  Object.keys(finalGrid).forEach(k => {
    const t = finalGrid[k];
    if (t.type === TileType.DUST) t.power = powerMap[k] || 0;
    if (t.type === TileType.LAMP) {
      const [x, y] = k.split(',').map(Number);
      t.active = getNeighbors(x, y).some(n => (powerMap[`${n.x},${n.y}`] || finalGrid[`${n.x},${n.y}`]?.power || 0) > 0);
    }
  });

  return finalGrid;
};

// --- SVG Sprite Component ---
const Sprite: React.FC<{ 
  type: TileType, 
  active?: boolean, 
  power?: number, 
  direction?: Direction, 
  inverted?: boolean, 
  value?: number 
}> = ({ type, active, power = 0, direction = 'N', inverted, value }) => {
  const rot = { N: 0, E: 90, S: 180, W: 270 }[direction] || 0;
  const glow = active || power > 0 ? 'redstone-glow' : '';
  const color = active || power > 0 ? '#ff4d4d' : '#4a0404';

  switch (type) {
    case TileType.DUST:
      return (
        <svg viewBox="0 0 40 40" className={`w-full h-full ${glow}`}>
          <path d="M18 18h4v4h-4zM10 19h20v2H10zM19 10h2v20h-2z" fill={color} />
        </svg>
      );
    case TileType.TORCH:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full" style={{ transform: `rotate(${rot}deg)` }}>
          <rect x="18" y="20" width="4" height="12" fill="#5c4033" />
          <rect x="16" y="10" width="8" height="10" fill={active ? '#ff4d4d' : '#3d0a0a'} className={active ? 'redstone-glow' : ''} />
        </svg>
      );
    case TileType.REPEATER:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full" style={{ transform: `rotate(${rot}deg)` }}>
          <rect x="4" y="4" width="32" height="32" fill="#7a7a7a" rx="2" />
          <rect x="12" y="10" width="4" height="6" fill={active ? '#ff4d4d' : '#3d0a0a'} />
          <rect x="24" y="10" width="4" height="6" fill={active ? '#ff4d4d' : '#3d0a0a'} />
          <path d="M18 28l4-8 4 8h-8z" fill="#444" />
        </svg>
      );
    case TileType.LEVER:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="10" y="28" width="20" height="4" fill="#555" />
          <rect x="18" y="10" width="4" height="20" fill="#333" style={{ transformOrigin: '20px 30px', transform: `rotate(${active ? 45 : -45}deg)` }} />
        </svg>
      );
    case TileType.COUNTER:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" fill="#1e293b" rx="4" />
          <text x="50%" y="26" textAnchor="middle" fill={power > 0 ? '#ff4d4d' : '#444'} fontSize="20" fontWeight="bold" className={power > 0 ? 'redstone-glow' : ''}>{value || 0}</text>
        </svg>
      );
    case TileType.LAMP:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" fill={active ? '#fff3ad' : '#2d2d2d'} rx="2" />
          <rect x="8" y="8" width="24" height="24" fill="none" stroke={active ? '#ffcc00' : '#444'} strokeWidth="2" />
        </svg>
      );
    case TileType.DAYLIGHT_SENSOR:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" fill={inverted ? '#1e3a8a' : '#3b82f6'} rx="2" />
          <rect x="12" y="12" width="16" height="16" fill={inverted ? '#a5b4fc' : '#fde047'} rx="8" />
          <text x="50%" y="85%" textAnchor="middle" fill="white" fontSize="8" fontFamily="monospace">{inverted ? 'NIGHT' : 'DAY'}</text>
        </svg>
      );
    case TileType.BLOCK:
      return <div className={`w-full h-full ${power > 0 ? 'bg-red-700' : 'bg-gray-600'} border border-gray-800 shadow-inner`} />;
    case TileType.REDSTONE_BLOCK:
      return <div className="w-full h-full bg-red-600 border-2 border-red-800 shadow-[inset_0_0_10px_rgba(0,0,0,0.5)] redstone-glow" />;
    default:
      return <div className="w-full h-full border border-white/5" />;
  }
};

const App: React.FC = () => {
  const [grid, setGrid] = useState<GridData>({});
  const [selectedType, setSelectedType] = useState<TileType>(TileType.DUST);
  const [direction, setDirection] = useState<Direction>('N');
  const [tool, setTool] = useState<ToolMode>('BUILD');
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({
    tntDestructive: true,
    simulationSpeed: 100,
    dayTime: 600
  });

  const getDynamicBackground = () => {
    const factor = Math.sin(Math.PI * settings.dayTime / 1200);
    return settings.dayTime < 1200 
      ? `rgb(${5 + 30 * factor}, ${5 + 50 * factor}, ${10 + 100 * factor})`
      : `rgb(${5}, ${5}, ${10})`;
  };

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setSettings(prev => ({ ...prev, dayTime: (prev.dayTime + 1) % 2400 }));
      setGrid(prev => updateRedstone(prev, { ...settings, dayTime: (settings.dayTime + 1) % 2400 }));
    }, settings.simulationSpeed);
    return () => clearInterval(interval);
  }, [isPaused, settings]);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const summary = Object.entries(grid)
      .map(([k, t]) => `${t.type} at ${k}`)
      .join(', ');
    
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Analyze this redstone circuit summary: ${summary || 'Empty lab'}`
      });
      setAiAnalysis(response.text || "No analysis available.");
    } catch (e) {
      setAiAnalysis("Analysis failed.");
    }
    setIsAnalyzing(false);
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-200" style={{ backgroundColor: getDynamicBackground() }}>
      {/* Sidebar */}
      <div className="w-80 bg-[#1a1a1a]/95 backdrop-blur-lg border-r border-slate-800 flex flex-col p-6 z-20 shadow-2xl overflow-y-auto custom-scroll">
        <h1 className="text-2xl font-bold mb-8 text-red-500 flex items-center gap-2">
          <div className="w-3 h-3 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_red]" />
          REDSTONE LAB
        </h1>

        <div className="space-y-8">
          <section>
            <h3 className="text-xs uppercase font-bold text-slate-500 mb-4 tracking-widest">Tools</h3>
            <div className="grid grid-cols-2 gap-2">
              {(['CURSOR', 'BUILD', 'DELETE', 'MOVE'] as ToolMode[]).map(m => (
                <button key={m} onClick={() => setTool(m)} className={`p-2 rounded font-bold text-[11px] uppercase border transition-all ${tool === m ? 'bg-red-600 border-red-400 text-white shadow-lg' : 'bg-slate-800/50 border-white/10 text-slate-400 hover:border-slate-500'}`}>
                  {m}
                </button>
              ))}
            </div>
          </section>

          {tool === 'BUILD' && (
            <section>
              <h3 className="text-xs uppercase font-bold text-slate-500 mb-4 tracking-widest">Components</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(TileType).filter(v => v !== TileType.AIR && v !== TileType.PISTON_HEAD).map(type => (
                  <button key={type} onClick={() => setSelectedType(type)} className={`p-2 rounded-lg border flex flex-col items-center gap-1 transition-all ${selectedType === type ? 'bg-red-950/40 border-red-500' : 'bg-white/5 border-transparent hover:border-white/10'}`}>
                    <div className="w-8 h-8"><Sprite type={type} active={true} direction="N" /></div>
                    <span className="text-[9px] uppercase font-bold truncate w-full text-center mt-1 opacity-70">{type.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="bg-black/40 p-4 rounded-xl border border-white/10">
             <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-3">
                <span>{settings.dayTime < 1200 ? '☀️ Day' : '🌙 Night'}</span>
                <span>{Math.floor(settings.dayTime / 100)}:00</span>
             </div>
             <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                <div className="h-full bg-red-500" style={{ width: `${(settings.dayTime / 2400) * 100}%` }} />
             </div>
          </section>

          <section className="space-y-2">
            <button onClick={() => setIsPaused(!isPaused)} className="w-full py-2 bg-white/5 border border-white/10 hover:bg-white/10 rounded font-bold text-xs uppercase">
              {isPaused ? '▶ Resume' : '⏸ Pause'}
            </button>
            <button onClick={handleAnalyze} disabled={isAnalyzing} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 rounded font-bold text-xs uppercase shadow-lg disabled:opacity-50">
              {isAnalyzing ? 'Analyzing...' : 'AI Logic Analysis'}
            </button>
          </section>

          {aiAnalysis && (
            <div className="text-[11px] p-3 bg-indigo-950/30 border border-indigo-500/30 rounded text-indigo-200 leading-relaxed italic">
              "{aiAnalysis}"
            </div>
          )}
        </div>
      </div>

      {/* Grid Area */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center p-20 custom-scroll">
        <div className="grid-bg shadow-2xl relative" style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`, width: GRID_SIZE * TILE_SIZE, height: GRID_SIZE * TILE_SIZE }}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE, y = Math.floor(i / GRID_SIZE), k = `${x},${y}`, tile = grid[k];
            return (
              <div 
                key={k}
                onMouseDown={() => {
                  setIsMouseDown(true);
                  if (tool === 'BUILD') setGrid(g => ({ ...g, [k]: { type: selectedType, power: 0, direction, active: selectedType === TileType.TORCH, internalCounter: 0, isInverted: false } }));
                  else if (tool === 'DELETE') setGrid(g => { const n = { ...g }; delete n[k]; return n; });
                  else if (tool === 'CURSOR' && tile?.type === TileType.LEVER) setGrid(g => ({ ...g, [k]: { ...tile, active: !tile.active } }));
                  else if (tool === 'CURSOR' && tile?.type === TileType.DAYLIGHT_SENSOR) setGrid(g => ({ ...g, [k]: { ...tile, isInverted: !tile.isInverted } }));
                  else if (tool === 'MOVE' && grid[k]) setDraggedKey(k);
                }}
                onMouseEnter={() => {
                  setHoveredTile(k);
                  if (isMouseDown) {
                    if (tool === 'BUILD') setGrid(g => ({ ...g, [k]: { type: selectedType, power: 0, direction, active: selectedType === TileType.TORCH, internalCounter: 0, isInverted: false } }));
                    else if (tool === 'DELETE') setGrid(g => { const n = { ...g }; delete n[k]; return n; });
                  }
                }}
                onMouseUp={() => {
                  if (tool === 'MOVE' && draggedKey && draggedKey !== k) {
                    setGrid(g => { const n = { ...g }; n[k] = n[draggedKey]; delete n[draggedKey]; return n; });
                  }
                  setDraggedKey(null); setIsMouseDown(false);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (tile) {
                    const d = { N: 'E', E: 'S', S: 'W', W: 'N' }[tile.direction] as Direction;
                    setGrid(g => ({ ...g, [k]: { ...tile, direction: d } }));
                  } else {
                    setDirection(d => ({ N: 'E', E: 'S', S: 'W', W: 'N' }[d] as Direction));
                  }
                }}
                className={`border border-white/5 flex items-center justify-center relative ${hoveredTile === k && tool === 'MOVE' && draggedKey ? 'bg-white/10 scale-105 z-10' : ''} ${draggedKey === k ? 'opacity-20' : ''}`}
                style={{ width: TILE_SIZE, height: TILE_SIZE }}
              >
                {tile && <Sprite type={tile.type} active={tile.active} power={tile.power} direction={tile.direction} inverted={tile.isInverted} value={tile.internalCounter} />}
                {hoveredTile === k && tool === 'BUILD' && !tile && <div className="opacity-20 scale-75 pointer-events-none"><Sprite type={selectedType} direction={direction} /></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default App;