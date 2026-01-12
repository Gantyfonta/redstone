
import { GridData, TileType, Direction, TileState, AppSettings } from '../types';

export const getNeighbors = (x: number, y: number) => [
  { x, y: y - 1, dir: 'N' as Direction },
  { x, y: y + 1, dir: 'S' as Direction },
  { x: x - 1, y, dir: 'W' as Direction },
  { x: x + 1, y, dir: 'E' as Direction },
];

const getDirectionVector = (dir: Direction) => {
  switch (dir) {
    case 'N': return { dx: 0, dy: -1 };
    case 'S': return { dx: 0, dy: 1 };
    case 'W': return { dx: -1, dy: 0 };
    case 'E': return { dx: 1, dy: 0 };
    default: return { dx: 0, dy: 0 };
  }
};

const getOppositeDirection = (dir: Direction): Direction => {
  switch (dir) {
    case 'N': return 'S';
    case 'S': return 'N';
    case 'W': return 'E';
    case 'E': return 'W';
  }
};

const PUSH_LIMIT = 12;

const isSolid = (type: TileType): boolean => {
  return [
    TileType.BLOCK, TileType.PISTON, TileType.PISTON_HEAD, 
    TileType.STICKY_PISTON, TileType.GLASS, TileType.SLIME, 
    TileType.LAMP, TileType.NOTE_BLOCK, TileType.OBSERVER,
    TileType.REDSTONE_BLOCK, TileType.TNT, TileType.TARGET,
    TileType.OBSIDIAN, TileType.DISPENSER, TileType.DAYLIGHT_SENSOR,
    TileType.SCULK_SENSOR, TileType.ANTENNA, TileType.RECEIVER,
    TileType.COUNTER
  ].includes(type);
};

const isImmovable = (type: TileType): boolean => {
  return [
    TileType.OBSIDIAN,
    TileType.PISTON_HEAD,
    TileType.AIR
  ].includes(type);
};

const isReplaceable = (type: TileType): boolean => {
  return [
    TileType.AIR, TileType.DUST, TileType.TORCH, 
    TileType.LEVER, TileType.BUTTON, TileType.REPEATER,
    TileType.COMPARATOR, TileType.PRESSURE_PLATE
  ].includes(type);
};

const getConnectedGroup = (grid: GridData, startX: number, startY: number, excludeX: number, excludeY: number): string[] | null => {
  const startKey = `${startX},${startY}`;
  const startTile = grid[startKey];
  if (!startTile || startTile.type === TileType.AIR || startTile.type === TileType.PISTON_HEAD) return [];
  if (isImmovable(startTile.type)) return null;

  const group = new Set<string>();
  const queue = [startKey];
  group.add(startKey);

  let head = 0;
  while (head < queue.length) {
    const currentKey = queue[head++];
    const [cx, cy] = currentKey.split(',').map(Number);
    const tile = grid[currentKey];

    const neighbors = getNeighbors(cx, cy);
    for (const n of neighbors) {
      const nKey = `${n.x},${n.y}`;
      if (n.x === excludeX && n.y === excludeY) continue;
      if (group.has(nKey)) continue;

      const nTile = grid[nKey];
      if (!nTile || nTile.type === TileType.AIR || nTile.type === TileType.PISTON_HEAD) continue;

      if (tile.type === TileType.SLIME || nTile.type === TileType.SLIME) {
        if (isImmovable(nTile.type)) return null; 
        group.add(nKey);
        queue.push(nKey);
      }
    }
    if (group.size > PUSH_LIMIT) return null;
  }
  return Array.from(group);
};

