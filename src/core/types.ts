export interface Building {
  id: number;
  name: string;
  unlocked: boolean;
  count: number;
  level: number;
  baseProduction: number;
  nextBuyCost: number;
  servantCount: number;
  servantBaseProduction: number;
  nextServantCost: number;
  servantCapacityOverride: number;
}

export interface GameState {
  ore: number;
  productionMultiplier: number;
  monthlyCardActive: boolean;
  servantSkillLevel: number;
  nextServantSkillCost: number;
  targetBuildingId: number;
  buildings: Building[];
}

export type ActionType = 'buy' | 'upgrade' | 'hireServant' | 'upgradeServantSkill';

export interface Action {
  type: ActionType;
  buildingId: number | null;
  buildingName: string;
  amount?: number;
  cost: number;
  deltaProduction: number;
  waitSeconds: number;
  paybackSeconds: number;
  scoreSeconds: number;
  rawScoreSeconds: number;
  reason: string;
  label: string;
}

export interface TimelineStep {
  action: Action;
  totalSeconds: number;
  productionBefore: number;
  productionAfter: number;
  oreAfter: number;
  waitSeconds: number;
}

export interface GreedyPlanResult {
  finalState: GameState;
  timeline: TimelineStep[];
  elapsedSeconds: number;
  finalProduction: number;
  initialProduction: number;
}

export interface HardUnlockResult {
  finalState: GameState;
  timeline: TimelineStep[];
  totalSeconds: number;
  firstBuyTotalSeconds: number | null;
  reachable: boolean;
  reason?: string;
}
