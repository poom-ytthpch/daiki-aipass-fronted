import {proxyBackend} from '@/lib/backend';
export async function GET(){return proxyBackend('/v1/admin/queues')}
