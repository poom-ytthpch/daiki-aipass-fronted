import {redirect} from 'next/navigation';
import {getAdminAccess} from '@/lib/admin';
import {AdminGuestDetail} from '@/components/AdminGuestDetail';
function decodeParam(value:string){try{return decodeURIComponent(value)}catch{return value}}
export default async function Page({params}:{params:Promise<{guestSubject:string}>}){const a=await getAdminAccess();if(!a.authenticated)redirect('/login');if(!a.admin)redirect('/chat');const raw=await params;return <AdminGuestDetail guestSubject={decodeParam(raw.guestSubject)}/>}
