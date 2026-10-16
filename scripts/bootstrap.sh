#!/bin/sh
set -eu
# User-space runtime only. No Box3D server, Docker, Python, or global npm installation.
base="${BOX3D_CONNECTOR_HOME:-$HOME/.box3d-cloud}"
mkdir -p "$base/downloads" "$base/tools"
chmod 700 "$base"
case "$(uname -s)" in Darwin) node_os=darwin;; Linux) node_os=linux;; *) echo '请使用 Windows 版安装入口。'; exit 1;; esac
case "$(uname -m)" in arm64|aarch64) node_arch=arm64;; x86_64) node_arch=x64;; *) echo '当前处理器尚未验证，未修改配置。'; exit 1;; esac
hash_file(){ if command -v sha256sum >/dev/null 2>&1; then sha256sum "$1"; else shasum -a 256 "$1"; fi; }
node_version=v22.23.3
node_name="node-$node_version-$node_os-$node_arch"
node_bin="$base/tools/$node_name/bin/node"
if [ ! -x "$node_bin" ]; then
  echo '正在安装官方 Node.js 连接运行环境…'
  curl --fail --silent --show-error --location "https://nodejs.org/dist/$node_version/$node_name.tar.gz" -o "$base/downloads/$node_name.tar.gz"
  curl --fail --silent --show-error --location "https://nodejs.org/dist/$node_version/SHASUMS256.txt" -o "$base/downloads/node-shasums.txt"
  expected=$(awk -v f="$node_name.tar.gz" '$2==f {print $1}' "$base/downloads/node-shasums.txt")
  actual=$(hash_file "$base/downloads/$node_name.tar.gz" | awk '{print $1}')
  [ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo '运行环境校验失败，未安装。'; exit 1; }
  tar -xzf "$base/downloads/$node_name.tar.gz" -C "$base/tools"
fi
PATH="$(dirname "$node_bin"):$PATH"; export PATH
if ! command -v codex >/dev/null 2>&1 && [ -z "${BOX3D_CODEX_BIN:-}" ]; then
  echo '正在安装官方 Codex 命令行安装助手…'
  npm install --prefix "$base/tools/codex" --no-audit --no-fund @openai/codex@0.153.4
  BOX3D_CODEX_BIN="$base/tools/codex/node_modules/.bin/codex"; export BOX3D_CODEX_BIN
fi
if ! command -v git >/dev/null 2>&1; then echo '缺少 Git，请让 Codex 从系统官方软件源安装后继续。'; exit 1; fi
release=https://github.com/yuyou-dev/box3d-cloud-plugin/releases/download/v0.2.3
curl --fail --silent --show-error --location "$release/box3d-cloud-0.2.3.tar.gz" -o "$base/downloads/plugin.tar.gz"
curl --fail --silent --show-error --location "$release/box3d-cloud-0.2.3.sha256" -o "$base/downloads/plugin.sha256"
expected=$(awk '{print $1}' "$base/downloads/plugin.sha256")
actual=$(hash_file "$base/downloads/plugin.tar.gz" | awk '{print $1}')
[ -n "$expected" ] && [ "$expected" = "$actual" ] || { echo '插件下载校验失败，未安装。'; exit 1; }
mkdir -p "$base/packages/0.2.3"
tar -xzf "$base/downloads/plugin.tar.gz" -C "$base/packages/0.2.3"
"$node_bin" "$base/packages/0.2.3/scripts/install.mjs"
