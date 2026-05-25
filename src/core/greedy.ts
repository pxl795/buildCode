import {
  DEFAULT_HORIZON_SECONDS,
  DEFAULT_MAX_STEPS,
  FRONTIER_UNLOCK_DISCOUNT,
  GROWTH_FACTOR,
  HIGH_IMPACT_DISCOUNT,
  HIGH_IMPACT_THRESHOLD,
  MAX_BUILDING_LEVEL,
  NEXT_BUILDING_UNLOCK_COUNT,
  SERVANT_PRICE_GROWTH_FACTOR,
  SERVANT_SKILL_COST_GROWTH_FACTOR,
  UPGRADE_DISCOUNT,
  UPGRADE_THRESHOLD_PER_LEVEL
} from './constants';
import { listGreedyActions } from './actions';
import { calcTotalProduction, calcUnitProduction } from './formulas';
import { getHighestUnlockedId, recalculateUnlocks } from './unlock';
import type { Action, GameState, GreedyPlanResult, HardUnlockResult, TimelineStep } from './types';

/** 最大前瞻步数：距离升级门槛多少栋内考虑复合打分 */
const UPGRADE_LOOKAHEAD = 6;

const EPS = 1e-9;

/** 深拷贝游戏状态 */
export function cloneState(state: GameState): GameState {
  return {
    ...state,
    buildings: state.buildings.map(b => ({ ...b }))
  };
}

/** 给单个动作打分（基于当前 state） */
export function scoreAction(action: Action, state: GameState, cachedProduction?: number): Action {
  const production = cachedProduction ?? calcTotalProduction(state);
  const cost = action.cost;
  const delta = action.deltaProduction;

  let waitSeconds: number;
  if (production <= 0) {
    waitSeconds = state.ore >= cost ? 0 : Infinity;
  } else {
    waitSeconds = Math.max(0, (cost - state.ore) / production);
  }

  const paybackSeconds = delta > 0 ? cost / delta : Infinity;
  let scoreSeconds = waitSeconds + paybackSeconds;
  const rawScoreSeconds = scoreSeconds;

  // 前沿解锁折扣：购买当前最高已解锁建筑且数量 < 5
  if (action.type === 'buy' && action.buildingId !== null) {
    const frontierId = getHighestUnlockedId(state);
    if (action.buildingId === frontierId) {
      const b = state.buildings[action.buildingId];
      if (b && b.count < NEXT_BUILDING_UNLOCK_COUNT) {
        scoreSeconds *= FRONTIER_UNLOCK_DISCOUNT;
      }
    }
  }

  // 升级动作折扣：升级一类建筑可放大整类倍数，价值通常被低估
  if (action.type === 'upgrade') {
    scoreSeconds *= UPGRADE_DISCOUNT;
  }

  // 高影响折扣：动作增产 >= 当前总秒产的 HIGH_IMPACT_THRESHOLD，再乘 HIGH_IMPACT_DISCOUNT
  if (production > 0 && delta >= production * HIGH_IMPACT_THRESHOLD) {
    scoreSeconds *= HIGH_IMPACT_DISCOUNT;
  }

  // 升级冲刺复合打分：购买接近升级门槛的建筑时，计算「买N栋+升级」的复合分数（与单步同口径）
  if (action.type === 'buy' && action.buildingId !== null) {
    const b = state.buildings[action.buildingId];
    if (b && b.level < MAX_BUILDING_LEVEL) {
      const threshold = b.level * UPGRADE_THRESHOLD_PER_LEVEL;
      const distance = threshold - b.count;
      if (distance > 0 && distance <= UPGRADE_LOOKAHEAD) {
        const composite = calcUpgradeComposite(b, state, distance, production);
        if (composite && isFinite(composite.scoreSeconds)) {
          scoreSeconds = Math.min(scoreSeconds, composite.scoreSeconds);
        }
      }
    }
  }

  return {
    ...action,
    waitSeconds,
    paybackSeconds,
    scoreSeconds,
    rawScoreSeconds
  };
}

