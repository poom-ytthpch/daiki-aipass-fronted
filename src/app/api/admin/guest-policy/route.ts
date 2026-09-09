import {proxyBackend} from '@/lib/backend';
export async function GET(){return proxyBackend('/v1/admin/guest-policy')}
export async function PUT(req:Request){return proxyBackend('/v1/admin/guest-policy',req)}
