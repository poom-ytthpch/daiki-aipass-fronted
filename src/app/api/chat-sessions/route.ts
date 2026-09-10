import {proxyBackend} from '@/lib/backend';
export async function GET(req:Request){
  const query=new URL(req.url).searchParams.get('q')?.trim()||'';
  return proxyBackend(`/v1/chat-sessions${query?`?q=${encodeURIComponent(query)}`:''}`);
}
export async function POST(req:Request){return proxyBackend('/v1/chat-sessions',req)}
