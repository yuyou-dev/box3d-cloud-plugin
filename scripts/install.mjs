import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile),root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const codex=process.env.BOX3D_CODEX_BIN||'codex';
const say=(step,message,extra={})=>console.log(JSON.stringify({step,message,...extra}));
async function cli(args){const {stdout}=await run(codex,args,{maxBuffer:4*1024*1024,env:{...process.env,PATH:path.dirname(process.execPath)+path.delimiter+process.env.PATH}});return stdout.trim();}
try{
 if(Number(process.versions.node.split('.')[0])<20)throw Error('需要 Node.js 20.19 或更新版本，请按 START_HERE.md 安装官方运行环境。');
 say('checking','正在检查 Codex 和云端插件。');
 await cli(['plugin','add','--help']);
 const listing=JSON.parse(await cli(['mcp','list','--json']));
 const old=listing.find(item=>item.name==='box3d_cloud');
 const home=process.env.BOX3D_CONNECTOR_HOME||path.join(os.homedir(),'.box3d-cloud');
 const runtime=path.join(home,'runtime','0.2.0');
 const entry=path.join(runtime,'start-mcp.mjs');
 if(old){const transport=old.transport||old;if(transport.command!==process.execPath||!(transport.args||[]).includes(entry))throw Error('已有其他 box3d_cloud 连接，未覆盖。请在 Codex 中明确选择保留旧连接或切换到新插件。');}
 say('installing_plugin','正在从 Box3D 公开插件市场安装。');
 await cli(['plugin','marketplace','add','https://github.com/yuyou-dev/box3d-cloud-plugin.git','--ref','v0.2.0','--json']);
 await cli(['plugin','add','box3d-cloud@box3d-cloud-marketplace','--json']);
 await fs.mkdir(runtime,{recursive:true,mode:0o700});
 for(const name of ['start-mcp.mjs','cli.mjs','THIRD-PARTY-NOTICES.txt'])await fs.copyFile(path.join(root,'plugins','box3d-cloud','dist',name),path.join(runtime,name));
 if(!old)await cli(['mcp','add','box3d_cloud','--',process.execPath,entry]);
 say('ready','插件和 MCP 已安装。下一步打开登录页面。',{node:process.execPath,cli:path.join(runtime,'cli.mjs'),next:['connect'],note:'当前聊天若尚未加载新 MCP，可由 Codex 使用附带 CLI 继续连接；下次聊天自动加载 MCP。'});
}catch(error){say('needs_attention',error.message.includes('已有其他')?error.message:'安装未完成：请让 Codex 根据 START_HERE.md 检查官方运行环境、Codex 插件功能和网络连接。');process.exitCode=1;}
