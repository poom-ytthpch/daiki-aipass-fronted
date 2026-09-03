import {getSession,isAdmin} from '@/lib/auth';
import {backendFetch} from '@/lib/backend';
import {NavIcon} from '@/components/NavItem';
import {AppShellClient} from '@/components/AppShellClient';

type Me={status?:'pending'|'approved'|'suspended'|'rejected';isAdmin?:boolean};
type Item={label:string;href:string;icon:NavIcon};
const userNav:Item[]=[
  {label:'Chat',href:'/chat',icon:'chat'},
  {label:'Plan',href:'/plan',icon:'plan'},
  {label:'Usage',href:'/usage',icon:'usage'},
  {label:'Settings',href:'/settings',icon:'settings'},
  {label:'Info',href:'/info',icon:'info'},
  {label:'Account',href:'/account',icon:'account'},
];
const adminNav:Item[]=[
  {label:'Dashboard',href:'/admin',icon:'dashboard'},
  {label:'Users',href:'/admin/users',icon:'users'},
  {label:'Tokens',href:'/admin/tokens',icon:'tokens'},
  {label:'API Keys',href:'/admin/api-keys',icon:'keys'},
  {label:'Usage',href:'/admin/usage',icon:'usage'},
  {label:'System',href:'/admin/system',icon:'system'},
  {label:'Providers',href:'/admin/providers',icon:'providers'},
  {label:'Email',href:'/admin/email',icon:'settings'},
  {label:'Audit',href:'/admin/audit',icon:'audit'},
];
export async function AppShell({children}:{children:React.ReactNode}){
  const session=await getSession();
  if(!session)return <>{children}</>;
  let me:Me={};
  try{const r=await backendFetch('/v1/me');if(r.ok)me=await r.json() as Me}catch{}
  const admin=Boolean(me.isAdmin)||isAdmin(session);
  const blocked=me.status==='suspended'||me.status==='rejected';
  const workspace=blocked?userNav.filter(x=>['Info','Account'].includes(x.label)):userNav;
  return <AppShellClient admin={admin} adminNav={adminNav} workspace={workspace} homeHref={admin?'/admin':'/chat'} name={session.name} status={me.status||'user'}>{children}</AppShellClient>;
}
