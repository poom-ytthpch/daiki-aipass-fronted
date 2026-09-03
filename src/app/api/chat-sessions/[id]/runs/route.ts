import {proxyBackend} from '@/lib/backend';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyBackend(`/v1/chat-sessions/${encodeURIComponent(id)}/runs/latest`,req)}
export async function POST(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyBackend(`/v1/chat-sessions/${encodeURIComponent(id)}/runs`,req)}
