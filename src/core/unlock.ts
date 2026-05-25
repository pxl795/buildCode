import { NEXT_BUILDING_UNLOCK_COUNT, TOTAL_BUILDING_TYPES } from './constants';
import type { GameState } from './types';

/**
 * 重新计算建筑解锁状态。建筑 0 默认解锁；i 解锁条件 = i-1 已解锁且数量 >= 5。
 * 该函数会就地修改 state.buildings[i].unlocked 字段并返回 state。
 */
export function recalculateUnlocks(state: GameState): GameState {
  const buildings = state.buildings;
  if (buildings.length === 0) return state;
  buildings[0].unlocked = true;
  for (let i = 1; i < Math.min(buildings.length, TOTAL_BUILDING_TYPES); i++) {
    const prev = buildings[i - 1];
    buildings[i].unlocked = prev.unlocked && prev.count >= NEXT_BUILDING_UNLOCK_COUNT;
  }
  return state;
}

/** 当前已解锁的最高建筑 id（前沿）。遇到第一个未解锁就停下，避免被人为破坏的不连续状态误导。 */
export function getHighestUnlockedId(state: GameState): number {
  let id = 0;
  for (let i = 0; i < state.buildings.length; i++) {
    if (!state.buildings[i].unlocked) break;
    id = i;
  }
  return id;
}

/** 下一类待解锁建筑的 id（如已全部解锁则返回 null） */
export function getNextBuildingId(state: GameState): number | null {
  for (let i = 0; i < state.buildings.length; i++) {
    if (!state.buildings[i].unlocked) return i;
  }
  return null;
}

/** 已解锁建筑数量 */
export function countUnlocked(state: GameState): number {
  return state.buildings.reduce((acc, b) => acc + (b.unlocked ? 1 : 0), 0);
}
