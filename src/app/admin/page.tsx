import {redirect} from 'next/navigation';import {getSession,isAdmin} from '@/lib/auth';import {AdminPanel} from '@/components/AdminPanel';
export default async function Admin(){const s=await getSession();if(!s)redirect('/login');if(!isAdmin(s))redirect('/');return <AdminPanel/>}
