import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
export default async function Home(){const a=await getAdminAccess();if(!a.authenticated)redirect('/login');redirect(a.admin?'/admin':'/chat')}
