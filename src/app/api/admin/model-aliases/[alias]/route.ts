import {proxyBackend} from '@/lib/backend';
export async function PUT(req:Request,{params}:{params:Promise<{alias:string}>}){const {alias}=await params;return proxyBackend(`/v1/admin/model-aliases/${encodeURIComponent(alias)}`,req)}
