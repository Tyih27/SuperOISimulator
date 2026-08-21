# 审计报告：确定性 BUG 清单

共 14 项。每项含严重度、精确定位、问题描述、影响、复现方式与修复建议。
行号以 main 分支 commit `9b60940` 为准。

---

## BUG-01 【P1】开始战斗时本地回放失败的错误提示被无条件覆盖

- **位置**：`src/app/router.js:485-490`
- **描述**：`startBattle()` 的 `catch` 分支在 488 行设置错误消息 `快照已锁定，等待服务端回放（${error.message}）`，但函数在 490 行无条件执行 `this.message = "战斗快照已由服务端创建。"`，将刚设置的错误提示覆盖掉。
- **影响**：本地可视化回放构建失败时玩家永远看不到失败原因，只会看到"成功"提示；若服务端结算也异常，玩家面对一个既不能播放也没有结算按钮的空页面且无任何解释。
- **复现**：构造缺少 `level.topics` 的快照（或 mock 服务端返回残缺 snapshot）→ 点击"开始挑战"→ 观察消息为"战斗快照已由服务端创建。"而非 catch 中的内容。
- **修复建议**：把 490 行的赋值移入 `try` 成功分支，或在 catch 中 `return` 前不再覆盖；建议改为 `this.message = playback ? "战斗快照已由服务端创建。" : \`快照已锁定，等待服务端回放（${error.message}）\``。

## BUG-02 【P2】目标倍率死代码：`targets.length > 1 ? 1 : 1`

- **位置**：`src/combat/engine.js:159`
- **描述**：`const targetMultiplier = targets.length > 1 ? 1 : 1;` 两个分支值相同，恒为 1，随后在 160-165 行乘入进度计算。实际的目标倍率已在 `calculateSkillProgress`（`src/combat/math.js:44`）内部通过 `skill.targetMultiplier` 生效，此处是冗余且误导的死代码。
- **影响**：无直接数值错误，但暗示"多目标时另有衰减"的实现意图从未落地；未来有人在此调整群体技能衰减时会以为已有机制。
- **复现**：代码审读即可确认。
- **修复建议**：删除该行及乘法，或明确实现"多目标衰减"设计并补充对应技能内容。

## BUG-03 【P2】引擎默认编队回退会无视传入的 teamIds 顺序

- **位置**：`src/combat/engine.js:53-55`
- **描述**：当未显式传 `positions` 且 `teamIds` 恰好是默认三人（planner/graphist/structurer）的任意排列时，构造器强制使用 `DEFAULT_FORMATION`（A1=planner, A2=graphist, A3=structurer），忽略调用方 teamIds 的顺序语义。
- **影响**：当前所有生产调用方（快照、播放器）都显式传 positions，故为潜伏缺陷；但任何直接用 `new CombatEngine({ teamIds: [...] })` 的新调用（如测试、未来 API）都会得到与预期不符的站位，进而改变行动顺序与站位相关目标选择——而站位正是本作的核心策略维度。
- **复现**（已验证）：
  ```js
  new CombatEngine({ level, seed: 1, students: STUDENTS, teamIds: ['graphist','planner','structurer'] }).positions
  // → { A1:'planner', A2:'graphist', A3:'structurer' }，传入顺序被丢弃
  ```
- **修复建议**：删除该"智能回退"，统一按 `teamIds` 顺序填充 A1/A2/A3。

## BUG-04 【P2】背包中专项训练册显示原始物品 ID

- **位置**：`src/app/progression.js:110-114`（`inventoryRows`）
- **描述**：标签映射只包含 `{ student-training-material: "学生培养材料" }`，五种专项训练册（`specialist-book-dynamicProgramming` 等）没有中文标签，走 `labels[item] ?? item` 回退后直接显示英文原始 ID。
- **影响**："训练与补给 → 补给背包"面板中出现 `specialist-book-graphTheory × 3` 这类文本，与全中文界面割裂，玩家无法直观理解道具。
- **复现**：获得任意训练册（如购买商店"数据结构专项训练册"）后查看补给背包。
- **修复建议**：用 `ABILITY_KEYS` + `specialistTrainingBookId()` 批量生成五个训练册的中文名，或复用 `SHOP_OFFERS` 中的 `name` 字段建立映射。

## BUG-05 【P2】竞技场平局以失败样式呈现、事件类型未本地化

- **位置**：`src/app/arena.js:26`
- **描述**：
  1. 结果区样式类由 `replay.result.winner === "attacker" ? "is-win" : "is-lose"` 决定，平局（winner === "draw"）落入 `is-lose` 红色失败样式，虽然标题文案是"平局"，视觉上却传达"你输了"；
  2. 回放事件列表直接输出 `event.type` 原始英文枚举（如 `stage_start`），而主战斗页有完整的 `EVENT_LABELS` 中文映射（`src/app/router.js:47-57`），两处体验不一致。
