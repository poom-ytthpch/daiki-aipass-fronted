import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import {AdminGuestDetail} from '@/components/AdminGuestDetail';
export default async function Page({params}:{params:Promise<{guestSubject:string}>}){const a=await getAdminAccess();if(!a.authenticated)redirect('/login');if(!a.admin)redirect('/chat');const {guestSubject}=await params;return <AdminGuestDetail guestSubject={guestSubject}/>}
