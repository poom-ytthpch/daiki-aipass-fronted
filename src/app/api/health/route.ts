const backend=()=> (process.env.DAIKI_BACKEND_URL||'').replace(/\/$/,'');

export async function GET(){
  const base=backend();
  if(!base){
    return Response.json({service:'daiki-ai-passport-frontend',status:'degraded',backend:'not-configured'},{status:503});
  }
  try{
    const upstream=await fetch(`${base}/v1/health/ready`,{cache:'no-store',signal:AbortSignal.timeout(5000)});
    const ready=upstream.ok;
    return Response.json({
      service:'daiki-ai-passport-frontend',
      status:ready?'ok':'degraded',
      backend:ready?'ready':`http-${upstream.status}`,
    },{status:ready?200:503,headers:{'cache-control':'no-store'}});
  }catch{
    return Response.json({service:'daiki-ai-passport-frontend',status:'degraded',backend:'unreachable'},{status:503,headers:{'cache-control':'no-store'}});
  }
}
