/** 格式化大数：使用中文万/亿/兆/京/垓单位（四位一进），统一保留两位小数 */
export function formatNumber(num: number, fractionDigits = 2): string {
  if (!isFinite(num)) return '∞';
  if (Number.isNaN(num)) return '-';
  const abs = Math.abs(num);
  if (abs >= 1e20) return (num / 1e20).toFixed(fractionDigits) + ' 垓';
  if (abs >= 1e16) return (num / 1e16).toFixed(fractionDigits) + ' 京';
  if (abs >= 1e12) return (num / 1e12).toFixed(fractionDigits) + ' 兆';
  if (abs >= 1e8) return (num / 1e8).toFixed(fractionDigits) + ' 亿';
  if (abs >= 1e4) return (num / 1e4).toFixed(fractionDigits) + ' 万';
  if (Number.isInteger(num)) return num.toLocaleString('en-US');
  return num.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  });
}

/** 完整千分位（不简写） */
export function formatNumberFull(num: number, fractionDigits = 2): string {
  if (!isFinite(num)) return '∞';
  if (Number.isNaN(num)) return '-';
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: fractionDigits
  });
}

/** 时间格式化：秒 → "X 天 X 小时" / "X.X 小时" / "X.X 分" */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '∞';
  if (Number.isNaN(seconds) || seconds < 0) return '-';
  if (seconds < 1) return '<1 秒';
  if (seconds < 60) return `${seconds.toFixed(1)} 秒`;
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)} 分`;
  if (seconds < 86400) return `${(seconds / 3600).toFixed(2)} 小时`;
  const days = Math.floor(seconds / 86400);
  const hours = (seconds - days * 86400) / 3600;
  return `${days} 天 ${hours.toFixed(1)} 小时`;
}

/** 秒产格式化：41,787.22/s */
export function formatProduction(rate: number): string {
  if (!isFinite(rate)) return '∞/s';
  if (Number.isNaN(rate)) return '-/s';
  return `${formatNumber(rate, 2)}/s`;
}

/** 简短秒产，不写 /s */
export function formatRate(rate: number): string {
  return formatNumber(rate, 2);
}