/**
 * 计算「买 distance 栋 → 升级」的复合分数。
 * 做渐进式模拟：每买一栋更新产量与 ore，最后用「门槛时的真实 count（= b.count + distance）」算升级增益。
 * 输出格式与单步 score 一致（compositeWait + compositePayback），可与单步 min。
 */
function calcUpgradeComposite(
  b: GameState['buildings'][number],
  state: GameState,
  distance: number,
  currentProduction: number
): { scoreSeconds: number } | null {
  if (currentProduction <= 0) return null;
  if (b.level <= 0) return null;

  const unitProd = calcUnitProduction(b, state);
  if (unitProd <= 0) return null;

  // 渐进模拟：每买一栋更新 production 和 ore
  let ore = state.ore;
  let production = currentProduction;
  let nextCost = b.nextBuyCost;
  let totalWait = 0;
  let totalInvestment = 0;

  for (let i = 0; i < distance; i++) {
    if (production <= 0) return null;
    const wait = Math.max(0, (nextCost - ore) / production);
    totalWait += wait;
    ore = ore + wait * production - nextCost;
    totalInvestment += nextCost;
    production += unitProd; // 买完一栋，产量上升
    nextCost *= GROWTH_FACTOR;
  }

  // 现在 count = b.count + distance = threshold，可升级；升级费用按 exp=1 计算
  // upgradeCost = ceil(UPGRADE_MULTIPLIER * 当前 nextBuyCost / GROWTH_FACTOR^1)
  //   当前 nextBuyCost 已经是 b.nextBuyCost × GROWTH_FACTOR^distance
  const upgradeCost = Math.ceil((1.4 * nextCost) / GROWTH_FACTOR);
  const upgradeWait = Math.max(0, (upgradeCost - ore) / production);
  totalWait += upgradeWait;
  totalInvestment += upgradeCost;

  // 升级增益：用「升级时刻」的 count 而非当前 count（修复 P1）
  // delta = unitProduction / level × postBuyCount
  const postBuyCount = b.count + distance;
  const upgradeDelta = (unitProd / b.level) * postBuyCount;

  // distance 栋自身的产量贡献
  const buyDeltaTotal = unitProd * distance;
  const totalDelta = buyDeltaTotal + upgradeDelta;
  if (totalDelta <= 0) return null;

  const compositePayback = totalInvestment / totalDelta;
  return { scoreSeconds: totalWait + compositePayback };
}

/** 对所有动作打分并按贪心规则排序 */
export function scoreAndSortActions(state: GameState): Action[] {
  const production = calcTotalProduction(state);
  const scored = listGreedyActions(state).map(a => scoreAction(a, state, production));
  scored.sort((a, b) => {
    if (Math.abs(a.scoreSeconds - b.scoreSeconds) > EPS) {
      return a.scoreSeconds - b.scoreSeconds;
    }
    if (Math.abs(a.deltaProduction - b.deltaProduction) > EPS) {
      return b.deltaProduction - a.deltaProduction;
    }
    return a.cost - b.cost;
  });
  return scored;
}

