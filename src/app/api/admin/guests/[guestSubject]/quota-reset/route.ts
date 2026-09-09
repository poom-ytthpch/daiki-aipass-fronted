import {proxyBackend} from '@/lib/backend';
export async function POST(req:Request,{params}:{params:Promise<{guestSubject:string}>}){const {guestSubject}=await params;return proxyBackend(`/v1/admin/guests/${encodeURIComponent(guestSubject)}/quota-reset`,req)}
