'use client';
import {useCallback,useEffect,useMemo,useState} from 'react';
import {QuotaPolicyFields,defaultQuotaPolicy,quotaPolicyPayload,type QuotaPolicy} from './QuotaPolicyFields';

type UsageRow={subject:string;email?:string;displayName?:string;status:string;totalTokens:number;requests:number};

export function AdminTokens(){
  const [policy,setPolicy]=useState<QuotaPolicy>(defaultQuotaPolicy);const [rows,setRows]=useState<UsageRow[]>([]);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('');
  const load=useCallback(async()=>{const [p,u]=await Promise.all([fetch('/api/admin/token-policy',{cache:'no-store'}),fetch('/api/admin/usage',{cache:'no-store'})]);if(p.ok){const d=await p.json();const next=d.policy||{};setPolicy({...defaultQuotaPolicy,...next,parallelLimits:Array.isArray(next.parallelLimits)?next.parallelLimits:[]})}if(u.ok)setRows(await u.json())},[]);
  useEffect(()=>{const t=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(t)},[load]);
  const total=useMemo(()=>rows.reduce((n,r)=>n+(r.totalTokens||0),0),[rows]);
  const save=async()=>{setBusy(true);setMessage('');const payload={...quotaPolicyPayload(policy),allowedModels:['auto','fast','balanced','deep']};const r=await fetch('/api/admin/token-policy',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));setMessage(r.ok?'System token policy saved.':d.error||'Unable to save policy');if(r.ok)await load();setBusy(false)};
  return <><header className="pageHeader"><div><div className="eyebrow">Entitlements</div><h1>Token Settings</h1><p>Set the default token allowance inherited by users and API keys unless a more specific override exists.</p></div><button className="btn primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save policy'}</button></header>
  <div className="pastelGrid"><div className="pastelCard peach"><span>System mode</span><strong>{policy.quotaMode}</strong><small>default entitlement</small></div><div className="pastelCard sky"><span>Window</span><strong>{policy.intervalKind}</strong><small>reset interval</small></div><div className="pastelCard mint"><span>Total usage</span><strong>{new Intl.NumberFormat().format(total)}</strong><small>completed tokens</small></div></div>
  <section className="surface sectionGap"><div className="sectionHead"><div><h2>Default policy</h2><p className="muted small">User/API-key overrides take precedence over this system default.</p></div></div><QuotaPolicyFields policy={policy} onChange={setPolicy}/>{message?<div className="notice butter sectionGap">{message}</div>:null}</section>
  <section className="surface tableSurface sectionGap"><div className="sectionHead"><h2>Usage overview</h2><span className="muted small">Per-user overrides remain configurable from Users</span></div><div className="tableWrap"><table className="table"><thead><tr><th>User</th><th>Status</th><th>Requests</th><th>Total tokens</th></tr></thead><tbody>{rows.map(r=><tr key={r.subject}><td><strong>{r.displayName||r.email||r.subject}</strong><div className="muted small">{r.email||r.subject}</div></td><td><span className={`status status-${r.status}`}>{r.status}</span></td><td>{r.requests}</td><td><strong>{new Intl.NumberFormat().format(r.totalTokens||0)}</strong></td></tr>)}</tbody></table></div></section></>;
}