const getPushGroup = (grid: GridData, startX: number, startY: number, pushDir: Direction): string[] | null => {
  const { dx, dy } = getDirectionVector(pushDir);
  const pistonX = startX - dx;
  const pistonY = startY - dy;
  
  const startTile = grid[`${startX},${startY}`];
  if (!startTile) return [];
  if (isImmovable(startTile.type)) return null;

  const group = new Set<string>();
  const initialAdhesionGroup = getConnectedGroup(grid, startX, startY, pistonX, pistonY);
  if (!initialAdhesionGroup) return null;
  initialAdhesionGroup.forEach(k => group.add(k));

  let changed = true;
  while (changed) {
    changed = false;
    const currentGroup = Array.from(group);
    for (const key of currentGroup) {
      const [cx, cy] = key.split(',').map(Number);
      const frontX = cx + dx;
      const frontY = cy + dy;
      const frontKey = `${frontX},${frontY}`;

      const frontTile = grid[frontKey];
      if (frontTile && frontTile.type !== TileType.AIR && !group.has(frontKey)) {
        if (isImmovable(frontTile.type)) return null;
        const addedGroup = getConnectedGroup(grid, frontX, frontY, -1, -1);
        if (!addedGroup) return null;
        for (const ak of addedGroup) {
          if (!group.has(ak)) {
            group.add(ak);
            changed = true;
          }
        }
      }
    }
    if (group.size > PUSH_LIMIT) return null;
  }

  for (const key of group) {
    const [gx, gy] = key.split(',').map(Number);
    const targetX = gx + dx;
    const targetY = gy + dy;
    const targetKey = `${targetX},${targetY}`;
    if (targetX < 0 || targetX >= 24 || targetY < 0 || targetY >= 24) return null;
    if (grid[targetKey] && grid[targetKey].type !== TileType.AIR && !group.has(targetKey)) {
      return null;
    }
  }
  return Array.from(group);
};

