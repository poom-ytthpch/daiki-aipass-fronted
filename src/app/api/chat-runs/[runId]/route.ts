import {proxyBackend} from '@/lib/backend';
export async function GET(req:Request,{params}:{params:Promise<{runId:string}>}){const {runId}=await params;return proxyBackend(`/v1/chat-runs/${encodeURIComponent(runId)}`,req)}
export async function PATCH(req:Request,{params}:{params:Promise<{runId:string}>}){const {runId}=await params;return proxyBackend(`/v1/chat-runs/${encodeURIComponent(runId)}`,req)}
