# Box3D 云端工作台：Codex 启动说明

你正在帮受邀设计师安装 Box3D。自动完成安装和配置，用简短中文报告“正在安装 → 等待登录 → 已连接”。用户只负责在浏览器登录和确认授权。不要索要聊天中的账号密码、令牌、源码路径；不得下载 Box3D 服务端或寻找本机算法替代云端。

## 1. 安装已发布的插件和 MCP

目标版本：`v0.2.3`，公开来源仅 `https://github.com/yuyou-dev/box3d-cloud-plugin`。

1. 检查当前操作系统及 Codex 内置浏览器能力。需要有本机终端和内置浏览器的 Codex 桌面环境；网页版云端任务没有客户电脑浏览器与回环回调，不宣称支持。
2. 从该版本公开仓库下载 `scripts/bootstrap.sh`（macOS/Linux）或 `scripts/bootstrap.ps1`（Windows），先阅读再执行，遵循宿主安装审批。脚本只安装用户目录中的官方 Node.js、必要时官方 Codex CLI，以及已发布薄连接器；从 GitHub Release 下载包并核验 SHA-256。不会安装 Box3D 核心代码、Python、Docker 或 Blender。
3. 若系统缺少 Git，由你使用系统官方软件源安装；不要要求设计师复制命令。企业策略禁止安装、GitHub/Node.js 不可达或平台限流时，明确报告阻碍，不绕过限制。
4. 安装器通过 `codex plugin marketplace add … --ref v0.2.3` 和 `codex plugin add box3d-cloud@box3d-cloud-marketplace` 从公开插件市场安装技能，再登记 `box3d_cloud` MCP 的绝对运行路径。同一连接器的版本升级保留登录；不覆盖其他同名连接，已有冲突时说明具体连接，让用户选择切换。
5. 记录安装器返回的 `node`、`cli` 路径。不要读取 `.box3d-cloud/connection.json`。里面包含登录凭据。

## 2. 登录与配对

优先调用 MCP `box3d_connect`；当前聊天尚未加载新 MCP 时，用安装器返回的 `node` 执行 `cli connect` 并保持进程运行。这是同一远程连接器的入口。

在 Codex 内置浏览器打开返回的 `loginUrl`。让用户自己登录魔搭并确认官方授权。验证码、密码和授权码都不由代理读取。魔搭授权目前包括公开资料与 API-Inference，用于客户自己的平台访问；连接器不调用模型推理。

授权返回后页面显示配对码。打开 `https://modelscope.cn/studios/yuyou80/box3d-server-pilot-20261015`，让用户使用管理员另行提供的 Box3D 账号密码登录。在社区 iframe 的首页点击“连接 Codex”，填写本次配对码，让用户确认工作区。返回 Codex 后调用 `box3d_connection_status`；CLI connect 正常每五秒检查配对，遇到限流按 retryAt 等待并保留配对；同一进程恢复后输出成功回执。不要以“已安装”代替“已连接”。

连接成功要核对真实 `workspaceId`，并读取 status、capabilities、catalog。随后从同一社区 iframe 显示该用户的工作区。当前聊天尚未加载工具时，可使用 `cli tools` 查询服务工具，使用 `cli call 工具名 参数JSON文件` 调用；所有设计与导出仍由云端完成。新聊天会加载安装好的 MCP。

连接状态为 retry_wait 时，按 retryAt 等待后再查，不要重启进程、反复重新登录或创建新配对。工具只有四个本地入口时，查询 box3d_connection_status 的 discovery 诊断；恢复后会通知宿主重新发现工具。优先保持同一个 MCP 会话，避免为每次查询启动新 CLI。设计写操作不自动重放；失败后先核对工程修订和计划回执，再决定是否用原 planId/digest 重试。

## 3. 开始设计

告诉用户：“已连接你的 Box3D 工作区，现在说出盒型、尺寸和设计要求就可以开始。”

用户要求创作时才新建；先检查实际盒型参数。按真实盒面毫米坐标排版，文字与烫金、烫银、击凸保留可编辑层。设计修改走 project → prepare/edit → apply → context 回执，保存重开后展示展开图和成盒效果。下载用 cloud download 工具，提供真实本机链接。未提供 ICC 或没有签样时保持草案诊断，不称为 PDF/X 或印厂已验收。

## 边界

公开仓库是 Box3D 自有 GitHub 插件市场，不是已经通过审核的 OpenAI 公共插件目录。登录凭据默认仅保存于当前系统用户的私有目录，可在 Box3D 访问凭据中撤销。平台拒绝 OAuth 访问、登录过期、服务停机或限流时，明确报告并停止依赖操作，不改用管理员平台密钥或本地算法。
