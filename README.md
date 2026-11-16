# Agent Docs

为人和 AI 维护共用的持久上下文／共享记忆。两个独立插件：`dsh-agent-docs` 和 `codex-agent-docs`，没有独立 Agent、数据库或中央服务。

0.1.5 默认只初始化 Project、Design、Rules、Knowledge 四个目录；待办、收集箱和环境问题按需使用单文件，优先更新已有主题。验证材料复用现有约定，无约定时使用项目根目录 `evidence/`，有材料时创建，不默认整目录忽略。索引逐层概括直接子级，Docs 内从根索引可达；AGENTS.md 只列重要外部入口，主题参考在主题中链接。稳定项目偏好可从多次纠正中主动提炼，冲突及扩大适用范围先确认。实现后对照当前要求或有效 Design 核验，不新增固定 Spec／任务清单流程。

正常工作结束时，原生 Hook 让当前 Agent 读取 `maintain.md` 检查一次；无需维护时直接结束。初始化由用户明确发起，通过 DSH `agent_docs_rules` 的 `init` 模式或 Codex `init` 技能读取 `init.md`。

用户规则默认位于 `~/.agent-docs/dsh` 或 `~/.agent-docs/codex`；DSH 可设置 `rulesDir`，两端也都支持环境变量 `AGENT_DOCS_RULES_DIR` 指向同一个绝对目录。用户文件只在缺失时创建，升级不覆盖，修改后下次读取生效。

规则源为 `rules/` 下四份文件：`principles.md`（组织原则）、`spec.md`（内容规格）、`init.md`（初始化操作）、`maintain.md`（日常维护）。发行包包含全部四份，首次调用自动补齐缺失的原则与规格文件。已有用户规则不会被升级覆盖，更新已有机器时请主动比较并选择替换。

开发：Node.js 22+，`npm run build`、`npm test`、`npm run pack`。无需下载构建依赖。DSH 使用宿主已有的 peer 服务；离线包不包含整个 DSH 运行环境。

详细说明见源码仓库 [文档入口](docs/index.md)。发行包中的 `安装与测试.md` 提供安装命令、桌面版 Hook 审阅和验收步骤。

## 从 GitHub 安装 DSH Web

以下命令使用 v0.1.5 Release 安装包；本轮发布不自动更新本机插件或已有用户规则。

需要 Node.js 22+、已安装的 DSH 和可联网的 PowerShell。在 PowerShell 执行：

```powershell
dsh plugin --profile web add 'https://github.com/Songyanglin-curious/agent-docs/releases/download/v0.1.5/dsh-agent-docs-0.1.5.tgz'
```

安装后重启对应 DSH Web 实例；Profile 不是 web 时替换名称。不要添加 `--offline`。插件工具应包含 `agent_docs_rules`。初始化时明确说“用 Agent Docs 初始化当前项目 Docs”。

## 从 GitHub 安装 Codex 桌面插件

在 PowerShell 下载固定版本 ZIP，验证 GitHub 校验和，解压并运行登记脚本：

```powershell
$version = '0.1.5'
$base = "https://github.com/Songyanglin-curious/agent-docs/releases/download/v$version"
$download = Join-Path $env:TEMP ('agent-docs-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $download | Out-Null
$zip = Join-Path $download "codex-agent-docs-$version.zip"
Invoke-WebRequest "$base/codex-agent-docs-$version.zip" -OutFile $zip
Invoke-WebRequest "$base/SHA256SUMS.txt" -OutFile (Join-Path $download 'SHA256SUMS.txt')
$line = Get-Content (Join-Path $download 'SHA256SUMS.txt') | Where-Object { $_.EndsWith("  codex-agent-docs-$version.zip") }
if (@($line).Count -ne 1) { throw '校验清单缺少唯一的 Codex ZIP 条目' }
$expected = ($line -split '  ', 2)[0]
if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw '安装包校验失败' }
$unpacked = Join-Path $download 'unpacked'
Expand-Archive -LiteralPath $zip -DestinationPath $unpacked
& (Join-Path $unpacked 'install-codex.ps1')
if (-not $?) { throw '插件登记失败' }
```

脚本会备份并更新 `~/.agent-docs/plugins/codex-agent-docs`，保留个人市场的其他插件与现有用户规则。它只登记插件来源；还需执行安装。支持 `codex plugin` 的版本可继续运行：

```powershell
codex plugin add codex-agent-docs@personal-local --json
codex plugin list --marketplace personal-local --json
```

若命令不可用，重启 Codex 桌面应用，在插件目录选择 `personal-local`，安装或更新 `codex-agent-docs`。安装后重启桌面应用并新建聊天；如提示 Review hooks，在 Settings > Hooks 审阅并信任 Agent Docs Stop Hook。不要同时添加重复的用户 Stop Hook。插件安装完成与桌面模型自动维护通过是两项独立验收。

以上市场及安装命令依据 [官方插件文档](https://developers.openai.com/plugins/build/plugins) 和 [插件管理命令](https://learn.chatgpt.com/docs/developer-commands)。已有机器升级不会覆盖用户规则；若要应用新版默认规则，请先比较并备份后替换。

## 下载和本地打包

当前版本发布页见 [v0.1.5 发布页](https://github.com/Songyanglin-curious/agent-docs/releases/tag/v0.1.5)。当前本地版本为 **0.1.5**，执行 `npm run pack` 在 `dist/` 和项目根目录同时生成 `agent-docs-0.1.5-安装包.zip`、`dsh-agent-docs-0.1.5.tgz`、`codex-agent-docs-0.1.5.zip` 与 `SHA256SUMS.txt`，包文件均由 Git 忽略。

本地 DSH 安装示例（本轮未执行）：

```powershell
dsh plugin --profile web add 'D:/mycode/agent-docs/dsh-agent-docs-0.1.5.tgz'
```

Codex 可解压 `codex-agent-docs-0.1.5.zip`，运行其中 `install-codex.ps1` 登记，再按安装手册完成插件安装和 Hook 审阅。**升级安装包不会覆盖既有用户规则**；要应用新版需定位实际规则目录，比较、备份后同步四份文件，或在临时验收中指定全新的规则目录。本次不自动同步本机规则、不迁移已有项目。

## 本机安装验证（2026-11-16）

已按上述 GitHub 命令安装 0.1.4：DSH web 的依赖指向固定 Release URL，Codex 回读为 `version=0.1.4`、`installed=true`、`enabled=true`。已安装 DSH 包的真实 Cordis 工具与生命周期测试通过，已安装 Codex Hook 的子进程验证首次提醒、续接放行通过。两端包内四份规则与源码哈希一致。全量测试 12 项通过、1 项原有模型闭环用例跳过。重启 DSH Web 和 Codex 桌面应用后使用新版；桌面正常聊天的自动维护闭环仍需验收。
