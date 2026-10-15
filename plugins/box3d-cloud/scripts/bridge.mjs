import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {createOnboarding} from './onboarding.mjs';
import {credentialHeaders,boundFetch,createFileBridge,remoteError} from './client.mjs';
import {profile} from './profile.mjs';
const object={type:'object',properties:{},additionalProperties:false};
const localTools=[
 {name:'box3d_connect',description:'首次连接或重新登录 Box3D 云端工作台。返回本机安全登录页；在 Codex 内置浏览器打开，让用户登录魔搭，再在 Box3D 输入配对码。密码与令牌不得进入聊天。',inputSchema:object},
 {name:'box3d_connection_status',description:'检查配对进度和已保存连接。返回工作区与友好的状态，不返回凭据。登录后调用，配对完成后核对云端身份。',inputSchema:object,annotations:{readOnlyHint:true}},
 {name:'box3d_import_image',description:'上传用户指定的本机图片到已登录的 Box3D 云端工作区。只上传指定素材，不上传凭据或目录。',inputSchema:{type:'object',properties:{path:{type:'string'},mode:{enum:['image','white-on-black-mask']},color:{type:'string'},requireAlpha:{type:'boolean'}},required:['path'],additionalProperties:false}},
 {name:'box3d_download_export',description:'按云端 artifactId 下载交付文件，核验摘要并返回本机绝对路径。',inputSchema:{type:'object',properties:{artifactId:{type:'string'}},required:['artifactId'],additionalProperties:false}}
];
const result=value=>({content:[{type:'text',text:JSON.stringify(value)}],structuredContent:value});
export function createBridge({onboarding=createOnboarding(),changed=()=>{}}={}){
 let remote,config,key,connecting;
 async function connected(){
  const next=await onboarding.config(),nextKey=next.token+next.platformToken;
  if(remote&&key===nextKey)return remote;
  if(connecting)return connecting;
  connecting=(async()=>{
   if(remote)await remote.close();remote=undefined;config=next;
   const client=new Client({name:'box3d-cloud',version:profile.version});
   try{await client.connect(new StreamableHTTPClientTransport(new URL(config.origin+'/mcp'),{requestInit:{headers:credentialHeaders(config),redirect:'error'},fetch:boundFetch(config)}));}
   catch(e){await client.close().catch(()=>{});throw e;}
   remote=client;key=nextKey;return remote;
  })().finally(()=>{connecting=undefined;});return connecting;
 }
 async function list(){
  try{return [...localTools,...(await(await connected()).listTools()).tools.filter(t=>!localTools.some(l=>l.name===t.name))];}
  catch{return localTools;}
 }
 async function call(name,args={}){
  try{
   if(name==='box3d_connect')return result(await onboarding.begin());
   if(name==='box3d_connection_status'){
    const status=await onboarding.status();
    if(['connected','saved'].includes(status.state)){
     const checked=await(await connected()).callTool({name:'box3d_status',arguments:{}});
     if(checked.isError)return checked;
     const actual=checked.structuredContent||JSON.parse(checked.content.find(c=>c.type==='text').text);
     await changed();return result({...status,state:'connected',message:'已连接云端工作区，可以开始设计。',workspaceId:actual.workspaceId,service:actual});
    }
    return result(status);
   }
   const client=await connected();
   if(name==='box3d_import_image')return result(await createFileBridge(config).upload(args));
   if(name==='box3d_download_export')return result(await createFileBridge(config).download(args));
   return await client.callTool({name,arguments:args});
  }catch(error){return {isError:true,...result({ok:false,state:'needs_attention',message:config?remoteError(config,error):'连接未就绪，请重新登录 Box3D。'})};}
 }
 return {list,call,async close(){await onboarding.stop();if(remote)await remote.close();}};
}
