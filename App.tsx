import React, { useState, useEffect, useRef } from 'react';
import { GridData, TileType, Direction, TileState, AppSettings } from './types';
import { updateRedstone, getNeighbors } from './services/redstoneEngine';
import { TICK_RATE, COLORS, TILE_SIZE, GRID_SIZE } from './constants';

type ToolMode = 'CURSOR' | 'BUILD' | 'DELETE' | 'MOVE';

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
  const glowClass = active || power > 0 ? 'redstone-glow' : '';
  const color = active || power > 0 ? '#ff4d4d' : '#4a0404';

  const style = { transform: `rotate(${rot}deg)` };

  switch (type) {
    case TileType.DUST:
      return (
        <svg viewBox="0 0 40 40" className={`w-full h-full ${glowClass}`}>
          <path d="M18 18h4v4h-4zM10 19h20v2H10zM19 10h2v20h-2z" fill={color} />
        </svg>
      );
    case TileType.TORCH:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full" style={style}>
          <rect x="18" y="20" width="4" height="12" fill="#5c4033" />
          <rect x="16" y="10" width="8" height="10" fill={active ? '#ff4d4d' : '#3d0a0a'} className={active ? 'redstone-glow' : ''} />
        </svg>
      );
    case TileType.REPEATER:
    case TileType.COMPARATOR:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full" style={style}>
          <rect x="4" y="4" width="32" height="32" fill="#7a7a7a" rx="2" />
          <rect x="12" y="10" width="4" height="6" fill={active ? '#ff4d4d' : '#3d0a0a'} />
          <rect x="24" y="10" width="4" height="6" fill={active ? '#ff4d4d' : '#3d0a0a'} />
          {type === TileType.COMPARATOR && <rect x="18" y="10" width="4" height="6" fill={active ? '#ffaaaa' : '#550000'} />}
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
    case TileType.BUTTON:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="14" y="14" width="12" height="12" fill="#444" rx="1" />
          <rect x="16" y="16" width="8" height="8" fill={active ? '#888' : '#222'} />
        </svg>
      );
    case TileType.LAMP:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" fill={active ? '#fff3ad' : '#2d2d2d'} rx="2" />
          <rect x="8" y="8" width="24" height="24" fill="none" stroke={active ? '#ffcc00' : '#444'} strokeWidth="2" />
        </svg>
      );
    case TileType.PISTON:
    case TileType.STICKY_PISTON:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full" style={style}>
          <rect x="4" y="14" width="32" height="22" fill="#555" />
          <rect x="4" y="4" width="32" height="10" fill={type === TileType.STICKY_PISTON ? '#4ade80' : '#b45309'} />
        </svg>
      );
    case TileType.PISTON_HEAD:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full" style={style}>
          <rect x="4" y="4" width="32" height="6" fill="#b45309" />
          <rect x="18" y="10" width="4" height="26" fill="#555" />
        </svg>
      );
    case TileType.OBSERVER:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full" style={style}>
          <rect x="4" y="4" width="32" height="32" fill="#333" rx="2" />
          <rect x="10" y="8" width="20" height="4" fill="#111" />
          <rect x="18" y="28" width="4" height="4" fill={active ? '#ff0000' : '#400000'} />
        </svg>
      );
    case TileType.TNT:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" fill={active ? '#fff' : '#ef4444'} rx="1" />
          <rect x="4" y="15" width="32" height="10" fill="white" />
          <text x="50%" y="22" textAnchor="middle" fill="black" fontSize="8" fontWeight="bold">TNT</text>
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
    case TileType.COUNTER:
      return (
        <svg viewBox="0 0 40 40" className="w-full h-full">
          <rect x="4" y="4" width="32" height="32" fill="#1e293b" rx="4" />
          <text x="50%" y="26" textAnchor="middle" fill={power > 0 ? '#ff4d4d' : '#444'} fontSize="20" fontWeight="bold" className={power > 0 ? 'redstone-glow' : ''}>{value || 0}</text>
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

const playNote = (pitch: number) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    const freq = 185 * Math.pow(2, (pitch || 0) / 12);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
  } catch (e) {}
};

