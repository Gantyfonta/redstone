
import React from 'react';

export const GRID_SIZE = 24;
export const TILE_SIZE = 40;
export const TICK_RATE = 100; // 100ms per redstone tick

export const COLORS = {
  REDSTONE_OFF: '#4a0404',
  REDSTONE_ON: '#ff0000',
  BLOCK: '#7a7a7a',
  GLASS: 'rgba(165, 243, 252, 0.3)',
  SLIME: '#86efac',
  TORCH_ON: '#ff4d4d',
  TORCH_OFF: '#2a0000',
  LAMP_ON: '#fff3ad',
  LAMP_OFF: '#2d2d2d',
  BG: '#121212',
  GRID: '#242424',
  WATER: 'rgba(59, 130, 246, 0.7)',
  LAVA: 'rgba(249, 115, 22, 0.9)',
  TNT: '#ef4444',
  TARGET: '#ffffff',
  OBSIDIAN: '#1a0d2b',
  DISPENSER: '#4b5563',
  DAYLIGHT: '#3b82f6',
  SCULK: '#064e3b',
  ANTENNA: '#6366f1',
  RECEIVER: '#ec4899'
};

export const ICONS: Record<string, React.ReactNode> = {
  AIR: <div className="w-4 h-4 border border-dashed border-gray-600 rounded" />,
  DUST: <div className="w-4 h-4 bg-red-700 rounded-full" />,
  TORCH: <div className="w-2 h-4 bg-red-500 rounded-t-sm" />,
  REPEATER: <div className="w-4 h-4 bg-gray-500 flex items-center justify-center text-[8px]">▶</div>,
  LEVER: <div className="w-2 h-4 bg-stone-400 rotate-12" />,
  BUTTON: <div className="w-2 h-2 bg-stone-600" />,
  LAMP: <div className="w-4 h-4 bg-yellow-900 border border-yellow-700" />,
  BLOCK: <div className="w-4 h-4 bg-gray-400 shadow-inner" />,
  GLASS: <div className="w-4 h-4 border border-cyan-200/50 bg-cyan-100/10" />,
  SLIME: <div className="w-4 h-4 bg-green-400 border border-green-600 shadow-sm" />,
  PISTON: <div className="w-4 h-4 bg-stone-700 border-t-4 border-amber-900" />,
  STICKY_PISTON: <div className="w-4 h-4 bg-stone-700 border-t-4 border-green-600" />,
  PISTON_HEAD: <div className="w-4 h-1 bg-amber-800" />,
  OBSERVER: <div className="w-4 h-4 bg-stone-800 flex flex-col items-center justify-center border-t border-red-500"><div className="w-2 h-2 bg-stone-400 rounded-sm" /></div>,
  NOTE_BLOCK: <div className="w-4 h-4 bg-amber-950 border border-amber-700 flex items-center justify-center text-[8px] text-amber-500 font-bold">♫</div>,
  WATER: <div className="w-4 h-4 bg-blue-500 rounded-sm shadow-[0_0_5px_rgba(59,130,246,0.5)]" />,
  LAVA: <div className="w-4 h-4 bg-orange-600 rounded-sm shadow-[0_0_8px_rgba(234,88,12,0.8)]" />,
  REDSTONE_BLOCK: <div className="w-4 h-4 bg-red-600 border border-red-900 shadow-[inset_0_0_5px_rgba(0,0,0,0.5)]" />,
  COMPARATOR: <div className="w-4 h-4 bg-stone-400 flex items-center justify-center text-[8px] font-bold">C</div>,
  TNT: <div className="w-4 h-4 bg-red-600 border border-white flex flex-col items-center justify-center text-[6px] font-black text-white">TNT</div>,
  TARGET: <div className="w-4 h-4 bg-white rounded-full border-2 border-red-600 flex items-center justify-center"><div className="w-1 h-1 bg-red-600 rounded-full" /></div>,
  OBSIDIAN: <div className="w-4 h-4 bg-[#1a0d2b] border border-[#2d1b4d] shadow-[inset_0_0_3px_rgba(255,255,255,0.1)]" />,
  DISPENSER: <div className="w-4 h-4 bg-stone-600 border border-stone-800 flex items-center justify-center"><div className="w-2 h-2 bg-stone-900 rounded-full border border-stone-400" /></div>,
  DAYLIGHT_SENSOR: <div className="w-4 h-4 bg-blue-400 border-2 border-slate-600 flex items-center justify-center"><div className="w-2 h-2 bg-yellow-300 rounded-full" /></div>,
  PRESSURE_PLATE: <div className="w-4 h-2 bg-stone-400 border border-stone-600 rounded-sm" />,
  SCULK_SENSOR: <div className="w-4 h-4 bg-teal-900 border border-teal-500 flex items-center justify-center"><div className="w-1 h-3 bg-teal-400 animate-pulse" /></div>,
  ANTENNA: <div className="w-4 h-4 text-indigo-400">📡</div>,
  RECEIVER: <div className="w-4 h-4 text-pink-400">📟</div>,
};
