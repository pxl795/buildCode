# 灵矿石策略计算器

基于贪心算法的放置/经营游戏资源规划工具。Vue 3 + TypeScript + Vite。

## 功能

- 全局输入区：灵矿石、产量倍率、月卡、杂役技艺等
- 总览：当前秒产、日产、解锁数、前沿建筑、硬冲解锁时间
- 16 类建筑录入表 + 杂役录入表
- 贪心推荐：第一步建议 + Top 10 候选动作
- 贪心路线模拟：24h / 3天 / 7天 切换
- 硬冲解锁目标建筑模拟
- JSON 导入 / 导出 / 重置默认
- 移动端响应式适配

## 开发

```bash
npm install
npm run dev       # 启动开发服务器（http://localhost:5173）
npm run build     # 类型检查 + 生产构建
npm run test      # 运行 Vitest 单元测试
```

## 项目结构

```
src/
  core/           # 纯计算模块（无 UI 依赖）
    constants.ts  # 常量
    types.ts      # 数据类型
    formulas.ts   # 所有产出/花费公式
    unlock.ts     # 建筑解锁逻辑
    actions.ts    # 候选动作生成
    greedy.ts     # 打分、排序、路线模拟
    index.ts
  components/     # Vue SFC（仅 UI，调用 core）
  composables/
    useGameState.ts
  data/
    defaultState.ts  # spec 第 22 节的默认样例
  utils/
    format.ts        # 数字/时间格式化
  App.vue
  main.ts
  index.css
tests/            # Vitest 单元测试
```

## 验收

`npm run test` 会校验 spec 第 22 节的关键指标：

- 当前秒产 ≈ 41,787.22/s
- 日产 ≈ 3,610,415,935.72
- 第一推荐 = 购买锻兵房（cost=2,592,000,000，increase≈2074.95/s）
- 折扣后得分 ≈ 655,607.63 秒
- 硬冲解锁藏经阁 ≈ 455,845 秒（约 5.28 天）

## 算法说明

贪心算法：每一步只看当前状态下哪个动作最划算。

```
score = waitSeconds + paybackSeconds
waitSeconds   = max(0, (cost - ore) / totalProduction)
paybackSeconds = cost / deltaProduction
```

折扣：购买当前最高已解锁建筑（前沿）且数量 < 5 时，`score *= 0.5`。

排序：score 升序 → deltaProduction 降序 → cost 升序。
