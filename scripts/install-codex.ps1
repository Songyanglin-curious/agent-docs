param([string]$MarketplaceRoot = $PSScriptRoot, [string]$UserRoot = $env:USERPROFILE)
$ErrorActionPreference = 'Stop'
# 将发行包登记到个人市场；不修改其他插件，不伪造 Hook 信任或缓存安装状态。
$pluginSource = Join-Path $MarketplaceRoot 'plugins/codex-agent-docs'
if (-not (Test-Path -LiteralPath (Join-Path $pluginSource '.codex-plugin/plugin.json'))) {
    throw '未找到插件。请从解压后的发行包执行此脚本，或用 -MarketplaceRoot 指定发行目录。'
}
$personalMarketDir = Join-Path $UserRoot '.agents/plugins'
$catalogPath = Join-Path $personalMarketDir 'marketplace.json'
$destination = Join-Path $UserRoot '.codex/plugins/local/codex-agent-docs'
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item -Path (Join-Path $pluginSource '*') -Destination $destination -Recurse -Force
# Windows 的点号目录不是隐藏属性；额外校验插件清单确实复制成功。
if (-not (Test-Path -LiteralPath (Join-Path $destination '.codex-plugin/plugin.json'))) { throw '插件清单复制失败' }
New-Item -ItemType Directory -Path $personalMarketDir -Force | Out-Null
if (Test-Path -LiteralPath $catalogPath) {
    $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
} else {
    $catalog = [pscustomobject]@{ name = 'personal-local'; plugins = @() }
}
if (-not $catalog.name) { throw '已有个人市场缺少 name，已保留原文件，请手工合并' }
$otherPlugins = @($catalog.plugins | Where-Object { $_.name -ne 'codex-agent-docs' })
# 个人市场根为用户主目录，source.path 按根目录解析。
$entry = [pscustomobject]@{
    name = 'codex-agent-docs'
    source = @{ source = 'local'; path = './.codex/plugins/local/codex-agent-docs' }
    policy = @{ installation = 'AVAILABLE'; authentication = 'ON_INSTALL' }
    category = 'Productivity'
}
$catalog | Add-Member -NotePropertyName plugins -NotePropertyValue @($otherPlugins + $entry) -Force
$json = $catalog | ConvertTo-Json -Depth 30
[System.IO.File]::WriteAllText($catalogPath, $json, [System.Text.UTF8Encoding]::new($false))
$check = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
if (@($check.plugins | Where-Object name -eq 'codex-agent-docs').Count -ne 1) { throw '市场回读验证失败' }
Write-Output "已登记：$catalogPath"
Write-Output "插件目录：$destination"
Write-Output '请重启桌面应用，在插件目录中选择个人市场安装，再到设置 > Hooks 审阅并信任 Agent Docs。脚本没有代替这两步。'
