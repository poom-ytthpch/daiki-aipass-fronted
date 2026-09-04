'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ChevronLeft,ChevronRight,LogOut,Menu,X} from 'lucide-react';
import {useEffect,useState} from 'react';
import {NavItem,NavIcon} from '@/components/NavItem';

type Item={label:string;href:string;icon:NavIcon};

type Props={
  children:React.ReactNode;
  admin:boolean;
  adminNav:Item[];
  workspace:Item[];
  homeHref:string;
  name:string;
  status:string;
};

export function AppShellClient({children,admin,adminNav,workspace,homeHref,name,status}:Props){
  const pathname=usePathname();
  const inChat=pathname==='/chat';
  const [drawer,setDrawer]=useState(false);
  const [collapsed,setCollapsed]=useState(false);
  useEffect(()=>{const t=window.setTimeout(()=>setDrawer(false),0);return()=>window.clearTimeout(t)},[pathname]);
  useEffect(()=>{const t=window.setTimeout(()=>{try{setCollapsed(localStorage.getItem('daiki_sidebar_collapsed')==='1')}catch{}},0);return()=>window.clearTimeout(t)},[]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')setDrawer(false)};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
  useEffect(()=>{const open=()=>setDrawer(true);const close=()=>setDrawer(false);window.addEventListener('daiki-open-navigation',open);window.addEventListener('daiki-close-navigation',close);return()=>{window.removeEventListener('daiki-open-navigation',open);window.removeEventListener('daiki-close-navigation',close)}},[]);
  const toggleCollapsed=()=>setCollapsed(v=>{const next=!v;try{localStorage.setItem('daiki_sidebar_collapsed',next?'1':'0')}catch{}return next});
  return <div className={`shell appShell ${collapsed&&!inChat?'shellCollapsed':''} ${inChat?'chatShell':''}`}>
    <header className="mobileTopbar">
      <button className="iconButton" type="button" aria-label="Open navigation" onClick={()=>setDrawer(true)}><Menu size={21}/></button>
      <Link href={homeHref} className="mobileBrand"><strong>Daiki<span>●</span></strong><small>AI Passport</small></Link>
      <Link className="mobileAvatar" href="/account" aria-label="Account">{name.slice(0,1).toUpperCase()}</Link>
    </header>
    {drawer?<button className="sidebarBackdrop" aria-label="Close navigation" onClick={()=>setDrawer(false)}/>:null}
    <aside className={`sidebar appSidebar ${drawer?'drawerOpen':''}`}>
      <div className="sidebarHeader">
        <Link href={homeHref} className="brand" aria-label="Daiki AI Passport home">
          <span className="brandWord">Daiki<span className="brandDot">●</span></span>
          <span className="brandSub">AI Passport</span>
        </Link>
        {!inChat?<button className="collapseButton" type="button" aria-label={collapsed?'Expand sidebar':'Collapse sidebar'} onClick={toggleCollapsed}>{collapsed?<ChevronRight size={17}/>:<ChevronLeft size={17}/>}</button>:null}
        <button className="drawerClose" type="button" aria-label="Close navigation" onClick={()=>setDrawer(false)}><X size={19}/></button>
      </div>
      <div className="sidebarScroll">
        {inChat?<div id="chat-sidebar-slot" className="chatSidebarSlot"/>:null}
        <div className="navGroup"><div className="navLabel">Workspace</div><nav className="nav">{workspace.map(x=><NavItem key={x.href} {...x}/>)}</nav></div>
        {admin?<div className="navGroup"><div className="navLabel">Admin</div><nav className="nav">{adminNav.map(x=><NavItem key={x.href} {...x}/>)}</nav></div>:null}
      </div>
      <div className="profile">
        <Link className="profileMain" href="/account"><div className="avatar">{name.slice(0,1).toUpperCase()}</div><div className="profileCopy"><strong>{name}</strong><span>{admin?'Administrator':status}</span></div></Link>
        <a className="signout iconButton" href="/api/auth/logout" aria-label="Sign out" title="Sign out"><LogOut size={17}/></a>
      </div>
    </aside>
    <main className="main">{children}</main>
  </div>;
}