export const updateRedstone = (grid: GridData, settings: AppSettings): GridData => {
  let nextGrid: GridData = {};
  const keys = Object.keys(grid);

  // PASS 0: Wireless Registry
  const activeChannels = new Set<number>();
  keys.forEach(key => {
    const tile = grid[key];
    if (tile.type === TileType.ANTENNA && tile.active && tile.channel !== undefined) {
      activeChannels.add(tile.channel);
    }
  });

  // PASS 1: Logic Components
  keys.forEach(key => {
    const tile = grid[key];
    const [x, y] = key.split(',').map(Number);
    
    let newPower = 0;
    let newActive = tile.active;
    let extraState: Partial<TileState> = {};

    if (tile.type === TileType.LEVER || tile.type === TileType.BUTTON || tile.type === TileType.PRESSURE_PLATE) {
      newPower = tile.active ? 15 : 0;
    } else if (tile.type === TileType.RECEIVER) {
      const channelOn = activeChannels.has(tile.channel ?? 0);
      newPower = channelOn ? 15 : 0;
      newActive = channelOn;
    } else if (tile.type === TileType.DAYLIGHT_SENSOR) {
      // Daylight sensor cycle: settings.dayTime is 0 to 2400
      // 0-1200 is day, 1200-2400 is night. Peak at 600 or 1800.
      const time = settings.dayTime;
      const isNightMode = tile.isInverted;
      let lightValue = 0;
      
      // Calculate a value 0-15 based on a sine curve
      if (time < 1200) { // Day
        lightValue = Math.max(0, Math.floor(15 * Math.sin(Math.PI * time / 1200)));
      } else { // Night
        lightValue = 0;
      }

      if (isNightMode) {
          // Night mode logic: it peaks at night (roughly inverted)
          let nightLightValue = 0;
          if (time >= 1200) {
              nightLightValue = Math.max(0, Math.floor(15 * Math.sin(Math.PI * (time - 1200) / 1200)));
          }
          newPower = nightLightValue;
      } else {
          newPower = lightValue;
      }
      newActive = newPower > 0;
    } else if (tile.type === TileType.COUNTER) {
      const currentVal = tile.internalCounter ?? 0;
      const nextVal = (currentVal % 15) + 1;
      newPower = nextVal;
      newActive = true;
      extraState = { internalCounter: nextVal };
    } else if (tile.type === TileType.REDSTONE_BLOCK) {
      newPower = 15;
    } else if (tile.type === TileType.SCULK_SENSOR) {
        if (tile.active) {
            newPower = 15;
            let cooldown = (tile.tickCooldown ?? 0) - 1;
            if (cooldown <= 0) {
                newActive = false;
                cooldown = 0;
            }
            extraState = { tickCooldown: cooldown };
        }
    } else if (tile.type === TileType.TARGET) {
      if (tile.active) {
        newPower = 15;
        let cooldown = (tile.tickCooldown ?? 0) - 1;
        if (cooldown <= 0) {
          newActive = false;
          cooldown = 0;
        }
        extraState = { tickCooldown: cooldown };
      }
    } else if (tile.type === TileType.TNT) {
      const isPowered = getNeighbors(x, y).some(n => {
        const neighbor = grid[`${n.x},${n.y}`];
        return neighbor && neighbor.power > 0;
      });
      if (isPowered || tile.active) {
        newActive = true;
        let cooldown = (tile.tickCooldown === undefined) ? 40 : tile.tickCooldown - 1;
        extraState = { tickCooldown: cooldown };
      }
    } else if (tile.type === TileType.TORCH) {
      const attachedDir = getOppositeDirection(tile.direction);
      const { dx, dy } = getDirectionVector(attachedDir);
      const attachedKey = `${x + dx},${y + dy}`;
      const attachedBlock = grid[attachedKey];
      
      const isInputPowered = attachedBlock && attachedBlock.power > 0 && isSolid(attachedBlock.type);
      newActive = !isInputPowered;
      newPower = newActive ? 15 : 0;
    } else if (tile.type === TileType.REPEATER) {
      const inputPos = tile.direction === 'N' ? {x, y: y+1} :
                      tile.direction === 'S' ? {x, y: y-1} :
                      tile.direction === 'E' ? {x: x-1, y} : {x: x+1, y};
      const input = grid[`${inputPos.x},${inputPos.y}`];
      const inputActive = !!(input && input.power > 0);
      
      let currentCooldown = tile.tickCooldown ?? 0;
      let currentPending = tile.pendingActive ?? tile.active;
      let nextActiveState = tile.active;

      if (inputActive !== currentPending) {
        currentPending = inputActive;
        currentCooldown = tile.delay ?? 1;
      }

      if (currentCooldown > 0) {
        currentCooldown--;
        if (currentCooldown === 0) nextActiveState = currentPending;
      }

      newActive = nextActiveState;
      newPower = newActive ? 15 : 0;
      extraState = { tickCooldown: currentCooldown, pendingActive: currentPending };
    } else if (tile.type === TileType.COMPARATOR) {
      const inputPos = tile.direction === 'N' ? {x, y: y+1} :
                      tile.direction === 'S' ? {x, y: y-1} :
                      tile.direction === 'E' ? {x: x-1, y} : {x: x+1, y};
      const sideDirs = tile.direction === 'N' || tile.direction === 'S' ? ['W', 'E'] : ['N', 'S'];
      
      const input = grid[`${inputPos.x},${inputPos.y}`]?.power || 0;
      const sideMax = Math.max(...sideDirs.map(d => {
        const vec = getDirectionVector(d as Direction);
        return grid[`${x + vec.dx},${y + vec.dy}`]?.power || 0;
      }));

      if (tile.comparatorMode === 'SUBTRACT') {
        newPower = Math.max(0, input - sideMax);
      } else {
        newPower = input >= sideMax ? input : 0;
      }
      newActive = newPower > 0;
    } else if (tile.type === TileType.OBSERVER) {
      const { dx, dy } = getDirectionVector(tile.direction);
      const observedKey = `${x + dx},${y + dy}`;
      const observedTile = grid[observedKey];
      
      const observedChanged = (
        (observedTile?.type || TileType.AIR) !== (tile.observedType || TileType.AIR) ||
        (observedTile?.power || 0) !== (tile.observedPower || 0) ||
        (observedTile?.active || false) !== (tile.observedActive || false)
      );

      if (observedChanged && !tile.active) {
        newActive = true;
        newPower = 15;
      } else if (tile.active) {
        newActive = false;
        newPower = 0;
      } else {
        newActive = false;
        newPower = 0;
      }

      extraState = {
        observedType: observedTile?.type || TileType.AIR,
        observedPower: observedTile?.power || 0,
        observedActive: observedTile?.active || false
      };
    } else {
      newActive = tile.active;
      newPower = 0;
    }

    nextGrid[key] = { ...tile, power: newPower, active: newActive, ...extraState };
  });

  // Handle TNT explosions
  const explosionGrid = { ...nextGrid };
  keys.forEach(key => {
    const tile = nextGrid[key];
    if (tile.type === TileType.TNT && tile.active && (tile.tickCooldown ?? 0) <= 0) {
      const [tx, ty] = key.split(',').map(Number);
      delete explosionGrid[key];
      
      if (settings?.tntDestructive) {
        for (let dy = -2; dy <= 2; dy++) {
          for (let dx = -2; dx <= 2; dx++) {
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist <= 2.2) {
              const targetKey = `${tx+dx},${ty+dy}`;
              const targetTile = nextGrid[targetKey];
              if (targetTile && targetTile.type !== TileType.OBSIDIAN) {
                delete explosionGrid[targetKey];
              }
            }
          }
        }
      }
    }
  });
  nextGrid = explosionGrid;

  // PASS 2: Redstone Propagation
  const powerMap: Record<string, number> = {};
  const queue: { key: string, power: number }[] = [];

  Object.keys(nextGrid).forEach(key => {
    const tile = nextGrid[key];
    if (tile.power > 0 && [TileType.LEVER, TileType.BUTTON, TileType.TORCH, TileType.REPEATER, TileType.COMPARATOR, TileType.OBSERVER, TileType.REDSTONE_BLOCK, TileType.TARGET, TileType.DAYLIGHT_SENSOR, TileType.PRESSURE_PLATE, TileType.SCULK_SENSOR, TileType.RECEIVER, TileType.COUNTER].includes(tile.type)) {
      powerMap[key] = tile.power;
      queue.push({ key, power: tile.power });
    }
  });

  Object.keys(nextGrid).forEach(key => {
    const tile = nextGrid[key];
    const [x, y] = key.split(',').map(Number);

    if (isSolid(tile.type)) {
      const neighbors = getNeighbors(x, y);
      const isHardPowered = neighbors.some(n => {
        const neighbor = nextGrid[`${n.x},${n.y}`];
        if (!neighbor) return false;
        if (neighbor.type === TileType.DUST) return false; 
        if (neighbor.power === 0) return false;

        if (neighbor.type === TileType.TORCH || neighbor.type === TileType.REPEATER || neighbor.type === TileType.COMPARATOR || neighbor.type === TileType.OBSERVER) {
            const pointingAt = getDirectionVector(neighbor.direction);
            const neighborPointingAtX = (n.x) + pointingAt.dx;
            const neighborPointingAtY = (n.y) + pointingAt.dy;
            return neighborPointingAtX === x && neighborPointingAtY === y;
        }
        return true;
      });

      if (isHardPowered) {
        powerMap[key] = 15;
        queue.push({ key, power: 15 });
      }
    }
  });

  let head = 0;
  while (head < queue.length) {
    const { key, power } = queue[head++];
    const [x, y] = key.split(',').map(Number);
    getNeighbors(x, y).forEach(n => {
      const nKey = `${n.x},${n.y}`;
      const nTile = nextGrid[nKey];
      if (nTile && nTile.type === TileType.DUST) {
        const nextPower = Math.max(0, power - 1);
        if (nextPower > (powerMap[nKey] || 0)) {
          powerMap[nKey] = nextPower;
          queue.push({ key: nKey, power: nextPower });
        }
      }
    });
  }

  Object.keys(powerMap).forEach(key => {
    if (nextGrid[key]) nextGrid[key].power = powerMap[key];
  });

  // PASS 3: Consumers
  Object.keys(nextGrid).forEach(key => {
    const tile = nextGrid[key];
    if (tile.type === TileType.LAMP || tile.type === TileType.PISTON || tile.type === TileType.STICKY_PISTON || tile.type === TileType.TNT || tile.type === TileType.DISPENSER || tile.type === TileType.NOTE_BLOCK || tile.type === TileType.ANTENNA) {
      const [x, y] = key.split(',').map(Number);
      const isPowered = getNeighbors(x, y).some(n => (powerMap[`${n.x},${n.y}`] || 0) > 0) || (powerMap[key] || 0) > 0;
      if (tile.type === TileType.TNT) {
         if (isPowered && nextGrid[key]) nextGrid[key].active = true;
      } else {
         if (nextGrid[key]) nextGrid[key].active = isPowered;
      }
    }
  });

  // PASS 4: Mechanical & Fluid Dynamics
  const resultGrid: GridData = { ...nextGrid };

  // Dispenser Logic
  Object.keys(nextGrid).forEach(key => {
    const tile = nextGrid[key];
    if (tile.type === TileType.DISPENSER) {
      const oldTile = grid[key];
      const isRisingEdge = tile.active && (!oldTile || !oldTile.active);
      if (isRisingEdge && tile.contents && tile.contents !== TileType.AIR) {
        const [x, y] = key.split(',').map(Number);
        const { dx, dy } = getDirectionVector(tile.direction);
        const targetKey = `${x + dx},${y + dy}`;
        if (!resultGrid[targetKey] || resultGrid[targetKey].type === TileType.AIR) {
          resultGrid[targetKey] = {
            type: tile.contents,
            power: 0,
            direction: tile.direction,
            active: tile.contents === TileType.TORCH ? true : false,
            pitch: tile.contents === TileType.NOTE_BLOCK ? 0 : undefined,
            delay: tile.contents === TileType.REPEATER ? 1 : undefined,
            isSource: tile.contents === TileType.WATER || tile.contents === TileType.LAVA,
            level: (tile.contents === TileType.WATER || tile.contents === TileType.LAVA) ? 7 : undefined,
          };
        }
      }
    }
  });

  // Fluid Dynamics
  const fluidInterest = new Set<string>();
  Object.keys(nextGrid).forEach(key => {
    const tile = nextGrid[key];
    if (tile.type === TileType.WATER || tile.type === TileType.LAVA) {
      fluidInterest.add(key);
      const [x, y] = key.split(',').map(Number);
      getNeighbors(x, y).forEach(n => fluidInterest.add(`${n.x},${n.y}`));
    }
  });

  fluidInterest.forEach(key => {
    const [x, y] = key.split(',').map(Number);
    if (x < 0 || x >= 24 || y < 0 || y >= 24) return;
    const tile = nextGrid[key];
    if (tile?.isSource) return;

    const neighbors = getNeighbors(x, y).map(n => nextGrid[`${n.x},${n.y}`]);
    const waterLevel = Math.max(0, ...neighbors.filter(t => t?.type === TileType.WATER).map(t => (t?.level || 0) - 1));
    const lavaLevel = Math.max(0, ...neighbors.filter(t => t?.type === TileType.LAVA).map(t => (t?.level || 0) - 1));

    if (waterLevel > 0 && waterLevel >= lavaLevel) {
      if (!tile || isReplaceable(tile.type)) resultGrid[key] = { type: TileType.WATER, power: 0, direction: 'N', active: false, level: waterLevel };
    } else if (lavaLevel > 0) {
      if (!tile || isReplaceable(tile.type)) resultGrid[key] = { type: TileType.LAVA, power: 0, direction: 'N', active: false, level: lavaLevel };
    } else if (tile?.type === TileType.WATER || tile?.type === TileType.LAVA) {
      if (!tile.isSource) delete resultGrid[key];
    }
  });

  // Piston movements
  const finalGrid = { ...resultGrid };
  Object.keys(resultGrid).forEach(key => {
    const tile = resultGrid[key];
    if (tile.type !== TileType.PISTON && tile.type !== TileType.STICKY_PISTON) return;

    const [x, y] = key.split(',').map(Number);
    const { dx, dy } = getDirectionVector(tile.direction);
    const headKey = `${x + dx},${y + dy}`;
    const oldTile = grid[key];

    // Safety: Check if the piston itself still exists in its original spot in finalGrid
    // It might have been moved by a previous piston in the same tick loop.
    const currentPiston = finalGrid[key];
    if (!currentPiston || currentPiston.type !== tile.type) return;

    if (tile.active && (!oldTile || !oldTile.active)) {
      const pushGroup = getPushGroup(finalGrid, x + dx, y + dy, tile.direction);
      if (pushGroup !== null) {
        const groupTiles: Record<string, TileState> = {};
        for (const k of pushGroup) {
          groupTiles[k] = finalGrid[k];
          delete finalGrid[k];
        }
        for (const k of pushGroup) {
          const [gx, gy] = k.split(',').map(Number);
          finalGrid[`${gx + dx},${gy + dy}`] = groupTiles[k];
        }
        finalGrid[headKey] = { type: TileType.PISTON_HEAD, power: 0, direction: tile.direction, active: true };
      } else {
        finalGrid[key].active = false;
      }
    } else if (!tile.active && oldTile && oldTile.active) {
      if (finalGrid[headKey] && finalGrid[headKey].type === TileType.PISTON_HEAD) {
        delete finalGrid[headKey];
        if (tile.type === TileType.STICKY_PISTON) {
          const pullTargetKey = `${x + dx * 2},${y + dy * 2}`;
          const targetTile = finalGrid[pullTargetKey];
          if (targetTile && targetTile.type !== TileType.AIR && targetTile.type !== TileType.PISTON_HEAD && !isImmovable(targetTile.type)) {
            const pullGroup = getConnectedGroup(finalGrid, x + dx * 2, y + dy * 2, x + dx, y + dy);
            if (pullGroup) {
              const groupTiles: Record<string, TileState> = {};
              for (const pk of pullGroup) {
                groupTiles[pk] = finalGrid[pk];
                delete finalGrid[pk];
              }
              for (const pk of pullGroup) {
                const [px, py] = pk.split(',').map(Number);
                finalGrid[`${px - dx},${py - dy}`] = groupTiles[pk];
              }
            }
          }
        }
      }
    }
  });

  return finalGrid;
};
