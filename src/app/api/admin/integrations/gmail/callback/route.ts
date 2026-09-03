import {NextRequest,NextResponse} from 'next/server';
import {backendFetch} from '@/lib/backend';
export async function GET(req:NextRequest){
  const code=req.nextUrl.searchParams.get('code');const state=req.nextUrl.searchParams.get('state');const error=req.nextUrl.searchParams.get('error');
  if(error||!code||!state)return NextResponse.redirect(new URL('/admin/email?gmail=denied',req.url));
  try{const r=await backendFetch('/v1/admin/integrations/gmail/callback',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code,state})});return NextResponse.redirect(new URL(r.ok?'/admin/email?gmail=connected':'/admin/email?gmail=failed',req.url))}catch{return NextResponse.redirect(new URL('/admin/email?gmail=failed',req.url))}
}
