# 验证记录

## 2026-09-26：Docker Desktop 最小生产改造

范围已调整为公开阅读／搜索、单管理员写入；保留同步 Python 流程和文件索引，不引入数据库、独立 Worker、代理或 VPS 部署。

分阶段结果：

1. **认证阶段**：33 项 TypeScript 测试、类型检查和生产构建通过；浏览器单独验证公开访问、管理页跳转登录、三个写接口拒绝未登录请求、管理员登录以及退出后 Cookie 重放失败。
2. **DATA_DIR 阶段**：34 项 TypeScript、17 项 Python 测试及生产构建通过。覆盖相对／绝对 DATA_DIR、空库初始化、隔离输出；浏览器使用独立 `.runtime/e2e-*` 数据目录和随机凭据。
3. **完整浏览器回归**：桌面／手机合计 18 项通过、2 项按平台职责跳过。覆盖阅读、关键词／语义检索、爱心、排序、管理员粘贴→Python 整理→搜索→删除及手机布局。
4. **Docker 生产运行**：Windows Docker Desktop Linux Engine 28.5.1、Compose 2.40.0；`docker compose up -d --build` 成功，容器健康。镜像内 Next.js 16.3.5 standalone 运行、Python 3.13、uv 0.9.4 锁定安装依赖，应用以非 root 账号运行。
5. **Docker 业务与持久化**：`scripts/docker-smoke.mjs prepare` 在空 Volume 中创建唯一临时面经，验证浏览器登录／退出、公开详情、关键词和演示语义检索、匿名写入 401、跨站写入 403，以及容器内 Python 成功发布。实际执行 `docker compose down`、`docker compose up -d --wait`，再以 `verify` 确认原文与索引保留；随后仅删除该临时面经并确认详情 404、搜索移除。
6. **凭据检查**：本机 `.env` 中随机生成的实际密码／Session Secret 未出现在 Git 已跟踪或可添加文件中；`.env` 和 `.runtime/` 被忽略。容器应用文件扫描未发现这些值，也不存在 `/app/.env`、`.env.local` 或 `.git`。真实模型 API Key 未配置；模板只保留空变量。

实际运行的主要命令：

```powershell
pnpm test
pnpm typecheck
& .\.venv\Scripts\python.exe -m pytest -q
pnpm build
node node_modules/@playwright/test/cli.js test
docker compose up -d --build
node --env-file=.env scripts/docker-smoke.mjs prepare
docker compose down
docker compose up -d --wait
node --env-file=.env scripts/docker-smoke.mjs verify
```

Docker 验收使用演示模型；没有调用真实模型。公网安全、HTTPS、付费检索限额和非正常终止时的自动任务恢复不属于本次验收。最后容器保持运行，命名 Volume 保留，临时验收面经已清理；本机原有面经未导入容器、未被修改。

## 2026-09-23：原始 V1 验证

验证环境：Windows、Python 3.13.5、Node.js 22、Google Chrome；2026-09-23。

最终结果：Python 14 项、TypeScript 27 项通过；浏览器 16 项通过、2 项按桌面/手机职责主动跳过。Next.js 生产构建与类型检查通过。浏览器测试使用仓库演示模型配置，仅在本机运行管理写入；临时私人面经创建、搜索、详情查看和删除均通过，测试后私人目录为空，索引恢复到 10 篇演示资料。另对 320px 手机宽度检查了管理页与顶栏，无横向溢出，三个可见导航项在同一行。

本次更新的验收范围：

- 离线分析与生成数据使用 `schema_version: 2`，不再要求岗位分类；原文、总结、面试题和技术标签完整保留。
- 热门技术栈优先展示 AI 开发标签，其余标签保留按出现篇数排序；数字显示收录篇数，同一篇重复标签只计一次，展开后可查看全部标签。这是面向 AI 开发准备的编辑顺序，并非行业热度排行。
- 爱心可以点亮、刷新后保留和取消；爱心清单只显示当前浏览器收藏的面经，搜索接口可以通过 `filters.ids` 限定范围。
- 列表支持时间降序、时间升序和热门；热门将已点爱心的面经放在前面，同分按时间倒序。搜索结果同样应用所选排序。
- 浏览器检查覆盖桌面和手机宽度：首页、详情页均无横向溢出，原文证据和搜索结果仍可打开。
- 管理接口检查覆盖空原文、超长原文、额外字段、非本机和跨站请求、保存失败后的原文保留与重试、受保护资料拒删。
- 管理页端到端检查使用单篇临时私人面经，验证粘贴后自动整理、首页搜索、详情原文、删除后的 404 与搜索同步移除；测试在失败时也只清理该篇临时原文。手机宽度单独检查管理页无横向溢出。

运行命令：

```powershell
& .\.venv\Scripts\python.exe -m pytest -q
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

容量检查使用虚构样例扩展成 1000 篇和 1536 维片段，记录 JSON 体积、堆内存增量、关键词搜索与本地相似度计算耗时。它不包含磁盘首次读取、云端请求、网络和页面渲染，也不用于评价真实模型质量。

真实 LLM 提取质量、供应商兼容性、云端延迟，以及 30 篇资料和 20 条人工标注查询的 Hit@5 验收，仍需接入真实资料与模型后验证。`pnpm evaluate <标注文件>` 提供评测入口；演示向量结果不能作为真实检索效果的证明。
