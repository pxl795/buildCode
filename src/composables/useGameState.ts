import { computed, reactive, ref, watchEffect } from 'vue';
import { createDefaultState } from '../data/defaultState';
import {
  calcDailyProduction,
  calcTotalProduction,
  countUnlocked,
  getHighestUnlockedId,
  getNextBuildingId,
  performAction,
  recalculateUnlocks,
  scoreAndSortActions,
  simulateGreedyPlan,
  simulateHardUnlock
} from '../core';
import type { Action, Building, GameState } from '../core/types';

const STORAGE_KEY = 'spirit-ore-calc:state-v1';

function loadFromStorage(): GameState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.buildings)) {
      return parsed as GameState;
    }
  } catch (e) {
    console.warn('localStorage 读取失败', e);
  }
  return null;
}

function saveToStorage(state: GameState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('localStorage 保存失败', e);
  }
}

export function useGameState() {
  const initial = loadFromStorage() ?? createDefaultState();
  // 保证解锁状态正确
  recalculateUnlocks(initial);
  const gameState = reactive<GameState>(initial);
  const maxSteps = ref<number>(20);

  // ===== 撤销栈 =====
  const HISTORY_LIMIT = 30;
  const history = ref<{ snapshot: GameState; label: string }[]>([]);
  const canUndo = computed(() => history.value.length > 0);

  function snapshotState(): GameState {
    return {
      ...gameState,
      buildings: gameState.buildings.map(b => ({ ...b }))
    } as GameState;
  }

  function pushHistory(label: string) {
    history.value.push({ snapshot: snapshotState(), label });
    if (history.value.length > HISTORY_LIMIT) history.value.shift();
  }

  function restoreSnapshot(snap: GameState) {
    Object.assign(gameState, snap);
    gameState.buildings = snap.buildings.map(b => ({ ...b }));
    recalculateUnlocks(gameState);
  }

  function undo(): { ok: boolean; message: string; label?: string } {
    const item = history.value.pop();
    if (!item) return { ok: false, message: '没有可撤销的操作' };
    restoreSnapshot(item.snapshot);
    return { ok: true, message: `已撤销：${item.label}`, label: item.label };
  }

  function clearHistory() {
    history.value = [];
  }

  // ===== 派生计算 =====
  const totalProduction = computed(() => calcTotalProduction(gameState));
  const dailyProduction = computed(() => calcDailyProduction(gameState));
  const unlockedCount = computed(() => countUnlocked(gameState));
  const frontierId = computed(() => getHighestUnlockedId(gameState));
  const frontierBuilding = computed(() => gameState.buildings[frontierId.value]);
  const nextBuildingId = computed(() => getNextBuildingId(gameState));
  const nextBuilding = computed(() => {
    const id = nextBuildingId.value;
    return id == null ? null : gameState.buildings[id];
  });

  const sortedActions = computed<Action[]>(() => scoreAndSortActions(gameState));
  const bestAction = computed<Action | null>(() => sortedActions.value[0] ?? null);

  // 贪心路线模拟：仅用步数控制，时间窗口设为无限大让算法走完
  const greedyPlan = computed(() =>
    simulateGreedyPlan(gameState, {
      horizonSeconds: 1e15,
      maxSteps: maxSteps.value
    })
  );

  const hardUnlock = computed(() => simulateHardUnlock(gameState, gameState.targetBuildingId));

  // ===== 修改方法 =====

  function updateBuilding(id: number, field: keyof Building, value: number | boolean | string) {
    const b = gameState.buildings[id];
    if (!b) return;
    if (field === 'unlocked') {
      // 解锁手动开关：仅在前置满足时允许打开
      b.unlocked = !!value;
    } else if (field === 'name') {
      // 名称：去除首尾空白，空字符串忽略避免误清空
      const s = String(value ?? '').trim();
      if (s.length > 0) b.name = s.slice(0, 20);
    } else if (typeof value === 'number') {
      // 边界
      let v = value;
      if (Number.isNaN(v)) v = 0;
      if (field === 'count') v = Math.max(0, Math.min(50, Math.round(v)));
      else if (field === 'level') v = Math.max(1, Math.min(6, Math.round(v)));
      else if (field === 'servantCount') v = Math.max(0, Math.round(v));
      else v = Math.max(0, v);

      // ===== 联动推算 =====
      // count 变化 → nextBuyCost 按 1.25^Δ 缩放
      if (field === 'count') {
        const delta = v - b.count;
        if (delta !== 0 && b.nextBuyCost > 0) {
          b.nextBuyCost *= Math.pow(1.25, delta);
        }
      }
      // level 变化 → baseProduction 按 newLevel/oldLevel 缩放（baseProduction(L) = base1 × L）
      else if (field === 'level') {
        if (b.level > 0 && v > 0 && b.level !== v && b.baseProduction > 0) {
          b.baseProduction *= v / b.level;
        }
      }
      // servantCount 变化 → nextServantCost 按 1.1^Δ 缩放
      else if (field === 'servantCount') {
        const delta = v - b.servantCount;
        if (delta !== 0 && b.nextServantCost > 0) {
          b.nextServantCost *= Math.pow(1.1, delta);
        }
      }

      (b as any)[field] = v;
    }
    recalculateUnlocks(gameState);
  }

  function updateGlobal<K extends keyof GameState>(field: K, value: GameState[K]) {
    if (field === 'buildings') return;
    if (typeof gameState[field] === 'number' && typeof value === 'number') {
      let v = value as number;
      if (Number.isNaN(v)) v = 0;
      if (field === 'productionMultiplier') v = Math.max(0, v);
      else if (field === 'servantSkillLevel') v = Math.max(1, Math.round(v));
      else if (field === 'targetBuildingId') v = Math.max(0, Math.min(15, Math.round(v)));
      else v = Math.max(0, v);
      (gameState as any)[field] = v;
    } else {
      (gameState as any)[field] = value;
    }
    recalculateUnlocks(gameState);
  }

  function setMaxSteps(steps: number) {
    maxSteps.value = Math.max(1, Math.round(steps));
  }

  /** 把当前贪心推荐的最佳动作应用到游戏状态：自动等待 + 扣费 + 修改建筑 */
  function applyBestAction(): { ok: boolean; message: string; waitSeconds?: number; label?: string } {
    const action = bestAction.value;
    if (!action) {
      return { ok: false, message: '当前没有可执行的推荐动作' };
    }
    if (!isFinite(action.scoreSeconds) || !isFinite(action.waitSeconds)) {
      return { ok: false, message: '推荐动作不可执行（等待时间无穷）' };
    }
    // 入栈历史以便撤销
    pushHistory(action.label);
    const result = performAction(gameState as GameState, action);
    const next = result.state;
    // 回写到响应式 state
    gameState.ore = next.ore;
    gameState.servantSkillLevel = next.servantSkillLevel;
    gameState.nextServantSkillCost = next.nextServantSkillCost;
    gameState.productionMultiplier = next.productionMultiplier;
    gameState.targetBuildingId = next.targetBuildingId;
    for (let i = 0; i < next.buildings.length; i++) {
      Object.assign(gameState.buildings[i], next.buildings[i]);
    }
    recalculateUnlocks(gameState);
    return {
      ok: true,
      message: `已执行：${action.label}`,
      waitSeconds: result.step.waitSeconds,
      label: action.label
    };
  }

  function exportState(): string {
    return JSON.stringify(
      {
        version: 7,
        state: gameState,
        settings: { maxSteps: maxSteps.value }
      },
      null,
      2
    );
  }

  function importState(json: string): { ok: boolean; message: string } {
    try {
      const parsed = JSON.parse(json);
      const s: GameState = parsed.state ?? parsed;
      if (!s || !Array.isArray(s.buildings)) {
        return { ok: false, message: '数据格式错误：缺少 buildings 数组' };
      }
      Object.assign(gameState, s);
      // 重建 buildings 引用
      gameState.buildings = s.buildings.map(b => ({ ...b }));
      recalculateUnlocks(gameState);
      if (typeof parsed.settings?.maxSteps === 'number') {
        maxSteps.value = parsed.settings.maxSteps;
      }
      clearHistory();
      return { ok: true, message: '导入成功' };
    } catch (e: any) {
      return { ok: false, message: 'JSON 解析失败：' + (e?.message ?? e) };
    }
  }

  function resetToDefault() {
    const def = createDefaultState();
    Object.assign(gameState, def);
    gameState.buildings = def.buildings.map(b => ({ ...b }));
    recalculateUnlocks(gameState);
    clearHistory();
  }

  // 持久化
  watchEffect(() => {
    saveToStorage(gameState);
  });

  return {
    gameState,
    maxSteps,
    // 派生
    totalProduction,
    dailyProduction,
    unlockedCount,
    frontierBuilding,
    nextBuilding,
    sortedActions,
    bestAction,
    greedyPlan,
    hardUnlock,
    // 方法
    canUndo,
    updateBuilding,
    updateGlobal,
    setMaxSteps,
    applyBestAction,
    undo,
    exportState,
    importState,
    resetToDefault
  };
}

export type UseGameState = ReturnType<typeof useGameState>;
