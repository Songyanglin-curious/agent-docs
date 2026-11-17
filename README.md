# Agent Docs

为人和 AI 维护共用的持久上下文。包含独立 DSH、Codex 插件；没有第二个 Agent、数据库或中央服务。

当前版本 **0.1.6**：默认直接读取各自安装包的 `defaults/`，升级插件即更新默认规则，不创建 `~/.agent-docs`，不自动产生规则备份。仅显式配置 DSH `rulesDir` 或 `AGENT_DOCS_RULES_DIR` 时使用自定义目录；显式自定义文件不被升级覆盖。

Docs 默认四核心目录：Project、Design、Rules、Knowledge。待办、收集箱、环境问题优先更新已有主题，必要时使用单文件。原始验证材料优先复用现有约定，否则使用项目根目录 `evidence/`。索引逐层概括直接子级并保证可达。详见 [文档入口](docs/index.md)。

## 打包

Node.js 22+，PowerShell 7 的 pwsh、tar 在 PATH 中：

```powershell
npm test
npm run pack
npm run verify:packages
```

根目录与 dist 同时生成完整安装包 `agent-docs-0.1.6-安装包.zip`、独立 TGZ、Codex ZIP 及 SHA256SUMS.txt。包文件不入源码 Git。

## DSH web 本地安装与卸载

```powershell
dsh plugin --profile web add 'D:/mycode/agent-docs/dsh-agent-docs-0.1.6.tgz'
```

插件由 DSH Profile 管理。重启 DSH Web 后调用 `agent_docs_rules` 的 info 模式，init、maintain 应指向已安装包的 defaults，不是用户目录。只有明确要求初始化时才使用 init。

卸载：

```powershell
dsh plugin --profile web remove dsh-agent-docs
```

原生包管理器可能保留其共享依赖缓存；插件不额外创建独立规则或备份目录。

## Codex 本地安装与完整卸载

1. 将 `codex-agent-docs-0.1.6.zip` 解压到临时目录，保留点号目录。
2. 在 PowerShell 执行解压目录的 `install-codex.ps1`。它只将源放在 `~/.codex/plugins/local/codex-agent-docs`，增量登记宿主支持的个人市场 `~/.agents/plugins/marketplace.json`，保留其他条目，不生成备份。
3. 执行：

```powershell
codex plugin add codex-agent-docs@personal-local --json
codex plugin list --marketplace personal-local --json
```

Codex 自己管理安装缓存。若命令不可用，可在桌面插件目录选择 personal-local 安装。重启桌面应用，新建聊天；如提示审阅 Hook，核对命令后信任，不伪造信任记录。

查看实际规则：

```powershell
node "$env:USERPROFILE/.codex/plugins/local/codex-agent-docs/scripts/rules-cli.mjs" info
```

完整卸载先执行原生卸载，再运行解压目录中的清理脚本：

```powershell
codex plugin remove codex-agent-docs@personal-local --json
& '<解压目录>/uninstall-codex.ps1'
```

清理脚本仅移除本插件本地源和市场条目。共享市场文件及其他插件保留；显式自定义规则不自动删除。不再创建用户主目录 `.agent-docs`。

## GitHub 包

[v0.1.6 Release](https://github.com/Songyanglin-curious/agent-docs/releases/tag/v0.1.6) 提供 DSH TGZ、Codex ZIP、完整安装包 `agent-docs-0.1.6-bundle.zip` 与 SHA256SUMS.txt。不要使用源码 ZIP 代替发行包。

DSH web 从 GitHub 安装：

```powershell
dsh plugin --profile web add 'https://github.com/Songyanglin-curious/agent-docs/releases/download/v0.1.6/dsh-agent-docs-0.1.6.tgz'
```

Codex 从 GitHub 下载并校验后安装（PowerShell）：

```powershell
$ErrorActionPreference = 'Stop'
$base = 'https://github.com/Songyanglin-curious/agent-docs/releases/download/v0.1.6'
$download = Join-Path $env:TEMP ('agent-docs-016-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $download | Out-Null
$zip = Join-Path $download 'codex-agent-docs-0.1.6.zip'
Invoke-WebRequest "$base/codex-agent-docs-0.1.6.zip" -OutFile $zip
Invoke-WebRequest "$base/SHA256SUMS.txt" -OutFile (Join-Path $download 'SHA256SUMS.txt')
$line = @(Get-Content (Join-Path $download 'SHA256SUMS.txt') | Where-Object { $_.EndsWith('  codex-agent-docs-0.1.6.zip') })
if ($line.Count -ne 1) { throw '校验清单缺少唯一的 Codex ZIP 条目' }
if ((Get-FileHash $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne ($line[0] -split '  ', 2)[0]) { throw '安装包校验失败' }
$unpacked = Join-Path $download 'unpacked'
Expand-Archive -LiteralPath $zip -DestinationPath $unpacked
& (Join-Path $unpacked 'install-codex.ps1')
if (-not $?) { throw '插件登记失败' }
codex plugin add codex-agent-docs@personal-local --json
if ($LASTEXITCODE -ne 0) { throw '插件安装失败' }
```

完整卸载仍使用上节的原生卸载与清理脚本。安装后重启对应宿主，按提示审阅 Hook。

## 自定义规则（可选）

通常无需配置。需要修改规则时，在当前 Agent 自有目录内选一个明确位置，如 DSH 的 `.dsh/agent-docs/rules` 或 Codex 的 `.codex/agent-docs/rules`，由用户显式设置绝对路径。两端共享也必须显式指定同一目录；Windows、WSL 不自动共享。

普通升级不再需要手动同步规则。开发同步脚本只用于明确选择的自定义目录，必须传入 TargetRoot；它按显式同步操作保留备份，不是插件运行流程，不会在本轮自动调用。

安装与路径验证不代表真实模型完成了初始化和自动维护，完整验收步骤见 [安装与测试](docs/安装与测试.md)。
