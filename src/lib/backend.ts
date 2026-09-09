import {refreshSession} from '@/lib/auth';

const base=()=> (process.env.DAIKI_BACKEND_URL||'').replace(/\/$/,'');

export async function backendFetch(path:string,init:RequestInit={}){
  let session=await refreshSession(false);
  if(!session?.accessToken) throw new Error('Unauthorized');
  if(!base()) throw new Error('DAIKI_BACKEND_URL is not configured');
  const headers=new Headers(init.headers);
  headers.set('authorization',`Bearer ${session.accessToken}`);
  if(typeof init.body==='string'&&!headers.has('content-type')) headers.set('content-type','application/json');
  let response=await fetch(`${base()}${path}`,{...init,headers,cache:'no-store'});
  if(response.status===401){
    session=await refreshSession(true);
    if(!session?.accessToken) throw new Error('Unauthorized');
    headers.set('authorization',`Bearer ${session.accessToken}`);
    response=await fetch(`${base()}${path}`,{...init,headers,cache:'no-store'});
  }
  return response;
}

const responseHeaders=['content-type','content-disposition','cache-control','retry-after','x-accel-buffering','x-daiki-request-id','x-daiki-access-mode','x-daiki-inference-upstream','x-daiki-quota-mode','x-daiki-quota-remaining','x-daiki-quota-reset','x-daiki-research-used','x-daiki-research-sources','x-daiki-research-mode','x-daiki-model-alias','x-daiki-skills','x-daiki-tools','x-daiki-thinking-mode','x-daiki-token-estimate-input','x-daiki-token-estimate-thinking','x-daiki-token-estimate-output','x-daiki-token-estimate-total','x-daiki-model-physical','x-daiki-retry-attempts','x-daiki-context-trimmed','x-daiki-fallback-model'];
const copyResponseHeaders=(upstream:Response)=>{const headers=new Headers();for(const name of responseHeaders){const value=upstream.headers.get(name);if(value)headers.set(name,value)}return headers};
export async function proxyBackend(path:string,req?:Request){
  try{
    const init:RequestInit={method:req?.method||'GET'};
    if(req&& !['GET','HEAD'].includes(req.method)) init.body=await req.text();
    const upstream=await backendFetch(path,init);
    return new Response(upstream.body,{status:upstream.status,headers:copyResponseHeaders(upstream)});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    return Response.json({error:message},{status:message==='Unauthorized'?401:502});
  }
}
const cookieValue=(req:Request,name:string)=>{
  const raw=req.headers.get('cookie')||'';
  const prefix=`${name}=`;
  for(const part of raw.split(';')){const v=part.trim();if(v.startsWith(prefix)){try{return decodeURIComponent(v.slice(prefix.length))}catch{return v.slice(prefix.length)}}}
  return '';
};
export async function proxyPublicBackend(path:string,req?:Request){
  try{
    if(!base())throw new Error('DAIKI_BACKEND_URL is not configured');
    const headers=new Headers();
    if(req){
      const contentType=req.headers.get('content-type');if(contentType)headers.set('content-type',contentType);
      const userAgent=req.headers.get('user-agent');if(userAgent)headers.set('user-agent',userAgent);
      // Resolve the public network identity at the server boundary. Never trust a
      // browser-supplied IP identity; device metadata is descriptive only and quota
      // remains keyed by this server-resolved network fingerprint.
      const networkIP=req.headers.get('cf-connecting-ip')||req.headers.get('x-real-ip')||req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'';
      if(networkIP)headers.set('x-daiki-client-ip',networkIP);
      const deviceID=req.headers.get('x-daiki-guest-device-id')||cookieValue(req,'daiki_guest_device_id');
      const deviceName=req.headers.get('x-daiki-guest-device-name')||cookieValue(req,'daiki_guest_device_name');
      if(deviceID)headers.set('x-daiki-guest-device-id',deviceID);
      if(deviceName)headers.set('x-daiki-guest-device-name',deviceName);
    }
    const init:RequestInit={method:req?.method||'GET',headers,cache:'no-store'};
    if(req&&!['GET','HEAD'].includes(req.method))init.body=await req.arrayBuffer();
    const upstream=await fetch(`${base()}${path}`,init);
    return new Response(upstream.body,{status:upstream.status,headers:copyResponseHeaders(upstream)});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    return Response.json({error:message},{status:502});
  }
}
