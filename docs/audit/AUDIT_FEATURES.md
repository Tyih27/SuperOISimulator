# 审计报告：功能缺陷与未接入功能

本篇盘点"服务端已实现但客户端未接入"、"引擎已支持但无内容"、"文档已承诺但未实现"以及死代码/契约漂移问题。与 [AUDIT_BUGS.md](AUDIT_BUGS.md) 的确定性 BUG 互补。

---

## 1. 【P1】服务端已实现、客户端从未接入的功能

### 1.1 竞技场历史回放

- **服务端**：`GET /api/v1/arena/matches/:id` 完整返回双方快照、事件日志、哈希与积分变化（`server/services/arena-service.js:115-124`），并有权限校验（仅参战双方可见）。
- **客户端**：`src/app/` 中对 `/arena/matches/` 的唯一调用是结算 POST（`src/app/router.js:332`）；回放端点零调用。竞技场页也没有任何历史比赛列表。
- **文档**：README 宣称"异步竞技场提供防守快照、对手发现、服务端结算、积分变化和**只读历史回放**"，与实现不符。
- **建议**：新增 `GET /arena/matches?limit=` 列表接口 + 竞技场战绩页；或先移除 README 中的相应宣称。

### 1.2 战斗历史

- 服务端持久化全部 `battle_records`（含完整事件日志与结果，`server/repositories/battle-repository.js`），但只有 `start/settle` 两个写入路径被路由暴露；无列表/详情查询接口，UI 无历史入口。玩家刷新即丢失当前战斗引用（见 AUDIT_PLAYABILITY §2.2）。

### 1.3 播放倍速

- `PlaybackController.setSpeed` + `PLAYBACK_SPEEDS`（`src/app/state.js:5,118-125`）与 `.speed-control/.speed-button` 样式（`styles/base.css:225-227`）全部就绪，UI 无入口。属于典型的"功能完成度 95%，差一个按钮"。

### 1.4 竞技场防守编队独立配置

- 设计语义是"设置防守队伍和站位"（GAME_DESIGN §9.3），服务端也支持任意 formation 快照（`ARENA_DEFENSE_DTO_SCHEMA` 接收独立 teamIds+formation）。
- 但 UI 的"保存当前编队"按钮直接把主线编队原样上传（`src/app/router.js:328`），玩家无法为防守单独排兵——进攻用一套、防守藏一套的策略空间被 UI 抹掉。

---

## 2. 【P1】"有引擎、无内容/无入口"的空转系统

这些系统代码完整、测试覆盖，但在实际游戏中永远不会触发，构成维护负担并误导后续开发者：

| 系统 | 引擎支持位置 | 内容现状 |
| --- | --- | --- |
| 临时能力 buff | `engine.js:251-257` 处理 `intent.buffs`、`:111-115` 回合过期逻辑、`effectiveStudent` 应用加成 | 没有任何技能产生 buff（所有 intent 的 `buffs: []`）。设计文档 §2.5 列举的"提高能力/降低难度/使题目跳过行动"类辅助技能均未实装 |
| 技能组等级 | 档案强制校验 `skillGroupLevels.normal/burst ≥ 1`（`profile-service.js:84-90`）、快照携带 | 全游戏恒为 1；无升级道具、无升级接口、等级不参与任何公式（`calculateSkillProgress` 只看 skillMultiplier）|
| 随机目标规则 | `selectProblemTargets` 支持 `'random'`（消耗 rng）与 `'two-best-match'` | 无技能引用这两个规则；当前战斗除种子外完全确定，rng 几乎不被消耗，"同 seed 同序列"的宣传成立但 seed 本身影响趋近于零 |
| 群体解题技能 | 目标规则 `'all-problems'/'allProblems'` 已实现 | 无技能使用；现有爆发技能全部单体（structurer/supporter 的群体技能是辅助类）|

**建议**：短期在代码中显式注释这些扩展点；中期按设计文档补内容（如给 supporter 爆发改为"全队 +DP buff"即可激活 buff 链路）；若确认不做，删除死分支。

---

## 3. 【P1】死代码与双轨风险

| 项目 | 位置 | 说明 |
| --- | --- | --- |
| `settleCampaignBattle` | `server/services/progression-service.js:105-132` | 完整的第二条主线发奖路径（含 `campaign_settlements` 幂等表），无路由调用。与 `battle-service.settle` 并存构成双发风险（BUG-12、BALANCE §4.3）|
| `STUDENTS[].abilities` 固定数值 | `src/data.js:161-210` | 不进入玩家档案（真实能力随机生成），只被失真的平衡模拟脚本引用（BALANCE §3）。字段存在性误导读者以为这是初始数值 |
| v1/v2 契约 Schema | `shared/contracts/v1.js:85-171,173-241` | 要求已废弃的 `skillLevels/role/skills` 字段与 schemaVersion 1/2，未被路由挂载却作为"官方契约"导出（BUG-11）|
| `CAMPAIGN_SETTLEMENT_DTO_SCHEMA` | `shared/contracts/v1.js:313` | 仅服务于上述死代码路径的请求 schema |

