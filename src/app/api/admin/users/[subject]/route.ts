import {proxyBackend} from '@/lib/backend';

export async function GET(req:Request,{params}:{params:Promise<{subject:string}>}){
  const {subject}=await params;
  const url=new URL(req.url);
  const period=url.searchParams.get('period')||'month';
  return proxyBackend(`/v1/admin/users/${encodeURIComponent(subject)}?period=${encodeURIComponent(period)}`);
}
