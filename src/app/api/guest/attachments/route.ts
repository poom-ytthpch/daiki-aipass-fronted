import {proxyPublicBackend} from '@/lib/backend';
export const runtime='nodejs';
export async function GET(req:Request){return proxyPublicBackend('/v1/guest/attachments',req)}
export async function POST(req:Request){return proxyPublicBackend('/v1/guest/attachments',req)}
