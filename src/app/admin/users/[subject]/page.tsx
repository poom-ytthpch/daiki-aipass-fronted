import {AdminUserDetail} from '@/components/AdminUserDetail';

export default async function AdminUserDetailPage({params}:{params:Promise<{subject:string}>}){
  const {subject}=await params;
  return <AdminUserDetail subject={subject}/>;
}
