<script setup lang="ts">
import { computed, ref } from 'vue';
import type { Building, GameState } from '../core/types';
import {
  calcHireServantCost,
  calcHireServantDeltaProduction,
  calcServantProduction,
  calcServantSkillMultiplier,
  getOpenServantSlots,
  getServantCapacity
} from '../core/formulas';
import { MONTHLY_CARD_BONUS_RATE } from '../core/constants';
import { formatNumber } from '../utils/format';
import NumberInput from './NumberInput.vue';

const props = defineProps<{
  gameState: GameState;
}>();

const emit = defineEmits<{
  (e: 'update', id: number, field: keyof Building, value: number | boolean): void;
}>();

/** 是否显示未解锁建筑（默认不显示，避免干扰） */
const showLocked = ref<boolean>(false);
const visible = computed(() =>
  props.gameState.buildings.filter((b: Building) => showLocked.value || b.unlocked)
);
const skillMul = computed(() => calcServantSkillMultiplier(props.gameState));

function onIntField(id: number, field: keyof Building, ev: Event) {
  const v = parseFloat((ev.target as HTMLInputElement).value);
  emit('update', id, field, Number.isNaN(v) ? 0 : v);
}
function onNumField(id: number, field: keyof Building, value: number) {
  emit('update', id, field, value);
}

/**
 * 显示给玩家看的"杂役总产出（不含月卡）"
 *  = 单杂役基础产出 × 技艺倍率 × 杂役数
 *  = 游戏 UI 上 "80.08" 这种数字
 */
function displayedTotalRaw(b: Building): number {
  return b.servantBaseProduction * skillMul.value * b.servantCount;
}
/**
 * 用户输入「不含月卡杂役总产出」V → 反推存储用的 raw base。
 *  - 当 servantCount > 0：raw = V / (skillMul × count)
 *  - 当 servantCount = 0：把 V 当作"单杂役产出（×技艺）"使用，
 *    raw = V / skillMul（先填基础值，等招募后再生效）
 */
function setDisplayedTotalRaw(b: Building, v: number) {
  const m = skillMul.value;
  if (m <= 0) return;
  let raw: number;
  if (b.servantCount > 0) {
    raw = v / (m * b.servantCount);
  } else {
    raw = v / m;
  }
  emit('update', b.id, 'servantBaseProduction', raw);
}

function capacity(b: Building) { return getServantCapacity(b); }
function open(b: Building) { return getOpenServantSlots(b); }
function fillCost(b: Building) {
  const slots = open(b);
  return slots <= 0 ? 0 : calcHireServantCost(b, slots);
}
function fillDelta(b: Building) {
  const slots = open(b);
  return slots <= 0 ? 0 : calcHireServantDeltaProduction(b, props.gameState, slots);
}
function totalProd(b: Building) { return calcServantProduction(b, props.gameState); }

