import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import {AdminDashboard} from '@/components/AdminDashboard';
export default async function Admin(){const a=await getAdminAccess();if(!a.authenticated)redirect('/login');if(!a.admin)redirect('/chat');return <AdminDashboard/>}
