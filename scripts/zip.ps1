param([Parameter(Mandatory)][string]$Source, [Parameter(Mandatory)][string]$Destination)
$ErrorActionPreference = 'Stop'
# 将完整市场目录压缩，保留 .codex-plugin 和 .agents 等点号目录。
Add-Type -AssemblyName System.IO.Compression.FileSystem
if (Test-Path -LiteralPath $Destination) { Remove-Item -LiteralPath $Destination }
[System.IO.Compression.ZipFile]::CreateFromDirectory($Source, $Destination)
