# 灵矿石策略计算器：玩法规则与贪心算法实现说明

这份文档用于交给其他大模型生成一个“灵矿石策略计算器”。目标不是复刻当前项目里的 Beam Search 长期规划，而是做一个按贪心算法推荐下一步操作和模拟路线的计算器。

## 1. 项目玩法总结

这是一个放置/经营类资源规划工具。玩家拥有一种核心资源：`灵矿石`。建筑和杂役会持续产生灵矿石，玩家用灵矿石继续购买建筑、升级建筑、招募杂役、提升杂役技艺，从而滚雪球提高秒产。

核心循环：

```text
当前灵矿石 -> 等待产出 -> 执行一个投资动作 -> 秒产提高 -> 再计算下一步
```

计算器要回答的问题：

```text
在当前资源、建筑数量、等级、杂役数据下，下一步最值得做什么？
如果一直按贪心策略执行，未来一段时间内的路线是什么？
距离解锁下一类建筑、首购目标建筑还要多久？
```

## 2. 建筑与解锁规则

游戏有 16 类建筑，按顺序解锁：

```text
0 补给营地
1 探测法阵
2 采矿据点
3 修士坊市
4 炼丹楼
5 灵符堂
6 锻兵房
7 藏经阁
8 真仙池
9 玄仙府
10 金仙宫
11 太乙峰
12 大罗天
13 道祖殿
14 鸿蒙塔
15 混元境
```

解锁规则：

```text
第 0 类建筑默认解锁。
第 i 类建筑解锁条件：第 i-1 类建筑已经解锁，并且第 i-1 类建筑数量 >= 5。
```

数量与等级上限：

```text
建筑最大数量 MAX_COUNT = 50
建筑最大等级 MAX_LEVEL = 6
下一类建筑解锁数量 NEXT_BUILDING_UNLOCK_COUNT = 5
```

## 3. 全局输入

计算器至少需要这些全局输入：

| 字段 | 含义 | 示例 |
| --- | --- | --- |
| `ore` | 当前灵矿石数量 | `1000000` |
| `productionMultiplier` | 全局产量倍率 | `1.05` |
| `monthlyCardActive` | 是否开启月卡 | `true` |
| `servantSkillLevel` | 杂役技艺等级 | `15` |
| `nextServantSkillCost` | 下次提升杂役技艺花费 | `136880040` |
| `targetBuildingId` | 目标建筑编号 | `7` |

月卡规则：

```text
MONTHLY_CARD_BONUS_RATE = 0.35
月卡开启时，建筑基础单产额外增加 35%。
```

## 4. 单个建筑数据结构

每类建筑至少包含：

```ts
type Building = {
  id: number;                    // 0-15
  name: string;                  // 建筑名称
  unlocked: boolean;             // 是否已解锁
  count: number;                 // 当前数量，0-50
  level: number;                 // 当前等级，1-6
  baseProduction: number;        // 当前等级下的建筑基础单产
  nextBuyCost: number;           // 下一栋购买价格

  servantCount: number;          // 当前杂役数量
  servantBaseProduction: number; // 单个杂役基础产出
  nextServantCost: number;       // 下一个杂役招募价格
  servantCapacityOverride: number; // 手动覆盖岗位上限，0 表示自动
};
```

数据归一化建议：

```text
ore >= 0
productionMultiplier >= 0
count 限制到 0-50
level 限制到 1-6
servantCount 不超过岗位上限
nextBuyCost、baseProduction、nextServantCost 均不能为负数
```

## 5. 建筑产出公式

建筑月卡加成：

```text
buildingMonthlyBonus = monthlyCardActive ? baseProduction * 0.35 : 0
```

单栋建筑秒产：

```text
unitProduction = (baseProduction + buildingMonthlyBonus) * productionMultiplier
```

一类建筑总秒产：

```text
buildingTotalProduction = unitProduction * count
```

所有已解锁建筑秒产：

```text
totalBuildingProduction = sum(buildingTotalProduction of unlocked buildings)
```

## 6. 购买建筑规则

购买动作：

```text
动作类型：buy
条件：建筑已解锁，count < 50，nextBuyCost > 0，unitProduction > 0
花费：nextBuyCost
增产：unitProduction
```

购买后状态变化：

```text
count += 1
nextBuyCost *= 1.25
重新计算建筑解锁状态
```

常量：

