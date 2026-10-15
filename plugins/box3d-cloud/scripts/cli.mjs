import fs from 'node:fs/promises';
import {createBridge} from './bridge.mjs';
const bridge=createBridge();
const [command,...args]=process.argv.slice(2);
const show=value=>console.log(JSON.stringify(value));
try{
 if(command==='connect'){
  const initial=await bridge.call('box3d_connect');show(initial.structuredContent);
  if(initial.isError||initial.structuredContent?.state==='error'){await bridge.close();process.exitCode=1;}
  else{
   let checking=false;
   const timer=setInterval(async()=>{if(checking)return;checking=true;try{const current=await bridge.call('box3d_connection_status');const s=current.structuredContent;if(s?.state==='connected'||s?.state==='error'||current.isError){show(s||current);clearInterval(timer);await bridge.close();}}finally{checking=false;}},3000);
   const timeout=setTimeout(async()=>{clearInterval(timer);show({state:'expired',message:'连接已过期，请重新连接。'});await bridge.close();},15*60*1000);timeout.unref();
  }
 }else{
  if(command==='status')show(await bridge.call('box3d_connection_status'));
  else if(command==='tools')show(await bridge.list());
  else if(command==='call'&&args[0]){
   const input=args[1]?JSON.parse(await fs.readFile(args[1],'utf8')):{};
   show(await bridge.call(args[0],input));
  }else throw Error('用法：connect | status | tools | call 工具名 [参数JSON文件]');
  await bridge.close();
 }
}catch{console.error('Box3D 连接未完成，请重新连接或检查插件安装。');await bridge.close();process.exitCode=1;}
