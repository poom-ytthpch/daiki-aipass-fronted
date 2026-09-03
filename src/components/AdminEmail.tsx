'use client';
import {useCallback,useEffect,useState} from 'react';
import {Mail,RefreshCw,Send,Unplug} from 'lucide-react';

type GmailStatus={connected:boolean;sender?:string;connectedAt?:string;updatedAt?:string;scopes?:string[]};

export function AdminEmail(){
  const [data,setData]=useState<GmailStatus>({connected:false});const [busy,setBusy]=useState('');const [message,setMessage]=useState('');
  const load=useCallback(async()=>{const r=await fetch('/api/admin/integrations/gmail',{cache:'no-store'});if(r.ok)setData(await r.json())},[]);
  useEffect(()=>{const t=window.setTimeout(()=>void load(),0);return()=>window.clearTimeout(t)},[load]);
  const connect=async()=>{setBusy('connect');setMessage('');try{const r=await fetch('/api/admin/integrations/gmail/authorize',{method:'POST'});const d=await r.json();if(!r.ok||!d.url)throw new Error(d.error||'Unable to start Google authorization');window.location.assign(d.url)}catch(e){setMessage(e instanceof Error?e.message:'Unable to connect Gmail');setBusy('') }};
  const test=async()=>{setBusy('test');setMessage('');const r=await fetch('/api/admin/integrations/gmail/test',{method:'POST'});const d=await r.json().catch(()=>({}));setMessage(r.ok?'Test email sent successfully.':d.error||'Test email failed.');setBusy('')};
  const disconnect=async()=>{if(!confirm('Disconnect Gmail from Daiki email delivery?'))return;setBusy('disconnect');setMessage('');const r=await fetch('/api/admin/integrations/gmail',{method:'DELETE'});setMessage(r.ok?'Gmail disconnected.':'Unable to disconnect Gmail.');await load();setBusy('')};
  return <><header className="pageHeader"><div><div className="eyebrow">Delivery</div><h1>Email</h1><p>Connect the Google account Daiki uses to send password resets and system email.</p></div></header>
    <section className="surface emailIntegration">
      <div className="emailIcon"><Mail size={24}/></div>
      <div className="emailIntegrationCopy"><div className="sectionHead"><div><h2>Google Gmail</h2><p className="muted">OAuth 2.0 · send-only access</p></div><span className={`status ${data.connected?'status-approved':'status-pending'}`}>{data.connected?'Connected':'Not connected'}</span></div>
      <div className="emailFacts"><div><span>Sender</span><strong>{data.sender||'ch.yutthapichai@gmail.com'}</strong></div><div><span>Permission</span><strong>Send email only</strong></div><div><span>Connected</span><strong>{data.connectedAt?new Date(data.connectedAt).toLocaleString():'—'}</strong></div></div>
      {message?<div className="notice butter">{message}</div>:null}
      <div className="actions">{!data.connected?<button className="btn primary" disabled={!!busy} onClick={()=>void connect()}><Mail size={16}/> Connect Gmail</button>:<><button className="btn primary" disabled={!!busy} onClick={()=>void test()}><Send size={16}/> Send test email</button><button className="btn ghost" disabled={!!busy} onClick={()=>void connect()}><RefreshCw size={16}/> Reconnect</button><button className="btn ghost" disabled={!!busy} onClick={()=>void disconnect()}><Unplug size={16}/> Disconnect</button></>}</div>
      </div>
    </section>
    <section className="surface sectionGap"><div className="sectionHead"><h2>Password reset delivery</h2><span className="muted small">Daiki managed</span></div><p className="muted">Reset links are single-use, expire after 15 minutes, and are sent through this Gmail connection. Daiki stores the Google refresh token encrypted; it does not store your Google password.</p></section>
  </>;
}
