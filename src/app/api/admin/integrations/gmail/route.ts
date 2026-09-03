import {proxyBackend} from '@/lib/backend';
export async function GET(){return proxyBackend('/v1/admin/integrations/gmail')}
export async function DELETE(){return proxyBackend('/v1/admin/integrations/gmail',new Request('http://local',{method:'DELETE'}))}
