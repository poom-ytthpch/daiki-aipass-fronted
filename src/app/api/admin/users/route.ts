import {proxyBackend} from '@/lib/backend';
export async function GET(){return proxyBackend('/v1/admin/users')}
export async function POST(req:Request){return proxyBackend('/v1/admin/users',req)}
