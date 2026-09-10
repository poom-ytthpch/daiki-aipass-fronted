import {proxyPublicBackend} from '@/lib/backend';

export async function GET(req:Request){return proxyPublicBackend('/v1/guest/capabilities',req)}
