import {proxyPublicBackend} from '@/lib/backend';
export async function POST(req:Request){return proxyPublicBackend('/v1/guest/generate/image',req)}
