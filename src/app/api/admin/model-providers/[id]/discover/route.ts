import {proxyBackend} from '@/lib/backend';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyBackend(`/v1/admin/model-providers/${encodeURIComponent(id)}/discover`)}
