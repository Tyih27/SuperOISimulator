# 运维与恢复

## 配置

服务启动前必须设置 `DATABASE_URL`、至少 32 字符的 `SESSION_SECRET` 和同源 `APP_ORIGIN`。`APP_ORIGIN` 可配置为逗号分隔的完整 HTTP(S) 来源白名单，例如 `http://localhost:3000,http://127.0.0.1:3000`；不能包含路径。生产环境还必须明确设置 `SECURE_COOKIES=true` 或 `SECURE_COOKIES=false`；开发环境未设置时默认为 `false`。

```bash
docker compose up -d postgres
npm run dev
```

启动程序会在开始监听前执行 `server/migrations/` 中按文件名排序的迁移。迁移以 `schema_migrations` 记录，已记录的 SQL 文件不会再次执行；不要修改已经部署过的迁移文件。

## 档案迁移

读取或更新档案时，服务端会将 schema v1/v2 纯函数迁移至当前 schema v3。技术学生 ID、已有名称、能力和技能等级会保留；缺失的名称、资质、能力、背包、货币、关卡和编队使用版本化且可复现的默认值补齐。首次读取旧档案后，迁移结果会写回 `player_profiles`，不会修改原始 JSON 对象。

迁移前应先创建数据库备份，并在预发布数据库执行：

```bash
npm run test:migration
npm run test:api
```

## 备份与恢复

在维护窗口执行逻辑备份：

```bash
pg_dump --format=custom --file=super-oi-backup.dump "$DATABASE_URL"
```

恢复到空的目标数据库后，启动服务以补齐尚未应用的迁移：

```bash
pg_restore --clean --if-exists --dbname="$DATABASE_URL" super-oi-backup.dump
npm run dev
```

玩家也可以在“账户与数据”下载 JSON 导出。该导出包含档案、货币流水、背包流水、战斗记录和审计事件，不包含密码哈希、会话令牌或明文密码。它适用于账户数据核对，不能替代 PostgreSQL 备份。

## 账户恢复与删除

密码变更必须提交当前密码，成功后会撤销该账户所有会话。玩家使用新密码登录后即可在其他设备恢复同一份服务端档案。

删除账户也必须提交当前密码。删除会立即生效：服务在事务中删除 `accounts` 对应行并撤销全部会话，外键会级联删除档案、记录、竞技场防守和审计数据，无法恢复。执行前应按备份与合规策略确认操作；如需审计留痕，请依赖删除前的数据库备份。

审计表 `account_audit_log` 仅保存账户 ID、动作类型、SHA-256 载荷摘要和时间。不要向该表或应用日志写入密码、Argon2 哈希、会话令牌或完整导出内容。
