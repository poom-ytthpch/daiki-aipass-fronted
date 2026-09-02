import {proxyBackend} from '@/lib/backend';
export async function GET(){return proxyBackend('/v1/admin/api-keys')}
export async function POST(req:Request){return proxyBackend('/v1/admin/api-keys',req)}
