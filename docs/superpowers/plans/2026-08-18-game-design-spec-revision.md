# Game Design Specification Revision Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the selected review recommendations into an implementation-ready combat and multiplayer specification while moving combat values to a hundreds/thousands scale.

**Architecture:** Keep `docs/GAME_DESIGN.md` as the single product specification. Clarify the deterministic combat kernel first, then define multiplayer as two combat instances coordinated by simultaneous phases and persisted through versioned snapshots plus immutable event logs.

**Tech Stack:** Markdown specification, deterministic turn-based simulation concepts, server-authoritative asynchronous multiplayer.

---

### Task 1: Terminology And Prototype Boundaries

**Files:**
- Modify: `docs/GAME_DESIGN.md`

- [x] **Step 1: Rename overloaded combat terms**

Use `常规技能` and `爆发技能` for skill timing, `解题技能` and `辅助技能` for skill category, and `专注值` for the resource that triggers an explosive skill.

- [x] **Step 2: Split the delivery scope into milestones**

Define a local combat prototype, a single-player vertical slice, and the first asynchronous multiplayer version. Keep economy, accounts, matchmaking, ranking, and server replay out of the local combat prototype.

### Task 2: Deterministic Combat Specification

**Files:**
- Modify: `docs/GAME_DESIGN.md`

- [x] **Step 1: Move combat values to a larger scale**

Use integer abilities in the hundreds, question progress and energy in the thousands, and retain configurable per-formula bounds instead of a global low ceiling.

- [x] **Step 2: Define skill progress calculation**

Document the complete formula:

```text
基准进度 = clamp(基础进度 + 能力差距 × 能力系数, 基准下限, 基准上限)
技能进度 = round(基准进度 × 技能倍率 × 目标倍率 + 固定加成)
```

Define rounding, clamping, group-target attenuation, and overflow behavior.

- [x] **Step 3: Define action and status settlement**

Specify target snapshots, deterministic tie-breaking, atomic effect application, state duration, stacking, zero-energy exits, question completion, and terminal checks for both sequential PvE phases and simultaneous PvP phases.

### Task 3: Multiplayer Outcomes And Replay

**Files:**
- Modify: `docs/GAME_DESIGN.md`

- [x] **Step 1: Resolve simultaneous terminal states**

Define completion as higher priority than elimination, explicitly handle both sides completing or being eliminated in the same phase, and make maximum-round tie-break timestamps precise.

- [x] **Step 2: Specify versioned battle records**

Require engine version, balance version, combatant snapshots, question queue, PRNG algorithm and seed, ordered events, and an event-log hash. State that clients replay events instead of recalculating historical combat.

### Task 4: Verification

**Files:**
- Verify: `docs/GAME_DESIGN.md`

- [x] **Step 1: Scan for obsolete terminology**

Run:

```bash
rg -n '普通状态技能|满状态技能|满状态' docs/GAME_DESIGN.md
```

Expected: no obsolete player-facing combat terms remain.

- [x] **Step 2: Check milestone and replay coverage**

Run:

```bash
rg -n '战斗原型|单机纵切片|异步多人版本|引擎版本|事件日志|同一阶段' docs/GAME_DESIGN.md
```

Expected: all selected scope, determinism, multiplayer, and replay requirements are present.

- [x] **Step 3: Review the final diff**

Run:

```bash
rg -n '[[:blank:]]+$' docs/GAME_DESIGN.md docs/superpowers/plans/2026-08-18-game-design-spec-revision.md
test $(( $(rg -n '^```' docs/GAME_DESIGN.md | wc -l) % 2 )) -eq 0
```

Expected: no trailing whitespace and balanced Markdown code fences. The workspace has no Git metadata, so a Git diff check is unavailable.
