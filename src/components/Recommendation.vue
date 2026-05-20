<script setup lang="ts">
import { computed } from 'vue';
import type { Action } from '../core/types';
import { formatNumber, formatNumberFull, formatTime } from '../utils/format';

const props = defineProps<{
  bestAction: Action | null;
  sortedActions: Action[];
  currentProduction: number;
}>();

const topActions = computed(() => props.sortedActions.slice(0, 10));

function deltaPct(a: Action) {
  if (props.currentProduction <= 0) return '—';
  return ((a.deltaProduction / props.currentProduction) * 100).toFixed(1) + '%';
}

function typeTag(t: Action['type']) {
  switch (t) {
    case 'buy': return { cls: 'blue', text: '购买' };
    case 'upgrade': return { cls: 'purple', text: '升级' };
    case 'hireServant': return { cls: 'green', text: '招募' };
    case 'upgradeServantSkill': return { cls: 'gold', text: '技艺' };
  }
}
</script>

<template>
  <section class="card">
    <h3 class="card-title">贪心推荐</h3>

    <div v-if="!props.bestAction" class="empty-rec">
      当前没有可执行动作。请检查建筑/杂役数据是否完整。
    </div>

    <div v-else class="best-rec">
      <div class="best-head">
        <span class="best-badge">推荐</span>
        <span class="best-label">{{ props.bestAction.label }}</span>
      </div>
      <div class="best-grid">
        <div class="best-cell">
          <div class="cell-label">花费</div>
          <div class="cell-value mono">{{ formatNumberFull(props.bestAction.cost, 0) }}</div>
          <div class="cell-sub mono">{{ formatNumber(props.bestAction.cost) }}</div>
        </div>
        <div class="best-cell">
          <div class="cell-label">增产</div>
          <div class="cell-value mono text-green">+{{ formatNumber(props.bestAction.deltaProduction) }}/s</div>
          <div class="cell-sub">{{ deltaPct(props.bestAction) }} 当前秒产</div>
        </div>
        <div class="best-cell">
          <div class="cell-label">等待</div>
          <div class="cell-value mono">{{ formatTime(props.bestAction.waitSeconds) }}</div>
          <div class="cell-sub mono">{{ formatNumber(props.bestAction.waitSeconds) }} 秒</div>
        </div>
        <div class="best-cell">
          <div class="cell-label">回本</div>
          <div class="cell-value mono">{{ formatTime(props.bestAction.paybackSeconds) }}</div>
          <div class="cell-sub mono">{{ formatNumber(props.bestAction.paybackSeconds) }} 秒</div>
        </div>
        <div class="best-cell">
          <div class="cell-label">折扣后得分</div>
          <div class="cell-value mono text-accent">{{ formatTime(props.bestAction.scoreSeconds) }}</div>
          <div class="cell-sub mono">原始 {{ formatTime(props.bestAction.rawScoreSeconds) }}</div>
        </div>
      </div>
      <div class="best-reason">
        <span class="tag gold">原因</span>
        <span>{{ props.bestAction.reason }}</span>
      </div>
    </div>

    <h4 class="sub-title">候选动作 Top 10</h4>
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th style="width: 36px;">#</th>
            <th style="width: 60px;">类型</th>
            <th style="min-width: 160px;">动作</th>
            <th class="num">花费</th>
            <th class="num">增产/s</th>
            <th class="num">等待</th>
            <th class="num">回本</th>
            <th class="num">得分</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(a, idx) in topActions" :key="idx">
            <td class="rank">{{ idx + 1 }}</td>
            <td>
              <span class="tag" :class="typeTag(a.type).cls">{{ typeTag(a.type).text }}</span>
            </td>
            <td>{{ a.label }}</td>
            <td class="num">{{ formatNumber(a.cost) }}</td>
            <td class="num text-green">+{{ formatNumber(a.deltaProduction) }}</td>
            <td class="num">{{ formatTime(a.waitSeconds) }}</td>
            <td class="num">{{ formatTime(a.paybackSeconds) }}</td>
            <td class="num">{{ formatTime(a.scoreSeconds) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.empty-rec {
  padding: 24px;
  text-align: center;
  color: var(--text-muted);
}
.best-rec {
  background: linear-gradient(135deg, rgba(110,168,255,0.10), rgba(167,133,255,0.06));
  border: 1px solid rgba(110,168,255,0.3);
  border-radius: var(--radius);
  padding: 16px;
  margin-bottom: 16px;
}
.best-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.best-badge {
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.best-label {
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
}
.best-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}
.best-cell {
  background: rgba(0,0,0,0.2);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
}
.cell-label {
  font-size: 11px;
  color: var(--text-dim);
  margin-bottom: 2px;
}
.cell-value {
  font-size: 15px;
  font-weight: 600;
  word-break: break-all;
}
.cell-sub {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
  word-break: break-all;
}
.best-reason {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-dim);
  font-size: 13px;
}
.sub-title {
  margin: 8px 0 10px;
  font-size: 13px;
  color: var(--text-dim);
  font-weight: 500;
}
.rank {
  font-family: var(--font-mono);
  color: var(--text-muted);
  text-align: center;
}
@media (max-width: 600px) {
  .best-label { font-size: 17px; }
  .best-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .cell-value { font-size: 14px; }
}
</style>
