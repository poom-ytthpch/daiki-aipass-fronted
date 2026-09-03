import {proxyBackend} from '@/lib/backend';
export async function GET(){return proxyBackend('/v1/chat-sessions')}
export async function POST(req:Request){return proxyBackend('/v1/chat-sessions',req)}
