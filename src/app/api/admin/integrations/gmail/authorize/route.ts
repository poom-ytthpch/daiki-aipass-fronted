import {proxyBackend} from '@/lib/backend';
export async function POST(){return proxyBackend('/v1/admin/integrations/gmail/authorize',new Request('http://local',{method:'POST'}))}