---

## 4. 测试体系的结构性盲区

项目测试数量可观（单元 + API 集成 + E2E + 页面审计 + 平衡门槛），但存在三类盲区：

1. **E2E 全 mock**（BUG-14）：浏览器测试拦截全部 `/api/v1/**` 请求，客户端与服务端的真实契约无浏览器级验证；
2. **平衡门槛保护错误数值**：`test:balance` 把 0% 胜率基线固化为通过条件（BALANCE §1.1），模拟数据源失真（BALANCE §3）使门槛本身失去意义；
3. **无负向经济测试**：没有针对"重复结算同一关卡""并发签到""并发招募"的防重入测试（battle-service 有 settled 状态防重，但主线奖励重复问题在系统层面无测试感知）。

---

## 5. 文档承诺 vs 实现差异清单

| 承诺来源 | 承诺内容 | 实现状态 |
| --- | --- | --- |
| README | 异步竞技场"只读历史回放" | API 在、UI 未接（§1.1）|
| README/GAME_DESIGN §9.3 | 设置防守队伍**和站位** | UI 只能复制主线编队（§1.4）|
| GAME_DESIGN §6.4 | 多人四级平局判定 | 仅实现两级（`arena-engine.js:24-36`）|
| GAME_DESIGN §2.1 | 资质区间表、成长无全局硬上限 | 区间不一致；2000 硬上限（BALANCE §6）|
| GAME_DESIGN §7.4/§8.4 | 竞赛币、竞赛商店、排行榜、赛季奖励 | 竞技场已上线，四者皆无（部分可归入"后续版本"，但竞技场上线后排行榜缺位使积分无意义）|
| GAME_DESIGN §8.2/8.3/8.5 | 专题训练场、挑战塔、高难题目 | 未实现（文档已声明暂缓，不算缺陷，列出备查）|
| GAME_DESIGN §4.8 | 协作解题 | 未实现（已声明暂缓）|

---

## 6. 其他观察（P2/P3）

1. **【P2】对手发现容量硬编码 10 且无分页**（`server/repositories/arena-repository.js:23`）：服务器人数增长后玩家只能见到积分最接近的 10 人，且无法搜索/换一批；人数少时列表直接为空，竞技场不可用。
2. **【P2】竞技场进攻方必须自己也有防守编队**（`arena-service.js:69`）：合理的服务端约束，但属于隐式规则，UI 无提示（PLAYABILITY §4.4）。
3. **【P3】会话模型**：每个路由模块各自实例化 `AuthService`（battles/profile/progression/arena/account-data 五份），共享同一张 session 表所以功能正确，但 TTL 配置需五处一致传递，属冗余结构。
4. **【P3】`GET /api/v1/profile` 每次读写事务**（`profile-service.js:199-219`）：读操作走 `findOrCreateForUpdate` 行锁并在迁移变更时写回，正确但偏重；高频轮询场景下是潜在热点。
5. **【P3】指标端点无鉴权**（`server/routes/metrics.js`）：`/metrics` 公开账号数/活跃会话数/战斗总数。内含业务量信息，生产环境建议加网络层限制。
6. **【P3】导出文件名用 accountId**（`router.js:339`）：`super-oi-<uuid>.json` 对用户不友好，可用用户名。
7. **【P3】学生改名输入框 maxlength=12 按 UTF-16 码元截断**：emoji/组合字符可能被截坏；服务端 `normalizeStudentName` 用 Intl.Segmenter 按字素校验，两端标准不一致时用户会在前端被静默截断后在后端报错。

---

## 7. 功能完成度总表

| 模块 | 服务端 | 客户端 | 缺口摘要 |
| --- | --- | --- | --- |
| 账号/会话/改密/删号/导出 | ✅ | ✅ | — |
| 档案 CRUD/编队/改名 | ✅ | ✅ | — |
| 主线开战/结算/奖励 | ✅ | ✅ | 奖励无限刷（BALANCE §4.3）、历史缺失 |
| 战斗播放 | —（客户端本地）| ⚠️ | 倍速未接、性能差 |
| 专项训练 | ✅ | ✅ | 材料来源单一（BALANCE §4.2）|
| 商店/限购 | ✅ | ⚠️ | 限购余量不显示 |
| 招募/保底/劝退 | ✅ | ✅ | 模板可操纵（BUG-08）|
| 每日签到 | ✅ | ✅ | UTC 重置 |
| 竞技场防守/匹配/结算/积分 | ✅ | ⚠️ | 历史/排行榜/独立防守编队缺失 |
| buff/技能升级/随机目标 | 引擎就绪 | — | 零内容零入口 |

> 图例：✅ 可用；⚠️ 部分可用或有明显缺口；— 不适用