```text
GROWTH_FACTOR = 1.25
```

## 7. 建筑升级规则

升级条件：

```text
建筑已解锁
level < 6
count >= level * 10
```

例如：

```text
1 升 2：需要 10 栋
2 升 3：需要 20 栋
3 升 4：需要 30 栋
4 升 5：需要 40 栋
5 升 6：需要 50 栋
```

升级价格：

```text
upgradeCost = ceil(1.4 * nextBuyCost / 1.25 ^ (count - level * 10 + 1))
```

常量：

```text
UPGRADE_MULTIPLIER = 1.4
GROWTH_FACTOR = 1.25
```

升级带来的增产：

```text
upgradeDeltaProduction = unitProduction / level * count
```

升级后状态变化：

```text
baseProduction *= (level + 1) / level
level += 1
```

## 8. 杂役规则

每栋建筑提供的杂役岗位数量：

```text
servantsPerBuilding = (floor(buildingId / 2) + 1) * 2
```

示例：

```text
建筑 0-1：每栋 2 个岗位
建筑 2-3：每栋 4 个岗位
建筑 4-5：每栋 6 个岗位
建筑 6-7：每栋 8 个岗位
```

岗位上限：

```text
if servantCapacityOverride > 0:
  servantCapacity = servantCapacityOverride
else:
  servantCapacity = count * servantsPerBuilding
```

可招募数量：

```text
openSlots = max(0, servantCapacity - servantCount)
```

杂役技艺倍率：

```text
SERVANT_SKILL_BONUS_PER_LEVEL = 0.1
servantSkillMultiplier = 1 + max(0, servantSkillLevel - 1) * 0.1
```

单个杂役秒产：

```text
servantRawUnitProduction = servantBaseProduction * servantSkillMultiplier
servantMonthlyBonus = monthlyCardActive ? servantRawUnitProduction * 0.35 : 0
servantUnitProduction = servantRawUnitProduction + servantMonthlyBonus
```

一类建筑的杂役总秒产：

```text
servantProduction = servantUnitProduction * servantCount
```

说明：如果希望“全局产量倍率”也影响杂役，需要在 `servantUnitProduction` 最后再乘 `productionMultiplier`，并且所有杂役增产公式也必须同步乘。不要只在部分公式里乘，否则推荐会失真。

## 9. 招募杂役规则

招募动作：

```text
动作类型：hireServant
条件：建筑已解锁，openSlots > 0，nextServantCost > 0，servantBaseProduction > 0
单次候选数量：1 到 min(openSlots, 5)
```

杂役价格成长：

```text
SERVANT_PRICE_GROWTH_FACTOR = 1.1
```

连续招募 `amount` 个杂役的总花费：

```text
if amount <= 0:
  cost = 0
else:
  cost = nextServantCost * (1.1 ^ amount - 1) / (1.1 - 1)
```

招募增产：

```text
deltaProduction = servantUnitProduction * amount
```

招募后状态变化：

```text
servantCount += amount
nextServantCost *= 1.1 ^ amount
```

## 10. 杂役技艺升级规则

提升杂役技艺动作：

```text
动作类型：upgradeServantSkill
条件：nextServantSkillCost > 0，并且当前至少有杂役产生正收益
花费：nextServantSkillCost
```

提升一级技艺的增产：

```text
monthlyMultiplier = monthlyCardActive ? 1.35 : 1
deltaProduction = sum(
  building.servantBaseProduction
  * building.servantCount
  * 0.1
  * monthlyMultiplier
)
```

如果你的实现选择让全局倍率影响杂役，则这里也要乘 `productionMultiplier`。

升级后状态变化：

```text
servantSkillLevel += 1
nextServantSkillCost *= 2.2
```

常量：

```text
SERVANT_SKILL_COST_GROWTH_FACTOR = 2.2
```

## 11. 总秒产公式

推荐使用统一口径：

```text
totalProduction =
  sum(建筑总秒产 of unlocked buildings)
  + sum(杂役总秒产 of unlocked buildings)
```

预计日产：

```text
dailyProduction = totalProduction * 86400
```

## 12. 贪心算法目标

贪心版计算器每一步只看“当前状态下哪个动作最划算”，不搜索完整未来路线。

这里的“当前”包含当前已有灵矿石 `ore`。如果当前灵矿石已经够买某个动作，这个动作的等待时间就是 0；如果当前灵矿石不够，就用当前秒产计算还要等多久。这个等待时间只是当前动作的成本，不代表算法在做全局搜索。

