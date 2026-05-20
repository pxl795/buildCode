<script setup lang="ts">
import { computed } from 'vue';
import type { Building, GameState, HardUnlockResult } from '../core/types';
import { formatNumber, formatNumberFull, formatProduction, formatTime } from '../utils/format';

const props = defineProps<{
  gameState: GameState;
  totalProduction: number;
  dailyProduction: number;
  unlockedCount: number;
  frontierBuilding: Building;
  nextBuilding: Building | null;
  hardUnlock: HardUnlockResult;
}>();

const targetBuilding = computed<Building | null>(() => {
  const id = props.gameState.targetBuildingId;
  return props.gameState.buildings[id] ?? null;
});

const hardUnlockText = computed(() => {
  const r = props.hardUnlock;
  if (!r.reachable) return r.reason ?? '无法计算';
  return formatTime(r.totalSeconds);
});

const firstBuyText = computed(() => {
  const r = props.hardUnlock;
  if (!r.reachable) return '—';
  if (r.firstBuyTotalSeconds == null) return '数据缺失（baseProduction/nextBuyCost = 0）';
  return formatTime(r.firstBuyTotalSeconds);
});
</script>

<template>
  <section class="card">
    <h3 class="card-title">总览</h3>
    <div class="metrics">
      <div class="metric primary-metric">
        <div class="metric-label">当前秒产</div>
        <div class="metric-value mono">{{ formatProduction(props.totalProduction) }}</div>
        <div class="metric-sub mono">{{ formatNumberFull(props.totalProduction, 2) }}/s</div>
      </div>

      <div class="metric">
        <div class="metric-label">预计日产</div>
        <div class="metric-value mono">{{ formatNumber(props.dailyProduction, 2) }}</div>
        <div class="metric-sub mono">{{ formatNumberFull(props.dailyProduction, 0) }}</div>
      </div>

      <div class="metric">
        <div class="metric-label">已解锁建筑</div>
        <div class="metric-value">
          {{ props.unlockedCount }}<span class="metric-sub-inline">/16</span>
        </div>
      </div>

      <div class="metric">
        <div class="metric-label">当前前沿</div>
        <div class="metric-value">{{ props.frontierBuilding.name }}</div>
        <div class="metric-sub">数量 {{ props.frontierBuilding.count }} / 5</div>
      </div>

      <div class="metric">
        <div class="metric-label">下一类建筑</div>
        <div class="metric-value">
          {{ props.nextBuilding ? props.nextBuilding.name : '—' }}
        </div>
        <div class="metric-sub">{{ props.nextBuilding ? '待解锁' : '全部已解锁' }}</div>
      </div>

      <div class="metric">
        <div class="metric-label">硬冲解锁目标</div>
        <div class="metric-value mono">{{ hardUnlockText }}</div>
        <div class="metric-sub">
          目标：{{ targetBuilding?.name ?? '—' }}
        </div>
      </div>

      <div class="metric">
        <div class="metric-label">目标首购总时间</div>
        <div class="metric-value mono">{{ firstBuyText }}</div>
        <div class="metric-sub">硬冲 + 首购等待</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.metrics {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}
.metric {
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.metric-label {
  font-size: 11px;
  color: var(--text-dim);
  letter-spacing: 0.05em;
}
.metric-value {
  font-size: 18px;
  font-weight: 600;
  color: var(--text);
  word-break: break-all;
}
.metric-sub {
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
}
.metric-sub-inline {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 400;
  margin-left: 2px;
}
.primary-metric {
  background: linear-gradient(135deg, rgba(110,168,255,0.12), rgba(167,133,255,0.08));
  border-color: rgba(110,168,255,0.4);
}
.primary-metric .metric-value {
  color: var(--accent);
  font-size: 20px;
}
@media (max-width: 600px) {
  .metrics {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }
  .metric { padding: 10px; }
  .metric-value { font-size: 16px; }
  .primary-metric { grid-column: span 2; }
  .primary-metric .metric-value { font-size: 22px; }
}
</style>
