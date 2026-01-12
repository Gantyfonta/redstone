
import React, { useState, useEffect, useRef } from 'react';
import { GridData, TileType, Direction, TileState, AppSettings } from './types';
import { updateRedstone, getNeighbors } from './services/redstoneEngine';
import { TICK_RATE, COLORS, ICONS, TILE_SIZE, GRID_SIZE } from './constants';

type ToolMode = 'CURSOR' | 'BUILD' | 'DELETE' | 'MOVE';

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
    dayTime: 600 // Start at peak day
  });

  const lastNoteBlockSignals = useRef<Record<string, boolean>>({});

  const getRotatedDirection = (dir: Direction): Direction => {
    const sequence: Direction[] = ['N', 'E', 'S', 'W'];
    const currentIndex = sequence.indexOf(dir);
    return sequence[(currentIndex + 1) % 4];
  };

  const handleRotateGlobal = () => {
    setDirection(prev => getRotatedDirection(prev));
  };

  // Interpolate between day and night colors based on dayTime (0-2400)
  const getDynamicBackground = () => {
    const time = settings.dayTime;
    let r, g, b;
    if (time < 1200) { // Day transition
      const factor = Math.sin(Math.PI * time / 1200);
      r = 10 + Math.floor(60 * factor);
      g = 10 + Math.floor(100 * factor);
      b = 10 + Math.floor(160 * factor);
    } else { // Night transition
      const factor = Math.sin(Math.PI * (time - 1200) / 1200);
      r = 10 + Math.floor(10 * factor);
      g = 10 + Math.floor(20 * factor);
      b = 10 + Math.floor(50 * factor);
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
    const handleGlobalMouseUp = () => setIsMouseDown(false);
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
      setSettings(prev => ({
        ...prev,
        dayTime: (prev.dayTime + 1) % 2400
      }));

      setGrid(prev => {
        const next = updateRedstone(prev, {
            ...settings,
            dayTime: (settings.dayTime + 1) % 2400
        });
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
    const existing = grid[key];
    
    if (existing && existing.type === TileType.DISPENSER && selectedType !== TileType.DISPENSER) {
      setGrid(prev => ({
        ...prev,
        [key]: { ...existing, contents: selectedType }
      }));
      playClick(true);
      return;
    }

    setGrid(prev => ({
      ...prev,
      [key]: {
        type: selectedType,
        power: 0,
        direction,
        active: selectedType === TileType.TORCH ? true : false,
        pitch: selectedType === TileType.NOTE_BLOCK ? 0 : undefined,
        delay: selectedType === TileType.REPEATER ? 1 : undefined,
        isSource: selectedType === TileType.WATER || selectedType === TileType.LAVA,
        level: (selectedType === TileType.WATER || selectedType === TileType.LAVA) ? 7 : undefined,
        comparatorMode: selectedType === TileType.COMPARATOR ? 'COMPARE' : undefined,
        contents: selectedType === TileType.DISPENSER ? TileType.AIR : undefined,
        channel: (selectedType === TileType.ANTENNA || selectedType === TileType.RECEIVER) ? 0 : undefined,
        isInverted: false,
        internalCounter: selectedType === TileType.COUNTER ? 1 : undefined
      }
    }));
  };

  const deleteTile = (x: number, y: number) => {
    const key = `${x},${y}`;
    const existing = grid[key];
    if (!existing) return;
    setGrid(prev => {
      const next = { ...prev };
      delete next[key];
      if (existing.active && (existing.type === TileType.PISTON || existing.type === TileType.STICKY_PISTON)) {
        const { dx, dy } = { 'N': { dx: 0, dy: -1 }, 'S': { dx: 0, dy: 1 }, 'W': { dx: -1, dy: 0 }, 'E': { dx: 1, dy: 0 } }[existing.direction];
        delete next[`${x + dx},${y + dy}`];
      }
      return next;
    });
  };

  const interactTile = (x: number, y: number) => {
    const key = `${x},${y}`;
    const existing = grid[key];
    if (!existing) return;
    
    if (existing.type === TileType.LEVER) {
      playClick(!existing.active);
      setGrid(prev => ({ ...prev, [key]: { ...existing, active: !existing.active } }));
    } else if (existing.type === TileType.BUTTON) {
      if (existing.active) return;
      playClick(true);
      setGrid(prev => ({ ...prev, [key]: { ...existing, active: true } }));
      setTimeout(() => {
        setGrid(prev => {
          if (prev[key] && prev[key].type === TileType.BUTTON) {
            playClick(false);
            return { ...prev, [key]: { ...prev[key], active: false } };
          }
          return prev;
        });
      }, 1500);
    } else if (existing.type === TileType.DAYLIGHT_SENSOR) {
        playClick(true);
        setGrid(prev => ({ ...prev, [key]: { ...existing, isInverted: !existing.isInverted } }));
    } else if (existing.type === TileType.TARGET || existing.type === TileType.SCULK_SENSOR) {
      playClick(true);
      setGrid(prev => ({ ...prev, [key]: { ...existing, active: true, tickCooldown: 8 } }));
    } else if (existing.type === TileType.COMPARATOR) {
      const nextMode = existing.comparatorMode === 'COMPARE' ? 'SUBTRACT' : 'COMPARE';
      playClick(true);
      setGrid(prev => ({ ...prev, [key]: { ...existing, comparatorMode: nextMode } }));
    } else if (existing.type === TileType.NOTE_BLOCK) {
      const newPitch = ((existing.pitch || 0) + 1) % 25;
      playNote(newPitch);
      setGrid(prev => ({ ...prev, [key]: { ...existing, pitch: newPitch } }));
    } else if (existing.type === TileType.ANTENNA || existing.type === TileType.RECEIVER) {
        const newChannel = ((existing.channel || 0) + 1) % 10;
        playClick(true);
        setGrid(prev => ({ ...prev, [key]: { ...existing, channel: newChannel } }));
    }
  };

  const handleTileMouseDown = (e: React.MouseEvent, x: number, y: number) => {
    if (e.button === 0) setIsMouseDown(true);
    const key = `${x},${y}`;
    
    if (tool === 'CURSOR' && e.button === 0) {
      interactTile(x, y);
    }
    else if (tool === 'BUILD' && e.button === 0) placeTile(x, y);
    else if (tool === 'DELETE' && e.button === 0) deleteTile(x, y);
    else if (tool === 'MOVE' && grid[key] && e.button === 0) setDraggedKey(key);
  };

  const handleTileMouseEnter = (x: number, y: number) => {
    const key = `${x},${y}`;
    setHoveredTile(key);

    if (tool === 'CURSOR') {
        setGrid(prev => {
            const tile = prev[key];
            if (tile && tile.type === TileType.PRESSURE_PLATE && !tile.active) {
                playClick(true);
                return { ...prev, [key]: { ...tile, active: true } };
            }
            return prev;
        });
    }

    if (isMouseDown) {
      if (tool === 'BUILD') placeTile(x, y);
      else if (tool === 'DELETE') deleteTile(x, y);
    }
  };

  const handleTileMouseLeave = (x: number, y: number) => {
    const key = `${x},${y}`;
    setHoveredTile(null);

    setGrid(prev => {
        const tile = prev[key];
        if (tile && tile.type === TileType.PRESSURE_PLATE && tile.active) {
            playClick(false);
            return { ...prev, [key]: { ...tile, active: false } };
        }
        return prev;
    });
  };

  const handleTileMouseUp = (targetKey: string) => {
    if (tool === 'MOVE' && draggedKey && draggedKey !== targetKey) {
      const tileToMove = grid[draggedKey];
      if (tileToMove) {
        setGrid(prev => {
          const next = { ...prev };
          delete next[draggedKey];
          if (tileToMove.active && (tileToMove.type === TileType.PISTON || tileToMove.type === TileType.STICKY_PISTON)) {
             const [ox, oy] = draggedKey.split(',').map(Number);
             const { dx, dy } = { 'N': { dx: 0, dy: -1 }, 'S': { dx: 0, dy: 1 }, 'W': { dx: -1, dy: 0 }, 'E': { dx: 1, dy: 0 } }[tileToMove.direction];
             delete next[`${ox+dx},${oy+dy}`];
             tileToMove.active = false; 
          }
          next[targetKey] = { ...tileToMove };
          return next;
        });
      }
    }
    setDraggedKey(null);
    setIsMouseDown(false);
  };

  const handleTileRightClick = (e: React.MouseEvent, x: number, y: number) => {
    e.preventDefault();
    const key = `${x},${y}`;
    const tile = grid[key];
    if (tool === 'CURSOR') {
      if (tile && tile.type === TileType.DAYLIGHT_SENSOR) {
          interactTile(x, y);
          return;
      }
      if (tile && tile.type === TileType.REPEATER) {
        const newDelay = ((tile.delay || 1) % 4) + 1;
        playClick(true);
        setGrid(prev => ({ ...prev, [key]: { ...tile, delay: newDelay } }));
        return;
      }
      if (tile && (tile.type === TileType.ANTENNA || tile.type === TileType.RECEIVER)) {
        const newChannel = ((tile.channel || 0) + 1) % 10;
        playClick(true);
        setGrid(prev => ({ ...prev, [key]: { ...tile, channel: newChannel } }));
        return;
      }
      if (tile) {
        setGrid(prev => ({ ...prev, [key]: { ...tile, direction: getRotatedDirection(tile.direction) } }));
      }
    } else if (tool === 'BUILD') {
      if (tile) {
        setGrid(prev => ({ ...prev, [key]: { ...tile, direction: getRotatedDirection(tile.direction) } }));
      } else {
        handleRotateGlobal();
      }
    }
  };

  const handleExportBlueprint = () => {
    try {
      const data = JSON.stringify(grid);
      const encoded = btoa(data);
      setBlueprintInput(encoded);
      navigator.clipboard.writeText(encoded);
    } catch (e) {
      console.error("Export failed", e);
    }
  };

  const handleImportBlueprint = () => {
    if (!blueprintInput) return;
    try {
      const decoded = atob(blueprintInput);
      const parsed = JSON.parse(decoded);
      setGrid(parsed);
    } catch (e) {
      console.error("Import failed", e);
    }
  };

  const getTileDescription = (tile: TileState): React.ReactNode => {
    const typeName = tile.type.replace('_', ' ');
    const parts: string[] = [];
    parts.push(`Power: ${tile.power}`);
    
    switch (tile.type) {
      case TileType.REPEATER: parts.push(`Delay: ${tile.delay} tick(s)`); break;
      case TileType.NOTE_BLOCK: parts.push(`Pitch: ${tile.pitch}`); break;
      case TileType.COMPARATOR: parts.push(`Mode: ${tile.comparatorMode}`); break;
      case TileType.DISPENSER: parts.push(`Contents: ${tile.contents || 'Empty'}`); break;
      case TileType.WATER:
      case TileType.LAVA: parts.push(`Level: ${tile.level}`); break;
      case TileType.OBSIDIAN: parts.push(`Immovable, Blast Resistant`); break;
      case TileType.TNT: parts.push(tile.active ? `Ignited!` : `Armed`); break;
      case TileType.DAYLIGHT_SENSOR: 
          parts.push(tile.isInverted ? `Night Mode` : `Day Mode`); 
          parts.push(`Right-click to toggle`);
          break;
      case TileType.COUNTER:
          parts.push(`Cycle: 1 to 15`);
          parts.push(`Value: ${tile.internalCounter}`);
          break;
      case TileType.PRESSURE_PLATE: parts.push(`Hover to activate`); break;
      case TileType.SCULK_SENSOR: parts.push(`Vibration detection`); break;
      case TileType.ANTENNA:
          parts.push(`Channel: ${tile.channel ?? 0}`);
          parts.push(`Transmits signal wirelessly`);
          break;
      case TileType.RECEIVER: 
          parts.push(`Channel: ${tile.channel ?? 0}`);
          parts.push(`Outputs signal if antenna active`);
          break;
      case TileType.TORCH: 
          const attachedSide = {'N':'South', 'S':'North', 'W':'East', 'E':'West'}[tile.direction];
          parts.push(`Attached to ${attachedSide} block`);
          parts.push(tile.active ? `Active (Powering up)` : `Inactive (Input on)`); 
          break;
      case TileType.LEVER:
      case TileType.BUTTON:
      case TileType.LAMP:
      case TileType.PISTON:
      case TileType.STICKY_PISTON: parts.push(tile.active ? `Active` : `Inactive`); break;
    }

    return (
      <div className="flex flex-col gap-1 p-2 text-[11px] leading-tight">
        <div className="font-black text-red-500 uppercase tracking-wider text-xs border-b border-red-900 pb-1 mb-1">
          {typeName}
        </div>
        {parts.map((p, i) => (
          <div key={i} className="text-slate-300 flex justify-between gap-4">
            <span className="opacity-60">{p.includes(':') ? p.split(':')[0] : p}:</span>
            <span className="font-bold text-white">{p.includes(':') ? p.split(':')[1] : ''}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderGrid = () => {
    const cells = [];
    for (let y = 0; y < GRID_SIZE; y++) {
      for (let x = 0; x < GRID_SIZE; x++) {
        const key = `${x},${y}`;
        const tile = grid[key];
        let bgColor = 'transparent';
        let content = null;

        if (tile) {
          const rotationClass = { 'N': 'rotate-0', 'E': 'rotate-90', 'S': 'rotate-180', 'W': '-rotate-90' }[tile.direction];
          switch (tile.type) {
            case TileType.DUST: bgColor = tile.power > 0 ? COLORS.REDSTONE_ON : COLORS.REDSTONE_OFF; break;
            case TileType.BLOCK: bgColor = tile.power > 0 ? '#b91c1c' : COLORS.BLOCK; break;
            case TileType.REDSTONE_BLOCK: bgColor = '#dc2626'; break;
            case TileType.TNT: bgColor = tile.active ? (Math.floor(Date.now() / 100) % 2 === 0 ? '#ffffff' : '#ef4444') : COLORS.TNT; break;
            case TileType.GLASS: bgColor = COLORS.GLASS; break;
            case TileType.SLIME: bgColor = COLORS.SLIME; break;
            case TileType.LAMP: bgColor = tile.active ? COLORS.LAMP_ON : COLORS.LAMP_OFF; break;
            case TileType.TARGET: bgColor = COLORS.TARGET; content = <div className="w-4 h-4 rounded-full border-2 border-red-600 flex items-center justify-center"><div className="w-1 h-1 bg-red-600 rounded-full" /></div>; break;
            case TileType.OBSIDIAN: bgColor = COLORS.OBSIDIAN; break;
            case TileType.DAYLIGHT_SENSOR: 
                bgColor = tile.isInverted ? COLORS.DAYLIGHT_NIGHT : COLORS.DAYLIGHT; 
                content = (
                    <div className="w-4 h-4 rounded border border-white/20 flex items-center justify-center relative">
                        <div className={`w-2 h-2 ${tile.isInverted ? 'bg-indigo-300' : 'bg-yellow-400'} rounded-full`} />
                        <span className="absolute -top-1 -right-1 text-[6px]">{tile.isInverted ? '🌙' : '☀️'}</span>
                    </div>
                ); break;
            case TileType.COUNTER:
                bgColor = COLORS.COUNTER;
                content = (
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-[12px] font-bold text-white">{tile.internalCounter}</span>
                        <div className="w-4 h-0.5 bg-red-500 opacity-50" />
                    </div>
                ); break;
            case TileType.SCULK_SENSOR: bgColor = COLORS.SCULK; content = <div className="w-1 h-4 bg-teal-400 rounded-full animate-pulse" />; break;
            case TileType.PRESSURE_PLATE: content = <div className={`w-6 h-2 bg-stone-500 rounded-sm transition-transform ${tile.active ? 'scale-y-50 translate-y-1' : ''}`} />; break;
            case TileType.ANTENNA: 
                bgColor = tile.active ? '#4338ca' : '#1e1b4b';
                content = (
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-base">📡</span>
                        <span className="text-[10px] font-bold text-white/50">{tile.channel ?? 0}</span>
                    </div>
                ); break;
            case TileType.RECEIVER: 
                bgColor = tile.active ? '#be185d' : '#500724';
                content = (
                    <div className="flex flex-col items-center justify-center">
                        <span className="text-base">📟</span>
                        <span className="text-[10px] font-bold text-white/50">{tile.channel ?? 0}</span>
                    </div>
                ); break;
            case TileType.DISPENSER: bgColor = COLORS.DISPENSER; content = (
              <div className={`w-full h-full flex items-center justify-center relative ${rotationClass}`}>
                 <div className="w-4 h-4 rounded-full border-2 border-stone-800 bg-stone-900 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 bg-stone-700 rounded-full" />
                 </div>
                 {tile.contents && tile.contents !== TileType.AIR && (
                   <div className="absolute top-1 right-1 text-[6px] opacity-80 pointer-events-none">📦</div>
                 )}
              </div>
            ); break;
            case TileType.TORCH: 
              content = (
                <div className={`flex flex-col items-center ${rotationClass} transition-opacity ${tile.active ? 'opacity-100' : 'opacity-40'}`}>
                    <div className={`w-2 h-4 rounded-t ${tile.active ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]' : 'bg-red-950'}`} />
                    <div className="w-1 h-3 bg-amber-900" />
                </div>
              ); break;
            case TileType.LEVER: content = (
              <div className="relative w-full h-full flex items-center justify-center">
                <div className="w-6 h-2 bg-stone-500 rounded-sm absolute" />
                <div className={`w-1 h-6 bg-stone-800 rounded-full transition-transform ${tile.active ? 'rotate-45' : '-rotate-45'}`} />
              </div>
            ); break;
            case TileType.BUTTON: content = (
              <div className="w-full h-full flex items-center justify-center">
                <div className={`w-3 h-3 bg-stone-600 border border-stone-800 rounded-sm shadow-sm transition-transform ${tile.active ? 'scale-75 translate-y-0.5' : ''}`} />
              </div>
            ); break;
            case TileType.REPEATER:
            case TileType.COMPARATOR:
              const isComp = tile.type === TileType.COMPARATOR;
              content = (
                <div className={`w-9 h-9 bg-stone-400 rounded-sm flex flex-col items-center justify-center border-2 ${tile.active ? 'border-red-500' : 'border-stone-500'} ${rotationClass} relative overflow-hidden`}>
                   <div className={`w-1.5 h-3 absolute top-1 ${tile.active ? 'bg-red-500' : 'bg-red-900'}`} />
                   {isComp && tile.comparatorMode === 'SUBTRACT' && <div className="absolute top-1 w-1 h-1 bg-red-500 rounded-full animate-pulse" />}
                   <div className={`absolute text-[6px] font-bold text-black/50`}>{isComp ? (tile.comparatorMode === 'SUBTRACT' ? '-' : '=') : (tile.delay + 't')}</div>
                </div>
              ); break;
            case TileType.PISTON:
            case TileType.STICKY_PISTON: content = (
              <div className={`w-full h-full flex flex-col items-center bg-stone-600 border border-stone-800 relative transition-transform duration-75 ${rotationClass}`}>
                <div className={`w-full h-3 ${tile.type === TileType.STICKY_PISTON ? 'bg-green-600' : 'bg-amber-900'} border-b border-black`} />
              </div>
            ); break;
            case TileType.PISTON_HEAD: content = (
              <div className={`w-full h-full flex flex-col items-center justify-start transition-transform duration-75 ${rotationClass}`}>
                 <div className="w-full h-4 bg-amber-800 border-b-2 border-amber-950 rounded-b-sm" />
                 <div className="w-2 h-full bg-stone-400 border-x border-stone-500" />
              </div>
            ); break;
            case TileType.OBSERVER: content = (
              <div className={`w-full h-full flex flex-col items-center bg-stone-700 border border-stone-900 relative transition-transform duration-75 ${rotationClass}`}>
                 <div className="w-full h-3 bg-stone-800 border-b border-stone-900 flex items-center justify-center gap-1"><div className="w-1.5 h-1.5 bg-stone-500 rounded-full" /></div>
                 <div className="absolute bottom-1 w-2 h-2 rounded-full" style={{ backgroundColor: tile.active ? '#ff0000' : '#4a0404' }} />
              </div>
            ); break;
            case TileType.NOTE_BLOCK: content = (
              <div className="w-full h-full bg-[#3d2314] flex flex-col items-center justify-center border-2 border-[#1a100a] relative">
                 <span className="text-amber-600 text-[10px] font-bold">♫</span>
                 <span className="absolute bottom-0 text-[8px] text-amber-400 font-mono">{tile.pitch || 0}</span>
              </div>
            ); break;
            case TileType.WATER: bgColor = COLORS.WATER; break;
            case TileType.LAVA: bgColor = COLORS.LAVA; break;
          }
        }

        cells.push(
          <div
            key={key}
            onMouseDown={(e) => handleTileMouseDown(e, x, y)}
            onMouseEnter={() => handleTileMouseEnter(x, y)}
            onMouseUp={() => handleTileMouseUp(key)}
            onContextMenu={(e) => handleTileRightClick(e, x, y)}
            onMouseLeave={() => handleTileMouseLeave(x, y)}
            style={{ 
              width: TILE_SIZE, height: TILE_SIZE, backgroundColor: bgColor,
              borderColor: hoveredTile === key ? (tool === 'DELETE' ? '#ef4444' : '#4f46e5') : (settings.showGrid ? COLORS.GRID : 'transparent'),
              opacity: draggedKey === key ? 0.3 : 1
            }}
            className={`border box-border flex items-center justify-center transition-all relative overflow-hidden select-none ${tool === 'MOVE' ? 'cursor-grab active:cursor-grabbing' : tool === 'BUILD' ? 'cursor-cell' : 'cursor-default'}`}
          >
            {content}
            {tile && tile.power > 0 && tile.type === TileType.DUST && <span className="absolute bottom-0 right-0 text-[8px] opacity-70 text-white p-0.5 bg-black/20">{tile.power}</span>}
          </div>
        );
      }
    }
    return cells;
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden text-slate-200 transition-colors duration-1000" style={{ backgroundColor: getDynamicBackground() }}>
      {/* Sidebar */}
      <div className="w-80 bg-[#1a1a1a] border-r border-slate-800 flex flex-col p-4 z-20 shadow-2xl overflow-y-auto custom-scroll">
        <h1 className="text-2xl font-bold mb-6 text-red-500 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded-full animate-pulse shadow-[0_0_8px_red]" />
            REDSTONE LAB 2D
          </div>
          <button onClick={() => setShowSettings(!showSettings)} className="text-slate-500 hover:text-slate-300 transition-colors">
            ⚙️
          </button>
        </h1>

        <div className="space-y-6">
          <section>
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3 flex justify-between"><span>Tool Modes</span><span className="text-[9px] text-slate-600">[1-4]</span></h3>
            <div className="grid grid-cols-2 gap-2">
              {(['CURSOR', 'BUILD', 'DELETE', 'MOVE'] as ToolMode[]).map((m, idx) => (
                <button key={m} onClick={() => setTool(m)} className={`p-2 rounded font-bold text-[10px] uppercase border-2 transition-all relative ${tool === m ? 'bg-red-600 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500'}`}>{m}<span className="absolute top-0 right-1 text-[8px] opacity-50">{idx + 1}</span></button>
              ))}
            </div>
          </section>

          {tool === 'BUILD' && (
            <section>
              <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3">Components</h3>
              <div className="grid grid-cols-3 gap-2">
                {Object.entries(TileType).filter(([_, v]) => ![TileType.AIR, TileType.PISTON_HEAD].includes(v)).map(([k, type]) => (
                  <button key={k} onClick={() => setSelectedType(type)} className={`p-1.5 rounded-lg border-2 flex flex-col items-center gap-0.5 transition-all ${selectedType === type ? 'bg-red-950/50 border-red-600 shadow-[inset_0_0_10px_rgba(220,38,38,0.2)]' : 'bg-[#242424] border-transparent hover:border-slate-600'}`}>
                    <span className="text-base">{ICONS[type]}</span>
                    <span className="text-[8px] uppercase font-bold truncate w-full text-center leading-none mt-1">{k.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
            </section>
          )}

          <section>
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3 flex justify-between"><span>Simulation Time</span></h3>
            <div className="bg-black/40 p-3 rounded-lg border border-slate-800">
               <div className="flex items-center justify-between text-[10px] font-bold uppercase mb-2">
                  <span>{settings.dayTime < 1200 ? 'Daylight' : 'Nighttime'}</span>
                  <span className="text-slate-500">{Math.floor(settings.dayTime / 100)}:00</span>
               </div>
               <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(settings.dayTime / 2400) * 100}%` }} />
               </div>
            </div>
          </section>

          <section>
            <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3 flex justify-between"><span>Rotation</span><button onClick={handleRotateGlobal} className="text-[10px] text-indigo-400 hover:text-indigo-300">↻ ROTATE</button></h3>
            <div className="flex justify-between gap-1">
              {(['N', 'E', 'S', 'W'] as Direction[]).map(d => (
                <button key={d} onClick={() => setDirection(d)} className={`flex-1 py-1 rounded border text-xs font-bold ${direction === d ? 'bg-indigo-600 border-indigo-400' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}>{d === 'N' ? '↑' : d === 'E' ? '→' : d === 'S' ? '↓' : '←'}</button>
              ))}
            </div>
          </section>

          <section>
             <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3">Simulation</h3>
             <div className="grid grid-cols-1 gap-2">
                <button onClick={() => setIsPaused(!isPaused)} className={`py-2 rounded font-bold text-xs uppercase ${isPaused ? 'bg-green-700 hover:bg-green-600' : 'bg-amber-700 hover:bg-amber-600'}`}>{isPaused ? 'Resume Simulation' : 'Pause Simulation'}</button>
             </div>
          </section>

          <section className="border-t border-slate-800 pt-4">
             <h3 className="text-xs uppercase font-bold tracking-widest text-slate-500 mb-3">Blueprints</h3>
             <div className="space-y-2">
                <textarea value={blueprintInput} onChange={(e) => setBlueprintInput(e.target.value)} placeholder="Paste blueprint code..." className="w-full h-20 bg-black/40 border border-slate-700 rounded p-2 text-[10px] font-mono focus:outline-none focus:border-indigo-500 custom-scroll resize-none text-indigo-300 placeholder:text-slate-700" />
                <div className="grid grid-cols-2 gap-2">
                   <button onClick={handleExportBlueprint} className="py-2 bg-indigo-950 border border-indigo-700 hover:bg-indigo-900 rounded font-bold text-[10px] uppercase text-indigo-200">Export</button>
                   <button onClick={handleImportBlueprint} className="py-2 bg-slate-800 border border-slate-600 hover:bg-slate-700 rounded font-bold text-[10px] uppercase">Import</button>
                </div>
             </div>
          </section>
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 relative overflow-auto flex items-center justify-center custom-scroll p-20">
        <div className={`grid shadow-[0_0_100px_rgba(0,0,0,1)] bg-[#121212] ${settings.showGrid ? 'border-4 border-[#222]' : ''}`} style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, ${TILE_SIZE}px)`, width: GRID_SIZE * TILE_SIZE, height: GRID_SIZE * TILE_SIZE }}>{renderGrid()}</div>
        
        {/* Component Inspector Tooltip */}
        {hoveredTile && grid[hoveredTile] && (
          <div 
            className="fixed pointer-events-none z-50 bg-[#111111] border-2 border-red-600 rounded-lg shadow-[0_0_20px_rgba(220,38,38,0.3)] min-w-[140px]"
            style={{ 
              left: mousePos.x + 15, 
              top: mousePos.y + 15 
            }}
          >
            {getTileDescription(grid[hoveredTile])}
          </div>
        )}

        {/* HUD */}
        <div className="fixed bottom-6 right-6 bg-black/80 backdrop-blur-md px-4 py-2 rounded-full border border-slate-700 text-[10px] text-slate-400 flex gap-4 uppercase font-bold tracking-widest shadow-lg z-30">
          <div className="flex items-center gap-1"><span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-amber-500' : 'bg-green-500 animate-pulse'}`} />{isPaused ? 'Paused' : 'Running'}</div>
          <div className="border-l border-slate-800 pl-4">Tool: {tool}</div>
          <div className="border-l border-slate-800 pl-4">Time: {settings.dayTime}</div>
          <div className="border-l border-slate-800 pl-4">Daylight: {settings.dayTime < 1200 ? 'Day' : 'Night'}</div>
        </div>

        {/* Settings Menu Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-6">
            <div className="bg-[#1a1a1a] border-2 border-slate-700 w-96 rounded-xl shadow-2xl p-6 relative">
              <button onClick={() => setShowSettings(false)} className="absolute top-4 right-4 text-slate-500 hover:text-white">✕</button>
              <h2 className="text-xl font-bold text-red-500 mb-6 uppercase tracking-wider">Lab Settings</h2>
              
              <div className="space-y-6">
                <div>
                  <label className="text-xs uppercase font-bold text-slate-500 block mb-2">TNT Property</label>
                  <button 
                    onClick={() => setSettings(s => ({...s, tntDestructive: !s.tntDestructive}))}
                    className={`w-full py-2 px-4 rounded border transition-all flex justify-between items-center ${settings.tntDestructive ? 'bg-red-900/30 border-red-700 text-red-200' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                  >
                    <span>TNT Destroys Blocks</span>
                    <span className="text-[10px]">{settings.tntDestructive ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                <div>
                  <label className="text-xs uppercase font-bold text-slate-500 block mb-2">Grid Visibility</label>
                  <button 
                    onClick={() => setSettings(s => ({...s, showGrid: !s.showGrid}))}
                    className={`w-full py-2 px-4 rounded border transition-all flex justify-between items-center ${settings.showGrid ? 'bg-indigo-900/30 border-indigo-700 text-indigo-200' : 'bg-slate-800 border-slate-600 text-slate-400'}`}
                  >
                    <span>Show Grid Lines</span>
                    <span className="text-[10px]">{settings.showGrid ? 'YES' : 'NO'}</span>
                  </button>
                </div>

                <div>
                  <label className="text-xs uppercase font-bold text-slate-500 block mb-2">Simulation Tick Rate ({settings.simulationSpeed}ms)</label>
                  <input 
                    type="range" 
                    min="20" 
                    max="500" 
                    step="10"
                    value={settings.simulationSpeed} 
                    onChange={(e) => setSettings(s => ({...s, simulationSpeed: parseInt(e.target.value)}))}
                    className="w-full accent-red-600 bg-slate-800 h-1 rounded-full cursor-pointer"
                  />
                  <div className="flex justify-between text-[8px] text-slate-600 mt-1 uppercase font-bold">
                    <span>Fast (20ms)</span>
                    <span>Slow (500ms)</span>
                  </div>
                </div>
              </div>

              <button 
                onClick={() => setShowSettings(false)}
                className="w-full mt-8 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded uppercase tracking-widest text-xs shadow-lg"
              >
                Close Settings
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
