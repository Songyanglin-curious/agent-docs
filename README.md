# Agent Docs

为 AI Agent 提供项目文档维护。两个独立插件：`dsh-agent-docs` 和 `codex-agent-docs`，没有独立 Agent、数据库或中央服务。

正常工作结束时，原生 Hook 让当前 Agent 读取 `maintain.md` 检查一次；无需维护时直接结束。初始化由用户明确发起，通过 DSH `agent_docs_rules` 的 `init` 模式或 Codex `init` 技能读取 `init.md`。

用户规则默认位于 `~/.agent-docs/dsh` 或 `~/.agent-docs/codex`；DSH 可设置 `rulesDir`，两端也都支持环境变量 `AGENT_DOCS_RULES_DIR` 指向同一个绝对目录。用户文件只在缺失时创建，升级不覆盖，修改后下次读取生效。

规则源为 `rules/` 下四份文件：`principles.md`（组织原则）、`spec.md`（内容规格）、`init.md`（初始化操作）、`maintain.md`（日常维护）。发行包包含全部四份，首次调用自动补齐缺失的原则与规格文件。已有用户规则不会被升级覆盖，更新已有机器时请主动比较并选择替换。

开发：Node.js 22+，`npm run build`、`npm test`、`npm run pack`。无需下载构建依赖。DSH 使用宿主已有的 peer 服务；离线包不包含整个 DSH 运行环境。

详细说明见源码仓库 [文档入口](docs/index.md)。发行包中的 `安装与测试.md` 提供安装命令、桌面版 Hook 审阅和验收步骤。
