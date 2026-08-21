# Super OI Simulator 深度审计报告（2026-08-21）

本目录是对项目的一次全面深度检查结果，覆盖游戏 BUG、数值平衡性、可玩性、功能缺陷与代码质量等多个角度。所有结论均基于源码逐行审读与只读运行时验证（内存中直接调用战斗引擎与领域模型复现），未修改任何代码。

## 文档索引

| 文档 | 内容 |
| --- | --- |
| [AUDIT_BUGS.md](AUDIT_BUGS.md) | 确定性 BUG 清单（引擎 / 服务端 / UI），共 14 项 |
| [AUDIT_BALANCE.md](AUDIT_BALANCE.md) | 数值平衡性分析：实测胜率、经济循环测算、公式评估、文档漂移 |
| [AUDIT_PLAYABILITY.md](AUDIT_PLAYABILITY.md) | 可玩性走查：进度死锁、反馈缺失、新手体验、UX 摩擦清单 |
| [AUDIT_FEATURES.md](AUDIT_FEATURES.md) | 功能缺陷：未接入的 API、死代码、"有引擎无内容"系统、契约漂移 |

## 严重度定义

| 级别 | 含义 |
| --- | --- |
| **P0** | 阻断核心循环，玩家无法正常体验游戏目标 |
| **P1** | 功能明显损坏、数据/经济风险、或宣传与实现不符 |
| **P2** | 影响体验或存在隐患的确定缺陷 |
| **P3** | 打磨项、潜在风险、维护性问题 |

## 问题统计

| 类别 | P0 | P1 | P2 | P3 | 小计 |
| --- | ---: | ---: | ---: | ---: | ---: |
| 数值平衡 | 1 | 2 | 2 | 1 | 6 |
| 确定性 BUG | – | 3 | 7 | 4 | 14 |
| 可玩性 | – | 2 | 5 | 3 | 10 |
| 功能缺陷 | – | 4 | 3 | 5 | 12 |
| **合计** | **1** | **11** | **17** | **13** | **42** |

## 最需要优先关注的问题（Top 5）

### 1. 【P0】主线关卡实际不可战胜，进度死锁
`docs/BALANCE_BASELINE.md` 与 `src/data.js:227` 批准的基线胜率为 **0% / 5.83% / 0% / 0%**。本次审计用真实账号逻辑（初始能力按普通资质区间随机掷取）模拟 20 个新号挑战 chapter-1-1：**胜率 0%，平均完成 2/3 题**。玩家永远无法解锁第 2 关，主线进度在第一关即死锁。量化测算显示稳定通关首关约需 64～120 次训练（≈ 6,400～13,000+ 训练币 + 同量级训练册），而关卡奖励本身拿不到，唯一稳定收入是每日签到 1,000 币——即约 **1～2 周纯签到才能打第一章第一关**。详见 [AUDIT_BALANCE.md](AUDIT_BALANCE.md)。

### 2. 【P1】平衡模拟工具与真实玩家数据脱节
`scripts/simulate-formations.js:64` 直接使用 `src/data.js` 中学生的固定能力值（如 planner 动态规划 820），而真实玩家的初始学生能力由 `createProfile → generateInitialAbilities` 在普通资质区间内随机掷出（450～650 等）。基线数字系统性偏乐观，"平衡门槛"保护的是一个不代表真实游戏的数值。详见 [AUDIT_BALANCE.md](AUDIT_BALANCE.md) §3。

### 3. 【P1】主线奖励可无限重复刷取
`server/services/battle-service.js` 的结算以每次新建的 `battleId` 发奖，同一关卡反复开打即可反复获得全额奖励（训练币 + 训练册 + 招募券）。幂等表 `campaign_settlements` 只存在于无人调用的死代码路径 `ProgressionService.settleCampaignBattle`（`server/services/progression-service.js:105`）。一旦玩家练度跨过门槛，刷奖励效率将远超签到设计。详见 [AUDIT_BALANCE.md](AUDIT_BALANCE.md) §5。

### 4. 【P1】竞技场历史回放 API 存在但 UI 从未接入
服务端提供 `GET /api/v1/arena/matches/:id` 回放端点（`server/services/arena-service.js:115`），但客户端从不调用；README 宣称"异步竞技场提供……只读历史回放"，实际 UI 无法查看任何历史比赛。同类问题：战斗记录刷新即丢、无历史列表接口。详见 [AUDIT_FEATURES.md](AUDIT_FEATURES.md) §1。

### 5. 【P1】播放速度控制是死功能
播放控制器支持 0.5/1/2/4 倍速（`src/app/state.js:5,118`），CSS 也已有 `.speed-control/.speed-button` 样式（`styles/base.css:225-227`），但 UI 没有任何入口调用 `setSpeed`。默认 800ms/步 × 一场 72 步 ≈ 58 秒/局，玩家只能干等或反复点"单步"。详见 [AUDIT_PLAYABILITY.md](AUDIT_PLAYABILITY.md) §2。

## 验证方法说明

1. **源码审读**：通读 `src/`（战斗引擎、领域模型、UI）、`server/`（路由、服务、仓储）、`shared/contracts/`、`scripts/`、测试与文档，全部约 7,400 行。
2. **只读运行时验证**：通过 `node --input-type=module -e` 在内存中直接实例化 `createProfile / createBattleSnapshot / CombatEngine` 复现真实玩家路径，不落盘、不改库。关键实验：
   - 20 个随机新号通关率实测（结论 0/20）；
   - 定向训练投入 vs 胜率阶梯实验（48 次→0/3，64 次→1/3，120 次→5/5）；
   - 弱队团灭时序验证（第 1 回合内立即判负，终局判定无延迟 BUG）；
   - 引擎默认编队覆盖传入顺序的复现；
   - 典型新号学生承受题目反击伤害与治疗量的量化。
3. **交叉比对**：`docs/GAME_DESIGN.md`、`README.md` 与实际实现的承诺差异逐条核对。

## 阅读建议

- 若只看一处：先看 [AUDIT_BALANCE.md](AUDIT_BALANCE.md)，它解释了"为什么玩家会卡死在第一关"。
- 修复排期建议按 README Top 5 → 各文档内 P1 → P2 的顺序推进；多数 P2/P3 可随版本迭代顺手处理。
- 所有 `file:line` 引用以当前 main 分支（commit `9b60940`）为准。
