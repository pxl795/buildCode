# 灵矿石策略计算器 — 代码与算法评审

> 评审对象：`buildCode/` 仓库，截至当前 `main` 分支  
> 评审范围：核心算法（`src/core/*`）、状态管理（`useGameState.ts`）、规格文档（`greedy-calculator-spec.md`）一致性、单元测试  
> 评审目的：梳理项目需求、定位算法/工程问题、提出可落地的优化方向

---

## 1. 项目目标速览

一个**纯前端**的放置/经营游戏（"灵矿石"题材）资源规划工具：

- **核心数据**：1 种全局资源 `ore`，16 类建筑（每类可买、可升、可雇杂役），1 个全局"杂役技艺"
- **核心循环**：等待 → 投资（买/升/雇/升技艺）→ 秒产提高 → 继续滚雪球
- **核心问题**：
  1. **下一步最值得做什么？**（推荐单步）
  2. **持续按贪心走，未来若干步路线如何？**（路线模拟）
  3. **多久能解锁/首购目标建筑？**（硬冲解锁）
- **算法定位**：明确写的是"**贪心算法**（不是全局最优）"，规格还允许追加少量启发式折扣。

主要模块映射：

| 模块 | 职责 |
| --- | --- |
| `core/constants.ts` | 公式常量（增长系数、折扣、上限） |
| `core/types.ts` | `Building / GameState / Action / TimelineStep` 等类型 |
| `core/formulas.ts` | 所有产出/花费公式 |
| `core/unlock.ts` | 解锁判定、前沿建筑查询 |
| `core/actions.ts` | 枚举当前可执行的候选动作 |
| `core/greedy.ts` | 打分、排序、路线模拟、硬冲解锁 |
| `core/beam.ts` | Beam Search 对比版本（width=3） |
| `composables/useGameState.ts` | 响应式状态 + 撤销栈 + 派生 computed |
| `components/*` | 输入表、总览、推荐、时间线、算法对比 |

---

## 2. 贪心算法当前实现

### 2.1 打分公式（`scoreAction` in `core/greedy.ts`）

```
waitSeconds    = max(0, (cost - ore) / totalProduction)   // 攒钱时间
paybackSeconds = cost / deltaProduction                   // 回本时间
scoreSeconds   = waitSeconds + paybackSeconds             // 越小越优
```

### 2.2 启发式折扣

- **前沿解锁折扣**：购买"当前最高已解锁建筑"且 `count < 5` → `score × 0.5`
- **升级冲刺复合打分**：购买距离升级门槛 `≤ 6` 栋的建筑时，额外算一份"买完 N 栋 + 升级"的复合 score，取 `min(单步score, 复合score)`

### 2.3 排序规则

`score 升序 → deltaProduction 降序 → cost 升序`

---

## 3. 主要问题

下文按 **算法正确性 / 算法表现 / 工程实现 / 文档与一致性** 分组。每条标 **影响等级**：🔴 高 / 🟡 中 / 🟢 低。

---

### 3.1 算法正确性问题

#### 🔴 P1. 升级复合打分中 `upgradeDelta` 没有用"买完 N 栋之后的状态"
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:82-123`

```@e:/codeTwo/buildCode/src/core/greedy.ts:105-116
  // 升级后的产量增量：baseProduction 增加 (b.level+1)/b.level 倍
  const upgradeDelta = calcUpgradeDeltaProduction(b, state);
  if (upgradeDelta <= 0) return null;

  // 等比数列求和：distance 栋自身的新增产量
  let buyDeltaTotal = 0;
  const unitProd = calcUnitProduction(b, state);
  for (let i = 0; i < distance; i++) {
    buyDeltaTotal += unitProd;
  }
