# 面经札记 / Interview Notes

个人面经资料库：本地原文 → Python 整理 → JSON 与向量索引 → Next.js 阅读和检索。

支持总结、技术标签、面试题及原文证据、关键词搜索、语义搜索、公司和技术栈筛选、命中原文定位，以及爱心清单和排序。默认附带**虚构示例**，使用不联网的演示 Provider；演示向量只用于验证流程，不能代表真实语义效果。

## Quick Start（uv）

需要 Python 3.12+、Node.js 22+、pnpm 和 uv。尚未安装 uv 可参照 [官方安装指南](https://docs.astral.sh/uv/getting-started/installation/)。在项目根目录运行：

```powershell
uv sync --locked
pnpm install
pnpm data:build
pnpm dev
```

打开 http://127.0.0.1:3000 。`uv sync --locked` 会按 `uv.lock` 创建 `.venv`，数据构建脚本会自动使用它。默认是无需密钥的演示模式。需要生产构建时，停止开发服务后运行 `pnpm build`、`pnpm start`。服务默认只绑定本机地址。

不用 uv 时，可先用已有 Python 创建环境并安装依赖，再从上面的 `pnpm install` 继续。Windows PowerShell 示例（Python 路径按实际安装位置调整）：

```powershell
& "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe" -m venv .venv
& .\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Linux/macOS 可使用 `python3 -m venv .venv` 与 `.venv/bin/python -m pip install -r requirements.txt`。

## 接入真实模型

1. 将 `config.example.json` 复制为 `config.local.json`，分别填写 LLM 和 Embedding 的服务地址、模型。
2. 在根目录创建 `.env.local`：

```dotenv
INTERVIEW_CONFIG=config.local.json
LLM_API_KEY=你的LLM密钥
EMBEDDING_API_KEY=你的Embedding密钥
```

3. 运行 `pnpm data:build`。已启动的网站刷新页面后会读取新资料；如果这是首次启动，按上面的启动步骤构建并运行网站。修改 `.env.local` 后需重启网站以加载新的环境变量。

两个 Provider 完全独立，允许使用不同厂商、地址、模型和密钥变量。默认适配 OpenAI 兼容的 `/chat/completions` 与 `/embeddings` 协议，`base_url` 应包含服务要求的版本前缀（通常为 `/v1`），不要包含具体方法路径。不保证任意声称兼容的厂商都支持全部参数。

- LLM `output_mode` 默认为 `text`，通过提示词要求 JSON 并做本地校验。服务明确支持时，可配置 `json_object` 或 `json_schema`。结构或题目证据不合规时只纠正一次。
- Embedding 可选 `dimensions`；模型不支持自定义维度时不要填写。返回维度会记录在索引里，不会把所有厂商默认设为相同维度。
- `document_prefix` 和 `query_prefix` 默认为空；需要 `passage:` / `query:` 等前缀的模型必须按厂商说明配置。
- 两端共享同一份非敏感配置。模型、地址、维度、前缀等配置变化时必须重建索引。仅更换密钥不会使向量失效。
- Python 的 `LLMProvider` / `EmbeddingProvider` 和 TypeScript 的 `EmbeddingProvider` 是扩展边界。非兼容协议应新增适配器并加入工厂注册，而不是在业务代码中判断厂商。
- 密钥只读取环境变量；Python 和 Next.js 均支持根目录 `.env.local`，不要使用 `NEXT_PUBLIC_` 前缀，不要提交密钥。

## 管理面经

在本机打开网站的**面经管理**页 `/manage`，粘贴完整原文并提交。网站会把原文保存到被版本管理忽略的 `data/raw/private/`，随后自动调用 Python 整理、建立搜索索引；成功后页面会刷新资料，无需重新构建或重启网站。原文可以包含普通中文、标题、代码或列表，不要求固定模板。每次粘贴生成一篇新面经。

管理页可删除通过网页粘贴的面经，成功后原文及索引同步移除；内置示例不能在网页中删除。处理失败时会保留原文，检查模型配置后使用管理页的“重新整理”。网页写入只允许本机、同源操作；不要把管理服务直接暴露到公网。

也可以把每篇原文保存为一个 UTF-8 `.md` 或 `.txt` 文件，放在 `data/raw/`，继续通过命令管理：

```powershell
pnpm data:build                    # 处理新增/变更文件；未变更内容复用缓存
pnpm data:retry                    # 再次处理未成功的数据；成功结果不重复调用
pnpm data:build --force            # 强制重做全部分析和向量；会产生真实 API 费用
& .\.venv\Scripts\python.exe -m pipeline analyze private/example.md
```

`analyze` 只更新指定文件的缓存，不发布新的资料快照；之后运行完整构建。原文从不被处理脚本覆盖。

直接修改、删除文件后执行 `pnpm data:build`，然后刷新网站。文件相对路径决定 ID；改内容不改 ID，重命名会产生新 ID。相同内容的多个文件会报告重复，但不会自行删除。

原文按段落/句子边界切分，默认上限约 600 字、重叠 100 字。题目必须带原文中可验证的连续摘录，不生成题目答案。未知公司、岗位、日期保留空值。整理结果直接提供技术标签，不再把面经归入前端、后端、算法等岗位分类。

成功结果写入 `data/cache/`，最近一次报告在 `data/reports/latest.json`。全部资料成功才原子替换 `data/generated/snapshot.json`；一篇失败时保留上一次完整快照。超长输入由服务明确报错，不会静默截断。最终索引维度必须一致。

## 搜索与数据契约

- 关键词：中文子串、全半角与大小写归一化，空格分隔的多词 AND 匹配。标题/公司/岗位权重 8，标签/题目权重 4，总结/原文权重 1。不调用云模型。
- 语义：查询向量 → 原文片段余弦相似度 → 按面经取最高片段得分 → 前 20 篇。不生成答案，不把相似度显示为准确率。
- 两种搜索都先应用公司、技术栈与爱心清单筛选。搜索结果按页面所选排序展示；语义搜索先取最相关的前 20 篇，再对这 20 篇排序。列表每页展示 12 篇。
- “热门技术栈”优先展示 RAG、Agent、MCP 等 AI 开发标签，其余标签按当前资料库的出现篇数排序；展开后可查看全部标签。旁边的数字是收录该标签的面经篇数，同一篇重复标签只计一次。置顶顺序是面向 AI 开发准备的编辑选择，不代表行业热度。
- 排序可选时间降序、时间升序和热门。时间优先使用面试日期，缺失时使用资料更新时间；热门把已点爱心的面经排在前面，同分按时间倒序。每篇最多一颗爱心，可以取消。
- 爱心清单只保存在**当前浏览器**的本地存储中，不会同步到其他设备，也不是所有用户的公开热度。清除浏览器网站数据后，爱心记录会消失。
- 首页和详情页按请求读取最新资料快照；搜索接口在 Next.js Node 运行时读取索引。向量不会发送到浏览器。不支持 `output: export` 的纯静态托管。
- 长时间未刷新的页面可能带着旧版 `build_id` 搜索，此时接口返回 409；刷新页面即可读取新资料。

```text
POST /api/search
请求：{ query, mode: "keyword" | "semantic", filters?: {company, tag, ids}, build_id? }
响应：{ mode, build_id, items: [{id, title, summary, ..., score, snippet, chunk_id?}] }
错误：{ error, code }；400 输入不合法，409 版本/索引不匹配，503 模型不可用。
```

数据版本为 `schema_version: 2`；Python Pydantic 与 TypeScript Zod 使用同一组跨语言 fixture 验证。`filters.ids` 是可选的面经 ID 列表，爱心清单搜索会用它限定结果。新增不兼容字段需要升级契约并重建数据。

网页管理接口仅供本机使用：`POST /api/interviews` 接收 `{ raw }` 并返回新面经 ID；`DELETE /api/interviews/{id}` 只允许删除网页创建的私人面经；`PATCH /api/interviews` 重新整理此前保存但未成功发布的资料。每个写入操作完成后返回新的 `build_id`，管理页自动刷新。构建失败时，新增接口会返回 `saved: true` 和原文位置，便于确认内容已保留。

## 验证

```powershell
& .\.venv\Scripts\python.exe -m pytest -q
pnpm test
pnpm typecheck
pnpm build
pnpm test:e2e
```

端到端测试使用已安装的 Google Chrome，覆盖桌面与手机宽度，并串行执行会增删测试资料的管理用例。测试会独立启动本机生产服务器，强制使用仓库中的演示模型配置，避免误用个人模型密钥；运行前请确保 3000 端口空闲。管理用例只清理自己创建的私人面经。真实资料测试应另外维护场景，不要覆盖个人数据。

真实检索评测：准备至少 30 篇资料和 20 条人工标注查询；参照 `evaluation.example.json` 填写查询及相关文件在 `data/raw/` 下的相对路径，启动网站后执行：

```powershell
pnpm evaluate evaluation.example.json
```

报告每次耗时和 Hit@5，目标至少 80%。示例的 3 条查询只用于检查评测工具；未配置真实模型时，不能据此宣称达到真实检索验收标准。

## 项目结构与边界

```text
pipeline/          Python 离线处理、模型适配、缓存和测试
src/app/           页面和搜索 API
src/components/    界面组件
src/lib/           数据契约、检索与 Embedding 适配
data/raw/          原始面经
data/generated/    可重新生成的快照（不提交）
tests/             跨语言契约、检索及端到端测试
scripts/           启动处理脚本与检索评测工具
```

V1 面向个人本机使用，支持网页粘贴、自动整理和删除；不含修改已保存原文、登录权限、爬虫或对话问答。公开部署前需要单独设计访问控制及调用额度保护。向量规模以片段数量和模型维度为准，超过首版规模再评估数据库和专用检索索引。
