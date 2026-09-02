import {backendFetch} from '@/lib/backend';
import {getSession,isAdmin} from '@/lib/auth';

export async function getAdminAccess(){
  const session=await getSession();
  if(!session)return {authenticated:false,admin:false};
  if(isAdmin(session))return {authenticated:true,admin:true};
  try{
    const r=await backendFetch('/v1/me');
    if(r.ok){const me=await r.json() as {isAdmin?:boolean};return {authenticated:true,admin:Boolean(me.isAdmin)}}
  }catch{}
  return {authenticated:true,admin:false};
}
