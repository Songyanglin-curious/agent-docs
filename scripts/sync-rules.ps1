[CmdletBinding(SupportsShouldProcess)]
param(
    [Parameter(Mandatory)]
    [string]$TargetRoot,
    [ValidateSet('dsh', 'codex')]
    [string[]]$Platform = @('dsh', 'codex')
)

$ErrorActionPreference = 'Stop'
$sourceRoot = Join-Path (Split-Path $PSScriptRoot) 'rules'
$ruleNames = @('init.md', 'maintain.md', 'principles.md', 'spec.md')
$TargetRoot = [System.IO.Path]::GetFullPath($TargetRoot)
$backupRoot = Join-Path $TargetRoot ('.backups/rules-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '-' + [guid]::NewGuid().ToString('N'))
$changes = @()

# 先检查四份源文件与全部目标，避免发现缺失来源后才中断同步。
foreach ($ruleName in $ruleNames) {
    $source = Join-Path $sourceRoot $ruleName
    if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "规则源文件不存在：$source" }
    $sourceHash = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
    foreach ($hostName in ($Platform | Select-Object -Unique)) {
        $destination = Join-Path (Join-Path $TargetRoot $hostName) $ruleName
        $exists = Test-Path -LiteralPath $destination
        if ($exists -and -not (Test-Path -LiteralPath $destination -PathType Leaf)) { throw "目标不是文件：$destination" }
        $oldHash = if ($exists) { (Get-FileHash -LiteralPath $destination -Algorithm SHA256).Hash } else { $null }
        if ($oldHash -eq $sourceHash) { continue }
        $changes += [pscustomobject]@{
            Source = $source; Destination = $destination; SourceHash = $sourceHash
            OldHash = $oldHash; Backup = Join-Path (Join-Path $backupRoot $hostName) $ruleName
        }
    }
}

$copied = 0
foreach ($change in $changes) {
    if (-not $PSCmdlet.ShouldProcess($change.Destination, '从 rules 同步规则；覆盖前备份旧文件')) { continue }
    if ($null -ne $change.OldHash) {
        New-Item -ItemType Directory -Path (Split-Path $change.Backup) -Force | Out-Null
        Copy-Item -LiteralPath $change.Destination -Destination $change.Backup
        if ((Get-FileHash -LiteralPath $change.Backup -Algorithm SHA256).Hash -ne $change.OldHash) { throw "备份校验失败，未覆盖目标：$($change.Destination)" }
    }
    New-Item -ItemType Directory -Path (Split-Path $change.Destination) -Force | Out-Null
    Copy-Item -LiteralPath $change.Source -Destination $change.Destination -Force
    if ((Get-FileHash -LiteralPath $change.Destination -Algorithm SHA256).Hash -ne $change.SourceHash) { throw "同步后校验失败：$($change.Destination)" }
    $copied++
    Write-Output "已同步：$($change.Destination)"
}

if ($WhatIfPreference) { Write-Output "预览完成，共 $($changes.Count) 份文件需要同步，未写入文件。" }
elseif ($copied -eq 0) { Write-Output '规则已经一致，无需同步。' }
else { Write-Output "同步完成，共更新 $copied 份文件。" }
if (Test-Path -LiteralPath $backupRoot) { Write-Output "旧规则备份：$backupRoot" }
