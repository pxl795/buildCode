import {
  DEFAULT_HORIZON_SECONDS,
  DEFAULT_MAX_STEPS,
  FRONTIER_UNLOCK_DISCOUNT,
  GROWTH_FACTOR,
  NEXT_BUILDING_UNLOCK_COUNT,
  SERVANT_PRICE_GROWTH_FACTOR,
  SERVANT_SKILL_COST_GROWTH_FACTOR
} from './constants';
import { listGreedyActions } from './actions';
import { calcTotalProduction } from './formulas';
import { getHighestUnlockedId, recalculateUnlocks } from './unlock';
import type { Action, GameState, GreedyPlanResult, HardUnlockResult, TimelineStep } from './types';

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

  return {
    ...action,
    waitSeconds,
    paybackSeconds,
    scoreSeconds,
    rawScoreSeconds
  };
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

  // 修改状态
  switch (action.type) {
    case 'buy': {
      const b = next.buildings[action.buildingId!];
      b.count += 1;
      b.nextBuyCost *= GROWTH_FACTOR;
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

  recalculateUnlocks(next);
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
  let elapsedSeconds = 0;
  const timeline: TimelineStep[] = [];

  for (let step = 0; step < maxSteps; step++) {
    const production = calcTotalProduction(state);
    if (production <= 0) break;
    if (elapsedSeconds >= horizonSeconds) break;

    const actions = scoreAndSortActions(state);
    const best = actions[0];
    if (!best) break;
    if (!isFinite(best.scoreSeconds)) break;
    if (elapsedSeconds + best.waitSeconds > horizonSeconds) break;

    const result = performAction(state, best);
    state = result.state;
    elapsedSeconds += result.step.waitSeconds;
    timeline.push({
      ...result.step,
      totalSeconds: elapsedSeconds
    });
  }

  return {
    finalState: state,
    timeline,
    elapsedSeconds,
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
