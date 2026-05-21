import { describe, expect, it } from 'vitest';
import {
  calcDailyProduction,
  calcServantSkillMultiplier,
  calcTotalProduction,
  calcUnitProduction,
  calcUpgradeCost
} from '../src/core/formulas';
import { createDefaultState } from '../src/data/defaultState';
import { recalculateUnlocks } from '../src/core/unlock';

describe('formulas - 默认样例数据', () => {
  const state = recalculateUnlocks(createDefaultState());

  it('杂役技艺倍率 = 1 + (15-1)*0.1 = 2.4', () => {
    expect(calcServantSkillMultiplier(state)).toBeCloseTo(2.4, 9);
  });

  it('补给营地单产 = 12 * 1.35 * 1.06 = 17.172', () => {
    const b = state.buildings[0];
    expect(calcUnitProduction(b, state)).toBeCloseTo(17.172, 6);
  });

  it('当前秒产 ≈ 44,766.35/s', () => {
    expect(calcTotalProduction(state)).toBeCloseTo(44766.35, 1);
  });

  it('日产 ≈ 3,867,812,726.40', () => {
    expect(calcDailyProduction(state)).toBeCloseTo(3867812726.40, 0);
  });

  it('锻兵房单产 = 1450*1.35*1.06 ≈ 2074.95', () => {
    const b = state.buildings[6];
    expect(calcUnitProduction(b, state)).toBeCloseTo(2074.95, 2);
  });
});

describe('formulas - 升级花费', () => {
  it('count >= level*10 才能升级', () => {
    const state = createDefaultState();
    // 补给营地 count=50 level=6 -> 满级，不可升级
    expect(calcUpgradeCost(state.buildings[0])).toBe(0);
    // 探测法阵 count=40 level=5 -> 5升6 需要 50 栋，当前不满足
    expect(calcUpgradeCost(state.buildings[1])).toBe(0);
    // 修士坊市 count=25 level=3 -> 3升4 需要 30 栋，不满足
    expect(calcUpgradeCost(state.buildings[3])).toBe(0);
    // 灵符堂 count=10 level=2 -> 2升3 需要 20 栋，不满足
    expect(calcUpgradeCost(state.buildings[5])).toBe(0);
    // 构造一个可升级用例：count=10, level=1 -> 1升2 需要 10 栋
    state.buildings[6].count = 10;
    state.buildings[6].level = 1;
    expect(calcUpgradeCost(state.buildings[6])).toBeGreaterThan(0);
  });
});
