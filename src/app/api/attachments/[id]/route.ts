import {proxyBackend} from '@/lib/backend';

export const runtime='nodejs';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return proxyBackend(`/v1/attachments/${encodeURIComponent(id)}`);
}

export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return proxyBackend(`/v1/attachments/${encodeURIComponent(id)}`,new Request('http://local',{method:'DELETE'}));
}
