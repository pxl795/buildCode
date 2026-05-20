<script setup lang="ts">
import type { GameState } from '../core/types';
import { BUILDING_NAMES } from '../core/constants';
import NumberInput from './NumberInput.vue';

const props = defineProps<{
  gameState: GameState;
}>();

const emit = defineEmits<{
  (e: 'update', field: keyof GameState, value: number | boolean): void;
}>();

function onPlain(field: keyof GameState, ev: Event) {
  const v = parseFloat((ev.target as HTMLInputElement).value);
  emit('update', field, Number.isNaN(v) ? 0 : v);
}
function onToggle(field: keyof GameState, ev: Event) {
  emit('update', field, (ev.target as HTMLInputElement).checked);
}
function onSelect(field: keyof GameState, ev: Event) {
  const v = parseInt((ev.target as HTMLSelectElement).value, 10);
  emit('update', field, Number.isNaN(v) ? 0 : v);
}
</script>

<template>
  <section class="card">
    <h3 class="card-title">全局输入</h3>
    <div class="form-grid">
      <label class="field">
        <span class="field-label">当前灵矿石</span>
        <NumberInput
          :model-value="props.gameState.ore"
          @update:model-value="(v: number) => emit('update', 'ore', v)"
        />
      </label>

      <label class="field">
        <span class="field-label">全局产量倍率</span>
        <input
          type="number"
          step="0.01"
          :value="props.gameState.productionMultiplier"
          @input="onPlain('productionMultiplier', $event)"
        />
      </label>

      <label class="field">
        <span class="field-label">月卡（+35%）</span>
        <span class="toggle">
          <input
            type="checkbox"
            :checked="props.gameState.monthlyCardActive"
            @change="onToggle('monthlyCardActive', $event)"
          />
          <span class="slider"></span>
        </span>
      </label>

      <label class="field">
        <span class="field-label">杂役技艺等级</span>
        <input
          type="number"
          min="1"
          step="1"
          :value="props.gameState.servantSkillLevel"
          @input="onPlain('servantSkillLevel', $event)"
        />
      </label>

      <label class="field">
        <span class="field-label">下次技艺升级花费</span>
        <NumberInput
          :model-value="props.gameState.nextServantSkillCost"
          @update:model-value="(v: number) => emit('update', 'nextServantSkillCost', v)"
        />
      </label>

      <label class="field">
        <span class="field-label">目标建筑</span>
        <select
          :value="props.gameState.targetBuildingId"
          @change="onSelect('targetBuildingId', $event)"
        >
          <option v-for="(name, idx) in BUILDING_NAMES" :key="idx" :value="idx">
            {{ idx }} - {{ name }}
          </option>
        </select>
      </label>
    </div>
  </section>
</template>

<style scoped>
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 14px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
}
.field-label {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 500;
}
.field .toggle { margin-top: 2px; }

@media (max-width: 600px) {
  .form-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 10px;
  }
}
</style>
