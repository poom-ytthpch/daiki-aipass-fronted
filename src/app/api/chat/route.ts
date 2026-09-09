import {getSession} from '@/lib/auth';
import {proxyBackend,proxyPublicBackend} from '@/lib/backend';
export const runtime='nodejs';
export async function POST(req:Request){
  const body=await req.clone().json().catch(()=>({})) as {stream?:boolean};
  const session=await getSession();
  const path=body.stream===false?'/chat':'/chat/stream';
  return session?proxyBackend(`/v1${path}`,req):proxyPublicBackend(`/v1/guest${path}`,req);
}
