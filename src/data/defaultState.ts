import { BUILDING_NAMES, TOTAL_BUILDING_TYPES } from '../core/constants';
import type { Building, GameState } from '../core/types';

/** 来自 spec 第 22 节的样例存档，作为默认输入数据 */
const SAMPLE_BUILDINGS: Building[] = [
  { id: 0, name: '补给营地', count: 50, level: 6, baseProduction: 12, nextBuyCost: 37835121.154785156, servantCapacityOverride: 0, servantCount: 91, servantBaseProduction: 0.36666666666666664, nextServantCost: 1307800, unlocked: true },
  { id: 1, name: '探测法阵', count: 40, level: 5, baseProduction: 30, nextBuyCost: 52812600, servantCapacityOverride: 0, servantCount: 80, servantBaseProduction: 0.6666666666666666, nextServantCost: 1049700, unlocked: true },
  { id: 2, name: '采矿据点', count: 32, level: 4, baseProduction: 72, nextBuyCost: 144834765.625, servantCapacityOverride: 0, servantCount: 78, servantBaseProduction: 1.3666666666666667, nextServantCost: 7248400, unlocked: true },
  { id: 3, name: '修士坊市', count: 25, level: 3, baseProduction: 165, nextBuyCost: 312500000, servantCapacityOverride: 0, servantCount: 61, servantBaseProduction: 2.9166666666666665, nextServantCost: 12379000, unlocked: true },
  { id: 4, name: '炼丹楼', count: 20, level: 3, baseProduction: 480, nextBuyCost: 1329183578.491211, servantCapacityOverride: 0, servantCount: 42, servantBaseProduction: 8.166666666666666, nextServantCost: 25285000, unlocked: true },
  { id: 5, name: '灵符堂', count: 10, level: 2, baseProduction: 960, nextBuyCost: 1861572265.625, servantCapacityOverride: 0, servantCount: 20, servantBaseProduction: 16.166666666666668, nextServantCost: 38017300, unlocked: true },
  { id: 6, name: '锻兵房', count: 1, level: 1, baseProduction: 1450, nextBuyCost: 2592000000, servantCapacityOverride: 0, servantCount: 1, servantBaseProduction: 24.333333333333332, nextServantCost: 88704100, unlocked: true },
  { id: 7, name: '藏经阁', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 35.18192778795122, nextServantCost: 60000000, unlocked: false },
  { id: 8, name: '真仙池', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 67.72004824599254, nextServantCost: 3737127674.864238, unlocked: false },
  { id: 9, name: '玄仙府', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 130.3511553454479, nextServantCost: 33412764416.91088, unlocked: false },
  { id: 10, name: '金仙宫', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 250.90684575669357, nextServantCost: 298735532502.38983, unlocked: false },
  { id: 11, name: '太乙峰', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 482.9588589432602, nextServantCost: 2670922922328.4126, unlocked: false },
  { id: 12, name: '大罗天', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 929.6249320274014, nextServantCost: 23880082818612.32, unlocked: false },
  { id: 13, name: '道祖殿', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 1789.391577033853, nextServantCost: 213506107067536.44, unlocked: false },
  { id: 14, name: '鸿蒙塔', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 3444.3162028547295, nextServantCost: 1908907021026109, unlocked: false },
  { id: 15, name: '混元境', count: 0, level: 1, baseProduction: 0, nextBuyCost: 0, servantCapacityOverride: 0, servantCount: 0, servantBaseProduction: 6629.803256877163, nextServantCost: 17067080960687226, unlocked: false }
];

export function createDefaultState(): GameState {
  return {
    ore: 0,
    productionMultiplier: 1.06,
    monthlyCardActive: true,
    servantSkillLevel: 15,
    nextServantSkillCost: 136880040,
    targetBuildingId: 7,
    buildings: SAMPLE_BUILDINGS.map(b => ({ ...b }))
  };
}

/** 创建一份完全空白的状态，所有建筑数据为 0 */
export function createEmptyState(): GameState {
  const buildings: Building[] = [];
  for (let i = 0; i < TOTAL_BUILDING_TYPES; i++) {
    buildings.push({
      id: i,
      name: BUILDING_NAMES[i] ?? `建筑${i}`,
      unlocked: i === 0,
      count: 0,
      level: 1,
      baseProduction: 0,
      nextBuyCost: 0,
      servantCount: 0,
      servantBaseProduction: 0,
      nextServantCost: 0,
      servantCapacityOverride: 0
    });
  }
  return {
    ore: 0,
    productionMultiplier: 1,
    monthlyCardActive: false,
    servantSkillLevel: 1,
    nextServantSkillCost: 0,
    targetBuildingId: 1,
    buildings
  };
}
