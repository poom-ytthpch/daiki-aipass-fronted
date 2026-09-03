import {proxyBackend} from '@/lib/backend';
export async function POST(){return proxyBackend('/v1/admin/integrations/gmail/test',new Request('http://local',{method:'POST'}))}
