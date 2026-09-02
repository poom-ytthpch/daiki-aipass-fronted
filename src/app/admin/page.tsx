import {redirect} from 'next/navigation';import {getSession,isAdmin} from '@/lib/auth';import {AdminDashboard} from '@/components/AdminDashboard';
export default async function Admin(){const s=await getSession();if(!s)redirect('/login');if(!isAdmin(s))redirect('/chat');return <AdminDashboard/>}
