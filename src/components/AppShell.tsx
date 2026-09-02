import Link from 'next/link';
import {getSession,isAdmin} from '@/lib/auth';
import {backendFetch} from '@/lib/backend';

type Me={status?:'pending'|'approved'|'suspended'|'rejected'};

export async function AppShell({children}:{children:React.ReactNode}){
  const session=await getSession();
  if(!session)return <>{children}</>;
  let status:Me['status'];
  try{
    const r=await backendFetch('/v1/me');
    if(r.ok)status=((await r.json()) as Me).status;
  }catch{}
  const nav:[string,string][]=status==='approved'
    ? [['Dashboard','/'],['Chat','/chat'],['Models','/models'],['Usage','/usage'],['Account','/account'],['Settings','/settings']]
    : status==='pending'
      ? [['Chat','/chat'],['Account','/account']]
      : [['Account','/account']];
  if(isAdmin(session))nav.splice(Math.max(0,nav.length-1),0,['Admin','/admin']);
  return <div className="shell"><aside className="sidebar"><div className="brand"><div className="logo">D</div><div>Daiki AI<br/><span className="muted small">Passport</span></div></div><div className="nav">{nav.map(([n,h])=><Link key={h} href={h}>◈ &nbsp;{n}</Link>)}</div><div className="profile card"><div className="profileRow"><div className="avatar">{session.name.slice(0,1).toUpperCase()}</div><div><div className="profileName">{session.name}</div><div className="muted small">{isAdmin(session)?'Administrator':status||'User'}</div></div></div><a className="logout" href="/api/auth/logout">Sign out</a></div></aside><main className="main">{children}</main></div>;
}
