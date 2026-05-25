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
  /** 每个 beam 节点扩展的动作数量。默认 max(beamWidth + 2, 6)。 */
  expandCount?: number;
}

/**
 * 节点最终估值（P12）：截至 horizon 的总产 ore = 已累计 + 剩余时间 × 当前产量。
 * 这样 beam 会同时考虑「已经赚的」+「未来还能赚的」。
 */
function nodeScore(node: BeamCandidate, horizonSeconds: number): number {
  const remaining = Math.max(0, horizonSeconds - node.elapsedSeconds);
  const tailProduction = calcTotalProduction(node.state) * remaining;
  return node.cumulativeProduction + tailProduction + node.state.ore;
}

/**
 * Beam Search 路线模拟。
 * 与贪心不同：贪心每步只选 1 个最佳动作（score = wait + payback 最小）；
 * Beam 每步保留 beamWidth 个最佳状态，按 horizon 总产排序，最终选总产最高的路径。
 */
export function simulateBeamPlan(
  initialState: GameState,
  options: BeamOptions = {}
): BeamPlanResult {
  const horizonSeconds = options.horizonSeconds ?? DEFAULT_HORIZON_SECONDS;
  const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS;
  const beamWidth = options.beamWidth ?? 3;
  const expandCount = options.expandCount ?? Math.max(beamWidth + 2, 6);

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

      // 对每个 beam 节点，扩展 top-expandCount 个动作
      const limit = Math.min(actions.length, expandCount);
      for (let i = 0; i < limit; i++) {
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

    // 按 horizon 总产降序，保留 beamWidth 个最佳
    candidates.sort((a, b) => nodeScore(b, horizonSeconds) - nodeScore(a, horizonSeconds));
    beam = candidates.slice(0, beamWidth);
  }

  // 从最终 beam 中选取 horizon 总产最高的路径
  let best = beam[0];
  let bestScore = nodeScore(best, horizonSeconds);
  for (const node of beam) {
    const s = nodeScore(node, horizonSeconds);
    if (s > bestScore) {
      best = node;
      bestScore = s;
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