核心思想：

```text
每一步生成所有可执行候选动作。
给每个动作计算等待时间、回本时间和综合得分。
选择综合得分最低的动作。
模拟执行这个动作。
重复以上过程，得到一条贪心路线。
```

## 13. 候选动作生成

每轮贪心计算生成这些候选：

```text
1. 购买任意已解锁建筑 1 栋
2. 升级任意满足门槛的已解锁建筑
3. 招募任意已解锁建筑的杂役 1-5 个
4. 提升杂役技艺 1 级
```

每个候选动作结构：

```ts
type Action = {
  type: "buy" | "upgrade" | "hireServant" | "upgradeServantSkill";
  buildingId: number | null;
  buildingName: string;
  amount?: number;
  cost: number;
  deltaProduction: number;
  waitSeconds: number;
  paybackSeconds: number;
  scoreSeconds: number;
  reason: string;
};
```

## 14. 贪心打分函数

当前秒产：

```text
production = totalProduction(state)
```

当前灵矿石 `ore` 的作用：

```text
如果 ore >= action.cost:
  waitSeconds = 0
如果 ore < action.cost:
  waitSeconds = (action.cost - ore) / 当前秒产
```

等待时间：

```text
waitSeconds = production > 0
  ? max(0, (action.cost - ore) / production)
  : Infinity
```

回本时间：

```text
paybackSeconds = action.deltaProduction > 0
  ? action.cost / action.deltaProduction
  : Infinity
```

基础贪心得分：

```text
scoreSeconds = waitSeconds + paybackSeconds
```

分数越低，越优先执行。

如果只想做“当前立刻能买什么”的极简计算器，可以过滤掉 `cost > ore` 的动作，并只在当前买得起的动作里排序。但这个游戏的常见场景是大部分高价值动作暂时买不起，所以更推荐保留 `waitSeconds`，否则计算器会频繁忽略“稍微等一会儿就能买、但收益明显更高”的动作。

## 15. 推荐的贪心折扣

纯 `等待时间 + 回本时间` 容易忽略解锁，因为前沿建筑短期回本不一定最好。建议保留一个简单折扣：

```text
如果动作是购买当前最高已解锁建筑，并且该建筑数量 < 5：
  discount = 0.5
否则：
  discount = 1

scoreSeconds = (waitSeconds + paybackSeconds) * discount
```

这样可以让计算器更愿意推进下一类建筑解锁，但仍然是贪心算法。

可选增强折扣：

```text
可升级建筑动作 discount = 0.7
如果动作增产 >= 当前总秒产的 15%，再乘 0.85
```

如果只想实现最简单、最稳定版本，只使用“前沿解锁折扣 0.5”即可。

## 16. 贪心排序规则

候选动作排序：

```text
1. scoreSeconds 更小的排前面
2. 如果 scoreSeconds 接近相等，deltaProduction 更大的排前面
3. 如果仍相等，cost 更低的排前面
```

伪代码：

```ts
actions.sort((a, b) => {
  if (Math.abs(a.scoreSeconds - b.scoreSeconds) > 1e-9) {
    return a.scoreSeconds - b.scoreSeconds;
  }
  if (Math.abs(a.deltaProduction - b.deltaProduction) > 1e-9) {
    return b.deltaProduction - a.deltaProduction;
  }
  return a.cost - b.cost;
});
```

## 17. 执行动作模拟

执行一个动作时，先计算为了凑够花费需要等待多久：

```text
waitSeconds = max(0, (cost - ore) / totalProduction)
```

等待后扣费：

```text
ore = ore + waitSeconds * totalProduction - cost
```

然后按动作类型修改状态：

```text
buy:
  count += 1
  nextBuyCost *= 1.25

upgrade:
  baseProduction *= (level + 1) / level
  level += 1

hireServant:
  servantCount += amount
  nextServantCost *= 1.1 ^ amount

upgradeServantSkill:
  servantSkillLevel += 1
  nextServantSkillCost *= 2.2
```

最后重新计算建筑解锁状态。

## 18. 贪心路线模拟

用于生成“未来路线”：

