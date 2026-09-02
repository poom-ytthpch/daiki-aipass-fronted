import {proxyBackend} from '@/lib/backend';

export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return proxyBackend(`/v1/admin/api-keys/${encodeURIComponent(id)}/quota`);
}
export async function PUT(req:Request,{params}:{params:Promise<{id:string}>}){
  const {id}=await params;
  return proxyBackend(`/v1/admin/api-keys/${encodeURIComponent(id)}/quota`,req);
}
