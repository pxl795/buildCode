<script setup lang="ts">
import { computed } from 'vue';
import type { GreedyPlanResult } from '../core/types';
import { formatNumber, formatTime } from '../utils/format';

const props = defineProps<{
  plan: GreedyPlanResult;
  maxSteps: number;
}>();

const emit = defineEmits<{
  (e: 'changeMaxSteps', steps: number): void;
  (e: 'apply'): void;
}>();

function canApplyFirst(): boolean {
  const first = props.plan.timeline[0]?.action;
  return !!first && isFinite(first.scoreSeconds) && isFinite(first.waitSeconds);
}

const presets = [
  { label: '20 步', value: 20 },
  { label: '50 步', value: 50 },
  { label: '80 步', value: 80 }
];

const productionDelta = computed(() => {
  const init = props.plan.initialProduction;
  const fin = props.plan.finalProduction;
  if (init <= 0) return 0;
  return ((fin - init) / init) * 100;
});

function typeText(t: string) {
  switch (t) {
    case 'buy': return '购买';
    case 'upgrade': return '升级';
    case 'hireServant': return '招募';
    case 'upgradeServantSkill': return '技艺';
    default: return t;
  }
}
function typeCls(t: string) {
  switch (t) {
    case 'buy': return 'blue';
    case 'upgrade': return 'purple';
    case 'hireServant': return 'green';
    case 'upgradeServantSkill': return 'gold';
    default: return '';
  }
}
</script>

<template>
  <section class="card">
    <div class="header-row">
      <h3 class="card-title" style="margin: 0;">贪心路线</h3>
      <div class="steps-switch">
        <span class="switch-label">模拟步数</span>
        <button
          v-for="p in presets"
          :key="p.value"
          :class="{ primary: props.maxSteps === p.value, ghost: props.maxSteps !== p.value }"
          @click="emit('changeMaxSteps', p.value)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>

    <div class="summary">
      <div class="sum-item">
        <span class="sum-label">实际步数</span>
        <span class="sum-value mono">{{ props.plan.timeline.length }}</span>
      </div>
      <div class="sum-item">
        <span class="sum-label">总耗时</span>
        <span class="sum-value mono">{{ formatTime(props.plan.elapsedSeconds) }}</span>
      </div>
      <div class="sum-item">
        <span class="sum-label">起始秒产</span>
        <span class="sum-value mono">{{ formatNumber(props.plan.initialProduction) }}/s</span>
      </div>
      <div class="sum-item">
        <span class="sum-label">最终秒产</span>
        <span class="sum-value mono text-accent">{{ formatNumber(props.plan.finalProduction) }}/s</span>
      </div>
      <div class="sum-item">
        <span class="sum-label">秒产增长</span>
        <span class="sum-value mono text-green">+{{ productionDelta.toFixed(2) }}%</span>
      </div>
    </div>

    <div v-if="props.plan.timeline.length === 0" class="empty">
      无可执行步骤。可能数据不完整或秒产为 0。
    </div>

    <ol v-else class="timeline">
      <!-- ===== 第一步：放大版 ===== -->
      <li v-if="props.plan.timeline[0]" class="step step-first">
        <div class="hero-head">
          <span class="rec-badge">推荐</span>
          <span class="tag" :class="typeCls(props.plan.timeline[0].action.type)">{{ typeText(props.plan.timeline[0].action.type) }}</span>
          <span class="hero-label">{{ props.plan.timeline[0].action.label }}</span>
          <button
            type="button"
            class="apply-btn"
            :disabled="!canApplyFirst()"
            :title="canApplyFirst() ? '自动等待并执行此步，无需手动改输入框' : '动作不可执行'"
            @click="emit('apply')"
          >
            执行此步
          </button>
        </div>
        <div class="step-meta hero-meta">
          <span>等待 <b class="mono">{{ formatTime(props.plan.timeline[0].waitSeconds) }}</b></span>
          <span>累计 <b class="mono">{{ formatTime(props.plan.timeline[0].totalSeconds) }}</b></span>
          <span>花费 <b class="mono">{{ formatNumber(props.plan.timeline[0].action.cost) }}</b></span>
          <span class="text-green">+{{ formatNumber(props.plan.timeline[0].action.deltaProduction) }}/s</span>
          <span>秒产 <b class="mono">{{ formatNumber(props.plan.timeline[0].productionBefore) }}</b> → <b class="mono text-accent">{{ formatNumber(props.plan.timeline[0].productionAfter) }}</b></span>
        </div>
      </li>

      <!-- ===== 后续步骤：紧凑行 ===== -->
      <li
        v-for="(step, idx) in props.plan.timeline.slice(1)"
        :key="idx + 1"
        class="step"
      >
        <div class="step-index">
          <span class="step-num">{{ idx + 2 }}</span>
        </div>
        <div class="step-body">
          <div class="step-head">
            <span class="tag" :class="typeCls(step.action.type)">{{ typeText(step.action.type) }}</span>
            <span class="step-label">{{ step.action.label }}</span>
          </div>
          <div class="step-meta">
            <span>等待 <b class="mono">{{ formatTime(step.waitSeconds) }}</b></span>
            <span>累计 <b class="mono">{{ formatTime(step.totalSeconds) }}</b></span>
            <span>花费 <b class="mono">{{ formatNumber(step.action.cost) }}</b></span>
            <span class="text-green">+{{ formatNumber(step.action.deltaProduction) }}/s</span>
            <span>秒产 <b class="mono">{{ formatNumber(step.productionBefore) }}</b> → <b class="mono text-accent">{{ formatNumber(step.productionAfter) }}</b></span>
          </div>
        </div>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 14px;
}
.steps-switch {
  display: flex;
  align-items: center;
  gap: 6px;
}
.switch-label {
  color: var(--text-dim);
  font-size: 12px;
  margin-right: 4px;
}
.summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 8px;
  margin-bottom: 14px;
  padding: 12px 14px;
  background: var(--bg-elev-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}
