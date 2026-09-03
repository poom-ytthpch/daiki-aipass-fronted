import {getSession,isAdmin} from '@/lib/auth';
import {backendFetch} from '@/lib/backend';
import {NavItem,NavIcon} from '@/components/NavItem';

type Me={status?:'pending'|'approved'|'suspended'|'rejected';isAdmin?:boolean};
type Item={label:string;href:string;icon:NavIcon};
const userNav:Item[]=[
  {label:'Chat',href:'/chat',icon:'chat'},
  {label:'Plan',href:'/plan',icon:'plan'},
  {label:'Info',href:'/info',icon:'info'},
  {label:'Settings',href:'/settings',icon:'settings'},
  {label:'Account',href:'/account',icon:'account'},
];
const adminNav:Item[]=[
  {label:'Dashboard',href:'/admin',icon:'dashboard'},
  {label:'Users',href:'/admin/users',icon:'users'},
  {label:'Usage',href:'/admin/usage',icon:'usage'},
  {label:'System',href:'/admin/system',icon:'system'},
  {label:'Email',href:'/admin/email',icon:'settings'},
];

export async function AppShell({children}:{children:React.ReactNode}){
  const session=await getSession();
  if(!session)return <>{children}</>;
  let me:Me={};
  try{const r=await backendFetch('/v1/me');if(r.ok)me=await r.json() as Me}catch{}
  const admin=Boolean(me.isAdmin)||isAdmin(session);
  const blocked=me.status==='suspended'||me.status==='rejected';
  const workspace=blocked?userNav.filter(x=>['Info','Account'].includes(x.label)):userNav;
  return <div className="shell">
    <aside className="sidebar">
      <a href={admin?'/admin':'/chat'} className="brand" aria-label="Daiki AI Passport home">
        <span className="brandWord">Daiki<span className="brandDot">●</span></span>
        <span className="brandSub">AI Passport</span>
      </a>
      {admin&&<div className="navGroup"><div className="navLabel">Admin</div><nav className="nav">{adminNav.map(x=><NavItem key={x.href} {...x}/>)}</nav></div>}
      <div className="navGroup"><div className="navLabel">Workspace</div><nav className="nav">{workspace.map(x=><NavItem key={x.href} {...x}/>)}</nav></div>
      <div className="profile">
        <div className="avatar">{session.name.slice(0,1).toUpperCase()}</div>
        <div className="profileCopy"><strong>{session.name}</strong><span>{admin?'Administrator':me.status||'User'}</span></div>
        <a className="signout" href="/api/auth/logout">Sign out</a>
      </div>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