- **影响**：平局误导玩家；竞技场回放可读性差。
- **复现**：让一场竞技场对局双方都未达成目标且 completedCount 与 remainingEnergy 全部相等（可用两个完全相同的防守快照构造）→ 结算后观察红色"平局"卡片与英文事件流。
- **修复建议**：为 draw 增加 `is-draw` 样式分支；抽取 `EVENT_LABELS` 到共享模块供两处使用。

## BUG-06 【P2】对手列表显示账户 UUID 前 8 位而非用户名

- **位置**：`src/app/arena.js:23`（`opponent.accountId.slice(0, 8)`）
- **描述**：竞技场对手行展示 `对手 9f86d082` 这类 UUID 片段。服务端 `publicDefense`（`server/services/arena-service.js:26-28`）只返回 accountId/rating/战绩，不含用户名。
- **影响**：玩家无法辨认对手是谁，社交竞争感为零；同一玩家多次出现在列表中也无从识别。
- **复现**：注册两个账号分别保存防守编队，在另一账号刷新对手列表。
- **修复建议**：`listOpponents` JOIN accounts 表返回 username（用户名本就是公开展示字段，登录后顶栏即显示他人可见程度一致）。

## BUG-07 【P2】签到与商店限购按 UTC 重置，对中国玩家为早 8 点

- **位置**：`server/services/progression-service.js:43-45`（`dailyPeriod` 用 `toISOString().slice(0,10)`）
- **描述**：每日签到（`claimDailyCheckIn`）与每日限购商品（`purchaseShopOffer` 的 `period: "daily"`）的重置周期取 UTC 日期。北京时间玩家在每天早上 8 点才能再次领取/购买。
- **影响**：玩家晚间领过签到后，次日白天大部分时间无法领取，直觉上像"功能坏了"；商店 DP/图论训练册每日限购 1 本的节奏也被整体推迟 8 小时，加剧养成资源瓶颈（见 AUDIT_BALANCE §4）。
- **复现**：UTC 0 点前（北京 8 点前）领取签到失败，报"今日签到奖励已领取"。
- **修复建议**：引入服务器配置的重置时区（如 `Asia/Shanghai`）或固定偏移量计算 `dailyPeriod`；至少在 UI 上标注重置时间。

## BUG-08 【P2】招募模板按"学生总数模 6"轮转，可通过劝退操纵

- **位置**：`server/services/progression-service.js:253`
- **描述**：`const template = STUDENTS[Object.keys(profile.students).length % STUDENTS.length]` 用当前学生数量决定新学生模板。劝退招募学生会减少总数，因此"招募 → 劝退 → 招募"循环会反复命中同一模板。
- **影响**：配合保底机制，玩家可以定向刷出指定技能组的天才学生，并反复重掷其随机能力值（每次招募能力都重新生成），绕过"资质随机 + 模板轮转"的设计意图；同时每轮仅消耗 300 训练币的招募权成本，收益是保底天才。
- **复现**：拥有 7 名学生时招募（命中 `7 % 6 = 1` 号模板）→ 劝退该生 → 再招募，模板与名字种子模式重复。
- **修复建议**：改用独立的单调递增计数器（存入 profile.recruitment）决定模板，或直接随机选模板。

## BUG-09 【P2】matchScore 在排序比较器内做全量状态深拷贝

- **位置**：`src/combat/engine.js:331-335`（`matchScore` 内 `this.effectiveStudent(this.snapshot(), ...)`）
- **描述**：`bestMatch` / `two-best-match` 目标规则对活动题目排序，比较器每次调用都触发 `snapshot()`（克隆全部学生与题目状态）再克隆学生数据。一次排序的比较器调用是 O(n log n) 级，整体放大为高频 JSON 深拷贝。
- **影响**：单场战斗规模小尚可接受，但批量平衡模拟（600 局 × 多关卡）与服务端结算都承担了无谓开销；也是 GC 压力点。
- **复现**：性能剖析 `runBattleSnapshot` 可见大量 `JSON.parse(JSON.stringify)` 时间占比。
- **修复建议**：`effectiveStudent` 只需读 `this.students[studentId].abilityBonuses` 与静态 `studentById`，无需整场快照；比较器可在排序前预计算分值。

## BUG-10 【P2】专注值进度条读取不存在的 state 字段（潜伏）

- **位置**：`src/app/router.js:105` 读取 `state.combat.state?.focusMax ?? 1000`；而 `CombatEngine.getResult()` 返回的 `state` 对象（`src/combat/engine.js:379-385`）只含 `status/students/problems/activeProblems/queue`，**没有 `focusMax`**。
- **描述**：专注条宽度永远走 `?? 1000` 兜底。
- **影响**：当前四个关卡 `focusMax` 恰好都是 1000，故无症状；一旦未来关卡调整专注上限，UI 专注条百分比将全部画错（爆发时机视觉误导）。
- **复现**：临时把某关 `focusMax` 改为 500 并播放战斗，专注条满格时机与实际爆发时机不符。
- **修复建议**：`getResult().state` 补充 `focusMax: this.focusMax`，或 UI 从 `snapshot.level.focusMax` 取值。

