import {NextRequest,NextResponse} from 'next/server';
export function proxy(req:NextRequest){const p=req.nextUrl.pathname;if(p.startsWith('/login')||p.startsWith('/api/auth')||p.startsWith('/_next')||p==='/favicon.ico')return NextResponse.next();if(!req.cookies.get('daiki_session'))return NextResponse.redirect(new URL('/login',req.url));return NextResponse.next()}
export const config={matcher:['/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)']};
