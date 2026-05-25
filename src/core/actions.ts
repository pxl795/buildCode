import {
  MAX_BUILDING_COUNT,
  MAX_BUILDING_LEVEL,
  MAX_SERVANT_HIRE_BATCH,
  NEXT_BUILDING_UNLOCK_COUNT,
  UPGRADE_THRESHOLD_PER_LEVEL
} from './constants';
import {
  calcBuyCost,
  calcBuyDeltaProduction,
  calcHireServantCost,
  calcHireServantDeltaProduction,
  calcUnitProduction,
  calcUpgradeCost,
  calcUpgradeDeltaProduction,
  calcUpgradeServantSkillCost,
  calcUpgradeSkillDeltaProduction,
  canUpgrade,
  getOpenServantSlots
} from './formulas';
import { getHighestUnlockedId } from './unlock';
import type { Action, ActionType, Building, GameState } from './types';

function actionLabel(type: ActionType, name: string, amount?: number): string {
  switch (type) {
    case 'buy':
      return `购买 ${name}`;
    case 'upgrade':
      return `升级 ${name}`;
    case 'hireServant':
      return `招募 ${amount ?? 1} 个杂役到 ${name}`;
    case 'upgradeServantSkill':
      return '提升杂役技艺';
  }
}

function actionReason(
  type: ActionType,
  building: Building | null,
  isFrontierBuy: boolean,
  isUpgradeRush = false
): string {
  switch (type) {
    case 'buy':
      if (isFrontierBuy && building && building.count < NEXT_BUILDING_UNLOCK_COUNT) {
        return '推进前沿数量，帮助解锁下一类';
      }
      if (isUpgradeRush) {
        return '接近升级门槛，冲刺升级';
      }
      return '提升当前秒产';
    case 'upgrade':
      return '提升整类建筑倍数';
    case 'hireServant':
      return '招募杂役，提升自动产出';
    case 'upgradeServantSkill':
      return '提升杂役技艺，放大全部杂役产出';
  }
}

/**
 * 生成贪心候选动作（仅基础信息，cost / deltaProduction / label / reason）。
 * 不在此处计算分数，分数计算在 greedy.ts。
 */
export function listGreedyActions(state: GameState): Action[] {
  const actions: Action[] = [];
  const frontierId = getHighestUnlockedId(state);

  for (const b of state.buildings) {
    if (!b.unlocked) continue;

    // 1. 购买
    if (b.count < MAX_BUILDING_COUNT && b.nextBuyCost > 0) {
      const unit = calcUnitProduction(b, state);
      if (unit > 0) {
        const cost = calcBuyCost(b);
        const delta = calcBuyDeltaProduction(b, state);
        if (cost > 0 && delta > 0) {
          const isFrontier = b.id === frontierId;
          const threshold = b.level * UPGRADE_THRESHOLD_PER_LEVEL;
          const isUpgradeRush =
            b.level < MAX_BUILDING_LEVEL && b.count < threshold && threshold - b.count <= 6;
          actions.push({
            type: 'buy',
            buildingId: b.id,
            buildingName: b.name,
            cost,
            deltaProduction: delta,
            waitSeconds: 0,
            paybackSeconds: 0,
            scoreSeconds: 0,
            rawScoreSeconds: 0,
            reason: actionReason('buy', b, isFrontier, isUpgradeRush),
            label: actionLabel('buy', b.name)
          });
        }
      }
    }

    // 2. 升级
    if (canUpgrade(b) && b.level < MAX_BUILDING_LEVEL) {
      const cost = calcUpgradeCost(b);
      const delta = calcUpgradeDeltaProduction(b, state);
      if (cost > 0 && delta > 0) {
        actions.push({
          type: 'upgrade',
          buildingId: b.id,
          buildingName: b.name,
          cost,
          deltaProduction: delta,
          waitSeconds: 0,
          paybackSeconds: 0,
          scoreSeconds: 0,
          rawScoreSeconds: 0,
          reason: actionReason('upgrade', b, false),
          label: actionLabel('upgrade', b.name)
        });
      }
    }

    // 3. 招募杂役
    const open = getOpenServantSlots(b);
    if (open > 0 && b.nextServantCost > 0 && b.servantBaseProduction > 0) {
      const maxBatch = Math.min(open, MAX_SERVANT_HIRE_BATCH);
      for (let amount = 1; amount <= maxBatch; amount++) {
        const cost = calcHireServantCost(b, amount);
        const delta = calcHireServantDeltaProduction(b, state, amount);
        if (cost > 0 && delta > 0) {
          actions.push({
            type: 'hireServant',
            buildingId: b.id,
            buildingName: b.name,
            amount,
            cost,
            deltaProduction: delta,
            waitSeconds: 0,
            paybackSeconds: 0,
            scoreSeconds: 0,
            rawScoreSeconds: 0,
            reason: actionReason('hireServant', b, false),
            label: actionLabel('hireServant', b.name, amount)
          });
        }
      }
    }
  }

  // 4. 杂役技艺升级
  if (state.nextServantSkillCost > 0) {
    const cost = calcUpgradeServantSkillCost(state);
    const delta = calcUpgradeSkillDeltaProduction(state);
    if (cost > 0 && delta > 0) {
      actions.push({
        type: 'upgradeServantSkill',
        buildingId: null,
        buildingName: '',
        cost,
        deltaProduction: delta,
        waitSeconds: 0,
        paybackSeconds: 0,
        scoreSeconds: 0,
        rawScoreSeconds: 0,
        reason: actionReason('upgradeServantSkill', null, false),
        label: actionLabel('upgradeServantSkill', '')
      });
    }
  }

  return actions;
}
