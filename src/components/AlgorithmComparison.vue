<script setup lang="ts">
import { computed } from 'vue';
import type { GreedyPlanResult } from '../core/types';
import type { BeamPlanResult } from '../core/beam';
import { formatNumber, formatTime } from '../utils/format';

const props = defineProps<{
  greedy3Day: GreedyPlanResult;
  beam3Day: BeamPlanResult;
}>();

const W = 700;
const H = 280;
const PAD = { top: 24, right: 24, bottom: 44, left: 76 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

/** 从 timeline 采样均匀时间点，返回 [time, cumulativeProduction] 数组 */
function sampleCumulative(
  timeline: { productionBefore: number; waitSeconds: number }[],
  horizon: number,
  samples: number = 100
): [number, number][] {
  const result: [number, number][] = [];
  let time = 0;
  let cumulative = 0;
  let stepIdx = 0;

  for (let s = 0; s <= samples; s++) {
    const t = (s / samples) * horizon;

    // 推进 timeline 到时间 t
    while (stepIdx < timeline.length && time + timeline[stepIdx].waitSeconds <= t) {
      const step = timeline[stepIdx];
      cumulative += step.productionBefore * step.waitSeconds;
      time += step.waitSeconds;
      stepIdx++;
    }

    // 如果当前步跨越了采样点，线性插值
    let prodAtT = cumulative;
    if (stepIdx < timeline.length && timeline[stepIdx].waitSeconds > 0) {
      const remaining = t - time;
      if (remaining > 0) {
        prodAtT += timeline[stepIdx].productionBefore * remaining;
      }
    }

    result.push([t, prodAtT]);
  }

  return result;
}

const chartData = computed(() => {
  const greedy = props.greedy3Day;
  const beam = props.beam3Day;
  const horizon = Math.max(greedy.elapsedSeconds, beam.elapsedSeconds, 86400);

  const greedySamples = sampleCumulative(greedy.timeline, horizon, 120);
  const beamSamples = sampleCumulative(beam.timeline, horizon, 120);

  const allY = [
    ...greedySamples.map(([, y]) => y),
    ...beamSamples.map(([, y]) => y)
  ];
  const minY = 0;
  const maxY = Math.max(...allY, 1) * 1.1;

  function mapX(t: number) {
    return PAD.left + (t / horizon) * plotW;
  }
  function mapY(v: number) {
    return PAD.top + plotH - (v / maxY) * plotH;
  }

  function toPath(samples: [number, number][]): string {
    return samples.map(([t, y], i) => {
      const sx = mapX(t);
      const sy = mapY(y);
      return i === 0 ? `M${sx},${sy}` : `L${sx},${sy}`;
    }).join(' ');
  }

  // Y 轴刻度（5个）
  const yTicks: { value: number; label: string; sy: number }[] = [];
  const yStep = maxY / 5;
  for (let i = 0; i <= 5; i++) {
    const val = yStep * i;
    yTicks.push({ value: val, label: formatNumber(val), sy: mapY(val) });
  }

  // X 轴刻度：按小时显示
  const xTicks: { label: string; sx: number }[] = [];
  const hoursTotal = horizon / 3600;
  const hourInterval = hoursTotal <= 12 ? 2 : hoursTotal <= 36 ? 6 : 12;
  for (let h = 0; h <= hoursTotal; h += hourInterval) {
    xTicks.push({ label: `${h}h`, sx: mapX(h * 3600) });
  }
  // 确保最后一个点
  const lastHour = Math.floor(hoursTotal);
  if (lastHour % hourInterval !== 0) {
    xTicks.push({ label: `${lastHour}h`, sx: mapX(lastHour * 3600) });
  }

  // 累计产量终值
  const greedyCumulative = greedySamples[greedySamples.length - 1][1];
  const beamCumulative = beamSamples[beamSamples.length - 1][1];

  return {
    greedyPath: toPath(greedySamples),
    beamPath: toPath(beamSamples),
    yTicks,
    xTicks,
    horizon,
    greedyCumulative,
    beamCumulative
  };
});

const greedyDelta = computed(() => {
  const init = props.greedy3Day.initialProduction;
  if (init <= 0) return 0;
  return ((props.greedy3Day.finalProduction - init) / init) * 100;
});

const beamDelta = computed(() => {
  const init = props.beam3Day.initialProduction;
  if (init <= 0) return 0;
  return ((props.beam3Day.finalProduction - init) / init) * 100;
});

const cumulativeAdvantage = computed(() => {
  if (chartData.value.greedyCumulative <= 0) return 0;
  return ((chartData.value.beamCumulative - chartData.value.greedyCumulative) / chartData.value.greedyCumulative) * 100;
});
</script>

<template>
  <section class="card comparison">
    <h3 class="card-title">3 天累计产量对比</h3>
    <p class="card-desc">贪心 (Greedy) vs 集束搜索 (Beam Search, beamWidth=3) — 相同时间内谁的累计产量更高</p>

    <div v-if="props.greedy3Day.timeline.length === 0 && props.beam3Day.timeline.length === 0" class="empty">
      无可执行步骤，无法对比。
    </div>

    <template v-else>
      <!-- SVG 折线图 -->
      <svg :viewBox="`0 0 ${W} ${H}`" class="chart-svg">
        <!-- 网格线 -->
        <line
          v-for="tick in chartData.yTicks"
          :key="'yg' + tick.value"
          :x1="PAD.left" :y1="tick.sy"
          :x2="PAD.left + plotW" :y2="tick.sy"
          class="grid-line"
        />
        <line
          v-for="tick in chartData.xTicks"
          :key="'xg' + tick.sx"
          :x1="tick.sx" :y1="PAD.top"
          :x2="tick.sx" :y2="PAD.top + plotH"
          class="grid-line"
        />

        <!-- Y 轴标签 -->
        <text
          v-for="tick in chartData.yTicks"
          :key="'yl' + tick.value"
          :x="PAD.left - 8" :y="tick.sy + 4"
          text-anchor="end" class="axis-label"
        >
          {{ tick.label }}
        </text>

        <!-- X 轴标签 -->
        <text
          v-for="tick in chartData.xTicks"
          :key="'xl' + tick.sx"
          :x="tick.sx" :y="PAD.top + plotH + 18"
          text-anchor="middle" class="axis-label"
        >
          {{ tick.label }}
        </text>

        <!-- 轴标题 -->
        <text :x="14" :y="PAD.top + plotH / 2" text-anchor="middle" class="axis-title" transform="rotate(-90, 14, 130)">
          累计产量
        </text>
        <text :x="PAD.left + plotW / 2" :y="H - 4" text-anchor="middle" class="axis-title">
          时间
        </text>

        <!-- 贪心线 -->
        <path :d="chartData.greedyPath" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round" />
        <!-- Beam 线 -->
        <path :d="chartData.beamPath" fill="none" stroke="var(--gold)" stroke-width="2.5" stroke-linejoin="round" stroke-dasharray="6 3" />

        <!-- 图例 -->
        <g :transform="`translate(${PAD.left + plotW - 200}, ${PAD.top + 6})`">
          <line x1="0" y1="6" x2="20" y2="6" stroke="var(--accent)" stroke-width="2.5" />
          <text x="26" y="10" class="legend-text">贪心 {{ props.greedy3Day.timeline.length }}步</text>
          <line x1="0" y1="24" x2="20" y2="24" stroke="var(--gold)" stroke-width="2.5" stroke-dasharray="6 3" />
          <text x="26" y="28" class="legend-text">Beam {{ props.beam3Day.timeline.length }}步</text>
        </g>
      </svg>

      <!-- 数据对比表 -->
      <div class="compare-table">
        <div class="compare-header">
          <span></span>
          <span class="algo-name text-accent">贪心</span>
          <span class="algo-name" style="color: var(--gold);">Beam</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">累计产量</span>
          <span class="mono">{{ formatNumber(chartData.greedyCumulative) }}</span>
          <span class="mono">{{ formatNumber(chartData.beamCumulative) }}</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">最终秒产</span>
          <span class="mono">{{ formatNumber(props.greedy3Day.finalProduction) }}/s</span>
          <span class="mono">{{ formatNumber(props.beam3Day.finalProduction) }}/s</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">秒产增长</span>
          <span class="mono text-green">+{{ greedyDelta.toFixed(2) }}%</span>
          <span class="mono text-green">+{{ beamDelta.toFixed(2) }}%</span>
        </div>
        <div class="compare-row">
          <span class="compare-label">步数</span>
          <span class="mono">{{ props.greedy3Day.timeline.length }}</span>
          <span class="mono">{{ props.beam3Day.timeline.length }}</span>
        </div>
      </div>

      <p v-if="cumulativeAdvantage !== 0" class="advantage-note">
        <template v-if="cumulativeAdvantage > 0">
          Beam Search 累计产量比贪心高 <b class="text-green">{{ cumulativeAdvantage.toFixed(2) }}%</b>
        </template>
        <template v-else>
          贪心累计产量比 Beam Search 高 <b class="text-accent">{{ (-cumulativeAdvantage).toFixed(2) }}%</b>
        </template>
      </p>
    </template>
  </section>
</template>

<style scoped>
.comparison { margin-top: 16px; }
.card-title { margin: 0 0 4px; font-size: 16px; }
.card-desc { margin: 0 0 14px; font-size: 12px; color: var(--text-muted); }
.chart-svg { width: 100%; height: auto; display: block; margin-bottom: 14px; }
.grid-line { stroke: var(--border); stroke-width: 0.5; }
.axis-label { fill: var(--text-dim); font-size: 10px; font-family: var(--font-mono); }
.axis-title { fill: var(--text-dim); font-size: 11px; }
.legend-text { fill: var(--text); font-size: 11px; }
.compare-table {
  display: grid;
  grid-template-columns: 100px 1fr 1fr;
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
  font-size: 13px;
}
.compare-header { display: contents; background: var(--bg-elev-2); }
.compare-header > span { padding: 8px 10px; font-weight: 600; background: var(--bg-elev-2); }
.compare-row { display: contents; background: var(--bg-elev); }
.compare-row > span { padding: 6px 10px; background: var(--bg-elev); }
.compare-label { color: var(--text-dim); font-size: 12px; }
.advantage-note { margin: 10px 0 0; font-size: 13px; text-align: center; color: var(--text-dim); }
.empty { padding: 28px; text-align: center; color: var(--text-muted); }
@media (max-width: 600px) {
  .compare-table { grid-template-columns: 80px 1fr 1fr; font-size: 11px; }
  .compare-header > span, .compare-row > span { padding: 5px 6px; }
}
</style>
