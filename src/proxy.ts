import {NextRequest,NextResponse} from 'next/server';
export function proxy(req:NextRequest){
  const p=req.nextUrl.pathname;const hasSession=Boolean(req.cookies.get('daiki_session'));
  if(p.startsWith('/login'))return hasSession?NextResponse.redirect(new URL('/',req.url)):NextResponse.next();
  if(p.startsWith('/forgot-password')||p.startsWith('/reset-password')||p==='/api/auth/password-reset')return NextResponse.next();
  if(p.startsWith('/api/auth')||p.startsWith('/_next')||p==='/favicon.ico')return NextResponse.next();
  if(!hasSession)return NextResponse.redirect(new URL('/login',req.url));
  return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
