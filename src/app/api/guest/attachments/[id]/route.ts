import {proxyPublicBackend} from '@/lib/backend';
export const runtime='nodejs';
export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyPublicBackend(`/v1/guest/attachments/${encodeURIComponent(id)}`,req)}
export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;return proxyPublicBackend(`/v1/guest/attachments/${encodeURIComponent(id)}`,req)}
