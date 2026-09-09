'use client';

import {useCallback,useEffect,useMemo,useState} from 'react';
import {QuotaPolicyFields,defaultQuotaPolicy,quotaPolicyPayload,type QuotaPolicy} from './QuotaPolicyFields';

type WindowKind='hour'|'day'|'week'|'month'|'rolling'|'custom'|'lifetime';
type UsageRow={subject:string;email?:string;displayName?:string;status:string;totalTokens:number;requests:number};
type GuestUsage={inputTokens:number;outputTokens:number;totalTokens:number};
type GuestDeviceUsage={guestSubject:string;deviceId:string;deviceName?:string;requests:number;inputTokens:number;outputTokens:number;totalTokens:number;lastSeenAt:string;lastUsedAt?:string};
type GuestPolicy={
  enabled:boolean;tokenLimit:number;intervalKind:WindowKind;intervalSeconds?:number;requestsPerHour:number;minIntervalSeconds:number;maxCompletionTokens:number;fastModel:string;
  allowUploads:boolean;allowImageGeneration:boolean;allowFileGeneration:boolean;maxUploadBytes:number;maxUploadsPerHour:number;maxStoredFiles:number;maxStoredBytes:number;attachmentRetentionHours:number;
  imageGenerationsPerDay:number;fileGenerationsPerDay:number;maxGeneratedFileBytes:number;
};
const DEFAULT_GUEST:GuestPolicy={enabled:true,tokenLimit:4000,intervalKind:'day',requestsPerHour:6,minIntervalSeconds:45,maxCompletionTokens:384,fastModel:'fast',allowUploads:true,allowImageGeneration:true,allowFileGeneration:true,maxUploadBytes:10*1024*1024,maxUploadsPerHour:10,maxStoredFiles:20,maxStoredBytes:50*1024*1024,attachmentRetentionHours:24,imageGenerationsPerDay:3,fileGenerationsPerDay:5,maxGeneratedFileBytes:1024*1024};
const windows:WindowKind[]=['hour','day','week','month','rolling','custom','lifetime'];
const fmtBytes=(n:number)=>n>=1024*1024*1024?`${(n/1024/1024/1024).toFixed(1)} GB`:n>=1024*1024?`${(n/1024/1024).toFixed(1)} MB`:n>=1024?`${(n/1024).toFixed(1)} KB`:`${n} B`;
const shortGuest=(value:string)=>value.startsWith('guest:')?`guest:${value.slice(6,14)}…`:value;