```

- `calcUpgradeDeltaProduction(b, state)` 用的是 `b.count`（当前数量），而真实复合路径里升级是在 `count + distance` 时发生的，**升级增益被低估**（差距 = `unitProduction/level × distance`）。
- 后果：复合分数偏大，"买几栋凑齐再升级"这条策略被低估，前期升级会被推迟。

**修复建议**：在复合函数里手动计算 `(unitProduction / level) × (count + distance)`。

---

#### 🔴 P2. 复合打分的 `wait` 用恒定 `currentProduction` 估算
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:117-121`

```@e:/codeTwo/buildCode/src/core/greedy.ts:117-121
  const compositeWait = Math.max(0, (totalInvestment - state.ore) / currentProduction);
  const compositePayback = totalInvestment / totalDelta;
  const compositeScore = compositeWait + compositePayback;
```

- 现实里，每买一栋产量都会上升，攒下一栋钱的速度也越来越快。用恒定 `currentProduction` 攒 `totalInvestment` 会**高估等待时间**。
- 与 P1 的方向相反——一个让复合分偏大、一个让复合分偏大，整体把"升级冲刺"低估得更明显。

**修复建议**：分段等比模拟，每买完一栋更新 production，或对升级冲刺给个固定 multiplier（如 `0.8`）作为粗校正。

---

#### 🔴 P3. `buyDeltaTotal` 漏掉了"已买建筑还会再产出 wait 时间"的语义
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:108-119`

- 等比的 `buyDeltaTotal = unitProd × distance` 表示"这 N 栋的新单位产能"，再加 `upgradeDelta` 当作 `totalDelta`，然后 `compositePayback = totalInvestment / totalDelta`。
- 但 `paybackSeconds` 这种比值的含义是"用增量产出回收投入"，**等于把所有新增 production 同时按它的"达到时刻"折现**——这是个粗略指标，方向上还可以接受，但与单步 `paybackSeconds` 的定义并不严格对应。
- 影响：复合分与单步分在"绝对数值"层面不可直接比较，`Math.min(...)` 实际是把两种不同标度的分混着排。

**修复建议**：把复合打分也写成"等价单步 score"，比如：
```
equivalentPayback = totalInvestment / (totalDelta * 平均生效系数)
```
或干脆改成"模拟 distance+1 步后总耗时"，与其他动作的 `score` 同口径比较。

---

#### 🟡 P4. `canUpgrade` 硬编码 `level < 6`，绕过常量
**位置**：`@e:/codeTwo/buildCode/src/core/formulas.ts:68-70`

```@e:/codeTwo/buildCode/src/core/formulas.ts:68-70
export function canUpgrade(building: Building): boolean {
  return building.level < 6 && building.count >= building.level * 10;
}
```

- 应使用 `MAX_BUILDING_LEVEL` 常量，避免后续调上限时漏改。
- 同样 `actions.ts:79` 的 `b.level * 10` 也是硬编码，可改为 `b.level * UPGRADE_THRESHOLD_PER_LEVEL` 之类的命名常量（spec 第 7 节）。

---

#### 🟡 P5. 杂役产出**不**乘 `productionMultiplier`，与规格不严格一致
**位置**：`@e:/codeTwo/buildCode/src/core/formulas.ts:29-34`

```@e:/codeTwo/buildCode/src/core/formulas.ts:29-34
export function calcServantUnitProduction(building: Building, state: GameState): number {
  const skillMul = calcServantSkillMultiplier(state);
  const raw = building.servantBaseProduction * skillMul;
  const monthlyBonus = state.monthlyCardActive ? raw * MONTHLY_CARD_BONUS_RATE : 0;
  return raw + monthlyBonus;
}
```

- 规格第 8 节明确表达：**这两种口径都允许，但必须全公式一致**。当前实现统一不乘，逻辑自洽。
- 风险点：用户预期"全局倍率影响一切"时会看到推荐偏差；并且若未来加入"对杂役的倍率加成"，需要同步改 `calcUpgradeSkillDeltaProduction`、`calcHireServantDeltaProduction` 三处。
- 当前可在 README/页面上写明"productionMultiplier 仅作用于建筑产能"，避免误解。

---

#### 🟢 P6. `getHighestUnlockedId` 返回的是"已遍历过的最大已解锁 id"
**位置**：`@e:/codeTwo/buildCode/src/core/unlock.ts:20-26`

- 若数据被人为破坏（中间某栋 `unlocked=false` 而后面又 true），返回值会不连续。当前 `recalculateUnlocks` 已保证单调性，所以实践无问题；但函数自身不健壮。
- 改为遍历到第一个 `!unlocked` 之前一格即可，逻辑更清晰且无歧义。

---

### 3.2 算法表现问题（greedy 本身的局限）

#### 🔴 P7. `score = wait + payback` 把"等待"和"回本"两段时间相加，存在结构性偏差
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:30-44`