.sum-item { display: flex; flex-direction: column; gap: 2px; }
.sum-label { font-size: 11px; color: var(--text-dim); }
.sum-value { font-size: 14px; font-weight: 600; }
.empty {
  padding: 28px;
  text-align: center;
  color: var(--text-muted);
}
.timeline {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-height: 600px;
  overflow-y: auto;
  padding-right: 4px;
}
.step {
  display: flex;
  gap: 12px;
  padding: 10px 12px;
  background: var(--bg-elev);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  transition: border-color .15s, transform .15s;
}
.step:hover {
  border-color: var(--border-strong);
}
/* ===== 第一步：放大、明显，但不花哨 ===== */
.step-first {
  flex-direction: column;
  gap: 10px;
  padding: 14px 16px;
  background: var(--bg-elev-2);
  border: 2px solid var(--accent);
  border-radius: var(--radius);
}
.step-first:hover {
  border-color: var(--accent);
  background: var(--bg-elev-2);
}
.hero-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.hero-label {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.rec-badge {
  background: var(--accent);
  color: #fff;
  padding: 3px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
}
.apply-btn {
  margin-left: auto;
  background: var(--accent);
  color: #fff;
  border: none;
  padding: 7px 16px;
  border-radius: var(--radius-sm);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: filter .12s ease, opacity .12s ease;
}
.apply-btn:hover:not(:disabled) {
  filter: brightness(1.1);
}
.apply-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.hero-meta {
  font-size: 13px;
}
.hero-meta b {
  font-size: 14px;
}
.step-index {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.step-num {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  font-family: var(--font-mono);
}
.step-body { flex: 1; min-width: 0; }
.step-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}
.step-label { font-weight: 600; }
.step-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 14px;
  font-size: 12px;
  color: var(--text-dim);
}
.step-meta b { color: var(--text); font-weight: 600; }
@media (max-width: 600px) {
  .steps-switch button { padding: 5px 10px; font-size: 12px; }
  .step { padding: 8px 10px; gap: 8px; }
  .step-meta { gap: 6px 10px; font-size: 11px; }
}
</style>
