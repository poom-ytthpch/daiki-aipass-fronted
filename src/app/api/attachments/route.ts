import {backendFetch} from '@/lib/backend';

export const runtime='nodejs';

export async function GET(){
  try{
    const r=await backendFetch('/v1/attachments');
    return new Response(r.body,{status:r.status,headers:{'content-type':r.headers.get('content-type')||'application/json'}});
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:String(e)},{status:502});
  }
}

export async function POST(req:Request){
  try{
    const contentType=req.headers.get('content-type')||'';
    const body=await req.arrayBuffer();
    const r=await backendFetch('/v1/attachments',{method:'POST',headers:contentType?{'content-type':contentType}:undefined,body});
    return new Response(r.body,{status:r.status,headers:{'content-type':r.headers.get('content-type')||'application/json'}});
  }catch(e){
    return Response.json({error:e instanceof Error?e.message:String(e)},{status:502});
  }
}
