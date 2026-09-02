import {proxyBackend} from '@/lib/backend';
export const runtime='nodejs';
export async function POST(req:Request){
  const body=await req.clone().json().catch(()=>({})) as {stream?:boolean};
  return proxyBackend(body.stream===false?'/v1/chat':'/v1/chat/stream',req);
}
