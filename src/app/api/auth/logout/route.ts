import {NextResponse} from 'next/server';
import {clearSession,oidc} from '@/lib/auth';
export async function GET(){
  await clearSession();
  const guestChat=new URL('/chat',oidc.publicBase());
  const issuer=oidc.issuer();
  if(!issuer)return NextResponse.redirect(guestChat);
  const u=new URL(`${issuer.replace(/\/$/,'')}/protocol/openid-connect/logout`);
  u.searchParams.set('client_id',oidc.clientId());
  u.searchParams.set('post_logout_redirect_uri',guestChat.toString());
  return NextResponse.redirect(u);
}
