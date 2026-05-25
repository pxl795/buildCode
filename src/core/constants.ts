// 建筑相关
export const MAX_BUILDING_COUNT = 50;
export const MAX_BUILDING_LEVEL = 6;
export const NEXT_BUILDING_UNLOCK_COUNT = 5;
/** 升级门槛系数：level 升 (level+1) 需要 level × UPGRADE_THRESHOLD_PER_LEVEL 栋 */
export const UPGRADE_THRESHOLD_PER_LEVEL = 10;
export const GROWTH_FACTOR = 1.25;
export const UPGRADE_MULTIPLIER = 1.4;
export const TOTAL_BUILDING_TYPES = 16;

// 月卡
export const MONTHLY_CARD_BONUS_RATE = 0.35;

// 杂役相关
export const SERVANT_PRICE_GROWTH_FACTOR = 1.1;
export const SERVANT_SKILL_BONUS_PER_LEVEL = 0.1;
export const SERVANT_SKILL_COST_GROWTH_FACTOR = 2.2;
export const MAX_SERVANT_HIRE_BATCH = 5;

// 贪心相关
export const FRONTIER_UNLOCK_DISCOUNT = 0.5;
export const UPGRADE_DISCOUNT = 0.7;
export const HIGH_IMPACT_THRESHOLD = 0.15;
export const HIGH_IMPACT_DISCOUNT = 0.85;
export const DEFAULT_HORIZON_SECONDS = 86400;
export const DEFAULT_MAX_STEPS = 80;

// 建筑名称
export const BUILDING_NAMES: readonly string[] = [
  '补给营地',
  '探测法阵',
  '采矿据点',
  '修士坊市',
  '炼丹楼',
  '灵符堂',
  '锻兵房',
  '藏经阁',
  '真仙池',
  '玄仙府',
  '金仙宫',
  '太乙峰',
  '大罗天',
  '道祖殿',
  '鸿蒙塔',
  '混元境'
];
