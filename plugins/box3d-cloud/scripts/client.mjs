import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';

function assertPlatformDestination(url,header,platformToken){
  if(platformToken&&(header!=='x-box3d-token'||url.protocol!=='https:'||url.port||!/^([a-z0-9-]+\.)+api-inference\.modelscope\.net$/.test(url.hostname)))throw Error('平台凭据仅允许发往确切 HTTPS *.api-inference.modelscope.net 地址，并使用独立 X-Box3D-Token');
}
export const remoteError=(config,error)=>[config.token,config.platformToken].filter(Boolean).reduce((text,secret)=>text.replaceAll(secret,'[REDACTED]'),String(error?.message||error));
export function boundFetch(config,requestFetch=fetch){
  return (input,options={})=>{
    const url=new URL(typeof input==='object'&&'url' in input?input.url:String(input));
    if(url.origin!==config.origin)throw Error('远程请求不得离开已配置的精确服务 origin');
    assertPlatformDestination(url,config.tokenHeader||'authorization',config.platformToken);
    return requestFetch(input,{...options,redirect:'error'});
  };
}
export function connectionConfig(env = process.env) {
  if (!env.BOX3D_REMOTE_ORIGIN || !env.BOX3D_REMOTE_TOKEN) throw Error('请配置 BOX3D_REMOTE_ORIGIN 和 BOX3D_REMOTE_TOKEN。');
  const url = new URL(env.BOX3D_REMOTE_ORIGIN);
  const local = ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw Error('服务地址必须是 HTTPS origin；本机测试可用回环 HTTP。');
  const tokenHeader=(env.BOX3D_TOKEN_HEADER||'authorization').toLowerCase();
  if(!['authorization','x-box3d-token'].includes(tokenHeader))throw Error('BOX3D_TOKEN_HEADER 只支持 authorization 或 x-box3d-token');
  const platformToken=env.BOX3D_PLATFORM_TOKEN;
  assertPlatformDestination(url,tokenHeader,platformToken);
  return { origin:url.origin, token:env.BOX3D_REMOTE_TOKEN, tokenHeader, platformToken,
    downloadDirectory:path.resolve(env.BOX3D_DOWNLOAD_DIR || path.join(os.homedir(),'Downloads','Box3D')) };
}
export function credentialHeaders(config){
  const header=config.tokenHeader||'authorization';
  assertPlatformDestination(new URL(config.origin),header,config.platformToken);
  return {[header]:header==='authorization'?`Bearer ${config.token}`:config.token,...(config.platformToken?{Authorization:`Bearer ${config.platformToken}`}:{})};
}
export function createFileBridge(config, requestFetch = fetch) {
  const transport=boundFetch(config,requestFetch);
  async function request(route, options = {}) {
    const response = await transport(config.origin + route, { ...options, headers:{ ...options.headers, ...credentialHeaders(config) }, redirect:'error', signal:AbortSignal.timeout(130000) });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw Error(remoteError(config,body.error || `Box3D HTTP ${response.status}`));
    }
    return response;
  }
  return {
    async upload(input) {
      if (!path.isAbsolute(input.path)) throw Error('图片必须是用户指定的本机绝对路径。');
      const stat = await fs.stat(input.path);
      if (!stat.isFile() || stat.size > 12 * 1024 * 1024) throw Error('图片必须为不超过 12MB 的普通文件。');
      const query = new URLSearchParams();
      for (const key of ['mode','color','requireAlpha']) if (input[key] !== undefined) query.set(key, String(input[key]));
      const response = await request('/api/remote-agent/image?' + query, { method:'POST', headers:{'Content-Type':'application/octet-stream'}, body:await fs.readFile(input.path) });
      return response.json();
    },
    async download({artifactId}) {
      if (!/^[a-f0-9-]{36}$/.test(artifactId)) throw Error('请输入 exports 返回的 artifactId。');
      const index = await (await request('/api/exports')).json();
      const artifact = index.artifacts.find(item => item.id === artifactId);
      if (!artifact) throw Error('此工作区没有该交付文件。');
      if (artifact.bytes > 64 * 1024 * 1024) throw Error('交付文件超过 64MB。');
      const response = await request('/api/exports/' + artifactId);
      const chunks = []; let size = 0;
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > 64 * 1024 * 1024) throw Error('交付文件超过 64MB。');
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks), sha256 = createHash('sha256').update(bytes).digest('hex');
      if (artifact.bytes !== size || (artifact.sha256 && artifact.sha256 !== sha256)) throw Error('交付文件大小或摘要不匹配，未保存。');
      const name = path.basename(artifact.name).replace(/[\\/:*?"<>|\x00-\x1f]/g, '-');
      if (!name || name === '.' || name === '..') throw Error('无效交付文件名。');
      const folder = path.join(config.downloadDirectory, artifactId);
      await fs.mkdir(folder,{recursive:true});
      const destination = path.join(folder,name);
      try { await fs.writeFile(destination, bytes, {flag:'wx'}); }
      catch (error) {
        if (error.code !== 'EEXIST') throw error;
        const existing = createHash('sha256').update(await fs.readFile(destination)).digest('hex');
        if (existing !== sha256) throw Error('本地已有不同内容的文件，未覆盖。');
      }
      return {ok:true,artifactId,name,path:destination,bytes:size,sha256};
    }
  };
}
