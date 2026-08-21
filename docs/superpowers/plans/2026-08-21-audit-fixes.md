# Audit Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复审计中会阻断主线、造成奖励/模板漏洞、破坏契约一致性和明显影响可玩性的缺陷，并用测试锁定行为。

**Architecture:** 保持现有原生 ES modules、Fastify 服务和 PostgreSQL 仓储边界。先修纯函数和服务端事务，再接入客户端已有的播放状态 API，最后补共享标签、契约和浏览器级回归。对平衡只调整首关内容与模拟数据源，避免重写战斗公式。

**Tech Stack:** Node.js 22, Fastify, PostgreSQL, native browser JavaScript, Node test runner, Playwright.

---

### Task 1: 战斗引擎与回放确定性修复

**Files:**
- Modify: `src/app/router.js`, `src/combat/engine.js`, `src/app/progression.js`, `src/app/arena.js`
- Test: `src/tests/combat-engine.test.js`, `src/tests/page-audit.test.js`

- [ ] 修复战斗启动 catch 覆盖错误、按 teamIds 顺序回退编队、移除无效 targetMultiplier，并把 focusMax 放入结果状态。
- [ ] 为背包训练册建立完整中文标签，竞技场平局使用独立样式并本地化事件标签。
- [ ] 增加对应单元/页面断言。

### Task 2: 主线经济、防重和招募安全

**Files:**
- Modify: `server/services/battle-service.js`, `server/services/progression-service.js`, `server/repositories/*`, `server/migrations/*`, `server/routes/*`
- Test: `server/tests/battle-service.test.js`, `server/tests/progression.test.js`, `server/tests/account-data.test.js`

- [ ] 让主线结算按账号+关卡记录首次通关，首次全额、重复通关递减，并在事务内幂等。
- [ ] 删除或停用未接入的 `settleCampaignBattle` 双轨路径及其死契约。
- [ ] 用单调递增招募计数选择模板，避免劝退操纵轮转；把每日周期改为 `Asia/Shanghai` 可配置语义。
- [ ] 添加重复结算、模板轮转和每日周期回归测试。

### Task 3: 首关可玩性与模拟真实性

**Files:**
- Modify: `src/levels/chapter-1-1.js`, `src/data.js`, `scripts/simulate-formations.js`, `src/tests/balance-simulation.test.js`, `docs/BALANCE_BASELINE.md`

- [ ] 将首关目标/难度调整到新号可通过的范围，并更新批准基线。
- [ ] 模拟脚本改用 `createProfile` 生成随机能力，使用固定 seed 保证报告可复现。
- [ ] 重新运行平衡测试，确保不是继续保护 0% 胜率。

### Task 4: 服务端历史接口与客户端可恢复体验

**Files:**
- Modify: `server/repositories/battle-repository.js`, `server/repositories/arena-repository.js`, `server/services/arena-service.js`, `server/routes/*`, `src/api/client.js`, `src/app/router.js`, `src/app/state.js`, `src/app/arena.js`, `styles/base.css`
- Test: `server/tests/*-api.test.js`, `src/tests/api-client.test.js`, `e2e/*.spec.js`

- [ ] 增加主线战斗列表/详情和竞技场比赛列表接口，客户端提供历史入口与刷新恢复最近战斗。
- [ ] 接入现有播放倍速控件和跳过到结果操作，避免全页重渲染破坏滚动。
- [ ] 让竞技场防守编队有独立草稿、显示用户名和正确空态。
- [ ] 增加真实服务冒烟 E2E，保留现有 mock 用例。

### Task 5: 契约、错误文案和运营收尾

**Files:**
- Modify: `shared/contracts/v1.js`, `src/app/router.js`, `src/app/progression.js`, `src/app/arena.js`, `server/services/*.js`, `README.md`
- Test: `server/tests/health.test.js`, `src/tests/page-audit.test.js`

- [ ] 用现行 v3 profile/battle DTO 替换导出的 v1/v2 死 schema，或显式标记 deprecated 并增加 v3 校验。
- [ ] 统一服务端错误码到中文客户端映射，显示商店限购余量、竞技场前置条件和失败归因。
- [ ] 更新 README，准确描述已接入的历史/回放/平衡行为。

