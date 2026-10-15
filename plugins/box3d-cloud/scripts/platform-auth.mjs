import * as oauth from 'oauth4webapi';
import {profile} from './profile.mjs';
const issuer=new URL(profile.issuer);
let discovery;
async function metadata(){
  discovery ||= oauth.discoveryRequest(issuer,{signal:AbortSignal.timeout(20000)}).then(r=>oauth.processDiscoveryResponse(issuer,r)).catch(e=>{discovery=undefined;throw e;});
  const as=await discovery;
  for(const key of ['registration_endpoint','token_endpoint','authorization_endpoint','jwks_uri'])if(new URL(as[key]).origin!==issuer.origin)throw Error('魔搭登录地址发生变化，请更新插件。');
  return as;
}
export async function beginPlatformLogin(redirectUri){
  const as=await metadata();
  const response=await oauth.dynamicClientRegistrationRequest(as,{client_name:'Box3D Cloud Connector',redirect_uris:[redirectUri],grant_types:['authorization_code','refresh_token'],response_types:['code'],token_endpoint_auth_method:'none',scope:'openid profile api-inference'},{signal:AbortSignal.timeout(20000)});
  // ModelScope currently returns 200 for successful RFC 7591 registration.
  let registrationResponse=response;
  if(response.status===200){
    const data=await response.json();
    // The provider includes an unused secret even for public clients. Never retain it.
    if(data.token_endpoint_auth_method==='none'){delete data.client_secret;delete data.client_secret_expires_at;}
    registrationResponse=new Response(JSON.stringify(data),{status:201,headers:{'Content-Type':'application/json'}});
  }
  const registration=await oauth.processDynamicClientRegistrationResponse(registrationResponse);
  if(registration.token_endpoint_auth_method!=='none')throw Error('平台暂不支持设备独立登录，请联系管理员。');
  const client={client_id:registration.client_id,token_endpoint_auth_method:'none'};
  const state=oauth.generateRandomState(),nonce=oauth.generateRandomNonce(),verifier=oauth.generateRandomCodeVerifier();
  const url=new URL(as.authorization_endpoint);
  url.search=new URLSearchParams({client_id:client.client_id,redirect_uri:redirectUri,response_type:'code',scope:'openid profile api-inference',state,nonce,code_challenge:await oauth.calculatePKCECodeChallenge(verifier),code_challenge_method:'S256'}).toString();
  return {url:url.href,async complete(callback){
    const params=oauth.validateAuthResponse(as,client,new URL(callback),state);
    const result=await oauth.authorizationCodeGrantRequest(as,client,oauth.None(),params,redirectUri,verifier,{signal:AbortSignal.timeout(20000)});
    const tokens=await oauth.processAuthorizationCodeResponse(as,client,result,{expectedNonce:nonce,requireIdToken:true});
    await oauth.validateApplicationLevelSignature(as,result);
    return {client,accessToken:tokens.access_token,refreshToken:tokens.refresh_token,expiresAt:Date.now()+Number(tokens.expires_in||3600)*1000};
  }};
}
export async function refreshPlatformLogin(saved){
  if(saved.expiresAt>Date.now()+60000)return saved;
  if(!saved.refreshToken)throw Error('魔搭登录已到期，请重新连接。');
  const as=await metadata();
  const response=await oauth.refreshTokenGrantRequest(as,saved.client,oauth.None(),saved.refreshToken,{signal:AbortSignal.timeout(20000)});
  const tokens=await oauth.processRefreshTokenResponse(as,saved.client,response);
  return {...saved,accessToken:tokens.access_token,refreshToken:tokens.refresh_token||saved.refreshToken,expiresAt:Date.now()+Number(tokens.expires_in||3600)*1000};
}