## BUG-11 【P2】契约文件中 v1/v2 Schema 与现行 v3 数据结构严重不符

- **位置**：`shared/contracts/v1.js:85-171`（`ownedStudent` 要求 `skillLevels`、`PROFILE_DTO_SCHEMA` 要求 `schemaVersion: const 1`）；`:113`、`:225` 的 battle student 还要求已废弃的 `role`、`skills` 字段。
- **描述**：现行档案是 schemaVersion 3、字段 `skillGroupLevels` + 技能组目录（见 `src/domain/profile.js:13`、`src/domain/snapshot.js`）。这些过期 schema 虽未被路由挂载（路由只用请求 DTO），但仍是导出的"官方契约"。
- **影响**：任何按契约文档对接的第三方/测试会被误导；schema 校验若被启用会拒绝合法档案。属于维护陷阱而非运行时故障。
- **复现**：用 `PROFILE_DTO_SCHEMA` 校验 `GET /api/v1/profile` 的真实响应必然失败。
- **修复建议**：删除 v1/v2 死 schema 或显式标注 deprecated；保留并测试 v3 系列。

## BUG-12 【P3】双轨主线结算路径（死代码）构成奖励重复发放风险

- **位置**：`server/services/progression-service.js:105-132`（`settleCampaignBattle`）
- **描述**：该方法实现了另一条主线发奖路径（带 `campaign_settlements` 幂等表），但没有任何路由调用它；实际发奖走 `battle-service.settle`（无幂等表，见 AUDIT_BALANCE §5）。两套逻辑并存。
- **影响**：当前无害，但未来任何人"接上"这条路径（它看起来更完整、带幂等）就会与 battle-service 形成双发通道。
- **修复建议**：删除 `settleCampaignBattle` 与 `campaign_settlements` 相关迁移表，或将幂等逻辑合并进 `battle-service.settle`。

## BUG-13 【P3】实时战斗面板每步全量 innerHTML 重渲染

- **位置**：`src/app/router.js:477-482`（playback.subscribe → `this.render()`）；`renderShell/renderLiveBattle` 全量重建 DOM
- **描述**：自动播放每 800ms 触发一次整页 `innerHTML` 替换，包括导航、事件日志 `<details>` 等。
- **影响**：滚动位置丢失（长页面尤其明显）、`<details>` 开合状态依赖模板硬编码 `open`、移动端低端设备卡顿；事件日志 `slice(-30)`（router.js:107）导致旧事件不可回看。
- **复现**：播放任一战斗时滚动页面，每个阶段都会跳回顶部附近。
- **修复建议**：订阅回调只 diff 更新战斗面板子树；或至少把 render 范围限定在 `#main-content`。

## BUG-14 【P3】E2E 测试全部 mock API，真实前后端集成无浏览器级覆盖

- **位置**：`e2e/single-player.spec.js:24-60`、`e2e/arena.spec.js:8-27`
- **描述**：Playwright 用例通过 `page.route("**/api/v1/**")` 拦截并伪造全部接口响应，服务端真实行为不在覆盖范围内；服务端自身仅有 Node 单元/集成测试。
- **影响**：客户端渲染与服务端响应结构之间的契约漂移（如 BUG-10、BUG-11 这类字段不一致）不会被任何测试捕获。
- **修复建议**：保留现有 mock 用例之外，增加一条起真实服务（compose postgres + npm run dev）的冒烟 E2E：注册 → 开战 → 结算 → 领签到全链路。

---

### 已排查、确认不是问题的点（避免误报）

| 疑点 | 结论 |
| --- | --- |
| 全队精力归零后是否延迟判负 | 否。题目击杀最后一名学生经 `applyIntent → checkTerminal` 立即终局（已实测第 1 回合内判负） |
| `run()` 步数预算是否可能提前截断 | 否。每回合恰好消耗 6 步，预算 `maxRounds*6+2` 充足 |
| 竞技场 lockstep 双方步数不对称 | 否。双方各走相同步数，超时各自 `run()` 收尾 |
| 防守方 seed 固定导致每场防守结果不变 | 否。`runArena` 用 `arena:<matchId>:defender` 覆盖快照 seed，每场不同（已实测） |
| `.env` 是否泄漏进仓库 | 否。git 仅跟踪 `.env.example` |
| 治疗能否复活已退场学生 | 不能。目标筛选排除 `alive=false`，符合设计文档 4.7 |
