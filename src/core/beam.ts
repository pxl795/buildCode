import { DEFAULT_HORIZON_SECONDS, DEFAULT_MAX_STEPS } from './constants';
import { listGreedyActions } from './actions';
import { calcTotalProduction } from './formulas';
import { recalculateUnlocks } from './unlock';
import { cloneState, performAction, scoreAction } from './greedy';
import type { GameState, TimelineStep, Action } from './types';

export interface BeamPlanResult {
  finalState: GameState;
  timeline: TimelineStep[];
  elapsedSeconds: number;
  finalProduction: number;
  initialProduction: number;
}

interface BeamCandidate {
  state: GameState;
  timeline: TimelineStep[];
  elapsedSeconds: number;
  cumulativeProduction: number;
}

export interface BeamOptions {
  horizonSeconds?: number;
  maxSteps?: number;
  beamWidth?: number;
}

/**
 * Beam Search 路线模拟。
 * 与贪心不同：贪心每步只选 1 个最佳动作（score = wait + payback 最小）；
 * Beam 每步保留 beamWidth 个最佳状态，按累计产量排序，最终选产量最高的路径。
 */
export function simulateBeamPlan(
  initialState: GameState,
  options: BeamOptions = {}
): BeamPlanResult {
  const horizonSeconds = options.horizonSeconds ?? DEFAULT_HORIZON_SECONDS;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const beamWidth = options.beamWidth ?? 3;

  let startState = cloneState(initialState);
  recalculateUnlocks(startState);
  const initialProduction = calcTotalProduction(startState);

  // 初始 beam：只有一个状态
  let beam: BeamCandidate[] = [{
    state: startState,
    timeline: [],
    elapsedSeconds: 0,
    cumulativeProduction: 0
  }];

  for (let step = 0; step < maxSteps; step++) {
    const candidates: BeamCandidate[] = [];

    for (const node of beam) {
      const production = calcTotalProduction(node.state);
      if (production <= 0) continue;
      if (node.elapsedSeconds >= horizonSeconds) continue;

      const actions = listGreedyActions(node.state).map(a => scoreAction(a, node.state, production));

      // 对每个 beam 节点，扩展 top-k 个动作（按贪心分数排序后取前几个）
      const expandCount = Math.min(actions.length, beamWidth + 2);
      for (let i = 0; i < expandCount; i++) {
        const action = actions[i];
        if (!action || !isFinite(action.scoreSeconds)) break;
        if (node.elapsedSeconds + action.waitSeconds > horizonSeconds) break;

        const result = performAction(node.state, action);
        // 这一步等待期间产出的矿石 = productionBefore × waitSeconds
        const stepProduction = result.step.productionBefore * result.step.waitSeconds;
        const newCumulative = node.cumulativeProduction + stepProduction;

        candidates.push({
          state: result.state,
          timeline: [
            ...node.timeline,
            { ...result.step, totalSeconds: node.elapsedSeconds + result.step.waitSeconds }
          ],
          elapsedSeconds: node.elapsedSeconds + result.step.waitSeconds,
          cumulativeProduction: newCumulative
        });
      }
    }

    if (candidates.length === 0) break;

    // 按累计产量降序排列，保留 beamWidth 个最佳
    candidates.sort((a, b) => b.cumulativeProduction - a.cumulativeProduction);
    beam = candidates.slice(0, beamWidth);
  }

  // 从最终 beam 中选取累计产量最高的路径
  let best = beam[0];
  for (const node of beam) {
    if (node.cumulativeProduction > best.cumulativeProduction) {
      best = node;
    }
  }

  const finalProduction = calcTotalProduction(best.state);

  return {
    finalState: best.state,
    timeline: best.timeline,
    elapsedSeconds: best.elapsedSeconds,
    finalProduction,
    initialProduction
  };
}
