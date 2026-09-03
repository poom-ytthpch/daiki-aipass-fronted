import {proxyBackend} from '@/lib/backend';
export async function PUT(req:Request,{params}:{params:Promise<{subject:string}>}){const {subject}=await params;return proxyBackend(`/v1/admin/users/${encodeURIComponent(subject)}/roles`,req)}
