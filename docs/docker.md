# Windows Docker Desktop 生产运行指南

本次范围：公开阅读和搜索、单管理员后台、统一 DATA_DIR、单容器生产运行。保留现有同步 Python 管线，不涉及 VPS、代理、HTTPS、CI、数据库或任务队列。

## 1. 首次启动

1. 启动 Docker Desktop，切换为 Linux containers，确认 `docker version` 和 `docker compose version` 可用。
2. 项目根目录中，将 `.env.example` 复制为 `.env`（已有配置请勿覆盖）。填写管理员账号、至少 12 位密码和至少 32 字节随机 Session Secret。密码和 Secret 请使用不同的随机值；包含 `$`、`#` 或空格时使用单引号包围值。
3. 保持 `APP_ORIGIN=http://localhost:3000`、`MODEL_CONFIG_FILE=./config.json`，默认不需要模型密钥。
4. 执行：

```powershell
docker compose up -d --build
docker compose ps
```

打开 <http://localhost:3000>。访客可阅读／搜索，访问 `/manage` 会先要求登录。首次 Volume 为空，登录后粘贴第一篇面经即可；不会把 Windows 本机原文自动复制到公开资料库。

凭据从容器运行环境读取，不作为构建参数传入。`.env`、个人模型配置、数据及本机虚拟环境被 Git／Docker 构建上下文排除。不要把带有实际环境值的 `docker compose config` 或容器检查输出公开分享。

## 2. 认证行为

- `ADMIN_USERNAME` 和 `ADMIN_PASSWORD` 定义唯一管理员；本版直接使用环境密码，不支持密码 Hash 格式，没有默认固定密码、注册或 OAuth。
- 登录限流为单进程每 15 分钟最多 10 次失败尝试；成功会重置计数，进程重启也会重置。这是本地首版的基础保护。
- Cookie 为不可预测的随机令牌，`HttpOnly`、`SameSite=Strict`、12 小时有效，无 Domain 属性；浏览器里不保存密码。服务端 Session 位于 `DATA_DIR/auth/sessions`，退出立即撤销当前令牌。
- `SESSION_SECRET` 用于服务端令牌索引与凭据版本验证。更换账号、密码或 Secret 后，旧会话失效；应用重启且配置未变时，会话可继续使用至到期。
- `APP_ORIGIN` 严格匹配写入和登录请求的 Origin／Host。用 `localhost` 配置时，请勿改用 `127.0.0.1` 登录；如果需要后者，应修改配置并重建容器。不会信任任意转发头来绕过来源校验。
- 本机 HTTP 的 Cookie 不设 Secure，以便此次验收；配置 HTTPS 来源时自动增加 Secure。非本机 HTTP 来源不允许管理登录。本次没有配置 HTTPS 服务。
- `/manage` 服务端先验会话再读管理数据；新增、删除、重新整理接口在执行业务前检查会话与来源。未来新增编辑／上传 API 必须复用 `requireAdminWrite`，不能只控制按钮。
- 公开范围包含完整原文；`raw/private` 是历史目录名，并不表示访客无法阅读。不要上传或导入不打算公开的内容。

## 3. 数据目录与持久化

Compose 将命名 Volume `interview-data` 挂载到容器 `/app/data`。实际 Volume 名带 Compose 项目前缀，通常为 `interviewhelper_interview-data`；保持同一项目名才能继续使用同一个卷。

| 路径（相对 DATA_DIR） | 内容 |
| --- | --- |
| `raw/`、`raw/private/` | 原始面经；网页新增文件使用随机 UUID |
| `cache/analysis/`、`cache/vectors/` | 分析结果与向量缓存 |
| `generated/snapshot.json` | 已发布原文、结构化数据与向量索引 |
| `generated/.management.lock`、`generated/quarantine/` | 同步处理锁和删除临时区 |
| `reports/` | 最近一次处理报告 |
| `auth/sessions/` | 服务端管理员 Session |

当前没有数据库和上传文件功能，因此不额外引入空数据库或上传服务。后续新增的可变数据也必须进入 DATA_DIR。

```powershell
docker compose down
docker compose up -d
```