/** 执行一个动作，返回新状态和步骤记录 */
export function performAction(
  state: GameState,
  action: Action
): { state: GameState; step: TimelineStep } {
  const next = cloneState(state);
  const productionBefore = calcTotalProduction(next);

  let waitSeconds: number;
  if (productionBefore <= 0) {
    waitSeconds = next.ore >= action.cost ? 0 : Infinity;
  } else {
    waitSeconds = Math.max(0, (action.cost - next.ore) / productionBefore);
  }

  // 等待并扣费
  next.ore = next.ore + waitSeconds * productionBefore - action.cost;

  // 修改状态。只有 buy 动作会改变解锁拓扑，其他动作可省略 recalculateUnlocks（P16）。
  let unlockMayChange = false;
  switch (action.type) {
    case 'buy': {
      const b = next.buildings[action.buildingId!];
      b.count += 1;
      b.nextBuyCost *= GROWTH_FACTOR;
      unlockMayChange = true;
      break;
    }
    case 'upgrade': {
      const b = next.buildings[action.buildingId!];
      b.baseProduction *= (b.level + 1) / b.level;
      b.level += 1;
      break;
    }
    case 'hireServant': {
      const b = next.buildings[action.buildingId!];
      const amount = action.amount ?? 1;
      b.servantCount += amount;
      b.nextServantCost *= Math.pow(SERVANT_PRICE_GROWTH_FACTOR, amount);
      break;
    }
    case 'upgradeServantSkill': {
      next.servantSkillLevel += 1;
      next.nextServantSkillCost *= SERVANT_SKILL_COST_GROWTH_FACTOR;
      break;
    }
  }

  if (unlockMayChange) recalculateUnlocks(next);
  const productionAfter = calcTotalProduction(next);

  const step: TimelineStep = {
    action,
    waitSeconds,
    totalSeconds: 0, // 由调用方累加
    productionBefore,
    productionAfter,
    oreAfter: next.ore
  };

  return { state: next, step };
}

export interface SimulateOptions {
  horizonSeconds?: number;
  maxSteps?: number;
}

/**
 * 在执行 best 动作的长 wait 之前，先把所有「当前 ore 已经够付且回本时间 < waitSeconds」
 * 的小动作执行掉（P8）。这些小动作严格优势：等同样长时间，先做它们带来的产量增益更大。
 * 每执行一个小动作就重新排序候选（产量、ore 都变了）。返回穿插的步骤数组。
 */
function drainAffordableQuickWins(
  state: GameState,
  waitBudget: number,
  timeline: TimelineStep[],
  elapsedRef: { value: number },
  horizonSeconds: number,
  safetyLimit = 50
): GameState {
  let safety = 0;
  while (safety++ < safetyLimit) {
    if (elapsedRef.value >= horizonSeconds) return state;
    const production = calcTotalProduction(state);
    if (production <= 0) return state;

    // 找出"立刻买得起"且"回本时间 < 当前 wait 预算"的最佳动作
    const candidate = scoreAndSortActions(state).find(
      a =>
        a.cost <= state.ore + EPS &&
        isFinite(a.paybackSeconds) &&
        a.paybackSeconds < waitBudget &&
        a.waitSeconds < EPS
    );
    if (!candidate) return state;

    const result = performAction(state, candidate);
    // 小动作 waitSeconds 应当为 0（已经买得起），不消耗时间
    state = result.state;
    elapsedRef.value += result.step.waitSeconds;
    timeline.push({
      ...result.step,
      totalSeconds: elapsedRef.value
    });
  }
  return state;
}

/** 贪心路线模拟 */
export function simulateGreedyPlan(
  initialState: GameState,
  options: SimulateOptions = {}
): GreedyPlanResult {
  const horizonSeconds = options.horizonSeconds ?? DEFAULT_HORIZON_SECONDS;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;

  let state = cloneState(initialState);
  recalculateUnlocks(state);
  const initialProduction = calcTotalProduction(state);
  const elapsedRef = { value: 0 };
  const timeline: TimelineStep[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const production = calcTotalProduction(state);
    if (production <= 0) break;
    if (elapsedRef.value >= horizonSeconds) break;

    const actions = scoreAndSortActions(state);
    const best = actions[0];
    if (!best) break;
    if (!isFinite(best.scoreSeconds)) break;
    if (elapsedRef.value + best.waitSeconds > horizonSeconds) break;

    // P8: 如果 best 需要等待，先穿插立即可执行的小动作
    if (best.waitSeconds > 1 && timeline.length < maxSteps - 1) {
      const beforeLen = timeline.length;
      state = drainAffordableQuickWins(state, best.waitSeconds, timeline, elapsedRef, horizonSeconds);
      // 如果穿插了小动作，状态变了，需要重新挑 best
      if (timeline.length !== beforeLen) continue;
    }

    const result = performAction(state, best);
    state = result.state;
    elapsedRef.value += result.step.waitSeconds;
    timeline.push({
      ...result.step,
      totalSeconds: elapsedRef.value
    });
  }

  return {
    finalState: state,
    timeline,
    elapsedSeconds: elapsedRef.value,
    finalProduction: calcTotalProduction(state),
    initialProduction
  };
}

