import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import {AdminUsers} from '@/components/AdminUsers';
export default async function Page(){const a=await getAdminAccess();if(!a.authenticated)redirect('/login');if(!a.admin)redirect('/chat');return <AdminUsers/>}
