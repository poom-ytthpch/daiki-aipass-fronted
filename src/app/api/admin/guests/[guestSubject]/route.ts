import {proxyBackend} from '@/lib/backend';
function decodeParam(value:string){try{return decodeURIComponent(value)}catch{return value}}
export async function GET(req:Request,{params}:{params:Promise<{guestSubject:string}>}){
  const raw=await params;const guestSubject=decodeParam(raw.guestSubject);const url=new URL(req.url);const deviceId=url.searchParams.get('deviceId')||'';
  return proxyBackend(`/v1/admin/guests/${encodeURIComponent(guestSubject)}${deviceId?`?deviceId=${encodeURIComponent(deviceId)}`:''}`);
}