export function AdminTokens(){
  const [policy,setPolicy]=useState<QuotaPolicy>(defaultQuotaPolicy);
  const [rows,setRows]=useState<UsageRow[]>([]);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState('');
  const [guest,setGuest]=useState<GuestPolicy>(DEFAULT_GUEST);
  const [guestUsage,setGuestUsage]=useState<GuestUsage>({inputTokens:0,outputTokens:0,totalTokens:0});
  const [guestRequests,setGuestRequests]=useState(0);
  const [guestDevices,setGuestDevices]=useState<GuestDeviceUsage[]>([]);
  const [guestBusy,setGuestBusy]=useState(false);
  const [guestMessage,setGuestMessage]=useState('');
  const [resettingGuest,setResettingGuest]=useState('');

  const load=useCallback(async()=>{
    const [p,u,g]=await Promise.all([fetch('/api/admin/token-policy',{cache:'no-store'}),fetch('/api/admin/usage',{cache:'no-store'}),fetch('/api/admin/guest-policy',{cache:'no-store'})]);
    if(p.ok){const d=await p.json();const next=d.policy||{};setPolicy({...defaultQuotaPolicy,...next,parallelLimits:Array.isArray(next.parallelLimits)?next.parallelLimits:[]})}
    if(u.ok)setRows(await u.json());
    if(g.ok){const d=await g.json();setGuest({...DEFAULT_GUEST,...(d.policy||{})});setGuestUsage({inputTokens:Number(d.usage?.inputTokens||0),outputTokens:Number(d.usage?.outputTokens||0),totalTokens:Number(d.usage?.totalTokens||0)});setGuestRequests(Number(d.requests||0));setGuestDevices(Array.isArray(d.devices)?d.devices:[])}
  },[]);
  useEffect(()=>{const t=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(t)},[load]);
  const total=useMemo(()=>rows.reduce((n,r)=>n+(r.totalTokens||0),0),[rows]);

  const save=async()=>{setBusy(true);setMessage('');const payload={...quotaPolicyPayload(policy),allowedModels:['auto','fast','balanced','deep']};const r=await fetch('/api/admin/token-policy',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));setMessage(r.ok?'System token policy saved.':d.error||'Unable to save policy');if(r.ok)await load();setBusy(false)};
  const saveGuest=async()=>{setGuestBusy(true);setGuestMessage('');const payload={...guest,tokenLimit:Number(guest.tokenLimit||0),requestsPerHour:Number(guest.requestsPerHour||1),minIntervalSeconds:Number(guest.minIntervalSeconds||0),maxCompletionTokens:Number(guest.maxCompletionTokens||1),maxUploadBytes:Number(guest.maxUploadBytes||1),maxUploadsPerHour:Number(guest.maxUploadsPerHour||1),maxStoredFiles:Number(guest.maxStoredFiles||1),maxStoredBytes:Number(guest.maxStoredBytes||1),attachmentRetentionHours:Number(guest.attachmentRetentionHours||1),imageGenerationsPerDay:Number(guest.imageGenerationsPerDay||0),fileGenerationsPerDay:Number(guest.fileGenerationsPerDay||0),maxGeneratedFileBytes:Number(guest.maxGeneratedFileBytes||1),intervalSeconds:['rolling','custom'].includes(guest.intervalKind)?Number(guest.intervalSeconds||3600):undefined,fastModel:'fast'};const r=await fetch('/api/admin/guest-policy',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));setGuestMessage(r.ok?'Guest access policy saved.':d.error||'Unable to save guest policy');if(r.ok)await load();setGuestBusy(false)};
  const resetGuest=async(subject:string)=>{setResettingGuest(subject);setGuestMessage('');const r=await fetch(`/api/admin/guests/${encodeURIComponent(subject)}/quota-reset`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({note:'Reset from Admin Token Settings'})});const d=await r.json().catch(()=>({}));setGuestMessage(r.ok?`Guest quota reset immediately for ${shortGuest(subject)}.`:d.error||'Unable to reset guest quota');if(r.ok)await load();setResettingGuest('')};

  return <>
    <header className="pageHeader"><div><div className="eyebrow">Entitlements</div><h1>Token Settings</h1><p>Control authenticated quotas and the public Guest Hermes policy from one place.</p></div><button className="btn primary" disabled={busy} onClick={()=>void save()}>{busy?'Saving…':'Save user policy'}</button></header>
    <div className="pastelGrid"><div className="pastelCard peach"><span>System mode</span><strong>{policy.quotaMode}</strong><small>authenticated default</small></div><div className="pastelCard sky"><span>Guest access</span><strong>{guest.enabled?'On':'Off'}</strong><small>Hermes · Fast</small></div><div className="pastelCard mint"><span>User usage</span><strong>{new Intl.NumberFormat().format(total)}</strong><small>completed tokens</small></div><div className="pastelCard butter"><span>Guest usage</span><strong>{new Intl.NumberFormat().format(guestUsage.totalTokens)}</strong><small>{new Intl.NumberFormat().format(guestRequests)} requests</small></div></div>

    <section className="surface sectionGap"><div className="sectionHead"><div><h2>Authenticated default policy</h2><p className="muted small">Logged-in chat runs through Hermes. User/API-key overrides and parallel quota windows still take precedence.</p></div></div><QuotaPolicyFields policy={policy} onChange={setPolicy}/>{message?<div className="notice butter sectionGap">{message}</div>:null}</section>

    <section className="surface sectionGap guestPolicyCard">
      <div className="sectionHead"><div><div className="eyebrow">Public access</div><h2>Guest via Hermes</h2><p className="muted small">Guest chat uses the restricted Hermes profile: no skills, upskill, web, browser or general tools. Upload and core image/file generation are separately quota-controlled here.</p></div><label className="guestSwitch"><input type="checkbox" checked={guest.enabled} onChange={e=>setGuest(x=>({...x,enabled:e.target.checked}))}/><span>{guest.enabled?'Enabled':'Disabled'}</span></label></div>
      <div className="formGrid guestPolicyGrid sectionGap">
        <label><span>Token quota</span><input className="input" type="number" min="0" value={guest.tokenLimit} onChange={e=>setGuest(x=>({...x,tokenLimit:Number(e.target.value)}))}/><small>Shared per hashed network identity.</small></label>
        <label><span>Quota window</span><select className="input" value={guest.intervalKind} onChange={e=>setGuest(x=>({...x,intervalKind:e.target.value as WindowKind}))}>{windows.map(x=><option key={x}>{x}</option>)}</select><small>Manual reset starts a fresh window immediately.</small></label>
        {['rolling','custom'].includes(guest.intervalKind)?<label><span>Window seconds</span><input className="input" type="number" min="1" value={guest.intervalSeconds??3600} onChange={e=>setGuest(x=>({...x,intervalSeconds:Number(e.target.value)}))}/></label>:null}
        <label><span>Requests / hour</span><input className="input" type="number" min="1" max="10000" value={guest.requestsPerHour} onChange={e=>setGuest(x=>({...x,requestsPerHour:Number(e.target.value)}))}/></label>
        <label><span>Minimum gap (sec)</span><input className="input" type="number" min="0" max="3600" value={guest.minIntervalSeconds} onChange={e=>setGuest(x=>({...x,minIntervalSeconds:Number(e.target.value)}))}/></label>
        <label><span>Max output tokens</span><input className="input" type="number" min="1" max="8192" value={guest.maxCompletionTokens} onChange={e=>setGuest(x=>({...x,maxCompletionTokens:Number(e.target.value)}))}/></label>
        <label><span>Allowed route</span><input className="input" value="Hermes · Fast" disabled/><small>Guest cannot select Auto, Balanced or Deep.</small></label>
      </div>

      <div className="sectionHead sectionGap"><div><h3>Guest files & generation</h3><p className="muted small">Capability switches are independent from general Hermes tools.</p></div></div>
      <div className="formGrid guestPolicyGrid sectionGap">
        <label className="guestSwitch"><input type="checkbox" checked={guest.allowUploads} onChange={e=>setGuest(x=>({...x,allowUploads:e.target.checked}))}/><span>Uploads {guest.allowUploads?'On':'Off'}</span></label>
        <label className="guestSwitch"><input type="checkbox" checked={guest.allowImageGeneration} onChange={e=>setGuest(x=>({...x,allowImageGeneration:e.target.checked}))}/><span>Image generation {guest.allowImageGeneration?'On':'Off'}</span></label>
        <label className="guestSwitch"><input type="checkbox" checked={guest.allowFileGeneration} onChange={e=>setGuest(x=>({...x,allowFileGeneration:e.target.checked}))}/><span>File generation {guest.allowFileGeneration?'On':'Off'}</span></label>
        <label><span>Max upload / file</span><input className="input" type="number" min="1" value={guest.maxUploadBytes} onChange={e=>setGuest(x=>({...x,maxUploadBytes:Number(e.target.value)}))}/><small>{fmtBytes(guest.maxUploadBytes)}</small></label>
        <label><span>Uploads / hour</span><input className="input" type="number" min="1" value={guest.maxUploadsPerHour} onChange={e=>setGuest(x=>({...x,maxUploadsPerHour:Number(e.target.value)}))}/></label>
        <label><span>Stored files / network</span><input className="input" type="number" min="1" value={guest.maxStoredFiles} onChange={e=>setGuest(x=>({...x,maxStoredFiles:Number(e.target.value)}))}/></label>
        <label><span>Stored bytes / network</span><input className="input" type="number" min="1" value={guest.maxStoredBytes} onChange={e=>setGuest(x=>({...x,maxStoredBytes:Number(e.target.value)}))}/><small>{fmtBytes(guest.maxStoredBytes)}</small></label>
        <label><span>Attachment retention (hours)</span><input className="input" type="number" min="1" max={720} value={guest.attachmentRetentionHours} onChange={e=>setGuest(x=>({...x,attachmentRetentionHours:Number(e.target.value)}))}/></label>
        <label><span>Image generations / day</span><input className="input" type="number" min="0" value={guest.imageGenerationsPerDay} onChange={e=>setGuest(x=>({...x,imageGenerationsPerDay:Number(e.target.value)}))}/></label>
        <label><span>File generations / day</span><input className="input" type="number" min="0" value={guest.fileGenerationsPerDay} onChange={e=>setGuest(x=>({...x,fileGenerationsPerDay:Number(e.target.value)}))}/></label>
        <label><span>Max generated file bytes</span><input className="input" type="number" min="1" value={guest.maxGeneratedFileBytes} onChange={e=>setGuest(x=>({...x,maxGeneratedFileBytes:Number(e.target.value)}))}/><small>{fmtBytes(guest.maxGeneratedFileBytes)}</small></label>
      </div>
      <div className="guestPolicyFooter"><div><strong>{new Intl.NumberFormat().format(guestUsage.totalTokens)}</strong><span> tokens · </span><strong>{new Intl.NumberFormat().format(guestRequests)}</strong><span> requests</span></div><button className="btn primary" disabled={guestBusy} onClick={()=>void saveGuest()}>{guestBusy?'Saving…':'Save Guest policy'}</button></div>
      {guestMessage?<div className="notice butter sectionGap">{guestMessage}</div>:null}
    </section>

    <section className="surface tableSurface sectionGap"><div className="sectionHead"><div><h2>Guest usage by network & device</h2><p className="muted small">Network IDs are one-way hashes; raw IP addresses are not stored. Device ID/name are descriptive breakdown fields only.</p></div><span className="muted small">Reset clears token quota and runtime cooldown immediately for the whole network ID.</span></div><div className="tableWrap"><table className="table"><thead><tr><th>Network</th><th>Device</th><th>Last seen</th><th>Requests</th><th>Tokens</th><th>Action</th></tr></thead><tbody>{guestDevices.length?guestDevices.map(d=><tr key={`${d.guestSubject}:${d.deviceId}`}><td><strong>{shortGuest(d.guestSubject)}</strong></td><td><strong>{d.deviceName||'Unnamed device'}</strong><div className="muted small">{d.deviceId}</div></td><td>{new Date(d.lastSeenAt).toLocaleString()}</td><td>{new Intl.NumberFormat().format(d.requests)}</td><td><strong>{new Intl.NumberFormat().format(d.totalTokens)}</strong><div className="muted small">{d.inputTokens} in · {d.outputTokens} out</div></td><td><button className="btn compact" disabled={resettingGuest===d.guestSubject} onClick={()=>void resetGuest(d.guestSubject)}>{resettingGuest===d.guestSubject?'Resetting…':'Reset now'}</button></td></tr>):<tr><td colSpan={6} className="muted">No Guest device usage yet.</td></tr>}</tbody></table></div></section>

    <section className="surface tableSurface sectionGap"><div className="sectionHead"><h2>Authenticated usage overview</h2><span className="muted small">Per-user overrides remain configurable from Users</span></div><div className="tableWrap"><table className="table"><thead><tr><th>User</th><th>Status</th><th>Requests</th><th>Total tokens</th></tr></thead><tbody>{rows.map(r=><tr key={r.subject}><td><strong>{r.displayName||r.email||r.subject}</strong><div className="muted small">{r.email||r.subject}</div></td><td><span className={`status status-${r.status}`}>{r.status}</span></td><td>{r.requests}</td><td><strong>{new Intl.NumberFormat().format(r.totalTokens||0)}</strong></td></tr>)}</tbody></table></div></section>
  </>;
}