const playClick = (isOn: boolean) => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const audioCtx = new AudioCtx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isOn ? 1200 : 800, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.05, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.1);
  } catch (e) {}
};

const App: React.FC = () => {
  const [grid, setGrid] = useState<GridData>({});
  const [selectedType, setSelectedType] = useState<TileType>(TileType.DUST);
  const [direction, setDirection] = useState<Direction>('N');
  const [isPaused, setIsPaused] = useState(false);
  const [hoveredTile, setHoveredTile] = useState<string | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [blueprintInput, setBlueprintInput] = useState('');
  const [tool, setTool] = useState<ToolMode>('BUILD');
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  const [settings, setSettings] = useState<AppSettings>({
    tntDestructive: true,
    backgroundColor: '#0a0a0a',
    showGrid: true,
    simulationSpeed: 100,
    dayTime: 600
  });

  const lastNoteBlockSignals = useRef<Record<string, boolean>>({});

  const getRotatedDirection = (dir: Direction): Direction => {
    const sequence: Direction[] = ['N', 'E', 'S', 'W'];
    return sequence[(sequence.indexOf(dir) + 1) % 4];
  };

  const getDynamicBackground = () => {
    const time = settings.dayTime;
    let r, g, b;
    if (time < 1200) {
      const factor = Math.sin(Math.PI * time / 1200);
      r = 5 + Math.floor(40 * factor);
      g = 5 + Math.floor(60 * factor);
      b = 10 + Math.floor(120 * factor);
    } else {
      const factor = Math.sin(Math.PI * (time - 1200) / 1200);
      r = 5 + Math.floor(5 * factor);
      g = 5 + Math.floor(10 * factor);
      b = 10 + Math.floor(30 * factor);
    }
    return `rgb(${r}, ${g}, ${b})`;
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;
      if (e.key === '1') setTool('CURSOR');
      if (e.key === '2') setTool('BUILD');
      if (e.key === '3') setTool('DELETE');
      if (e.key === '4') setTool('MOVE');
      if (e.key === 'Escape') setShowSettings(false);
    };
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
      setDraggedKey(null);
    };
    const handleMouseMoveGlobal = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('mousemove', handleMouseMoveGlobal);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('mousemove', handleMouseMoveGlobal);
    };
  }, []);

  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => {
      setSettings(prev => ({ ...prev, dayTime: (prev.dayTime + 1) % 2400 }));
      setGrid(prev => {
        const next = updateRedstone(prev, { ...settings, dayTime: (settings.dayTime + 1) % 2400 });
        Object.keys(next).forEach(key => {
          const tile = next[key];
          if (tile.type === TileType.NOTE_BLOCK) {
            const [x, y] = key.split(',').map(Number);
            const isPowered = getNeighbors(x, y).some(n => (next[`${n.x},${n.y}`]?.power || 0) > 0);
            if (isPowered && !lastNoteBlockSignals.current[key]) playNote(tile.pitch || 0);
            lastNoteBlockSignals.current[key] = isPowered;
          }
        });
        return next;
      });
    }, settings.simulationSpeed);
    return () => clearInterval(interval);
  }, [isPaused, settings]);

  const placeTile = (x: number, y: number) => {
    const key = `${x},${y}`;
    setGrid(prev => ({
      ...prev,
      [key]: {
        type: selectedType,
        power: 0,
        direction,
        active: selectedType === TileType.TORCH,
        pitch: selectedType === TileType.NOTE_BLOCK ? 0 : undefined,
        delay: selectedType === TileType.REPEATER ? 1 : undefined,
        isInverted: false,
        internalCounter: selectedType === TileType.COUNTER ? 1 : undefined,
        comparatorMode: selectedType === TileType.COMPARATOR ? 'COMPARE' : undefined,
      } as TileState
    }));
  };

  const deleteTile = (x: number, y: number) => {
    setGrid(prev => {
      const next = { ...prev };
      delete next[`${x},${y}`];
      return next;
    });
  };

  const interactTile = (x: number, y: number) => {
    const key = `${x},${y}`;
    const tile = grid[key];
    if (!tile) return;
    if (tile.type === TileType.LEVER) {
      playClick(!tile.active);
      setGrid(prev => ({ ...prev, [key]: { ...tile, active: !tile.active } }));
    } else if (tile.type === TileType.BUTTON && !tile.active) {
      playClick(true);
      setGrid(prev => ({ ...prev, [key]: { ...tile, active: true } }));
      setTimeout(() => setGrid(prev => prev[key] ? { ...prev, [key]: { ...prev[key], active: false } } : prev), 1000);
    } else if (tile.type === TileType.DAYLIGHT_SENSOR) {
      playClick(true);
      setGrid(prev => ({ ...prev, [key]: { ...tile, isInverted: !tile.isInverted } }));
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-200 transition-colors duration-1000" style={{ backgroundColor: getDynamicBackground() }}>
      {/* Sidebar */}
      <div className="w-80 bg-[#1a1a1a]/90 backdrop-blur-md border-r border-slate-800 flex flex-col p-4 z-20 shadow-2xl overflow-y-auto custom-scroll">
        <h1 className="text-2xl font-bold mb-6 text-red-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_red]" />
            REDSTONE LAB
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="text-slate-500 hover:text-slate-300">⚙️</button>
        </h1>

        <div className="space-y-6">
          <section>
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3 flex justify-between">
              <span>Tools</span>
              <span className="text-[9px] text-slate-600">[1-4]</span>
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {(['CURSOR', 'BUILD', 'DELETE', 'MOVE'] as ToolMode[]).map((m, idx) => (
                <button key={m} onClick={() => setTool(m)} className={`p-2 rounded font-bold text-[10px] uppercase border-2 transition-all ${tool === m ? 'bg-red-600 border-red-400 text-white shadow-lg' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>
                  {m}
                </button>
              ))}
            </div>
          </section>

          {tool === 'BUILD' && (
            <section>
              <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3">Components</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.values(TileType).filter(v => v !== TileType.AIR && v !== TileType.PISTON_HEAD).map(type => (
                  <button key={type} onClick={() => setSelectedType(type)} className={`p-1.5 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${selectedType === type ? 'bg-red-950/50 border-red-600' : 'bg-[#242424] border-transparent hover:border-slate-600'}`}>
                    <div className="w-8 h-8"><Sprite type={type} active={true} direction="N" /></div>
                    <span className="text-[8px] uppercase font-bold truncate w-full text-center leading-none mt-1">{type.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="bg-black/40 p-3 rounded-lg border border-slate-800">
             <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-2">
                <span>{settings.dayTime < 1200 ? '☀️ Day' : '🌙 Night'}</span>
                <span className="text-slate-500">{Math.floor(settings.dayTime / 100)}:00</span>
             </div>
             <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-red-500 transition-all duration-300" style={{ width: `${(settings.dayTime / 2400) * 100}%` }} />
             </div>
          </section>

          <section className="pt-4 border-t border-slate-800">
             <button onClick={() => setIsPaused(!isPaused)} className={`w-full py-2 rounded font-bold text-xs uppercase ${isPaused ? 'bg-green-700 hover:bg-green-600' : 'bg-amber-700 hover:bg-amber-600'}`}>
               {isPaused ? '▶ Resume' : '⏸ Pause'}
             </button>
          </section>
        </div>
      </div>

      {/* Grid Area */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center p-20 custom-scroll">
        <div className="grid-bg shadow-2xl relative" style={{ display: 'grid', gridTemplateColumns: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`, width: GRID_SIZE * TILE_SIZE, height: GRID_SIZE * TILE_SIZE }}>
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            const key = `${x},${y}`;
            const tile = grid[key];
            const isDragged = draggedKey === key;
            const isTarget = hoveredTile === key && draggedKey;

            return (
              <div 
                key={key}
                onMouseDown={(e) => {
                  if (e.button !== 0) return;
                  setIsMouseDown(true);
                  if (tool === 'BUILD') placeTile(x, y);
                  else if (tool === 'DELETE') deleteTile(x, y);
                  else if (tool === 'CURSOR') interactTile(x, y);
                  else if (tool === 'MOVE' && grid[key]) setDraggedKey(key);
                }}
                onMouseEnter={() => {
                  setHoveredTile(key);
                  if (isMouseDown) {
                    if (tool === 'BUILD') placeTile(x, y);
                    else if (tool === 'DELETE') deleteTile(x, y);
                  }
                }}
                onMouseUp={() => {
                  if (tool === 'MOVE' && draggedKey && draggedKey !== key) {
                    setGrid(prev => {
                      const next = { ...prev };
                      next[key] = next[draggedKey];
                      delete next[draggedKey];
                      return next;
                    });
                    playClick(true);
                  }
                  setDraggedKey(null);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  if (tile) {
                    const nextDir = getRotatedDirection(tile.direction);
                    setGrid(prev => ({ ...prev, [key]: { ...tile, direction: nextDir } }));
                  } else {
                    setDirection(prev => getRotatedDirection(prev));
                  }
                }}
                className={`border border-white/5 flex items-center justify-center relative transition-all ${isTarget ? 'bg-white/10 scale-105 z-10' : ''} ${isDragged ? 'opacity-20' : ''}`}
                style={{ width: TILE_SIZE, height: TILE_SIZE }}
              >
                {tile && <Sprite type={tile.type} active={tile.active} power={tile.power} direction={tile.direction} inverted={tile.isInverted} value={tile.internalCounter} />}
                {hoveredTile === key && tool === 'BUILD' && !tile && <div className="opacity-30 pointer-events-none scale-75"><Sprite type={selectedType} direction={direction} /></div>}
                {tile?.type === TileType.DUST && tile.power > 0 && <span className="absolute bottom-0 right-0 text-[8px] opacity-70 bg-black/40 px-0.5">{tile.power}</span>}
              </div>
            );
          })}
        </div>

        {/* HUD */}
        <div className="fixed bottom-6 right-6 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 text-[10px] text-slate-400 flex gap-4 uppercase font-bold tracking-widest shadow-lg z-30">
          <div className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`} />{isPaused ? 'Paused' : 'Running'}</div>
          <div className="border-l border-slate-800 pl-4">Tool: {tool}</div>
          <div className="border-l border-slate-800 pl-4">Tick: {settings.dayTime}</div>
        </div>

        {/* Inspector Tooltip */}
        {hoveredTile && grid[hoveredTile] && (
          <div className="fixed pointer-events-none z-50 bg-black/90 border border-red-900 rounded p-2 text-[10px] shadow-xl" style={{ left: mousePos.x + 15, top: mousePos.y + 15 }}>
            <div className="text-red-500 font-bold uppercase mb-1">{grid[hoveredTile].type.replace('_', ' ')}</div>
            <div>Power: {grid[hoveredTile].power}</div>
            <div>Dir: {grid[hoveredTile].direction}</div>
            {grid[hoveredTile].type === TileType.COUNTER && <div>Value: {grid[hoveredTile].internalCounter}</div>}
          </div>
        )}
      </div>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-[#1a1a1a] border-2 border-slate-700 w-80 rounded-xl p-6 shadow-2xl">
            <h2 className="text-xl font-bold text-red-500 mb-6 uppercase tracking-wider">Settings</h2>
            <div className="space-y-4">
               <label className="block">
                 <span className="text-xs font-bold text-slate-500 uppercase">Simulation Speed ({settings.simulationSpeed}ms)</span>
                 <input type="range" min="50" max="500" value={settings.simulationSpeed} onChange={(e) => setSettings(s => ({...s, simulationSpeed: parseInt(e.target.value)}))} className="w-full accent-red-600 mt-2" />
               </label>
               <button onClick={() => setShowSettings(false)} className="w-full py-2 bg-red-600 text-white font-bold rounded uppercase tracking-widest text-xs mt-4">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;