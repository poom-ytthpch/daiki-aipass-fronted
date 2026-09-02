import {proxyBackend} from '@/lib/backend';

export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return proxyBackend(`/v1/admin/api-keys/${encodeURIComponent(id)}`,new Request('http://local',{method:'DELETE'}));
}
