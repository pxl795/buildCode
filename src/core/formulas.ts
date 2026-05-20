import {
  GROWTH_FACTOR,
  MONTHLY_CARD_BONUS_RATE,
  SERVANT_PRICE_GROWTH_FACTOR,
  SERVANT_SKILL_BONUS_PER_LEVEL,
  UPGRADE_MULTIPLIER
} from './constants';
import type { Building, GameState } from './types';

// ===== 建筑产出 =====

export function calcUnitProduction(building: Building, state: GameState): number {
  const monthlyBonus = state.monthlyCardActive
    ? building.baseProduction * MONTHLY_CARD_BONUS_RATE
    : 0;
  return (building.baseProduction + monthlyBonus) * state.productionMultiplier;
}

export function calcBuildingTotalProduction(building: Building, state: GameState): number {
  return calcUnitProduction(building, state) * building.count;
}

// ===== 杂役产出（不乘 productionMultiplier，遵循 dev-doc 10.3 建议） =====

export function calcServantSkillMultiplier(state: GameState): number {
  return 1 + Math.max(0, state.servantSkillLevel - 1) * SERVANT_SKILL_BONUS_PER_LEVEL;
}

export function calcServantUnitProduction(building: Building, state: GameState): number {
  const skillMul = calcServantSkillMultiplier(state);
  const raw = building.servantBaseProduction * skillMul;
  const monthlyBonus = state.monthlyCardActive ? raw * MONTHLY_CARD_BONUS_RATE : 0;
  return raw + monthlyBonus;
}

export function calcServantProduction(building: Building, state: GameState): number {
  return calcServantUnitProduction(building, state) * building.servantCount;
}

// ===== 总秒产 =====

export function calcTotalProduction(state: GameState): number {
  let total = 0;
  for (const b of state.buildings) {
    if (!b.unlocked) continue;
    total += calcBuildingTotalProduction(b, state);
    total += calcServantProduction(b, state);
  }
  return total;
}

export function calcDailyProduction(state: GameState): number {
  return calcTotalProduction(state) * 86400;
}

// ===== 购买建筑 =====

export function calcBuyCost(building: Building): number {
  return building.nextBuyCost;
}

export function calcBuyDeltaProduction(building: Building, state: GameState): number {
  return calcUnitProduction(building, state);
}

// ===== 升级建筑 =====

export function canUpgrade(building: Building): boolean {
  return building.level < 6 && building.count >= building.level * 10;
}

export function calcUpgradeCost(building: Building): number {
  if (!canUpgrade(building)) return 0;
  const exp = building.count - building.level * 10 + 1;
  return Math.ceil((UPGRADE_MULTIPLIER * building.nextBuyCost) / Math.pow(GROWTH_FACTOR, exp));
}

export function calcUpgradeDeltaProduction(building: Building, state: GameState): number {
  if (building.level <= 0 || building.count <= 0) return 0;
  return (calcUnitProduction(building, state) / building.level) * building.count;
}

// ===== 杂役 =====

export function getServantsPerBuilding(buildingId: number): number {
  return (Math.floor(buildingId / 2) + 1) * 2;
}

export function getServantCapacity(building: Building): number {
  if (building.servantCapacityOverride > 0) return building.servantCapacityOverride;
  return building.count * getServantsPerBuilding(building.id);
}

export function getOpenServantSlots(building: Building): number {
  return Math.max(0, getServantCapacity(building) - building.servantCount);
}

export function calcHireServantCost(building: Building, amount: number): number {
  if (amount <= 0) return 0;
  // sum of geometric series: a * (r^n - 1) / (r - 1)
  return (
    (building.nextServantCost * (Math.pow(SERVANT_PRICE_GROWTH_FACTOR, amount) - 1)) /
    (SERVANT_PRICE_GROWTH_FACTOR - 1)
  );
}

export function calcHireServantDeltaProduction(
  building: Building,
  state: GameState,
  amount: number
): number {
  return calcServantUnitProduction(building, state) * amount;
}

// ===== 杂役技艺 =====

export function calcUpgradeServantSkillCost(state: GameState): number {
  return state.nextServantSkillCost;
}

export function calcUpgradeSkillDeltaProduction(state: GameState): number {
  const monthlyMultiplier = state.monthlyCardActive ? 1 + MONTHLY_CARD_BONUS_RATE : 1;
  let total = 0;
  for (const b of state.buildings) {
    if (!b.unlocked) continue;
    total += b.servantBaseProduction * b.servantCount * SERVANT_SKILL_BONUS_PER_LEVEL * monthlyMultiplier;
  }
  return total;
}