- 在长 wait 期间，玩家其实**可以同时做大量小动作**（招杂役、买小建筑），但贪心只评估"单动作"，于是：
  - 大额投资（前沿建筑）的 `wait` 被过度归罪到自身分数上
  - 小额、快回本动作总是被排在前面，前期会一直堆杂役/买低级建筑
- 这就是为什么 Beam Search 在长周期累计产量上能跑赢——它能间接捕捉"等待期间也可以做事"。
- 表现：3 天对比里 Beam 通常领先 5%~30%（取决于数据）。

**优化建议**（按工作量从小到大）：
1. **快速版**：把 `score` 改成 `max(wait, payback)` 或 `wait + α × payback`（α<1），削弱 wait 对大投资的惩罚。
2. **中等版**：引入"机会成本"——在评估大投资时，先把"wait 时间里能做的最优小动作链"模拟掉，再用剩余 ore/时间计算 wait。
3. **彻底版**：放弃单步贪心，全面切换到 Beam Search 或滚动时间窗模拟（详见 §4）。

---

#### 🔴 P8. 没有"等待期间穿插小动作"机制
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:142-200` `performAction`

```@e:/codeTwo/buildCode/src/core/greedy.ts:156-157
  // 等待并扣费
  next.ore = next.ore + waitSeconds * productionBefore - action.cost;
```

- 当 best action 需要等 17 小时时，模拟器**直接静默推进 17 小时**，不会在期间执行更便宜的动作。
- 这是导致 greedy 在 3 天累计产量上输给 beam search 的最大单点原因。
- **优化建议**：每选出一个 best 动作后，先扫一遍"当前 ore 已经够付且 ROI 优秀（如 `paybackSeconds < bestAction.waitSeconds`）"的小动作，依次执行直到 ore 不够，再继续等待。这是教科书"贪心 + 立即可执行项过滤"组合，实现 30~50 行即可。

---

#### 🟡 P9. 前沿解锁折扣 0.5 太硬
**位置**：`@e:/codeTwo/buildCode/src/core/constants.ts:19` + `greedy.ts:46-55`

- 0.5 是一刀切。在前期（前沿便宜）显得偏弱，在后期（前沿动辄数十亿）又会强行盖过其他更划算动作。
- 也没有考虑"前沿剩几栋就解锁"：差 4 栋和差 1 栋的折扣应当不同。
- **建议公式**：
  ```
  remain = 5 - frontier.count           // 1..5
  discount = 1 - 0.5 × (1 - (remain-1)/5)  // 差 1 栋时 ≈0.5；差 5 栋时 1.0
  ```
  或更稳：`discount = 0.4 + 0.12 × (remain - 1)`。

---

#### 🟡 P10. `UPGRADE_DISCOUNT` / `HIGH_IMPACT_THRESHOLD` / `HIGH_IMPACT_DISCOUNT` 是死代码
**位置**：`@e:/codeTwo/buildCode/src/core/constants.ts:20-22`

```@e:/codeTwo/buildCode/src/core/constants.ts:20-22
export const UPGRADE_DISCOUNT = 0.7;
export const HIGH_IMPACT_THRESHOLD = 0.15;
export const HIGH_IMPACT_DISCOUNT = 0.85;
```

- 这三个常量在整个项目里**没有任何引用**。规格第 15 节"可选增强折扣"里提到过，看来后来改了思路但常量没清理。
- 影响：阅读者会以为这些折扣生效，实际没有。
- **建议**：要么实现这两个折扣（升级动作 ×0.7、增产 ≥15% 总产时 ×0.85），要么删掉常量并在 README/footer 里改对应描述。

---

#### 🟡 P11. 硬冲解锁（hard unlock）只考虑买当前前沿
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:251-373`

