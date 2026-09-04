import {proxyBackend} from '@/lib/backend';
export async function POST(req:Request){return proxyBackend('/v1/quota-resets/use',req)}