/** 该建筑「不含月卡」的杂役总产出（对应游戏面板中的产出主数字） */
function rawProd(b: Building): number {
  return b.servantBaseProduction * calcServantSkillMultiplier(props.gameState) * b.servantCount;
}
/** 该建筑的月卡加成（rawProd × 35%），未开月卡时为 0 */
function monthlyBonus(b: Building): number {
  if (!props.gameState.monthlyCardActive) return 0;
  return rawProd(b) * MONTHLY_CARD_BONUS_RATE;
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <h3 class="card-title">杂役录入表</h3>
      <button
        type="button"
        class="pill-toggle"
        :class="{ active: showLocked }"
        :title="`当前总计 ${props.gameState.buildings.length} 类，已解锁 ${props.gameState.buildings.filter(b => b.unlocked).length} 类`"
        @click="showLocked = !showLocked"
      >
        <span class="dot" />
        <span>{{ showLocked ? '已显示未解锁' : '仅显示已解锁' }}</span>
      </button>
    </div>
    <div v-if="visible.length === 0" class="empty">尚无可显示建筑</div>
    <div v-else class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th style="min-width: 130px;">建筑</th>
            <th style="min-width: 100px;">已招募杂役数</th>
            <th class="num" style="min-width: 100px;">可容纳杂役数</th>
            <th class="num" style="min-width: 100px;">可招募杂役数</th>
            <th style="min-width: 200px;" title="对应游戏面板里直接显示的「不含月卡杂役总产出」 = 单杂役基础产出 × 技艺倍率 × 杂役数。当杂役数=0 时，按单杂役基础产出（含技艺）输入">
              杂役总产出
              <span class="th-hint">不含月卡</span>
            </th>
            <th style="min-width: 200px;">下次招募价</th>
            <th class="num" style="min-width: 160px;">杂役产出（+月卡）</th>
            <th class="num" style="min-width: 120px;">招满花费</th>
            <th class="num" style="min-width: 120px;">招满增产</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in visible" :key="b.id" :class="{ locked: !b.unlocked }">
            <td>
              <div class="bld-name">
                <span class="bld-id">#{{ b.id }}</span>
                <span>{{ b.name }}</span>
              </div>
            </td>
            <td>
              <input
                type="number"
                inputmode="numeric"
                pattern="[0-9]*"
                min="0"
                step="1"
                :value="b.servantCount"
                @focus="($event.target as HTMLInputElement).select()"
                @input="onIntField(b.id, 'servantCount', $event)"
              />
            </td>
            <td class="num">{{ capacity(b) }}</td>
            <td class="num">
              <span v-if="open(b) > 0">{{ open(b) }}</span>
              <span v-else class="text-muted">已满</span>
            </td>
            <td>
              <NumberInput
                :model-value="displayedTotalRaw(b)"
                :storage-key="`building.${b.id}.servantBaseProduction`"
                @update:model-value="(v: number) => setDisplayedTotalRaw(b, v)"
              />
              <div v-if="b.servantCount === 0" class="cell-sub">杂役数=0，按单杂役×技艺输入</div>
            </td>
            <td>
              <NumberInput
                :model-value="b.nextServantCost"
                :storage-key="`building.${b.id}.nextServantCost`"
                @update:model-value="(v: number) => onNumField(b.id, 'nextServantCost', v)"
              />
            </td>
            <td class="num">
              <span class="mono">{{ formatNumber(rawProd(b)) }}</span>
              <span
                v-if="props.gameState.monthlyCardActive && b.servantCount > 0"
                class="monthly-tag"
                title="月卡 35% 加成"
              >👑+{{ formatNumber(monthlyBonus(b)) }}</span>
              <div class="cell-sub mono">
                合计 {{ formatNumber(totalProd(b)) }}/s
              </div>
            </td>
            <td class="num">
              <span v-if="open(b) > 0">{{ formatNumber(fillCost(b)) }}</span>
              <span v-else class="text-muted">已满</span>
            </td>
            <td class="num">
              <span v-if="open(b) > 0" class="text-green">+{{ formatNumber(fillDelta(b)) }}/s</span>
              <span v-else class="text-muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.bld-name {
  display: flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}
.bld-id {
  color: var(--text-muted);
  font-size: 11px;
  font-family: var(--font-mono);
}
table.data input[type='number'] {
  padding: 3px 6px;
  font-size: 12px;
}
.empty {
  color: var(--text-muted);
  text-align: center;
  padding: 24px;
}
.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}
.card-head .card-title {
  margin: 0;
}
.pill-toggle {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 5px 12px 5px 10px;
  border: 1px solid var(--border);
  background: var(--bg-elev-1);
  color: var(--text-dim);
  font-size: 12px;
  border-radius: 999px;
  cursor: pointer;
  white-space: nowrap;
  user-select: none;
  transition: all .15s ease;
}
.pill-toggle:hover {
  color: var(--text);
  border-color: var(--border-strong);
}
.pill-toggle .dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text-muted);
  transition: background .15s ease, box-shadow .15s ease;
}
.pill-toggle.active {
  color: #fff;
  border-color: transparent;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 2px 8px rgba(110,168,255,0.25);
}
.pill-toggle.active .dot {
  background: #fff;
  box-shadow: 0 0 0 3px rgba(255,255,255,0.25);
}
.th-hint {
  display: inline-block;
  margin-left: 4px;
  font-size: 10px;
  color: var(--text-muted);
  font-weight: normal;
}
.monthly-tag {
  margin-left: 6px;
  display: inline-block;
  font-size: 11px;
  color: #f6c548;
  font-weight: 600;
  white-space: nowrap;
}
.cell-sub {
  font-size: 10px;
  color: var(--text-muted);
  margin-top: 2px;
}
</style>