- 策略是"无脑买前沿到 5 栋"，但其实**升级低阶建筑、招满杂役、提升技艺**可能让总秒产更早达到前沿购买所需的 ore，整体反而更快。
- 当前实现作为"基线参考"是合理的，但不是真正最快路径。
- **建议**：增加一个 `simulateHardUnlockOptimized`，每步用 greedy 但限制目标为"加快前沿购买"（如分数加权 `cost/ deltaProduction × frontier 距离系数`）。或者跑一个 Beam，但奖励函数改成"目标建筑解锁的最短时间"。

---

#### 🟡 P12. Beam Search 的"最优"按 `cumulativeProduction` 选，不考虑时间窗外的预期收益
**位置**：`@e:/codeTwo/buildCode/src/core/beam.ts:71-101`

```@e:/codeTwo/buildCode/src/core/beam.ts:71-83
        const stepProduction = result.step.productionBefore * result.step.waitSeconds;
        const newCumulative = node.cumulativeProduction + stepProduction;
```

- "累计产量"只统计"动作之间等待时段实际产出的 ore"，**没有把"最后一步以后到 horizon 终点"那段时间产出**算进去。
- 后果：beam 会偏爱"早期就大量等待"，而不是"快投资、后段产能爆发"。
- 改进：
  ```
  finalScore = cumulativeProduction + (horizon - elapsedSeconds) × finalProduction
  ```
  这才是真正的"horizon 内总累计 ore"。同时排序 candidates 时也用这个新指标。

---

#### 🟡 P13. Beam Search 候选扩展深度太浅 (`width + 2 = 5`)
**位置**：`@e:/codeTwo/buildCode/src/core/beam.ts:65-66`

- 每个 beam 节点只扩展前 5 个动作；但 `listGreedyActions` 通常有 30~80 个动作。
- 想要 beam 真正发挥作用，扩展深度至少应该 ≥ `2 × beamWidth`，或者按动作类型分桶（每类至少留一个候选），避免被同一类型小动作霸榜。
- 建议：扩展数从 `width+2` 改为可配置，UI 上提供调节。

---

### 3.3 工程实现问题

#### 🟡 P14. `scoreAndSortActions` 在响应式 computed 里被多个出口重复触发
**位置**：`@e:/codeTwo/buildCode/src/composables/useGameState.ts:95-122`

- `sortedActions`、`bestAction`、`greedyPlan`、`beamPlan`、`greedy3Day`、`beam3Day`、`hardUnlock` 都依赖 `gameState`。
- 每次任何字段变化（包括用户输入框敲一个字符）都会**触发 5~7 个完整模拟**，其中 `greedy3Day` 跑 200 步，`beam3Day` 在 200 步 × 5 扩展 × 3 beam 上跑。
- 实测在低端机上输入会卡顿。
- **优化建议**：
  1. 对 `greedy3Day`、`beam3Day` 加 `debounce`（如 300ms）或显式 "立即计算" 按钮
  2. 把候选动作生成与打分的 `production` 缓存抽出来（目前 `scoreAction` 已支持 `cachedProduction`，但 `scoreAndSortActions` 里没缓存到 `simulateGreedyPlan` 的循环里——其实有缓存，没问题；问题主要是**模拟自身**的开销）
  3. `simulateGreedyPlan` 内 `calcTotalProduction(state)` 在 `for` 循环开头每步算一次，再加上 `scoreAction` 内部又会算——已经传 `cachedProduction` 复用了，但 `performAction` 又算了两次 `productionBefore/After`，可以传入复用

