param([string]$Dist = (Join-Path $PSScriptRoot '../dist'))
$ErrorActionPreference = 'Stop'
# 检查真正的归档清单，并在独立目录解压后调用 Codex Hook。
Add-Type -AssemblyName System.IO.Compression.FileSystem
$repoRoot = Split-Path $PSScriptRoot
$codexVersion = (Get-Content -LiteralPath (Join-Path $repoRoot 'plugins/codex-agent-docs/.codex-plugin/plugin.json') -Raw | ConvertFrom-Json).version
$dshVersion = (Get-Content -LiteralPath (Join-Path $repoRoot 'plugins/dsh-agent-docs/package.json') -Raw | ConvertFrom-Json).version
$zipPath = Join-Path $Dist "codex-agent-docs-$codexVersion.zip"
$zip = [System.IO.Compression.ZipFile]::OpenRead($zipPath)
try {
    $entries = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
    foreach ($required in @('plugins/codex-agent-docs/.codex-plugin/plugin.json', 'plugins/codex-agent-docs/hooks/hooks.json', 'plugins/codex-agent-docs/scripts/rules.mjs', 'plugins/codex-agent-docs/defaults/init.md', 'plugins/codex-agent-docs/defaults/maintain.md', '.agents/plugins/marketplace.json', 'install-codex.ps1')) {
        if ($entries -notcontains $required) { throw "ZIP 缺少 $required" }
    }
} finally { $zip.Dispose() }
$tgz = Join-Path $Dist "dsh-agent-docs-$dshVersion.tgz"
$tarEntries = @(& tar.exe -tzf $tgz)
if ($LASTEXITCODE -ne 0) { throw 'tarball 读取失败' }
foreach ($required in @('package/package.json', 'package/cordis.patch.yml', 'package/lib/index.mjs', 'package/lib/rules.mjs', 'package/defaults/init.md', 'package/defaults/maintain.md')) {
    if ($tarEntries -notcontains $required) { throw "TGZ 缺少 $required" }
}
if (@($tarEntries | Where-Object { $_ -match 'node_modules|tests/|src/' }).Count) { throw 'tarball 混入开发文件' }
$verifyRoot = Join-Path $env:TEMP ('agent-docs-package-' + [guid]::NewGuid().ToString('N'))
[System.IO.Compression.ZipFile]::ExtractToDirectory($zipPath, $verifyRoot)
$dshExtract = Join-Path $verifyRoot 'dsh'
New-Item -ItemType Directory -Path $dshExtract | Out-Null
& tar.exe -xzf $tgz -C $dshExtract
if ($LASTEXITCODE -ne 0) { throw 'tarball 解压失败' }
foreach ($ruleName in @('init.md', 'maintain.md', 'principles.md', 'spec.md')) {
    $sourceHash = (Get-FileHash -LiteralPath (Join-Path $repoRoot "rules/$ruleName")).Hash
    foreach ($copyPath in @((Join-Path $verifyRoot "plugins/codex-agent-docs/defaults/$ruleName"), (Join-Path $dshExtract "package/defaults/$ruleName"))) {
        if ((Get-FileHash -LiteralPath $copyPath).Hash -ne $sourceHash) { throw "发行规则与用户源码不同：$copyPath" }
    }
}
New-Item -ItemType Directory -Path (Join-Path $verifyRoot 'project/docs') -Force | Out-Null
Set-Content -LiteralPath (Join-Path $verifyRoot 'project/docs/index.md') -Value '# 项目'
$oldRules = $env:AGENT_DOCS_RULES_DIR
try {
    $env:AGENT_DOCS_RULES_DIR = Join-Path $verifyRoot 'user-rules'
    $request = @{ hook_event_name = 'Stop'; cwd = (Join-Path $verifyRoot 'project'); turn_id = 'package'; stop_hook_active = $false } | ConvertTo-Json -Compress
    $response = $request | & node.exe (Join-Path $verifyRoot 'plugins/codex-agent-docs/scripts/stop.mjs') | ConvertFrom-Json
    if ($LASTEXITCODE -ne 0 -or $response.decision -ne 'block') { throw '解压后的 Hook 未请求续接' }
    foreach ($ruleName in @('maintain.md', 'principles.md', 'spec.md')) {
        if (-not (Test-Path -LiteralPath (Join-Path $env:AGENT_DOCS_RULES_DIR $ruleName))) { throw "首次调用缺少规则：$ruleName" }
    }
    $request = @{ hook_event_name = 'Stop'; cwd = (Join-Path $verifyRoot 'project'); stop_hook_active = $true } | ConvertTo-Json -Compress
    $allowed = $request | & node.exe (Join-Path $verifyRoot 'plugins/codex-agent-docs/scripts/stop.mjs') | ConvertFrom-Json
    if ($allowed.decision) { throw '续接后未正确放行' }
} finally { $env:AGENT_DOCS_RULES_DIR = $oldRules }
foreach ($line in Get-Content -LiteralPath (Join-Path $Dist 'SHA256SUMS.txt')) {
    $expected, $file = $line -split '  ', 2
    if ((Get-FileHash -LiteralPath (Join-Path $Dist $file) -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw "校验和不匹配：$file" }
}
Write-Output "归档完整、解压 Hook 行为与 SHA-256 校验通过：$verifyRoot"
