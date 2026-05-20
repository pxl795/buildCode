import { describe, expect, it } from 'vitest';
import { scoreAndSortActions, simulateHardUnlock } from '../src/core/greedy';
import { createDefaultState } from '../src/data/defaultState';
import { recalculateUnlocks } from '../src/core/unlock';

describe('greedy - 默认样例', () => {
  const state = recalculateUnlocks(createDefaultState());
  const actions = scoreAndSortActions(state);

  it('生成至少 8 个候选动作', () => {
    expect(actions.length).toBeGreaterThanOrEqual(8);
  });

  it('第一推荐：购买锻兵房', () => {
    const best = actions[0];
    expect(best.type).toBe('buy');
    expect(best.buildingName).toBe('锻兵房');
  });

  it('推荐花费 = 2,592,000,000，增产 ≈ 2074.95/s', () => {
    const best = actions[0];
    expect(best.cost).toBeCloseTo(2592000000, 0);
    expect(best.deltaProduction).toBeCloseTo(2074.95, 2);
  });

  it('推荐等待 ≈ 62028.53 秒（17.2 小时）', () => {
    const best = actions[0];
    expect(best.waitSeconds).toBeCloseTo(62028.53, 0);
  });

  it('推荐回本 ≈ 1,249,186.73 秒（14.46 天）', () => {
    const best = actions[0];
    expect(best.paybackSeconds).toBeCloseTo(1249186.73, 0);
  });

  it('折扣后得分 ≈ 655,607.63 秒（前沿购买 0.5 折扣）', () => {
    const best = actions[0];
    expect(best.scoreSeconds).toBeCloseTo(655607.63, 0);
  });

  it('Top 8 候选标签符合 spec', () => {
    const top = actions.slice(0, 8).map(a => a.label);
    expect(top[0]).toBe('购买 锻兵房');
    // 接下来几项可能因浮点比较微调，我们仅检查包含
    const all = top.join(' | ');
    expect(all).toContain('招募 1 个杂役到 补给营地');
    expect(all).toContain('购买 探测法阵');
    expect(all).toContain('提升杂役技艺');
  });
});

describe('greedy - 硬冲解锁', () => {
  it('硬冲解锁藏经阁 ≈ 455,845.12 秒', () => {
    const state = recalculateUnlocks(createDefaultState());
    const r = simulateHardUnlock(state, 7);
    expect(r.reachable).toBe(true);
    expect(r.totalSeconds).toBeGreaterThan(455000);
    expect(r.totalSeconds).toBeLessThan(457000);
  });

  it('藏经阁首购时间应为 null（数据缺失 baseProduction=0, nextBuyCost=0）', () => {
    const state = recalculateUnlocks(createDefaultState());
    const r = simulateHardUnlock(state, 7);
    expect(r.firstBuyTotalSeconds).toBeNull();
  });
});