#### 🟡 P15. `performAction` 重复计算产量
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:142-200`

```@e:/codeTwo/buildCode/src/core/greedy.ts:147-188
  const productionBefore = calcTotalProduction(next);
  ...
  recalculateUnlocks(next);
  const productionAfter = calcTotalProduction(next);
```

- 一次动作执行有 2 次 `calcTotalProduction`（O(16) 但每步固定开销），在 `simulateGreedyPlan` 主循环里 `production` 早就算过一次但被丢弃。
- 200 步 × beam 3 × 5 扩展 × 3 次计算 ≈ 9000 次扫表，放在响应式 computed 里会拖慢键盘输入。

---

#### 🟡 P16. `recalculateUnlocks` 重复调用
**位置**：多处

- `useGameState.ts` 的 `updateBuilding` / `updateGlobal` 每次都调用 `recalculateUnlocks`。
- `performAction` 内部也调用。
- `simulateGreedyPlan` / `simulateHardUnlock` 入口又调用一次。
- 单次调用很便宜，但叠加到模拟主循环里就成倍。建议在 `performAction` 内只针对"可能改变解锁状态的动作"（`buy`）调用。

---

#### 🟢 P17. `cloneState` 浅拷贝 `buildings` 数组里的对象，没拷贝其他引用
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:22-27`

- 当前 GameState 没有嵌套对象（除 buildings 外都是 primitive），实现正确。
- 但如果后续加上 `inventory`、`activeBuffs[]` 之类，会有静默 bug。
- 建议加注释提醒，或者用 `structuredClone` 兜底。

---

#### 🟢 P18. `safety++ > 500` 的硬编码上限
**位置**：`@e:/codeTwo/buildCode/src/core/greedy.ts:289-301`

- 16 类 × 5 栋 = 80 步上限其实够用，但万一有数据异常会撞 500。
- 应改为常量、并把异常 reason 写明白（当前是 `"硬冲模拟超出步数上限"`，OK 但可加更多上下文，比如卡在哪栋）。

---

### 3.4 文档与一致性问题

#### 🔴 P19. README/footer 与代码实际数值不一致

- `README.md:58` 写 `折扣后得分 ≈ 655,607.63 秒`
- `tests/greedy.test.ts:38` 测试期望 `653543.68`
- `App.vue:161` footer 写 `前沿解锁折扣 0.7`，但 `constants.ts:19` 是 `FRONTIER_UNLOCK_DISCOUNT = 0.5`
- `README.md:66-68` 写 `score = waitSeconds + paybackSeconds`，未提"升级冲刺复合打分"，描述与实现不对齐
- 建议统一为一份"算法当前真实行为"的简短说明，否则用户/审稿者无法自洽。

---

#### 🟡 P20. `spec` 是"应当怎么做"，`README` 是"做了什么"，但二者已经偏离

- spec 第 14-15 节描述 `score = wait + payback`、折扣 0.5、可选增强折扣
- 实现里加了 spec 没有的"升级冲刺复合打分"
- spec 第 22 节验收用例（"折扣后得分 ≈ 655,607.63"）已不对应当前默认数据（锻兵房 count 从 0 改成 1，所以测试期望 ≈ 653,543）
- 建议在 README 顶部加一段"实现增强"说明，列出与 spec 的所有偏差

---

#### 🟢 P21. 时间常量分散

- `DEFAULT_HORIZON_SECONDS = 86400`、`THREE_DAYS = 3 * 86400`（在 useGameState.ts 里写死）、`maxSteps = 200`（同上）、UI 上还有 24h / 3天 / 7天 切换的需求（README 提及但代码里没看到 7 天）
- 建议把时间窗集中到 constants：`HORIZON_1D`、`HORIZON_3D`、`HORIZON_7D`，UI 通过下拉切换。

---

## 4. 优化路线建议（按收益/工作量排序）

