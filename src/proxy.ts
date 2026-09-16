import {NextRequest,NextResponse} from 'next/server';
export function proxy(req:NextRequest){
  const p=req.nextUrl.pathname;const hasSession=Boolean(req.cookies.get('daiki_session'));
  if(p.startsWith('/login'))return hasSession?NextResponse.redirect(new URL('/',req.url)):NextResponse.next();
  if(p.startsWith('/forgot-password')||p.startsWith('/reset-password')||p==='/api/auth/password-reset')return NextResponse.next();
  if(p==='/api/health')return NextResponse.next();
  if(p.startsWith('/api/auth')||p.startsWith('/_next')||p==='/favicon.ico')return NextResponse.next();
  // Chat is the public landing surface. The server-side /api/chat route decides
  // whether to use the authenticated quota path or the restricted Guest path.
  if(p==='/'||p==='/chat'||p==='/api/chat'||p==='/api/account'||p.startsWith('/api/guest/'))return NextResponse.next();
  if(!hasSession){
    // Keep API semantics intact. A redirect is followed by fetch and becomes
    // HTTP 200 + text/html, which makes client pages treat an expired session
    // as a successful API response and then fail while decoding JSON.
    if(p.startsWith('/api/')){
      return NextResponse.json({error:'Unauthorized'},{status:401,headers:{'cache-control':'no-store'}});
    }
    return NextResponse.redirect(new URL('/login',req.url));
  }
  return NextResponse.next();
}
export const config={matcher:['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
