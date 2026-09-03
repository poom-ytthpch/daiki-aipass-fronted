import {proxyBackend} from '@/lib/backend';
export async function PATCH(req:Request,{params}:{params:Promise<{id:string;messageId:string}>}){const {id,messageId}=await params;return proxyBackend(`/v1/chat-sessions/${encodeURIComponent(id)}/messages/${encodeURIComponent(messageId)}`,req)}