```ts
function simulateGreedyPlan(initialState, options) {
  const horizonSeconds = options.horizonSeconds ?? 24 * 3600;
  const maxSteps = options.maxSteps ?? 80;

  let state = cloneAndNormalize(initialState);
  let elapsedSeconds = 0;
  const timeline = [];

  for (let step = 0; step < maxSteps; step++) {
    const production = totalProduction(state);
    if (production <= 0) break;
    if (elapsedSeconds >= horizonSeconds) break;

    const actions = listGreedyActions(state);
    const best = actions[0];
    if (!best) break;

    if (elapsedSeconds + best.waitSeconds > horizonSeconds) break;

    const result = performAction(state, best);
    state = result.state;
    elapsedSeconds += result.step.waitSeconds;

    timeline.push({
      ...result.step,
      totalSeconds: elapsedSeconds,
      productionAfter: totalProduction(state),
      oreAfter: state.ore,
    });
  }

  return {
    finalState: state,
    timeline,
    elapsedSeconds,
    finalProduction: totalProduction(state),
  };
}
```

## 19. 硬冲解锁模拟

除了综合贪心推荐，建议实现一个“硬冲解锁”参考路线：

```text
目标：最快解锁 targetBuildingId。
策略：只购买当前最高已解锁建筑，直到数量达到 5，解锁下一类。
重复直到目标建筑解锁。
```

伪代码：

```ts
function simulateHardUnlock(state, targetBuildingId) {
  let timeline = [];
  let totalSeconds = 0;

  while (!state.buildings[targetBuildingId].unlocked) {
    const frontierId = highestUnlockedId(state);
    const frontier = state.buildings[frontierId];

    if (frontier.count >= 5) {
      recalculateUnlocks(state);
      continue;
    }

    const action = makeBuyAction(frontier);
    const result = performAction(state, action);
    if (!result) break;

    state = result.state;
    totalSeconds += result.step.waitSeconds;
    timeline.push({ ...result.step, totalSeconds });
  }

  return { finalState: state, timeline, totalSeconds };
}
```

目标建筑首购时间：

```text
目标建筑已解锁后：
firstBuyWait = max(0, (target.nextBuyCost - ore) / totalProduction)
firstBuyTotalSeconds = hardUnlockSeconds + firstBuyWait
```

## 20. 页面应该展示什么

最小可用版本页面：

```text
1. 全局输入区
   - 当前灵矿石
   - 全局产量倍率
   - 月卡开关
   - 杂役技艺等级
   - 下次技艺升级花费

2. 总览区
   - 当前秒产
   - 预计日产
   - 已解锁建筑数量
   - 当前前沿建筑
   - 下一类建筑
   - 硬冲解锁时间
   - 目标建筑首购时间

3. 建筑录入表
   - 名称
   - 是否解锁
   - 数量
   - 等级
   - 基础单产
   - 下次购买价格
   - 当前建筑总秒产
   - 升级价格

4. 杂役录入表
   - 已招杂役
   - 岗位上限
   - 单个杂役基础产出
   - 下次招募价格
   - 招满花费
   - 招募增产

5. 推荐区
   - 当前贪心推荐第一步
   - 推荐动作等待时间
   - 推荐动作花费
   - 推荐动作增产
   - 推荐动作回本时间
   - 前 5-10 个候选动作排序

6. 贪心路线区
   - 规划窗口：24 小时、3 天、7 天
   - 按贪心连续执行得到的路线
   - 每步完成后秒产
```

## 21. 输出文案建议

动作名称：

```text
buy: 购买 {buildingName}
upgrade: 升级 {buildingName}
hireServant: 招募 {amount} 个杂役到 {buildingName}
upgradeServantSkill: 提升杂役技艺
```

动作原因：

```text
购买前沿建筑且数量 < 5：推进前沿数量，帮助解锁下一类
购买普通建筑：提升当前秒产
升级建筑：提升整类建筑倍数
招募杂役：招募杂役，提升自动产出
提升技艺：提升杂役技艺，放大全部杂役产出
```

## 22. 当前用户数据样例

下面这份是当前用户存档数据，可作为计算器的默认示例数据或验收数据。实现时可以把 `state` 部分作为初始状态导入。

