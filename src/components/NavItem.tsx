'use client';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {CircleGauge,Info,MessageCircle,Settings,ShieldCheck,Sparkles,UserRound,UsersRound,Activity} from 'lucide-react';

const icons={chat:MessageCircle,plan:Sparkles,info:Info,settings:Settings,account:UserRound,dashboard:CircleGauge,users:UsersRound,usage:Activity,system:ShieldCheck} as const;
export type NavIcon=keyof typeof icons;
export function NavItem({href,label,icon}:{href:string;label:string;icon:NavIcon}){
  const pathname=usePathname();const Icon=icons[icon];
  const active=pathname===href||(href!=='/admin'&&href!=='/'&&pathname.startsWith(`${href}/`));
  return <Link className={`navItem ${active?'active':''}`} href={href}><Icon size={17} strokeWidth={1.8}/><span>{label}</span></Link>;
}
