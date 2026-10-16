// Only allowlisted response metadata leaves the transport. Never include bodies or headers.
export function retryDelay(value,attempt=0,now=Date.now(),random=Math.random){
  if(value){const seconds=/^\d+(?:\.\d+)?$/.test(value.trim())?Number(value):NaN;
    const delay=Number.isFinite(seconds)?seconds*1000:Date.parse(value)-now;
    if(Number.isFinite(delay)&&delay>=0)return Math.max(1000,delay);
  }
  return Math.round(Math.min(60000,10000*2**Math.min(attempt,3))*(1+random()*0.2));
}
export async function responseError(response,{path,phase,attempt=0,now=Date.now(),random=Math.random}={}){
  const limited=response.status===429,retryable=limited||[502,503,504].includes(response.status);
  const retryAfterMs=retryable?retryDelay(response.headers.get('retry-after'),attempt,now,random):undefined;
  let body;try{body=await response.clone().json();}catch{}
  const candidate=response.headers.get('x-request-id')||body?.error?.request_id;
  const requestId=typeof candidate==='string'&&/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i.test(candidate)?candidate:undefined;
  const diagnostic={httpStatus:response.status,source:'unknown',path,phase,code:`HTTP_${response.status}`,retryable,...(requestId?{requestId}:{}),...(retryable?{retryAfterMs,retryAt:now+retryAfterMs}:{})};
  return Object.assign(Error(limited?'云端请求受到限流，来源待确认；请按提示时间稍后再试。':retryable?'云端服务暂时繁忙，请稍后再试。':`云端请求未完成（${response.status}）。`),{diagnostic});
}
export function createRequestGate({now=Date.now,random=Math.random}={}){
  let failure,attempt=0;
  return {pending(){return failure&&failure.diagnostic.retryAt>now()?failure:undefined;},
    async fetch(input,options={},request=fetch){
      const blocked=this.pending();if(blocked)throw blocked;
      const response=await request(input,options);
      if(response.status===429||[502,503,504].includes(response.status)){const error=await responseError(response,{path:new URL(typeof input==='object'&&'url' in input?input.url:String(input)).pathname,phase:'cloud_request',attempt,now:now(),random});
        if(error.diagnostic.retryable){failure=error;attempt++;}throw error;
      }
      failure=undefined;attempt=0;return response;
    }
  };
}