```json
{
  "version": 7,
  "state": {
    "ore": 0,
    "productionMultiplier": 1.06,
    "monthlyCardActive": true,
    "servantSkillLevel": 15,
    "nextServantSkillCost": 136880040,
    "targetBuildingId": 7,
    "buildings": [
      { "id": 0, "name": "补给营地", "count": 50, "level": 6, "baseProduction": 12, "nextBuyCost": 37835121.154785156, "servantCapacityOverride": 0, "servantCount": 91, "servantBaseProduction": 0.3391304347826087, "nextServantCost": 1307839.5827941403, "unlocked": true },
      { "id": 1, "name": "探测法阵", "count": 40, "level": 5, "baseProduction": 30, "nextBuyCost": 52812600, "servantCapacityOverride": 0, "servantCount": 80, "servantBaseProduction": 0.6695652173913044, "nextServantCost": 1049691.4309043947, "unlocked": true },
      { "id": 2, "name": "采矿据点", "count": 33, "level": 4, "baseProduction": 72, "nextBuyCost": 144834765.625, "servantCapacityOverride": 0, "servantCount": 78, "servantBaseProduction": 1.3634661835748791, "nextServantCost": 7248355.78748648, "unlocked": true },
      { "id": 3, "name": "修士坊市", "count": 25, "level": 3, "baseProduction": 165, "nextBuyCost": 312500000, "servantCapacityOverride": 0, "servantCount": 61, "servantBaseProduction": 2.9, "nextServantCost": 12379042.896980574, "unlocked": true },
      { "id": 4, "name": "炼丹楼", "count": 20, "level": 3, "baseProduction": 480, "nextBuyCost": 1329183578.491211, "servantCapacityOverride": 0, "servantCount": 42, "servantBaseProduction": 5.460869565217391, "nextServantCost": 25285007.000000007, "unlocked": true },
      { "id": 5, "name": "灵符堂", "count": 10, "level": 2, "baseProduction": 960, "nextBuyCost": 1861572265.625, "servantCapacityOverride": 60, "servantCount": 19, "servantBaseProduction": 8.104347826086956, "nextServantCost": 36719628.000000015, "unlocked": true },
      { "id": 6, "name": "锻兵房", "count": 0, "level": 1, "baseProduction": 1450, "nextBuyCost": 2592000000, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 18.27771944846274, "nextServantCost": 25750800, "unlocked": true },
      { "id": 7, "name": "藏经阁", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 35.18192778795122, "nextServantCost": 60000000, "unlocked": false },
      { "id": 8, "name": "真仙池", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 67.72004824599254, "nextServantCost": 3737127674.864238, "unlocked": false },
      { "id": 9, "name": "玄仙府", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 130.3511553454479, "nextServantCost": 33412764416.91088, "unlocked": false },
      { "id": 10, "name": "金仙宫", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 250.90684575669357, "nextServantCost": 298735532502.38983, "unlocked": false },
      { "id": 11, "name": "太乙峰", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 482.9588589432602, "nextServantCost": 2670922922328.4126, "unlocked": false },
      { "id": 12, "name": "大罗天", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 929.6249320274014, "nextServantCost": 23880082818612.32, "unlocked": false },
      { "id": 13, "name": "道祖殿", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 1789.391577033853, "nextServantCost": 213506107067536.44, "unlocked": false },
      { "id": 14, "name": "鸿蒙塔", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 3444.3162028547295, "nextServantCost": 1908907021026109, "unlocked": false },
      { "id": 15, "name": "混元境", "count": 0, "level": 1, "baseProduction": 0, "nextBuyCost": 0, "servantCapacityOverride": 0, "servantCount": 0, "servantBaseProduction": 6629.803256877163, "nextServantCost": 17067080960687226, "unlocked": false }
    ]
  },
  "settings": {
    "cumulativePlanHorizonSeconds": 259200,
    "cumulativePlanHorizonMode": "manual"
  }
}
```

按当前项目公式，这份数据的关键验收结果应接近：

```text
当前秒产：41,787.22/s
预计日产：3,610,415,935.72
当前前沿建筑：锻兵房，数量 0/5
下一类建筑：藏经阁
硬冲解锁藏经阁：约 455,845.12 秒，约 5.28 天
藏经阁首购时间：无法计算，因为藏经阁 baseProduction = 0 且 nextBuyCost = 0
```

按“前沿解锁折扣 0.5”的贪心算法，当前第一推荐应为：

```text
动作：购买锻兵房
花费：2,592,000,000
增产：2,074.95/s
等待：约 62,028.53 秒，约 17.2 小时
回本：约 1,249,186.73 秒，约 14.46 天
折扣后得分：约 655,607.63 秒，约 7.59 天
原因：推进前沿数量，帮助解锁下一类
```