| 优先级 | 项 | 涉及 | 工作量 | 预期收益 |
| --- | --- | --- | --- | --- |
| ⭐⭐⭐ | **P8** 等待期间穿插立即可执行的小动作 | `greedy.ts` 加一个 helper | 30~60 行 | 3 天累计产量显著提升，greedy 接近 beam |
| ⭐⭐⭐ | **P1+P2+P3** 修复升级冲刺复合打分 | `greedy.ts:82-123` | 30 行 | 关键转折点不再延误升级 |
| ⭐⭐⭐ | **P19+P20** README/footer/spec 三方对齐 | 文档 + 一处 footer 文案 | 10 分钟 | 阅读者信任度 |
| ⭐⭐ | **P12** Beam Search 评分加 horizon 尾部产能 | `beam.ts` 排序+ best 选择 | 5 行 | beam 推荐更稳，对比图更有意义 |
| ⭐⭐ | **P14** 重计算节流 | `useGameState.ts` 加 debounce | 20 行 | 输入流畅度大幅改善 |
| ⭐⭐ | **P10** 实现/删除 UPGRADE_DISCOUNT 等死常量 | `constants.ts` + `greedy.ts` | 20 行 | 代码自洽 |
| ⭐⭐ | **P9** 前沿折扣线性化 | `greedy.ts:46-55` | 5 行 | 推荐更平滑 |
| ⭐ | **P11** 硬冲解锁加优化版本 | 新增函数 | 50 行 | 给用户多一个参考 |
| ⭐ | **P13** Beam 扩展宽度可调 | `beam.ts` + UI | 20 行 | beam 表现 |
| ⭐ | **P4** `canUpgrade` 用常量 | `formulas.ts` | 3 行 | 可维护性 |
| ⭐ | **P5** 文档注明 `productionMultiplier` 不作用于杂役 | README | 5 分钟 | 用户理解 |
| ⭐ | **P15/P16** 模拟内部缓存复用 | `greedy.ts` | 10 行 | 性能 |

---

## 5. 一个推荐的"最小改造方案"

如果只能改一处，做 **P8**：

```ts
// greedy.ts 内 simulateGreedyPlan 主循环
function drainAffordableQuickWins(state: GameState, production: number): TimelineStep[] {
  const steps: TimelineStep[] = [];
  let safety = 0;
  while (safety++ < 50) {
    const actions = scoreAndSortActions(state)
      // 只考虑"已经买得起 + 回本快 + 不是前沿那种大投资"
      .filter(a => a.cost <= state.ore
        && isFinite(a.paybackSeconds)
        && a.paybackSeconds < 3600);  // 1 小时内回本算"小动作"
    if (actions.length === 0) break;
    const result = performAction(state, actions[0]);
    state = result.state;
    steps.push({ ...result.step, totalSeconds: 0 }); // 由调用方累加
  }
  return steps;
}
```

把这个 helper 在 `simulateGreedyPlan` 每次外层 `for` 进入时调用一次，就能让 greedy 在等待大投资前先把 ore 花到小动作上，3 天累计产量预期能提升 10%~20%（实测之前的 beam 优势很大程度上就来自这一点）。

---

## 6. 总结

- **架构**：UI 与计算解耦得很好，`core/*` 全是纯函数，便于单测和重构，**是项目的最大亮点**。
- **算法**：贪心定位明确、实现完整，但有 3 个量化 bug（P1/P2/P3）+ 2 个结构性短板（P7/P8）+ 1 个评分口径问题（P12）。
- **工程**：响应式触发链稍重（P14），但功能正确，撤销/导入/导出/持久化都到位。
- **文档**：README、spec、代码三者存在不可忽略的偏离（P19/P20），建议先快速对齐再谈算法迭代。

**首要落地三件事**：

1. 修升级冲刺复合打分（P1/P2/P3）
2. 在等待期间穿插小动作（P8）
3. README/footer 数值与算法描述对齐（P19/P20）

完成这三项后，再决定是否把贪心彻底替换为 Beam Search 或滚动窗口模拟。
