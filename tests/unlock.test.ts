import { describe, expect, it } from 'vitest';
import { getHighestUnlockedId, getNextBuildingId, recalculateUnlocks } from '../src/core/unlock';
import { createDefaultState } from '../src/data/defaultState';

describe('unlock - 解锁链', () => {
  it('默认数据：前沿建筑 = 锻兵房（id=6）', () => {
    const state = recalculateUnlocks(createDefaultState());
    expect(getHighestUnlockedId(state)).toBe(6);
    expect(state.buildings[6].name).toBe('锻兵房');
  });

  it('下一类建筑 = 藏经阁（id=7）', () => {
    const state = recalculateUnlocks(createDefaultState());
    const next = getNextBuildingId(state);
    expect(next).toBe(7);
    expect(state.buildings[7].name).toBe('藏经阁');
  });

  it('断开链：将建筑 5 数量改为 4 后，建筑 6 应被锁回', () => {
    const state = recalculateUnlocks(createDefaultState());
    state.buildings[5].count = 4;
    recalculateUnlocks(state);
    expect(state.buildings[6].unlocked).toBe(false);
    expect(state.buildings[5].unlocked).toBe(true);
  });
});
