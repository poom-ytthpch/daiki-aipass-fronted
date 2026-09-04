import {proxyBackend} from '@/lib/backend';
export async function GET(){return proxyBackend('/v1/quota-resets')}