/** 硬冲解锁模拟：仅购买当前前沿建筑直到目标解锁 */
export function simulateHardUnlock(
  initialState: GameState,
  targetBuildingId: number
): HardUnlockResult {
  let state = cloneState(initialState);
  recalculateUnlocks(state);

  if (targetBuildingId < 0 || targetBuildingId >= state.buildings.length) {
    return {
      finalState: state,
      timeline: [],
      totalSeconds: 0,
      firstBuyTotalSeconds: null,
      reachable: false,
      reason: '目标建筑 id 越界'
    };
  }

  // 已解锁
  if (state.buildings[targetBuildingId].unlocked) {
    const target = state.buildings[targetBuildingId];
    const production = calcTotalProduction(state);
    let firstBuyTotal: number | null = null;
    if (target.nextBuyCost > 0 && production > 0) {
      const wait = Math.max(0, (target.nextBuyCost - state.ore) / production);
      firstBuyTotal = wait;
    }
    return {
      finalState: state,
      timeline: [],
      totalSeconds: 0,
      firstBuyTotalSeconds: firstBuyTotal,
      reachable: true
    };
  }

  const timeline: TimelineStep[] = [];
  let totalSeconds = 0;
  let safety = 0;

  while (!state.buildings[targetBuildingId].unlocked) {
    if (safety++ > 500) {
      return {
        finalState: state,
        timeline,
        totalSeconds,
        firstBuyTotalSeconds: null,
        reachable: false,
        reason: '硬冲模拟超出步数上限'
      };
    }
    const frontierId = getHighestUnlockedId(state);
    const frontier = state.buildings[frontierId];

    if (frontier.count >= NEXT_BUILDING_UNLOCK_COUNT) {
      recalculateUnlocks(state);
      continue;
    }

    if (frontier.nextBuyCost <= 0 || frontier.baseProduction <= 0) {
      return {
        finalState: state,
        timeline,
        totalSeconds,
        firstBuyTotalSeconds: null,
        reachable: false,
        reason: `${frontier.name} 缺少购买价格或产出数据`
      };
    }

    const production = calcTotalProduction(state);
    if (production <= 0) {
      return {
        finalState: state,
        timeline,
        totalSeconds,
        firstBuyTotalSeconds: null,
        reachable: false,
        reason: '当前秒产为 0，无法计算等待时间'
      };
    }

    const actions = listGreedyActions(state);
    const buyAction = actions.find(a => a.type === 'buy' && a.buildingId === frontierId);
    if (!buyAction) {
      return {
        finalState: state,
        timeline,
        totalSeconds,
        firstBuyTotalSeconds: null,
        reachable: false,
        reason: '无法生成前沿建筑购买动作'
      };
    }

    const scored = scoreAction(buyAction, state, production);
    const result = performAction(state, scored);
    state = result.state;
    totalSeconds += result.step.waitSeconds;
    timeline.push({
      ...result.step,
      totalSeconds
    });
  }

  // 目标已解锁，计算首购等待时间
  const target = state.buildings[targetBuildingId];
  let firstBuyTotalSeconds: number | null = null;
  if (target.nextBuyCost > 0) {
    const production = calcTotalProduction(state);
    if (production > 0) {
      const wait = Math.max(0, (target.nextBuyCost - state.ore) / production);
      firstBuyTotalSeconds = totalSeconds + wait;
    }
  }

  return {
    finalState: state,
    timeline,
    totalSeconds,
    firstBuyTotalSeconds,
    reachable: true
  };
}
