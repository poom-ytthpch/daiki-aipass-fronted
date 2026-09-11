import {proxyBackend} from '@/lib/backend';
export async function GET(req:Request,{params}:{params:Promise<{guestSubject:string}>}){
  const {guestSubject}=await params;const url=new URL(req.url);const deviceId=url.searchParams.get('deviceId')||'';
  return proxyBackend(`/v1/admin/guests/${encodeURIComponent(guestSubject)}${deviceId?`?deviceId=${encodeURIComponent(deviceId)}`:''}`);
}
