import {getSession} from '@/lib/auth';
export async function GET(){const session=await getSession();return session?Response.json({authenticated:true,user:session}):Response.json({authenticated:false},{status:401})}
