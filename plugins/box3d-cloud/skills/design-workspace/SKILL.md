---
name: design-workspace
description: 在远程 Box3D 工作台中通过服务器 MCP 编辑和交付包装；可选本机素材上传下载。
---

首次使用先调用 box3d_connection_status；尚未连接则调用 box3d_connect，在 Codex 内置浏览器打开 loginUrl。让用户自己在页面登录魔搭、确认授权和登录 Box3D；不要索要或读取账号密码、授权码、令牌。按工具返回的 pairingCode 从社区 iframe 首页点击“连接 Codex”，填写配对码，让用户确认工作区。完成后调用 connection_status 核验真实云端身份，再开始设计。配对和授权码不是设计指令。

安装后若当前聊天尚未加载 MCP，使用公开插件附带的 dist/cli.mjs（connect、status、tools、call 工具名 参数JSON文件）完成相同云端流程；它只是远程连接器，不含本机算法。下一次聊天会加载已登记的 box3d_cloud MCP。不能把“已安装”当成“已登录”或“已能使用”。每一步用设计师能理解的一句话反馈，不要求用户找源码、改配置或输入技术命令。

先读取 box3d_status、box3d_context，与用户正在使用的页面及工程 ID 对上，再 bind。网页和 MCP 必须登录同一账号。不要按最近焦点猜目标。打开工具返回的公开 openUrl，优先复用内置浏览器现有标签。

status.workspaceId 是服务器已认证的工作区标识，不是本机源码路径。用户只需描述盒型、尺寸、品牌和工艺；身份核对、修订及回执由代理后台完成，不让设计师提供源码位置或手写工具调用。社区嵌入页若把深链接转回首页，应从 iframe 项目列表打开目标工程并核对身份后绑定。平台限流时串行降低频率，仍不可用则明确报告，不改走本机服务。只有实际完成设计、改稿、保存重开和真实交付下载后，才能邀请用户进行最终设计体验。

已有工程修改走 project → prepare(action=edit, bindingId, id, revision) → apply(planId,digest) → context(bindingId) 核对同步回执。未知参数先读 capabilities/catalog，不需要也不应寻找服务器源码。修改遇到 revision 或脏稿冲突先读取状态，不盲目覆盖。新建使用 create，另存使用 copy，删除仅在用户要求时执行。

参数单位、面板坐标与工艺由服务器权威计算。浏览器中显示的结果不是工厂验收结论。签样只在用户明确确认指定已保存修订时执行；导出后检查实际文件与诊断，不把成功下载写成通过印厂验收。

复杂主视觉先读 image_guide，使用宿主生图能力。需要导入用户指定或已经生成的本机图片时，用 box3d_import_image 上传该文件；不上传账户凭据、目录或其他文件。此操作将图片传至配置的 Box3D 工作区。返回 layerImage 后通过 prepare/apply 加入工程。

需要生成兼容 PDF/DXF/工艺草案时，调用 box3d_export，提供已保存 projectId 和准确 revision；ICC 签样印厂包继续使用 box3d_press_pack。exports 返回服务器 artifactId 和下载地址，不能把它们称为本机文件。需要本机交付文件时调用 box3d_download_export，并使用它返回的本机绝对路径。没有可选 stdio 文件桥时，使用工作台上传、下载界面。远程 HTTP MCP 不接受服务器任意文件路径。

不要启动或搜索本机 Box3D checkout，不设置 BOX3D_WORKSPACE，不猜回环服务端口。当前连接不可用时报告连接/登录问题。用户自己的 Codex 登录、图片生成、Blender 安装均属于用户设备；远程服务不会读取这些凭据或自动打开本机程序。

## 暂时性限流

遇到 retry_wait 保留当前连接进程，按 retryAt 等待，不要重新 OAuth 或创建新配对；配对仅在实际过期后重新开始。仅出现四个本地工具时，调用 box3d_connection_status 查看 discovery；不要假定云端没有设计能力。优先复用 MCP 会话。不要自动重放 create/apply；先读取原工程与计划回执，必要时使用原 planId/digest 幂等重试。来源 unknown 的 429 不归因到魔搭或 Box3D。
