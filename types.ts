
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
  WATER = 'WATER',
  LAVA = 'LAVA',
  REDSTONE_BLOCK = 'REDSTONE_BLOCK',
  COMPARATOR = 'COMPARATOR',
  TNT = 'TNT',
  TARGET = 'TARGET',
  OBSIDIAN = 'OBSIDIAN',
  DISPENSER = 'DISPENSER',
  DAYLIGHT_SENSOR = 'DAYLIGHT_SENSOR',
  PRESSURE_PLATE = 'PRESSURE_PLATE',
  SCULK_SENSOR = 'SCULK_SENSOR',
  ANTENNA = 'ANTENNA',
  RECEIVER = 'RECEIVER'
}

export interface AppSettings {
  tntDestructive: boolean;
  backgroundColor: string;
  showGrid: boolean;
  simulationSpeed: number;
}

export interface TileState {
  type: TileType;
  power: number; // 0-15
  direction: Direction;
  active: boolean; // For levers, buttons, repeaters, torches, pistons, observers, TNT
  channel?: number; // 0-9 for wireless redstone
  tickCooldown?: number; 
  pitch?: number; // 0-24 for note blocks
  delay?: number; // 1-4 for repeaters
  level?: number; // 0-7 for fluids
  isSource?: boolean; // For fluids
  pendingActive?: boolean; // Internal state for repeater timing
  comparatorMode?: 'COMPARE' | 'SUBTRACT';
  contents?: TileType; // For Dispenser
  lastActive?: boolean; // Rising edge detection for Dispenser
  // Cache for Observer logic
  observedType?: TileType;
  observedPower?: number;
  observedActive?: boolean;
}

export type GridData = Record<string, TileState>;

export interface Point {
  x: number;
  y: number;
}