前几个候选动作排序可用于调试：

```text
1. 购买锻兵房
2. 招募 1 个杂役到补给营地
3. 购买探测法阵
4. 招募 2 个杂役到补给营地
5. 提升杂役技艺
6. 招募 3 个杂役到补给营地
7. 招募 1 个杂役到修士坊市
8. 购买修士坊市
```

注意：`藏经阁` 以及后续未解锁建筑的 `baseProduction` 和 `nextBuyCost` 目前为 0。实现时必须把这类建筑视为“待补数据”，不能把它们加入购买候选，否则会产生错误推荐。

## 23. 给其他大模型的生成提示词

可以直接把下面这段交给其他大模型：

```text
请生成一个“灵矿石策略计算器”。这是一个放置经营资源规划工具，玩家用灵矿石购买建筑、升级建筑、招募杂役、提升杂役技艺来提高秒产。

请按贪心算法实现，不要使用 Beam Search、A*、动态规划或穷举全局最优。

核心规则：
1. 有 16 类建筑，建筑 0 默认解锁。第 i 类建筑需要第 i-1 类建筑数量 >= 5 才解锁。
2. 建筑最大数量 50，最大等级 6。
3. 购买建筑花费 nextBuyCost，购买后 count += 1，nextBuyCost *= 1.25。
4. 月卡开启时建筑基础单产 +35%。单栋建筑秒产 = (baseProduction + 月卡加成) * productionMultiplier。
5. 建筑升级条件：level < 6 且 count >= level * 10。
6. 升级价格 = ceil(1.4 * nextBuyCost / 1.25 ^ (count - level * 10 + 1))。
7. 升级增产 = unitProduction / level * count。升级后 baseProduction *= (level + 1) / level，level += 1。
8. 每栋建筑杂役岗位 = (floor(buildingId / 2) + 1) * 2。岗位上限 = count * 每栋岗位数，除非用户手动覆盖。
9. 杂役技艺倍率 = 1 + (servantSkillLevel - 1) * 0.1。
10. 单个杂役秒产 = servantBaseProduction * 技艺倍率，并在月卡开启时再 +35%。
11. 招募 amount 个杂役总花费 = nextServantCost * (1.1 ^ amount - 1) / 0.1。招募后 nextServantCost *= 1.1 ^ amount。
12. 提升杂役技艺花费 nextServantSkillCost，升级后 servantSkillLevel += 1，nextServantSkillCost *= 2.2。

贪心算法：
1. 每一轮生成候选动作：购买任意已解锁建筑 1 栋、升级任意满足条件的建筑、招募任意建筑 1-5 个杂役、提升杂役技艺。
2. 对每个动作计算：
   waitSeconds = max(0, (cost - ore) / totalProduction)
   paybackSeconds = cost / deltaProduction
   scoreSeconds = waitSeconds + paybackSeconds
3. 如果动作是购买当前最高已解锁建筑，并且该建筑数量 < 5，则 scoreSeconds *= 0.5，用于鼓励解锁下一类建筑。
4. 按 scoreSeconds 从小到大排序；如果接近相等，deltaProduction 大的优先。
5. 推荐 scoreSeconds 最低的动作。
6. 如果要生成未来路线，就重复执行当前最优动作，直到达到规划窗口或最大步数。

请实现完整页面，包含全局输入、建筑表、杂役表、当前秒产、预计日产、下一步推荐、候选动作列表、贪心路线模拟、硬冲解锁时间、目标建筑首购时间。所有公式必须集中在一个核心计算模块里，UI 只调用核心模块。
```

## 24. 实现注意事项

1. 不要把缺失价格或缺失产出的建筑放进候选动作，否则会出现无限收益或错误推荐。
2. `totalProduction <= 0` 时不能计算等待时间，应停止模拟并提示数据不足。
3. 所有候选动作必须满足 `cost > 0` 且 `deltaProduction > 0`。
4. 执行动作后必须重新计算解锁状态。
5. 生成路线时要保存每一步的 `waitSeconds`、`totalSeconds`、`productionBefore`、`productionAfter`、`oreAfter`。
6. 贪心算法不是全局最优，它只保证当前这一步看起来最划算。页面上可以写“贪心推荐”，不要写“全局最优”。
