import {redirect} from 'next/navigation';
import {getSession,isAdmin} from '@/lib/auth';
import {backendFetch} from '@/lib/backend';

type Me={isAdmin?:boolean};
export default async function Home(){
  const session=await getSession();
  if(!session)redirect('/login');
  let admin=isAdmin(session);
  try{const r=await backendFetch('/v1/me');if(r.ok)admin=admin||Boolean(((await r.json()) as Me).isAdmin)}catch{}
  redirect(admin?'/admin':'/chat');
}
