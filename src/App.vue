<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import GlobalInput from './components/GlobalInput.vue';
import Overview from './components/Overview.vue';
import BuildingTable from './components/BuildingTable.vue';
import ServantTable from './components/ServantTable.vue';
import GreedyTimeline from './components/GreedyTimeline.vue';
import { useGameState } from './composables/useGameState';

const game = useGameState();
const message = ref<string>('');

function handleReset() {
  if (confirm('确认重置为默认样例数据吗？')) {
    game.resetToDefault();
    flash('已重置为默认数据');
  }
}

function handleApplyBest() {
  const res = game.applyBestAction();
  if (!res.ok) {
    flash(res.message);
    return;
  }
  const wait = res.waitSeconds ?? 0;
  const waitTxt = wait < 1 ? '<1 秒' : wait < 60
    ? `${wait.toFixed(1)} 秒`
    : wait < 3600
      ? `${(wait / 60).toFixed(1)} 分`
      : `${(wait / 3600).toFixed(2)} 小时`;
  flash(`${res.message}（等待 ${waitTxt}）`);
}

function handleUndo() {
  const res = game.undo();
  flash(res.message);
}

function onKeydown(ev: KeyboardEvent) {
  // Ctrl+Z / Cmd+Z 撤销（避免与文本输入框的撤销冲突：在 input/textarea 里不拦截）
  if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && (ev.key === 'z' || ev.key === 'Z')) {
    const tgt = ev.target as HTMLElement | null;
    const tag = tgt?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tgt?.isContentEditable) return;
    ev.preventDefault();
    handleUndo();
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));

function flash(msg: string) {
  message.value = msg;
  setTimeout(() => {
    if (message.value === msg) message.value = '';
  }, 2200);
}
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <h1 class="app-title">灵矿石策略计算器</h1>
        <span class="app-subtitle">贪心算法 · 下一步推荐 · 路线模拟</span>
      </div>
      <div class="app-actions">
        <button
          class="ghost"
          :disabled="!game.canUndo.value"
          :title="game.canUndo.value ? '撤销上一步执行（Ctrl+Z）' : '没有可撤销的操作'"
          @click="handleUndo"
        >
          ↶ 撤销上一步执行
        </button>
        <button class="ghost" @click="handleReset">重置默认</button>
      </div>
    </header>

    <Transition>
      <div v-if="message" class="toast">{{ message }}</div>
    </Transition>

    <GlobalInput
      :game-state="game.gameState"
      @update="(f, v) => game.updateGlobal(f as any, v as any)"
    />

    <Overview
      :game-state="game.gameState"
      :total-production="game.totalProduction.value"
      :daily-production="game.dailyProduction.value"
      :unlocked-count="game.unlockedCount.value"
      :frontier-building="game.frontierBuilding.value"
      :next-building="game.nextBuilding.value"
      :hard-unlock="game.hardUnlock.value"
    />

    <GreedyTimeline
      :plan="game.greedyPlan.value"
      :max-steps="game.maxSteps.value"
      @change-max-steps="game.setMaxSteps"
      @apply="handleApplyBest"
    />

    <div class="two-col">
      <BuildingTable
        :game-state="game.gameState"
        @update="(id, f, v) => game.updateBuilding(id, f as any, v as any)"
      />
      <ServantTable
        :game-state="game.gameState"
        @update="(id, f, v) => game.updateBuilding(id, f as any, v as any)"
      />
    </div>

    <footer class="app-footer">
      <span>贪心算法 · 前沿解锁折扣 0.5 · 不代表全局最优</span>
    </footer>
  </div>
</template>

<style scoped>
.app-footer {
  text-align: center;
  padding: 12px 0 32px;
  color: var(--text-muted);
  font-size: 12px;
}
.toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 100;
  background: var(--bg-elev-2);
  border: 1px solid var(--border-strong);
  color: var(--text);
  padding: 8px 14px;
  border-radius: 999px;
  font-size: 13px;
  box-shadow: var(--shadow);
}
.v-enter-active, .v-leave-active { transition: all .2s ease; }
.v-enter-from { opacity: 0; transform: translate(-50%, -8px); }
.v-leave-to { opacity: 0; transform: translate(-50%, -8px); }
</style>
