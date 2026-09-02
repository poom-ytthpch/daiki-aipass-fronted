import {redirect} from 'next/navigation';import {getSession,isAdmin} from '@/lib/auth';import {AdminUsers} from '@/components/AdminUsers';
export default async function Page(){const s=await getSession();if(!s)redirect('/login');if(!isAdmin(s))redirect('/chat');return <AdminUsers/>}
