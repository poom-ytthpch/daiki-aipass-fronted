import {proxyBackend} from '@/lib/backend';
export async function GET(_req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyBackend(`/v1/chat-sessions/${encodeURIComponent(id)}`)}
export async function PATCH(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyBackend(`/v1/chat-sessions/${encodeURIComponent(id)}`,req)}
export async function DELETE(_req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyBackend(`/v1/chat-sessions/${encodeURIComponent(id)}`,new Request(_req.url,{method:'DELETE'}))}
