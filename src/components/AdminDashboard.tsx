'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';

type Service={name:string;status:string;latencyMs?:number|null};
type Summary={users?:number;pending?:number;approved?:number;totalTokens?:number;services?:Service[]};
type Queue={globalActive?:number;queued?:Record<string,number>};

export function AdminDashboard(){
  const [summary,setSummary]=useState<Summary>({});
  const [queue,setQueue]=useState<Queue>({});
  useEffect(()=>{void Promise.all([fetch('/api/admin/summary',{cache:'no-store'}),fetch('/api/admin/queues',{cache:'no-store'})]).then(async([s,q])=>{if(s.ok)setSummary(await s.json());if(q.ok)setQueue(await q.json())}).catch(()=>{})},[]);
  const waiting=Object.values(queue.queued||{}).reduce((a,b)=>a+b,0);
  return <>
    <div className="top"><div><div className="h1">Admin Dashboard</div><div className="muted">Users, usage, access and platform operations</div></div><span className="pill"><span className="dot"/>Administrator</span></div>
    <div className="grid cards">
      <Metric label="Users" value={summary.users??0} detail={`${summary.pending??0} pending approval`}/>
      <Metric label="Approved" value={summary.approved??0} detail="Full AI access"/>
      <Metric label="Total tokens" value={new Intl.NumberFormat().format(summary.totalTokens??0)} detail="Completed usage ledger"/>
      <Metric label="Queue" value={queue.globalActive??0} detail={`${waiting} waiting`}/>
    </div>
    <div className="adminQuickGrid">
      <Link className="card adminQuick" href="/admin/users"><strong>Users</strong><span>Create, approve, assign roles and quota</span></Link>
      <Link className="card adminQuick" href="/admin/tokens"><strong>Tokens</strong><span>Default entitlement and usage policy</span></Link>
      <Link className="card adminQuick" href="/admin/api-keys"><strong>API Keys</strong><span>Generate, expire, quota and revoke keys</span></Link>
      <Link className="card adminQuick" href="/admin/system"><strong>System</strong><span>Queue and service health</span></Link>
      <Link className="card adminQuick" href="/admin/usage"><strong>Usage</strong><span>Token usage by each user</span></Link>
      <Link className="card adminQuick" href="/admin/audit"><strong>Audit</strong><span>Review administrative changes</span></Link>
    </div>
    <section className="card" style={{marginTop:16}}><div className="sectionHead"><h3>Services</h3><span className="muted small">Live health</span></div>{(summary.services||[]).map(s=><div className="healthRow" key={s.name}><span>{s.name}</span><span className={`status ${s.status}`}>{s.status}{s.latencyMs!=null?` · ${s.latencyMs}ms`:''}</span></div>)}</section>
  </>;
}
function Metric({label,value,detail}:{label:string;value:string|number;detail:string}){return <div className="card"><div className="muted small">{label}</div><div className="kpi">{value}</div><div className="muted small">{detail}</div></div>}
