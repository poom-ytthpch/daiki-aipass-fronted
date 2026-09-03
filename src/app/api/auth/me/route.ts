import {refreshSession} from '@/lib/auth';
export async function GET(){
  const session=await refreshSession(false);
  if(!session)return Response.json({authenticated:false},{status:401});
  const {sub,name,email,emailVerified,roles,exp,refreshExp}=session;
  return Response.json({authenticated:true,user:{sub,name,email,emailVerified,roles,exp,refreshExp}});
}
