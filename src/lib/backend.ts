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

export async function proxyBackend(path:string,req?:Request){
  try{
    const init:RequestInit={method:req?.method||'GET'};
    if(req&& !['GET','HEAD'].includes(req.method)) init.body=await req.text();
    const upstream=await backendFetch(path,init);
    const headers=new Headers();
    for(const name of ['content-type','cache-control','x-accel-buffering','x-daiki-request-id','x-daiki-research-used','x-daiki-research-sources','x-daiki-research-mode','x-daiki-model-alias','x-daiki-skills','x-daiki-tools','x-daiki-thinking-mode','x-daiki-token-estimate-input','x-daiki-token-estimate-thinking','x-daiki-token-estimate-output','x-daiki-token-estimate-total']){const value=upstream.headers.get(name);if(value)headers.set(name,value)}
    return new Response(upstream.body,{status:upstream.status,headers});
  }catch(e){
    const message=e instanceof Error?e.message:String(e);
    return Response.json({error:message},{status:message==='Unauthorized'?401:502});
  }
}
