<script setup lang="ts">
import { computed } from 'vue';
import type { Building, GameState } from '../core/types';
import {
  calcBuildingTotalProduction,
  calcUpgradeCost,
  canUpgrade
} from '../core/formulas';
import { getHighestUnlockedId } from '../core/unlock';
import { formatNumber } from '../utils/format';
import NumberInput from './NumberInput.vue';

const props = defineProps<{
  gameState: GameState;
}>();

const emit = defineEmits<{
  (e: 'update', id: number, field: keyof Building, value: number | boolean | string): void;
}>();

const frontierId = computed(() => getHighestUnlockedId(props.gameState));

function onIntField(id: number, field: keyof Building, ev: Event) {
  const v = parseFloat((ev.target as HTMLInputElement).value);
  emit('update', id, field, Number.isNaN(v) ? 0 : v);
}
function onNumField(id: number, field: keyof Building, value: number) {
  emit('update', id, field, value);
}
function onNameInput(id: number, ev: Event) {
  const s = (ev.target as HTMLInputElement).value;
  emit('update', id, 'name', s);
}

function totalProd(b: Building) {
  return calcBuildingTotalProduction(b, props.gameState);
}
function upgradeCost(b: Building) {
  return canUpgrade(b) ? calcUpgradeCost(b) : 0;
}
</script>

<template>
  <section class="card">
    <h3 class="card-title">建筑录入表</h3>
    <div class="table-wrap">
      <table class="data">
        <thead>
          <tr>
            <th style="min-width: 130px;">建筑</th>
            <th style="min-width: 70px;">解锁</th>
            <th style="min-width: 90px;">数量</th>
            <th style="min-width: 80px;">等级</th>
            <th style="min-width: 180px;">基础单产</th>
            <th style="min-width: 200px;">下次购买价</th>
            <th class="num" style="min-width: 120px;">建筑总秒产</th>
            <th class="num" style="min-width: 120px;">升级价格</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="b in props.gameState.buildings"
            :key="b.id"
            :class="{ locked: !b.unlocked, frontier: b.id === frontierId }"
          >
            <td>
              <div class="bld-name">
                <span class="bld-id">#{{ b.id }}</span>
                <input
                  type="text"
                  class="name-input"
                  maxlength="20"
                  :value="b.name"
                  :title="`修改 #${b.id} 的名称（杂役表会自动同步）`"
                  @focus="($event.target as HTMLInputElement).select()"
                  @change="onNameInput(b.id, $event)"
                />
                <span v-if="b.id === frontierId" class="tag gold">前沿</span>
              </div>
            </td>
            <td>
              <span class="tag" :class="b.unlocked ? 'green' : 'red'">
                {{ b.unlocked ? '是' : '否' }}
              </span>
            </td>
            <td>
              <input
                type="number"
                inputmode="numeric"
                pattern="[0-9]*"
                min="0"
                max="50"
                step="1"
                :value="b.count"
                @focus="($event.target as HTMLInputElement).select()"
                @input="onIntField(b.id, 'count', $event)"
              />
            </td>
            <td>
              <input
                type="number"
                inputmode="numeric"
                pattern="[0-9]*"
                min="1"
                max="6"
                step="1"
                :value="b.level"
                @focus="($event.target as HTMLInputElement).select()"
                @input="onIntField(b.id, 'level', $event)"
              />
            </td>
            <td>
              <NumberInput
                :model-value="b.baseProduction"
                :storage-key="`building.${b.id}.baseProduction`"
                @update:model-value="(v: number) => onNumField(b.id, 'baseProduction', v)"
              />
            </td>
            <td>
              <NumberInput
                :model-value="b.nextBuyCost"
                :storage-key="`building.${b.id}.nextBuyCost`"
                @update:model-value="(v: number) => onNumField(b.id, 'nextBuyCost', v)"
              />
            </td>
            <td class="num">{{ formatNumber(totalProd(b)) }}</td>
            <td class="num">
              <span v-if="upgradeCost(b) > 0">{{ formatNumber(upgradeCost(b)) }}</span>
              <span v-else class="text-muted">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <p class="hint">未解锁建筑（淡灰行）若数据为 0 不会进入候选；解锁状态会按前置数量自动重算。</p>
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
.name-input {
  width: 70px;
  padding: 3px 6px;
  font-size: 12px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  color: var(--text);
}
.name-input:hover {
  border-color: var(--border);
}
.name-input:focus {
  border-color: var(--accent);
  background: var(--bg-elev-1);
  outline: none;
}
table.data input[type='number'] {
  padding: 3px 6px;
  font-size: 12px;
}
.hint {
  margin: 8px 2px 0;
  color: var(--text-muted);
  font-size: 11px;
}
</style>
