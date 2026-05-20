# 灵矿石策略计算器 — 开发文档

## 目录

1. [项目概述](#1-项目概述)
2. [技术栈](#2-技术栈)
3. [项目结构](#3-项目结构)
4. [核心计算模块设计](#4-核心计算模块设计)
5. [UI 模块设计](#5-ui-模块设计)
6. [数据流与状态管理](#6-数据流与状态管理)
7. [API 详细设计](#7-api-详细设计)
8. [验收标准](#8-验收标准)
9. [开发计划](#9-开发计划)
10. [注意事项](#10-注意事项)

---

## 1. 项目概述

### 1.1 项目名称

灵矿石策略计算器（Spirit Ore Strategy Calculator）

### 1.2 项目定位

一个面向放置/经营类游戏玩家的**资源规划工具**。玩家持有"灵矿石"资源，通过购买建筑、升级建筑、招募杂役、提升杂役技艺来持续提升灵矿石秒产。计算器基于**贪心算法**，回答"下一步最值得做什么"以及"按此策略未来路线是什么"。

### 1.3 核心问题

- 在当前资源、建筑数量、等级、杂役数据下，**下一步最值得做什么？**
- 如果一直按贪心策略执行，**未来一段时间内的路线是什么？**
- 距离**解锁下一类建筑**、**首购目标建筑**还要多久？

### 1.4 算法定位

**贪心算法**，每一步只看当前状态下哪个动作最划算。不使用 Beam Search、A*、动态规划或穷举全局最优。

---

## 2. 技术栈

| 层级 | 技术选型 | 说明 |
|------|---------|------|
| 框架 | Vue 3 + TypeScript (Composition API + `<script setup>`) | 类型安全，组件化开发 |
| 构建 | Vite 4.x | Node 16 兼容（Vite 5+ 需要 Node 18） |
| 样式 | Scoped CSS | Vue 原生支持，简单够用 |
| 状态管理 | Vue 3 `reactive` / `ref` + Composables | 项目规模无需 Pinia |
| 测试 | Vitest | 与 Vite 生态一致，验证核心计算逻辑 |

### 为什么选这个技术栈？

- 项目是纯前端计算器，无需后端，Vite 4 + Vue 3 足以支撑
- TypeScript 保障数值计算的类型安全
- 核心逻辑与 UI 解耦，计算模块可独立测试
- Node 16 兼容性：Vite 4.x 最低支持 Node 14.18+，完全满足

---

## 3. 项目结构

```
buildCode/
├── src/
│   ├── core/                        # 核心计算模块（纯函数，无 UI 依赖）
│   │   ├── constants.ts             # 所有常量定义
│   │   ├── types.ts                 # 核心数据类型
│   │   ├── formulas.ts              # 所有产出/花费公式
│   │   ├── actions.ts               # 候选动作生成与执行
│   │   ├── greedy.ts                # 贪心算法：打分、排序、路线模拟
│   │   ├── unlock.ts                # 建筑解锁逻辑
│   │   └── index.ts                 # core 模块统一导出
│   ├── components/                  # Vue 组件（.vue SFC）
│   │   ├── GlobalInput.vue          # 全局输入区
│   │   ├── Overview.vue             # 总览区（秒产、日产等）
│   │   ├── BuildingTable.vue        # 建筑录入表
│   │   ├── ServantTable.vue         # 杂役录入表
│   │   ├── Recommendation.vue       # 推荐区（第一步推荐 + 候选列表）
│   │   ├── GreedyTimeline.vue       # 贪心路线区
│   │   └── App.vue                  # 根组件，组装所有区域
│   ├── composables/
│   │   └── useGameState.ts          # 游戏状态管理 composable
│   ├── utils/
│   │   └── format.ts                # 数字格式化（大数、时间格式化）
│   ├── App.css                      # 全局样式
│   ├── main.ts                      # 入口
│   └── index.css                    # 入口样式
├── tests/
│   ├── formulas.test.ts             # 公式单元测试
│   ├── greedy.test.ts               # 贪心算法测试
│   └── unlock.test.ts               # 解锁逻辑测试
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── greedy-calculator-spec.md        # 原始规范文档
```

### 模块职责

| 模块 | 职责 |
|------|------|
| `core/` | 所有数值计算、动作生成、贪心策略。纯函数，无 Vue 依赖 |
| `components/` | UI 渲染（Vue SFC），只调用 core 模块，不包含计算逻辑 |
| `composables/` | 状态管理层，持有 reactive state 并调用 core |
| `utils/` | 纯工具函数（格式化等） |

---

## 4. 核心计算模块设计

### 4.1 常量定义 (`core/constants.ts`)

```ts
// 建筑相关
export const MAX_BUILDING_COUNT = 50;
export const MAX_BUILDING_LEVEL = 6;
export const NEXT_BUILDING_UNLOCK_COUNT = 5;
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
export const UPGRADE_DISCOUNT = 0.7;            // 可选
export const HIGH_IMPACT_THRESHOLD = 0.15;       // 可选：增产 >= 15% 当前秒产
export const HIGH_IMPACT_DISCOUNT = 0.85;        // 可选
export const DEFAULT_HORIZON_SECONDS = 86400;    // 24h
export const DEFAULT_MAX_STEPS = 80;
```

### 4.2 核心数据类型 (`core/types.ts`)

```ts
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

export interface Action {
  type: 'buy' | 'upgrade' | 'hireServant' | 'upgradeServantSkill';
  buildingId: number | null;
  buildingName: string;
  amount?: number;
  cost: number;
  deltaProduction: number;
  waitSeconds: number;
  paybackSeconds: number;
  scoreSeconds: number;
  reason: string;
}

export interface TimelineStep {
  action: Action;
  totalSeconds: number;
  productionBefore: number;
  productionAfter: number;
  oreAfter: number;
}

export interface GreedyPlanResult {
  finalState: GameState;
  timeline: TimelineStep[];
  elapsedSeconds: number;
  finalProduction: number;
}

export interface HardUnlockResult {
  finalState: GameState;
  timeline: TimelineStep[];
  totalSeconds: number;
  firstBuyTotalSeconds: number | null;
}
```

### 4.3 公式模块 (`core/formulas.ts`)

所有产出和花费公式集中管理。每个函数必须是纯函数。

#### 建筑产出计算

```
月卡加成 → buildingMonthlyBonus = monthlyCardActive ? baseProduction * 0.35 : 0
单栋秒产 → unitProduction = (baseProduction + buildingMonthlyBonus) * productionMultiplier
总秒产 → buildingTotalProduction = unitProduction * count
```

#### 杂役产出计算

```
技艺倍率 → servantSkillMultiplier = 1 + max(0, servantSkillLevel - 1) * 0.1
原始单产 → servantRawUnitProduction = servantBaseProduction * servantSkillMultiplier
月卡加成 → servantMonthlyBonus = monthlyCardActive ? servantRawUnitProduction * 0.35 : 0
单杂役秒产 → servantUnitProduction = servantRawUnitProduction + servantMonthlyBonus
总杂役秒产 → servantProduction = servantUnitProduction * servantCount
```

#### 总秒产

```
totalProduction = Σ(建筑总秒产) + Σ(杂役总秒产)
dailyProduction = totalProduction * 86400
```

#### 购买建筑

```
花费：nextBuyCost
增产：unitProduction
购买后：count += 1, nextBuyCost *= 1.25
```

#### 升级建筑

```
条件：level < 6 && count >= level * 10
花费：ceil(1.4 * nextBuyCost / 1.25 ^ (count - level * 10 + 1))
增产：unitProduction / level * count
升级后：baseProduction *= (level + 1) / level, level += 1
```

#### 招募杂役

```
岗位：servantsPerBuilding = (floor(buildingId / 2) + 1) * 2
岗位上限：servantCapacityOverride > 0 ? override : count * servantsPerBuilding
可招募：openSlots = max(0, capacity - servantCount)
招募 amount 个花费：nextServantCost * (1.1^amount - 1) / 0.1
增产：servantUnitProduction * amount
招募后：servantCount += amount, nextServantCost *= 1.1^amount
```

#### 杂役技艺升级

```
花费：nextServantSkillCost
增产：Σ(servantBaseProduction * servantCount * 0.1 * monthlyMultiplier)
升级后：servantSkillLevel += 1, nextServantSkillCost *= 2.2
```

### 4.4 建筑解锁逻辑 (`core/unlock.ts`)

```
规则：
- 建筑 0 默认解锁
- 建筑 i 解锁条件：建筑 i-1 已解锁 且 建筑 i-1 数量 >= 5

recalculateUnlocks(state):
  buildings[0].unlocked = true
  for i = 1 to 15:
    if buildings[i-1].unlocked && buildings[i-1].count >= 5:
      buildings[i].unlocked = true
    else:
      buildings[i].unlocked = false
```

**注意**：解锁后如果建筑的 `baseProduction` 或 `nextBuyCost` 为 0，说明数据缺失，不能加入购买候选。

### 4.5 候选动作生成 (`core/actions.ts`)

```
listGreedyActions(state) → Action[]

生成以下候选：
1. 对每个已解锁建筑，如果 count < 50 且 nextBuyCost > 0 且 unitProduction > 0：
   → 生成 buy 动作

2. 对每个已解锁建筑，如果 level < 6 且 count >= level * 10：
   → 生成 upgrade 动作

3. 对每个已解锁建筑，如果 openSlots > 0 且 nextServantCost > 0 且 servantBaseProduction > 0：
   → 生成 hireServant 动作（amount = 1 到 min(openSlots, 5)）

4. 如果 nextServantSkillCost > 0 且当前有杂役产生正收益：
   → 生成 upgradeServantSkill 动作

每个动作必须满足：cost > 0 且 deltaProduction > 0
```

### 4.6 贪心算法 (`core/greedy.ts`)

#### 打分函数

```
对每个动作：
  production = totalProduction(state)

  waitSeconds:
    if production <= 0 → Infinity
    if ore >= cost → 0
    else → (cost - ore) / production

  paybackSeconds:
    if deltaProduction <= 0 → Infinity
    else → cost / deltaProduction

  scoreSeconds = waitSeconds + paybackSeconds

  折扣规则：
    - 如果是购买最高已解锁建筑（frontier），且 count < 5 → score *= 0.5
    - （可选）如果是升级动作 → score *= 0.7
    - （可选）如果 deltaProduction >= 当前秒产 * 15% → score *= 0.85
```

#### 排序规则

```
actions.sort((a, b) => {
  1. scoreSeconds 小的优先
  2. scoreSeconds 接近（< 1e-9 差异）→ deltaProduction 大的优先
  3. 仍接近 → cost 低的优先
})
```

#### 动作执行模拟

```
performAction(state, action) → { state, step }:

  1. 计算等待：waitSeconds = max(0, (cost - ore) / totalProduction)
  2. 等待扣费：ore = ore + waitSeconds * totalProduction - cost
  3. 根据动作类型修改状态：
     - buy: count += 1, nextBuyCost *= 1.25
     - upgrade: baseProduction *= (level+1)/level, level += 1
     - hireServant: servantCount += amount, nextServantCost *= 1.1^amount
     - upgradeServantSkill: servantSkillLevel += 1, nextServantSkillCost *= 2.2
  4. 重新计算解锁状态
  5. 返回新状态和步骤记录
```

#### 贪心路线模拟

```
simulateGreedyPlan(state, options):
  horizonSeconds = options.horizonSeconds ?? 86400
  maxSteps = options.maxSteps ?? 80

  循环 maxSteps 次：
    1. 计算当前秒产，如果 <= 0 则停止
    2. 如果累计时间 >= horizonSeconds 则停止
    3. 生成候选动作，选最优的
    4. 如果最优动作的等待时间超出 horizonSeconds 则停止
    5. 执行动作，更新状态，记录步骤
  返回最终状态、时间线、总耗时
```

#### 硬冲解锁模拟

```
simulateHardUnlock(state, targetBuildingId):
  策略：只购买当前最高已解锁建筑（frontier），直到数量达 5 解锁下一类
  循环直到目标建筑解锁：
    1. 找到当前最高已解锁建筑
    2. 如果该建筑数量 >= 5，重新计算解锁并继续
    3. 否则生成购买动作并执行
  目标解锁后，计算首购等待时间
  返回总时间和首购总时间
```

---

## 5. UI 模块设计

### 5.1 页面布局

```
┌──────────────────────────────────────────────┐
│               全局输入区 (GlobalInput)          │
│  灵矿石 | 产量倍率 | 月卡 | 杂役技艺 | 花费    │
├──────────────────────────────────────────────┤
│               总览区 (Overview)                │
│  秒产 | 日产 | 已解锁数 | 前沿建筑 | 下一类    │
│  硬冲解锁时间 | 目标建筑首购时间               │
├──────────────────┬───────────────────────────┤
│  建筑录入表       │      杂役录入表             │
│  (BuildingTable)  │   (ServantTable)          │
│  16 行，每行可编辑 │   已解锁建筑的杂役数据     │
├──────────────────┴───────────────────────────┤
│               推荐区 (Recommendation)          │
│  第一步推荐（大字）                            │
│  前 5-10 个候选动作排序列表                    │
├──────────────────────────────────────────────┤
│             贪心路线区 (GreedyTimeline)         │
│  规划窗口选择：24h / 3天 / 7天                │
│  步骤列表：每步动作、等待时间、秒产变化         │
└──────────────────────────────────────────────┘
```

### 5.2 组件详细设计

#### GlobalInput（全局输入区）

| 字段 | 控件类型 | 说明 |
|------|---------|------|
| ore | 数字输入框 | 当前灵矿石数量 |
| productionMultiplier | 数字输入框 | 全局产量倍率，默认 1.0 |
| monthlyCardActive | 开关（toggle） | 月卡是否开启 |
| servantSkillLevel | 数字输入框 | 杂役技艺等级 |
| nextServantSkillCost | 数字输入框 | 下次技艺升级花费 |
| targetBuildingId | 下拉选择 | 目标建筑编号 |

#### Overview（总览区）

展示计算后的关键指标：

- **当前秒产**：格式化显示，如 `41,787.22/s`
- **预计日产**：`秒产 * 86400`
- **已解锁建筑数量**：统计 unlocked=true 的建筑
- **当前前沿建筑**：最高已解锁建筑的名称和数量
- **下一类建筑**：前沿建筑的下一类名称
- **硬冲解锁时间**：硬冲模拟的总秒数，转为"X 天 X 小时"
- **目标建筑首购时间**：硬冲解锁后 + 首购等待时间

#### BuildingTable（建筑录入表）

表格列：

| 列名 | 类型 | 说明 |
|------|------|------|
| 名称 | 只读 | 建筑名称 |
| 解锁 | 复选框 | 是否解锁 |
| 数量 | 数字输入 | 0-50 |
| 等级 | 数字输入 | 1-6 |
| 基础单产 | 数字输入 | baseProduction |
| 下次购买价 | 数字输入 | nextBuyCost |
| 建筑总秒产 | 只读 | 计算值 |
| 升级价格 | 只读 | 如果可升级则显示 |

- 每行输入变化时自动触发重新计算
- 未解锁建筑的输入框可以禁用或高亮提示

#### ServantTable（杂役录入表）

仅显示已解锁建筑。

| 列名 | 类型 | 说明 |
|------|------|------|
| 建筑名称 | 只读 | 关联建筑 |
| 已招杂役 | 数字输入 | servantCount |
| 岗位上限 | 只读 | 自动计算或覆盖值 |
| 单个基础产出 | 数字输入 | servantBaseProduction |
| 下次招募价 | 数字输入 | nextServantCost |
| 招满花费 | 只读 | 计算值 |
| 招募增产 | 只读 | 计算值 |

#### Recommendation（推荐区）

**第一步推荐**：大字突出显示

```
推荐：购买 锻兵房
花费：2,592,000,000
增产：+2,074.95/s
等待：约 17.2 小时
回本：约 14.46 天
原因：推进前沿数量，帮助解锁下一类
```

**候选动作列表**：前 5-10 个，表格形式

| 排名 | 动作 | 花费 | 增产 | 等待 | 回本 | 得分 |
|------|------|------|------|------|------|------|

#### GreedyTimeline（贪心路线区）

- 顶部：规划窗口选择按钮（24h / 3天 / 7天）
- 主体：时间线步骤列表

```
Step 1: 购买 锻兵房 [等待 17.2h] 秒产 → 43,862.17/s
Step 2: 招募 1 个杂役到补给营地 [等待 0.5h] 秒产 → 43,862.71/s
...
```

- 底部汇总：总耗时、最终秒产、秒产提升百分比

### 5.3 数字格式化工具 (`utils/format.ts`)

```ts
// 大数格式化：1,234,567.89 或 1.23M（根据数值大小）
formatNumber(num: number): string

// 时间格式化：秒 → "X 天 X 小时 X 分" 或 "X.XX 小时"
formatTime(seconds: number): string

// 秒产格式化：41,787.22/s
formatProduction(rate: number): string
```

---

## 6. 数据流与状态管理

### 6.1 状态结构

```ts
interface AppState {
  gameState: GameState;        // 完整游戏状态
  recommendation: {            // 当前推荐结果
    bestAction: Action | null;
    allActions: Action[];
    overview: OverviewData;
  };
  greedyPlan: GreedyPlanResult | null;  // 当前贪心路线
  hardUnlock: HardUnlockResult | null;  // 硬冲解锁结果
  planHorizon: number;         // 当前规划窗口（秒）
}
```

### 6.2 数据流

```
用户输入（GlobalInput / BuildingTable / ServantTable）
    ↓
更新 GameState（通过 useGameState composable）
    ↓
触发核心计算（纯函数调用，通过 Vue computed 自动追踪）
    ├── totalProduction() → 计算秒产
    ├── listGreedyActions() → 生成候选
    ├── scoreActions() → 打分排序
    ├── simulateGreedyPlan() → 路线模拟
    └── simulateHardUnlock() → 硬冲模拟
    ↓
更新 UI 状态（Recommendation / Overview / GreedyTimeline）
    ↓
Vue 响应式重渲染
```

### 6.3 Composable 设计 (`composables/useGameState.ts`)

```ts
function useGameState(initialState: GameState) {
  const gameState = reactive(structuredClone(initialState));

  // 更新单个建筑的某个字段
  const updateBuilding = (id: number, field: string, value: number) => { ... };

  // 更新全局字段
  const updateGlobal = (field: string, value: number | boolean) => { ... };

  // 导入/导出 JSON 状态
  const importState = (json: object) => { ... };
  const exportState = () => { ... };

  return { gameState, updateBuilding, updateGlobal, importState, exportState };
}
```

### 6.4 计算触发时机

- **每次 gameState 变化**：通过 `computed` 自动重新计算秒产、推荐、候选
- **切换规划窗口**：重新运行贪心路线模拟
- **切换目标建筑**：重新运行硬冲解锁模拟
- 使用 Vue `computed` 缓存计算结果，只有依赖的响应式数据变化时才重算

---

## 7. API 详细设计

### 7.1 core 模块导出接口 (`core/index.ts`)

```ts
// 常量
export * from './constants';

// 类型
export * from './types';

// 公式
export function calcUnitProduction(building: Building, state: GameState): number;
export function calcBuildingTotalProduction(building: Building, state: GameState): number;
export function calcServantUnitProduction(building: Building, state: GameState): number;
export function calcServantProduction(building: Building, state: GameState): number;
export function calcTotalProduction(state: GameState): number;
export function calcDailyProduction(state: GameState): number;

// 花费
export function calcBuyCost(building: Building): number;
export function calcUpgradeCost(building: Building): number;
export function calcHireServantCost(building: Building, amount: number): number;
export function calcUpgradeServantSkillCost(state: GameState): number;

// 增产
export function calcBuyDeltaProduction(building: Building, state: GameState): number;
export function calcUpgradeDeltaProduction(building: Building, state: GameState): number;
export function calcHireServantDeltaProduction(building: Building, state: GameState, amount: number): number;
export function calcUpgradeSkillDeltaProduction(state: GameState): number;

// 解锁
export function recalculateUnlocks(state: GameState): GameState;
export function getHighestUnlockedId(state: GameState): number;
export function getNextBuildingId(state: GameState): number | null;

// 动作
export function listGreedyActions(state: GameState): Action[];
export function scoreAction(action: Action, state: GameState): Action;
export function performAction(state: GameState, action: Action): { state: GameState; step: TimelineStep };

// 模拟
export function simulateGreedyPlan(state: GameState, options?: {
  horizonSeconds?: number;
  maxSteps?: number;
}): GreedyPlanResult;

export function simulateHardUnlock(state: GameState, targetBuildingId: number): HardUnlockResult;

// 杂役
export function getServantCapacity(building: Building): number;
export function getOpenServantSlots(building: Building): number;
export function getServantsPerBuilding(buildingId: number): number;
```

---

## 8. 验收标准

### 8.1 数值验收（使用 spec 中的用户数据样例）

使用 spec 第 22 节的 JSON 数据作为输入，以下结果必须在误差范围内：

| 指标 | 期望值 | 允许误差 |
|------|--------|---------|
| 当前秒产 | 41,787.22/s | ±0.01 |
| 预计日产 | 3,610,415,935.72 | ±100 |
| 当前前沿建筑 | 锻兵房，0/5 | 必须精确 |
| 下一类建筑 | 藏经阁 | 必须精确 |
| 硬冲解锁藏经阁 | ~455,845.12 秒 (~5.28 天) | ±60 秒 |
| 藏经阁首购时间 | 无法计算（baseProduction=0, nextBuyCost=0） | 必须正确处理 |

### 8.2 贪心推荐验收

第一推荐必须是：

| 字段 | 期望值 |
|------|--------|
| 动作 | 购买 锻兵房 |
| 花费 | 2,592,000,000 |
| 增产 | 2,074.95/s |
| 等待 | ~62,028.53 秒 (~17.2 小时) |
| 回本 | ~1,249,186.73 秒 (~14.46 天) |
| 折扣后得分 | ~655,607.63 秒 (~7.59 天) |
| 原因 | 推进前沿数量，帮助解锁下一类 |

### 8.3 候选动作排序验收

前 8 个候选必须按此顺序（或非常接近）：

```
1. 购买锻兵房
2. 招募 1 个杂役到补给营地
3. 购买探测法阵
4. 招募 2 个杂役到补给营地
5. 提升杂役技艺
6. 招募 3 个杂役到补给营地
7. 招募 1 个杂役到修士坊市
8. 购买修士坊市
```

### 8.4 功能验收

- [ ] 全局输入区所有字段可编辑，修改后即时反映到推荐
- [ ] 建筑录入表 16 行完整显示，可编辑关键字段
- [ ] 杂役录入表仅显示已解锁建筑
- [ ] 总览区显示所有指标
- [ ] 推荐区显示第一步推荐和候选列表
- [ ] 贪心路线区支持 24h/3天/7天 切换
- [ ] 硬冲解锁和目标建筑首购时间正确显示
- [ ] 未解锁且 baseProduction=0/nextBuyCost=0 的建筑不进入候选
- [ ] totalProduction <= 0 时停止模拟并提示
- [ ] 所有动作 cost > 0 且 deltaProduction > 0

### 8.5 边界情况验收

- [ ] 灵矿石为 0 时正常计算等待时间
- [ ] 建筑数量达 50 时不再推荐购买
- [ ] 建筑等级达 6 时不再推荐升级
- [ ] 杂役满岗时不再推荐招募
- [ ] 月卡开关切换时所有相关计算同步更新

---

## 9. 开发计划

### Phase 1：核心计算模块（优先级最高）

1. 创建项目骨架（Vite 4 + Vue 3 + TypeScript）
2. 实现 `core/constants.ts` — 常量定义
3. 实现 `core/types.ts` — 数据类型
4. 实现 `core/formulas.ts` — 所有公式
5. 实现 `core/unlock.ts` — 解锁逻辑
6. 实现 `core/actions.ts` — 候选动作生成
7. 实现 `core/greedy.ts` — 贪心打分、排序、模拟
8. 编写 `tests/formulas.test.ts` — 公式单元测试
9. 编写 `tests/greedy.test.ts` — 贪心算法测试（使用 spec 验收数据）

**验收**：跑通 spec 第 22 节的全部数值验收标准。

### Phase 2：UI 骨架与数据录入

10. 实现 `utils/format.ts` — 数字/时间格式化
11. 实现 `composables/useGameState.ts` — 状态管理 composable
12. 实现 `components/GlobalInput.vue` — 全局输入区
13. 实现 `components/BuildingTable.vue` — 建筑录入表
14. 实现 `components/ServantTable.vue` — 杂役录入表
15. 实现 `components/Overview.vue` — 总览区

**验收**：能输入 spec 样例数据，总览区显示正确秒产和日产。

### Phase 3：推荐与路线

16. 实现 `components/Recommendation.vue` — 推荐区
17. 实现 `components/GreedyTimeline.vue` — 贪心路线区
18. 实现 `components/App.vue` — 组装所有组件

**验收**：输入 spec 样例数据，推荐和排序与 spec 一致，路线模拟正常。

### Phase 4：打磨

19. 样式完善（响应式布局、颜色区分、交互反馈）
20. 导入/导出 JSON 功能
21. 边界情况处理和错误提示
22. 最终验收测试

---

## 10. 注意事项

### 10.1 关键约束

1. **核心计算与 UI 必须解耦**。core 目录下不能有任何 Vue 或 DOM 依赖。
2. **所有公式必须在一个模块里**（`core/formulas.ts`），UI 只调用 core 模块，不自行计算。
3. **数据验证**：输入数据必须做归一化和边界检查。
4. **缺失数据的建筑**：`baseProduction = 0` 或 `nextBuyCost = 0` 的未解锁建筑不能进入候选动作。

### 10.2 常见陷阱

| 陷阱 | 说明 | 避免方式 |
|------|------|---------|
| 月卡加成遗漏 | 月卡同时影响建筑和杂役 | 在所有产出计算中统一检查 monthlyCardActive |
| 全局倍率不一致 | productionMultiplier 要么影响杂役，要么不影响，不能部分乘 | 确定策略后所有杂役公式同步处理 |
| 浮点精度 | 大数计算可能有精度问题 | 升级费用使用 ceil()，关键比较用 1e-9 容差 |
| 解锁链断裂 | 修改建筑数量后忘记重新计算解锁 | performAction 后强制调用 recalculateUnlocks |
| 除零 | totalProduction = 0 时计算等待时间会除零 | 检查 production <= 0 时返回 Infinity 或停止 |

### 10.3 杂役产出与全局倍率的决策

spec 中提到一个关键决策点：

> 如果希望"全局产量倍率"也影响杂役，需要在 servantUnitProduction 最后再乘 productionMultiplier，并且所有杂役增产公式也必须同步乘。

**建议**：在初版实现中，**不让 productionMultiplier 影响杂役**。这样逻辑更简单，不容易出错。如果后续需要支持，只需在所有杂役相关公式中统一乘上即可。

### 10.4 贪心折扣的选择

spec 推荐了多种折扣策略：

| 折扣 | 值 | 建议 |
|------|------|------|
| 前沿解锁折扣 | 0.5 | **必须实现**，核心策略 |
| 升级折扣 | 0.7 | 可选，初版可跳过 |
| 高影响折扣 | 0.85 | 可选，初版可跳过 |

**建议**：初版只实现前沿解锁折扣 0.5，保持简单和可预测。

### 10.5 性能考虑

- 贪心路线模拟最多 80 步，每步生成 ~16*7 个候选（16 建筑 * 买/升级/杂役），计算量不大
- 使用 Vue `computed` 缓存计算结果
- 路线模拟是同步计算，如果耗时较长可考虑放在 Web Worker 中执行
- 大部分情况下用户修改输入 → 重新计算应该在 100ms 内完成