上述操作仅重建容器，不删除 Volume。**不要添加 `-v`，也不要在 Docker Desktop 中删除该 Volume。** 更换项目目录名或使用 `-p` 时可能创建另一个卷；原卷仍在，但新站会表现为空库。

初次启动缺少快照时自动生成空库；存在快照则直接读取，不会在每次启动时重新调用模型或覆盖资料。单个 Volume 只由一个应用容器管理；本版不支持扩成多个副本。

正常管理请求仍同步等待 Python，最多约 5 分钟。一篇失败会保留旧快照和新增原文；修复后点击“重新整理”。操作中强制停止容器可能留下管理锁／删除临时文件，本次未改成可靠任务队列。恢复时先确认所有处理进程停止，备份 Volume，再根据锁和 quarantine 内文件恢复原文、移除已失效锁并重新整理；不要直接清空数据目录。

## 4. 模型配置与数据导入

接入真实模型时，复制 `config.example.json` 为 `config.local.json`，按 README 填写模型及服务地址，在 `.env` 中设置：

```dotenv
MODEL_CONFIG_FILE=./config.local.json
LLM_API_KEY=自行填写
EMBEDDING_API_KEY=自行填写
```

配置以只读文件挂载至 `/app/runtime-config.json`，Node 和 Python 共同使用。Compose 传入两个标准密钥变量；自定义 `api_key_env` 名称时，须同步修改 Compose 的环境变量映射。更改 `.env` 后运行 `docker compose up -d`；更换模型或维度后由管理员重新整理索引。

Windows 本地 `DATA_DIR=./data` 不会变成容器的 Windows 路径：Compose 始终覆盖为 `/app/data`。本机 `.venv` 不进入镜像，Linux 依赖在镜像中通过 uv 锁文件重新安装。

如需导入已有原文，先在独立暂存目录中挑选确认可公开的文件，保留它们在 `raw/` 下的相对路径。备份卷后、停止网页增删操作，再执行以下示例（将占位目录换为自己的暂存目录）：

```powershell
docker compose cp ./待导入原文/. app:/app/data/raw/
# cp 可能改变文件所有者；恢复为容器内应用账号
docker compose exec --user root app chown -R interview:interview /app/data/raw
docker compose exec app /app/.venv/bin/python -m pipeline build
```

不要对正在整理的资料并发执行导入或命令行构建。此命令不通过网页鉴权，拥有 Docker／终端权限的人本就具备运维访问权。相对路径决定资料 ID，不要随意重命名；导入失败时查报告并保留原文。爱心仍属于浏览器本地数据，localhost 与此前 127.0.0.1 的记录互不共享，不随 Volume 迁移。

## 5. 常用操作与故障定位

```powershell
docker compose ps
docker compose logs --tail 100 app
docker compose up -d --build   # 更新代码并重新构建
docker compose down           # 停止，保留 Volume
```

- 3000 被占用：先停止本机开发／生产服务或测试服务，再启动 Compose。
- 缺少管理员配置：Compose 或启动检查会报错；不提供固定默认密码，也不静默开放后台。
- 登录提示来源不正确：核对浏览器地址和 APP_ORIGIN，包括协议、域名和端口。
- 模型处理失败：检查配置、密钥及服务连通性。默认 mock 仅验证流程，不代表真实模型效果。
- 容器不健康：查看启动日志；`/api/health` 只报告进程能否读取合法快照，不暴露文件、账号或模型配置。
- `pnpm build` 在本机仍按普通 Next.js 构建；Docker 的 `DOCKER_BUILD=1` 生成 standalone 产物，容器通过 `node server.js` 运行，不执行 `pnpm dev`。

## 6. 验收范围

验证需覆盖访客阅读／关键词与语义查询、管理页重定向、所有写 API 的 401、管理员登录／退出、原文保存／删除、跨站拒绝、生产构建、容器启动、down／up 后原文与索引保留，以及 Git 和镜像中不含实际凭据。实际执行结果记录在 [验证记录](verification.md)。

本次只映射本机回环地址。公网暴露、HTTPS、搜索调用预算和其他服务器运维均留待后续，不在此次 Docker Desktop 验收范围内。
