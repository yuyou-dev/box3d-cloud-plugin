$ErrorActionPreference = 'Stop'
$base = if ($env:BOX3D_CONNECTOR_HOME) { $env:BOX3D_CONNECTOR_HOME } else { Join-Path $env:USERPROFILE '.box3d-cloud' }
New-Item -ItemType Directory -Force -Path "$base\downloads", "$base\tools" | Out-Null
$arch = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { 'arm64' } else { 'x64' }
$name = "node-v22.23.3-win-$arch"
$node = "$base\tools\$name\node.exe"
if (!(Test-Path $node)) {
 Write-Output '正在安装官方 Node.js 连接运行环境…'
 Invoke-WebRequest "https://nodejs.org/dist/v22.23.3/$name.zip" -OutFile "$base\downloads\node.zip"
 Invoke-WebRequest 'https://nodejs.org/dist/v22.23.3/SHASUMS256.txt' -OutFile "$base\downloads\node-shasums.txt"
 $line = Get-Content "$base\downloads\node-shasums.txt" | Where-Object { $_ -match "  $([regex]::Escape($name)).zip$" }
 $expected = ($line -split '\s+')[0]
 if (!$expected -or (Get-FileHash "$base\downloads\node.zip" -Algorithm SHA256).Hash -ne $expected) { throw '运行环境校验失败，未安装。' }
 Expand-Archive "$base\downloads\node.zip" -DestinationPath "$base\tools" -Force
}
$env:PATH = "$(Split-Path $node);$env:PATH"
if (!(Get-Command codex -ErrorAction SilentlyContinue) -and !$env:BOX3D_CODEX_BIN) {
 & "$(Split-Path $node)\npm.cmd" install --prefix "$base\tools\codex" --no-audit --no-fund '@openai/codex@0.153.4'
 if ($LASTEXITCODE -ne 0) { throw '官方 Codex 安装助手尚未安装完成。' }
 # Resolve the vendor executable rather than executing a .cmd through a shell.
 $exe = Get-ChildItem "$base\tools\codex\node_modules\@openai" -Filter codex.exe -Recurse | Select-Object -First 1
 if (!$exe) { throw '未找到官方 Codex 可执行文件。' }
 $env:BOX3D_CODEX_BIN = $exe.FullName
}
if (!(Get-Command git -ErrorAction SilentlyContinue)) { throw '缺少 Git，请让 Codex 从系统官方软件源安装后继续。' }
$release = 'https://github.com/yuyou-dev/box3d-cloud-plugin/releases/download/v0.2.1'
Invoke-WebRequest "$release/box3d-cloud-0.2.1.tar.gz" -OutFile "$base\downloads\plugin.tar.gz"
Invoke-WebRequest "$release/box3d-cloud-0.2.1.sha256" -OutFile "$base\downloads\plugin.sha256"
$expected = ((Get-Content "$base\downloads\plugin.sha256") -split '\s+')[0]
if ((Get-FileHash "$base\downloads\plugin.tar.gz" -Algorithm SHA256).Hash -ne $expected) { throw '插件校验失败，未安装。' }
New-Item -ItemType Directory -Force -Path "$base\packages\0.2.1" | Out-Null
& tar -xzf "$base\downloads\plugin.tar.gz" -C "$base\packages\0.2.1"
if ($LASTEXITCODE -ne 0) { throw '插件解压失败。' }
& $node "$base\packages\0.2.1\scripts\install.mjs"
if ($LASTEXITCODE -ne 0) { throw '插件安装未完成。' }
