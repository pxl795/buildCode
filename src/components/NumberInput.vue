<script setup lang="ts">
import { computed, ref, watch } from 'vue';

const props = defineProps<{
  modelValue: number;
  min?: number;
  max?: number;
  step?: number | string;
  placeholder?: string;
  /** 自动根据值选择初始单位 */
  autoUnit?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: number): void;
}>();

const UNITS = [
  { label: '×1', value: 1 },
  { label: '万', value: 1e4 },
  { label: '亿', value: 1e8 },
  { label: '兆', value: 1e12 },
  { label: '京', value: 1e16 }
];

function pickUnit(v: number): number {
  const a = Math.abs(v);
  if (a >= 1e16) return 1e16;
  if (a >= 1e12) return 1e12;
  if (a >= 1e8) return 1e8;
  if (a >= 1e4) return 1e4;
  return 1;
}

const unit = ref<number>(props.autoUnit !== false ? pickUnit(props.modelValue || 0) : 1);

// 显示值：modelValue / unit。保留 4 位有效精度，避免显示过多小数。
const display = computed<string>(() => {
  if (props.modelValue == null || Number.isNaN(props.modelValue)) return '';
  const v = props.modelValue / unit.value;
  if (v === 0) return '0';
  // 保留两位小数；如果原值正好是整数倍，显示纯整数
  const fixed = v.toFixed(2);
  if (fixed.endsWith('.00')) return String(Math.round(v));
  return fixed.replace(/\.?0+$/, '');
});

function onInput(ev: Event) {
  const raw = (ev.target as HTMLInputElement).value;
  const parsed = parseFloat(raw);
  if (Number.isNaN(parsed)) {
    emit('update:modelValue', 0);
    return;
  }
  emit('update:modelValue', parsed * unit.value);
}

function onUnitChange(ev: Event) {
  unit.value = parseFloat((ev.target as HTMLSelectElement).value);
}

// 当外部值发生大变化时（例如导入或重置），自动调整单位以维持可读
watch(
  () => props.modelValue,
  (v, old) => {
    if (props.autoUnit === false) return;
    if (v === 0) return;
    const ideal = pickUnit(v);
    // 如果原 unit 显示出来超过 5 位整数 或 小于 0.01，则切换
    const display = Math.abs(v / unit.value);
    if (display >= 1e5 || (display > 0 && display < 0.01)) {
      unit.value = ideal;
    }
    // 大幅波动（导入数据时）
    if (Math.abs(Math.log10(Math.abs(v) + 1) - Math.log10(Math.abs(old || 1) + 1)) > 4) {
      unit.value = ideal;
    }
  }
);
</script>

<template>
  <div class="num-input">
    <input
      type="number"
      step="any"
      :min="props.min"
      :max="props.max"
      :placeholder="props.placeholder"
      :value="display"
      @input="onInput"
    />
    <select class="unit-select" :value="unit" @change="onUnitChange" tabindex="-1">
      <option v-for="u in UNITS" :key="u.value" :value="u.value">{{ u.label }}</option>
    </select>
  </div>
</template>

<style scoped>
.num-input {
  display: flex;
  align-items: stretch;
  gap: 0;
  width: 100%;
  min-width: 0;
}
.num-input input[type='number'] {
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
  border-right: none;
  flex: 1 1 0;
  min-width: 0;
  text-align: right;
  font-variant-numeric: tabular-nums;
  padding-right: 6px;
}
.unit-select {
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
  background: var(--bg-elev-2);
  color: var(--text-dim);
  font-size: 11px;
  padding: 0 4px;
  min-width: 38px;
  flex-shrink: 0;
  cursor: pointer;
}
.unit-select:hover {
  color: var(--accent);
  border-color: var(--accent);
}
</style>
