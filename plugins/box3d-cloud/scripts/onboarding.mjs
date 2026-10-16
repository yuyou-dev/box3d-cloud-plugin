import http from 'node:http';
import {randomBytes} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {profile as defaultProfile} from './profile.mjs';
import {createStore} from './store.mjs';
import {beginPlatformLogin,refreshPlatformLogin} from './platform-auth.mjs';
import {connectionConfig} from './client.mjs';
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
const page=(title,body)=>`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} · Box3D</title><style>body{font:16px system-ui;background:#171a1c;color:#f7f5ee;display:grid;place-items:center;min-height:95vh}main{width:min(520px,85vw);padding:36px 0}h1{font-size:32px}p{line-height:1.8;color:#c8c9c9}a{display:inline-block;background:#ecd6a3;color:#222;padding:14px 20px;border-radius:8px;text-decoration:none;margin:12px 0}code{font:26px monospace;letter-spacing:3px;color:#ecd6a3}small{color:#b8bdc0}</style><main><small>BOX3D / 连接你的云端工作台</small><h1>${title}</h1>${body}</main></html>`;
export function createOnboarding({profile=defaultProfile,store=createStore(),platformLogin=beginPlatformLogin,refresh=refreshPlatformLogin,request=fetch}={}){
  let phase='login',server,login,localOrigin,nonce,state='idle',message='',pending,platform,expiresAt=0;
  async function api(route,body){
    const r=await request(profile.apiOrigin+route,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+platform.accessToken,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',signal:AbortSignal.timeout(20000)});
    if(!r.ok)throw Error(r.status===429?'魔搭或 Box3D 正在限流，请稍后再连接。':r.status===401||r.status===403?'魔搭暂未允许此登录访问创空间 API。请联系服务管理员。':`云端连接暂时不可用（${r.status}）。`);
    return r.json();
  }
  async function stop(){if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));server=undefined;}}
  const safeStatus=()=>({ok:state!=='error',state,message,...(pending?{pairingCode:pending.code,expiresAt:pending.expiresAt,openUrl:profile.communityUrl}:{}),...(state==='awaiting_platform'?{loginUrl:localOrigin+'/start/'+nonce}:{}),communityUrl:profile.communityUrl});
  async function begin(){
    if(server&&expiresAt>Date.now()&&['awaiting_platform','awaiting_pairing'].includes(state))return safeStatus();
    await stop();pending=undefined;state='starting';message='正在准备魔搭登录…';expiresAt=Date.now()+15*60*1000;nonce=randomBytes(24).toString('hex');
    server=http.createServer(async(req,res)=>{
      const send=(status,html)=>{res.writeHead(status,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'});res.end(html);};
      if(req.headers.host!==new URL(localOrigin).host||req.method!=='GET'||(req.headers.origin&&req.headers.origin!==localOrigin))return send(403,'不接受此请求');
      if(Date.now()>expiresAt)return send(410,page('连接已过期','<p>请回到 Codex，说“重新连接 Box3D”。</p>'));
      const url=new URL(req.url,localOrigin);
      if(url.pathname==='/start/'+nonce)return send(200,page('先登录魔搭',`<p>使用你自己的魔搭账号授权 Box3D 连接器访问云端服务。下一步再登录管理员提供的 Box3D 工作区。</p><p>密码只在魔搭和 Box3D 页面输入，不要发送到聊天中。连接凭据仅保存在本机。</p><a href="${escape(login.url)}">使用魔搭账号登录</a>`));
      if(url.pathname==='/callback'&&state==='awaiting_platform'){
        state='checking_platform';
        try{
          phase='login';platform=await login.complete(url.href);phase='access';await api('/healthz');phase='pairing';
          pending=await api('/api/pairings/start',{label:'Codex · '+os.hostname().slice(0,48)});
          state='awaiting_pairing';message='魔搭已登录。请在 Box3D 工作区点击“连接 Codex”，输入配对码并确认。';
          return send(200,page('魔搭已登录',`<p>打开工作台，登录你的 Box3D 测试账号，然后点击“连接 Codex”。</p><p>本次配对码</p><code>${escape(pending.code.match(/.{1,4}/g).join(' '))}</code><p>配对码十分钟有效。确认连接后回到 Codex 即可开始设计。</p><a href="${profile.communityUrl}">打开 Box3D 工作台</a>`));
        }catch(error){state='error';message=phase==='login'?'魔搭授权未完成，请重新连接。若仍失败，请联系管理员检查连接器版本。':error.message;return send(400,page('连接尚未完成',`<p>${escape(message)}</p>`));}
      }
      send(404,'页面不存在');
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    localOrigin=`http://127.0.0.1:${server.address().port}`;
    try{login=await platformLogin(localOrigin+'/callback');state='awaiting_platform';message='请在打开的页面登录魔搭。';return safeStatus();}
    catch{await stop();state='error';message='魔搭登录服务暂时不可用，请稍后重试。';return safeStatus();}
  }
  async function status(){
    if(state==='awaiting_pairing'){
      try{
        const result=await api('/api/pairings/poll',{code:pending.code,secret:pending.secret});
        if(result.state==='connected'){
          await store.write({version:1,profile:profile.apiOrigin,platform,workspaceId:result.workspaceId,token:result.token});
          state='connected';message=`已连接工作区 ${result.workspaceId}，可以开始设计。`;pending=undefined;
          // Leave the success page readable; the MCP process owns its lifetime.
          return {...safeStatus(),workspaceId:result.workspaceId};
        }
      }catch(error){state='error';message=error.message;pending=undefined;}
      return safeStatus();
    }
    if(state!=='idle')return safeStatus();
    const saved=await store.read();
    if(saved.profile===profile.apiOrigin&&saved.token?.expiresAt>Date.now())return {ok:true,state:'saved',workspaceId:saved.workspaceId,message:'已找到本机保存的连接，正在使用时会核验云端登录。',communityUrl:profile.communityUrl};
    return {ok:true,state:'not_connected',message:'尚未连接。请开始登录 Box3D。',communityUrl:profile.communityUrl};
  }
  async function config(){
    let saved=await store.read();
    if(saved.profile!==profile.apiOrigin||!saved.token||saved.token.expiresAt<=Date.now())throw Error('请先调用 box3d_connect，在浏览器登录并配对。');
    const updated=await refresh(saved.platform);
    if(updated!==saved.platform){saved={...saved,platform:updated};await store.write(saved);}
    return connectionConfig({BOX3D_REMOTE_ORIGIN:profile.apiOrigin,BOX3D_REMOTE_TOKEN:saved.token.secret,BOX3D_TOKEN_HEADER:'x-box3d-token',BOX3D_PLATFORM_TOKEN:saved.platform.accessToken,BOX3D_DOWNLOAD_DIR:process.env.BOX3D_DOWNLOAD_DIR||path.join(os.homedir(),'Downloads','Box3D')});
  }
  return {begin,status,config,stop};
}
