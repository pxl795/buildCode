<script setup lang="ts">
import { ref } from 'vue';
import GlobalInput from './components/GlobalInput.vue';
import Overview from './components/Overview.vue';
import BuildingTable from './components/BuildingTable.vue';
import ServantTable from './components/ServantTable.vue';
import Recommendation from './components/Recommendation.vue';
import GreedyTimeline from './components/GreedyTimeline.vue';
import { useGameState } from './composables/useGameState';

const game = useGameState();
const message = ref<string>('');

function handleExport() {
  const json = game.exportState();
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(json).then(
      () => flash('已复制 JSON 到剪贴板'),
      () => downloadJson(json)
    );
  } else {
    downloadJson(json);
  }
}

function downloadJson(json: string) {
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `spirit-ore-state-${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  flash('已下载存档 JSON');
}

function handleImport() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const res = game.importState(String(reader.result));
      flash(res.message);
    };
    reader.readAsText(file);
  };
  input.click();
}

function handleReset() {
  if (confirm('确认重置为默认样例数据吗？')) {
    game.resetToDefault();
    flash('已重置为默认数据');
  }
}

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

    <Recommendation
      :best-action="game.bestAction.value"
      :sorted-actions="game.sortedActions.value"
      :current-production="game.totalProduction.value"
    />

    <GreedyTimeline
      :plan="game.greedyPlan.value"
      :max-steps="game.maxSteps.value"
      @change-max-steps="game.setMaxSteps"
    />

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
