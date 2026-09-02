import {getSession,isAdmin} from '@/lib/auth';

export async function requireUser(){
  const session=await getSession();
  if(!session) throw new Error('Unauthorized');
  return session;
}

export async function requireAdmin(){
  const session=await requireUser();
  if(!isAdmin(session)) throw new Error('Forbidden');
  return session;
}
