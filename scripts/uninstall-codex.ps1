param([string]$UserRoot = $env:USERPROFILE)
$ErrorActionPreference = 'Stop'
# 在执行 codex plugin remove 后，移除本插件源与登记；保留其他插件和显式自定义规则。
$root = [System.IO.Path]::GetFullPath($UserRoot)
$localRoot = Join-Path $root '.codex/plugins/local'
$destination = [System.IO.Path]::GetFullPath((Join-Path $localRoot 'codex-agent-docs'))
if ((Split-Path $destination) -ne [System.IO.Path]::GetFullPath($localRoot)) { throw '卸载目录超出插件本地源范围' }
$catalogPath = Join-Path $root '.agents/plugins/marketplace.json'
if (Test-Path -LiteralPath $catalogPath) {
    $catalog = Get-Content -LiteralPath $catalogPath -Raw | ConvertFrom-Json
    $catalog.plugins = @($catalog.plugins | Where-Object name -ne 'codex-agent-docs')
    [System.IO.File]::WriteAllText($catalogPath, ($catalog | ConvertTo-Json -Depth 30), [System.Text.UTF8Encoding]::new($false))
}
if (Test-Path -LiteralPath $destination) {
    if ((Get-Item -LiteralPath $destination).LinkType) { throw '插件源是链接，保留并请用户处理' }
    Remove-Item -LiteralPath $destination -Recurse -Force
}
Write-Output '已移除 codex-agent-docs 本地源及市场条目；共享市场文件和其他插件保持不变。'
