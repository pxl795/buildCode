<script setup lang="ts">
import { computed } from 'vue';
import type { Building, GameState } from '../core/types';
import {
  calcHireServantCost,
  calcHireServantDeltaProduction,
  calcServantProduction,
  getOpenServantSlots,
  getServantCapacity
} from '../core/formulas';
import { formatNumber } from '../utils/format';
import NumberInput from './NumberInput.vue';

const props = defineProps<{
  gameState: GameState;
}>();

const emit = defineEmits<{
  (e: 'update', id: number, field: keyof Building, value: number | boolean): void;
}>();

const visible = computed(() => props.gameState.buildings.filter((b: Building) => b.unlocked));

function onIntField(id: number, field: keyof Building, ev: Event) {
  const v = parseFloat((ev.target as HTMLInputElement).value);
  emit('update', id, field, Number.isNaN(v) ? 0 : v);
}
function onNumField(id: number, field: keyof Building, value: number) {
  emit('update', id, field, value);
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
</script>

<template>
  <section class="card">
    <h3 class="card-title">杂役录入表</h3>
    <div v-if="visible.length === 0" class="empty">尚无已解锁建筑</div>
    <div v-else class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th style="min-width: 130px;">建筑</th>
            <th style="min-width: 100px;">已招杂役</th>
            <th class="num" style="min-width: 90px;">岗位上限</th>
            <th style="min-width: 100px;">岗位覆盖</th>
            <th style="min-width: 180px;">单个基础产出</th>
            <th style="min-width: 200px;">下次招募价</th>
            <th class="num" style="min-width: 120px;">杂役总秒产</th>
            <th class="num" style="min-width: 120px;">招满花费</th>
            <th class="num" style="min-width: 120px;">招满增产</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="b in visible" :key="b.id">
            <td>
              <div class="bld-name">
                <span class="bld-id">#{{ b.id }}</span>
                <span>{{ b.name }}</span>
              </div>
            </td>
            <td>
              <input
                type="number"
                min="0"
                step="1"
                :value="b.servantCount"
                @input="onIntField(b.id, 'servantCount', $event)"
              />
            </td>
            <td class="num">{{ capacity(b) }}</td>
            <td>
              <input
                type="number"
                min="0"
                step="1"
                :value="b.servantCapacityOverride"
                @input="onIntField(b.id, 'servantCapacityOverride', $event)"
                title="0 表示自动按数量计算"
              />
            </td>
            <td>
              <NumberInput
                :model-value="b.servantBaseProduction"
                @update:model-value="(v: number) => onNumField(b.id, 'servantBaseProduction', v)"
              />
            </td>
            <td>
              <NumberInput
                :model-value="b.nextServantCost"
                @update:model-value="(v: number) => onNumField(b.id, 'nextServantCost', v)"
              />
            </td>
            <td class="num">{{ formatNumber(totalProd(b)) }}</td>
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
</style>
