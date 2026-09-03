import {proxyBackend} from '@/lib/backend';
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyBackend(`/v1/admin/provider-models/${encodeURIComponent(id)}`,req)}
