# Super OI Simulator

Super OI Simulator 是一个以信息学竞赛训练为主题的自动战斗模拟器。玩家从学生名单中选择三名学生，安排 A1、A2、A3 站位，让他们在有限回合内自动解决题目并应对题目的反击。

项目提供浏览器原生的单人训练界面，使用原生 HTML、CSS 和 JavaScript ES Modules；持久化账号、档案、主线进度和战斗结算由 Fastify/PostgreSQL 服务端负责。

## 当前功能

- 注册、登录、退出和会话恢复
- 主线关卡选择，以及在学生名单中维护编队（1～3 人）和 A1、A2、A3 站位
- 学生改名、专项训练、背包、商店和招募
- 服务端创建不可变战斗快照并权威结算奖励
- 服务端事件日志回放、战斗历史与桌面端/375px 移动端布局覆盖
- 账户 JSON 导出、密码变更和保留期删除请求

账号、云存档、主线奖励、专项训练、基础商店、招募、服务端权威单人战斗结算和异步竞技场均已实现；主线与竞技场均提供只读历史查询，主线胜利奖励首次全额、重复通关递减。生产镜像、迁移启动、健康检查、聚合监控和发布 CI 也已纳入，详见[部署文档](docs/DEPLOYMENT.md)、[安全文档](docs/SECURITY.md)和[项目完成计划](docs/superpowers/plans/2026-08-19-project-completion.md)。

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

复制 `.env.example` 为 `.env`，设置 `DATABASE_URL` 和至少 32 位的 `SESSION_SECRET`，然后运行。`APP_ORIGIN` 是逗号分隔的受信任浏览器来源；本地示例同时允许 `localhost` 和 `127.0.0.1`，生产环境应只保留实际的 HTTPS 域名：

```bash
npm run dev
```

开发环境启动成功后会自动打开默认浏览器访问本地页面；也可以手动访问：

```text
http://localhost:3000/
```

如需在服务器或 CI 环境中启动而不打开浏览器，请在 `.env` 中设置 `OPEN_BROWSER=false`。生产环境默认不会自动打开浏览器。

页面使用浏览器原生 ES Modules，不建议直接通过 `file://` 打开 `index.html`。

### 局域网访问

如果要让同一局域网中的其他设备访问本机服务，需要让 Node.js 监听所有网卡，并把本机局域网地址加入受信任来源。先用 `hostname -I` 查看本机地址；当前示例机器的地址是 `192.168.14.234`。请始终以命令输出为准，然后在 `.env` 中设置：

```env
HOST=0.0.0.0
PORT=3000
SECURE_COOKIES=false
APP_ORIGIN=http://localhost:3000,http://127.0.0.1:3000,http://192.168.14.234:3000
BROWSER_ORIGIN=http://192.168.14.234:3000
```

重启服务：

```bash
npm run dev
```

其他设备应访问本机局域网地址，而不是访问它们自己的 `localhost`：

```text
http://192.168.14.234:3000/
```

确认服务和 API 可用：

```bash
curl http://192.168.14.234:3000/health
```

如果系统防火墙阻止了连接，可以只允许局域网网段访问 3000 端口。下面的网段仅是示例，请替换成实际局域网网段：

```bash
sudo ufw allow from 192.168.14.0/24 to any port 3000 proto tcp
```

不要开放 PostgreSQL 的 5432 端口；项目的本地 Compose 配置默认只把数据库绑定到 `127.0.0.1`。局域网设备必须连接同一个非访客网络；如果路由器启用了无线客户端隔离，设备之间也无法互访。

## 操作方式

1. 注册或登录训练档案。
2. 新账号初始获得随机 3 名普通资质学生。在“学生名单”查看当前队伍；点击“调整阵容”拖动卡片互换站位或“换下”队员留空站位（允许 1～3 人上阵）。在学生详情中通过“替换学生”换上替补。
3. 保存编队后，在“主线关卡”选择已解锁关卡并开始挑战；服务端创建战斗快照并返回战斗编号。
4. 在战斗回放页执行服务端结算，查看事件日志和奖励。
5. 在“学生名单”改名，在“训练与补给”进行学生强化、购买训练册或招募学生。强化按学生资质增加目标能力（普通 +15、优秀 +20、稀有 +25、天才 +30、顶尖 +40）；优先消耗对应专项训练册且不收取训练币，没有对应训练册时可消耗 1 份学生培养材料并支付 100 训练币。能力达到 2,000 上限、训练币不足或材料不足时不会改变档案。
6. 在“异步竞技场”保存防守编队并挑战对手；进攻胜利结算 25 训练币，失败和平局不奖励训练币。每天最多主动挑战 40 场（按 `RESET_TIME_ZONE` 时区零点重置，默认 Asia/Shanghai），未结算的挑战同样占用次数，达到上限后服务端会拒绝新的挑战。结算后客户端会重新读取服务端档案，确保训练币余额同步显示。
7. 在“账户与数据”下载导出、修改密码或提交删除请求。

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
│   │   ├── chapter-2-1.js      # 第 2 章「竞赛进阶」高难关卡（推荐总战力 5000-30000）
│   │   ├── chapter-2-2.js
│   │   ├── chapter-2-3.js
│   │   ├── chapter-2-4.js
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
