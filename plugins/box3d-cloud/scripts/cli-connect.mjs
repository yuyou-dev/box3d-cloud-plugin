export async function connect(bridge,show,{now=Date.now,sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms)),timeoutMs=15*60*1000}={}){
 const deadline=now()+timeoutMs;
 let current=await bridge.call('box3d_connect'),last;
 while(true){
  const status=current.structuredContent||current;
  const display=JSON.stringify(status);
  if(display!==last){show(status);last=display;}
  if(status.state==='connected')return 0;
  if(['error','expired','cancelled','needs_attention'].includes(status.state)||current.isError&&!status.diagnostic?.retryable)return 1;
  if(now()>=deadline){show({ok:false,state:'expired',message:'连接已过期，请重新连接。'});return 1;}
  await sleep(Math.min(Math.max(5000,(status.retryAt||0)-now()),deadline-now()));
  current=await bridge.call('box3d_connection_status');
 }
}
