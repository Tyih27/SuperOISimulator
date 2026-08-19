# Super OI Simulator

Super OI Simulator 是一个以信息学竞赛训练为主题的自动战斗模拟器。玩家从学生名单中选择三名学生，安排 A1、A2、A3 站位，让他们在有限回合内自动解决题目并应对题目的反击。

项目提供浏览器原生的单人训练界面，使用原生 HTML、CSS 和 JavaScript ES Modules；持久化账号、档案、主线进度和战斗结算由 Fastify/PostgreSQL 服务端负责。

## 当前功能

- 注册、登录、退出和会话恢复
- 主线关卡选择、三人编队和 A1、A2、A3 固定站位
- 学生改名、专项训练、背包、商店和招募
- 服务端创建不可变战斗快照并权威结算奖励
- 服务端事件日志回放与桌面端/375px 移动端布局覆盖
- 账户 JSON 导出、密码变更和保留期删除请求

账号、云存档、主线奖励、专项训练、基础商店、招募、服务端权威单人战斗结算和异步竞技场均已实现；异步竞技场提供防守快照、对手发现、服务端结算、积分变化和只读历史回放。生产镜像、迁移启动、健康检查、聚合监控和发布 CI 也已纳入，详见[部署文档](docs/DEPLOYMENT.md)、[安全文档](docs/SECURITY.md)和[项目完成计划](docs/superpowers/plans/2026-08-19-project-completion.md)。

## 环境要求

- Node.js 22 或更高版本，用于运行测试
- Docker Engine 和 Docker Compose v2，用于生产镜像和容器 smoke 测试
- 任意支持 ES Modules 的现代浏览器
- 一个静态文件服务器

安装依赖：

```bash
npm install
```

## 本地运行

配置 `.env` 后启动同源开发服务。它会执行数据库迁移，同时提供 API 和浏览器静态资源；不需要再单独启动 Python 静态服务器。

先启动 PostgreSQL（或使用项目提供的 Docker Compose）：

```bash
docker compose up -d postgres
```

复制 `.env.example` 为 `.env`，设置 `DATABASE_URL` 和至少 32 位的 `SESSION_SECRET`，然后运行：

```bash
npm run dev
```

然后访问：

```text
http://localhost:3000/
```

页面使用浏览器原生 ES Modules，不建议直接通过 `file://` 打开 `index.html`。

## 操作方式

1. 注册或登录训练档案。
2. 在“主线关卡”选择已解锁关卡，选择三名学生并安排 A1、A2、A3 站位。
3. 保存编队后开始挑战；服务端创建战斗快照并返回战斗编号。
4. 在战斗回放页执行服务端结算，查看事件日志和奖励。
5. 在“学生名单”改名，在“训练与补给”进行专项训练、购买训练册或招募学生。
6. 在“账户与数据”下载导出、修改密码或提交删除请求。

同一个编队、站位、关卡配置和随机种子会产生相同的事件序列，可用于回放验证和数值测试。

## 测试

运行全部测试和 JavaScript 语法检查：

```bash
npm run check
```

仅运行测试：

```bash
npm test
```

也可以单独运行测试组：

```bash
npm run test:combat
npm run test:formation
npm run test:playback
npm run test:task6
npm run test:progression
npm run test:balance
npm run test:client
npm run test:migration
npm run test:api
npm run test:e2e
npm run test:container
```

测试覆盖确定性战斗、回合顺序、编队规则、播放状态、领域模型、批量平衡性门槛、API 客户端、页面可访问性审计，以及桌面和 375px 移动端浏览器流程。运行 `npm run simulate:balance` 可生成各关卡的 JSON/CSV 编队报告；已批准的基线见 [BALANCE_BASELINE.md](docs/BALANCE_BASELINE.md)。

## 项目结构

```text
.
├── index.html                  # 认证单人应用入口
├── styles/base.css             # 响应式界面样式
├── src/
│   ├── app/
│   │   ├── formation.js        # 纯编队状态与校验规则
│   │   ├── main.js             # 应用启动入口
│   │   ├── router.js           # 认证后的页面路由与 API 交互
│   │   ├── auth.js             # 登录与注册界面
│   │   ├── campaign.js         # 主线与编队界面
│   │   ├── progression.js      # 名单、训练、商店与招募界面
│   │   └── state.js            # 战斗播放状态机（原型兼容）
│   ├── api/client.js           # 同源认证 API 客户端
│   ├── combat/
│   │   ├── engine.js           # 确定性战斗引擎
│   │   ├── events.js           # 事件序列化
│   │   ├── index.js            # 战斗模块入口
│   │   └── math.js             # 战斗数值公式
│   ├── tests/                  # Node.js 单元与审计测试
│   ├── data.js                 # 学生、题目和共享内容数据
│   ├── levels/                 # 每个主线关卡一个独立配置文件
│   │   ├── chapter-1-1.js
│   │   ├── chapter-1-2.js
│   │   ├── chapter-1-3.js
│   │   ├── chapter-1-4.js
│   │   └── index.js            # 按顺序聚合关卡
│   └── rng.js                  # 可复现伪随机数生成器
└── docs/
    ├── GAME_DESIGN.md          # 游戏规则与版本范围
    └── superpowers/plans/      # 实现计划与验证记录
```

浏览器验收配置位于 `playwright.config.js`，测试辅助静态服务器位于 `e2e/serve.mjs`。

## 设计原则

- 战斗引擎不依赖 DOM，可以在浏览器、测试环境和未来服务端复用。
- 相同输入必须生成字节一致的序列化事件日志。
- 编队控制器只管理名单和站位，不直接操作页面或战斗引擎。
- 播放控制器负责阶段切换和定时调度，战斗引擎是战斗状态的唯一权威。
- 当前每场战斗必须包含三名不同学生，并完整占据 A1、A2、A3；每名学生只使用自己引用的技能组，位置只决定行动顺序和站位相关目标，不决定技能。

完整游戏规则见[游戏设计文档](docs/GAME_DESIGN.md)，备份、迁移和账户恢复流程见[运维文档](docs/OPERATIONS.md)。

## 开发状态

项目计划中的 Task 1 至 Task 12 已完成：战斗契约与三人编队、版本化领域模型、PostgreSQL API 基础、账号认证、版本化玩家档案和云存档、主线奖励、专项训练、商店与招募、服务端权威的单人战斗结算、账号界面、数据迁移、恢复与运维控制、批量模拟与平衡性门槛、异步竞技场，以及生产发布门槛、部署与监控。
