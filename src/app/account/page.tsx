import {backendFetch} from '@/lib/backend';
import {StatusCard} from '@/components/StatusCard';

type PendingPolicy={model:string;tokenLimitPerDay:number;requestsPerHour:number;minIntervalSeconds:number;maxCompletionTokens:number;textOnly:boolean};
type Me={name:string;email?:string;status:string;authProvider?:string;roles?:string[];createdAt?:string;approvedAt?:string;pendingChatPolicy?:PendingPolicy};
export default async function Account(){
  let me:Me|null=null;
  try{const r=await backendFetch('/v1/me');if(r.ok)me=await r.json() as Me}catch{}
  if(!me)return <><div className="h1">Account</div><p className="muted">Application identity is unavailable.</p></>;
  const detail=me.status==='approved'?'Full AI access is enabled':me.status==='pending'?'Restricted Chat is available while waiting for approval':`AI access is ${me.status}`;
  const p=me.pendingChatPolicy;
  return <><div className="top"><div><div className="h1">Account</div><div className="muted">Identity and application access state</div></div><span className={`pill status-${me.status}`}>{me.status}</span></div><div className="grid cards"><StatusCard label="Access" value={me.status} detail={detail}/><StatusCard label="Provider" value={me.authProvider||'Keycloak'} detail={me.email||me.name}/><StatusCard label="Roles" value={(me.roles||[]).join(', ')||'ai-user'} detail="Application roles"/><StatusCard label="Approved" value={me.approvedAt?new Date(me.approvedAt).toLocaleDateString():'—'} detail="Admin-controlled whitelist"/></div>{me.status==='pending'&&p&&<section className="card" style={{marginTop:16}}><h3>Restricted Chat access</h3><p className="muted">You can use text Chat before approval, but only through the Fast route with a small trial allowance.</p><div className="grid cards"><StatusCard label="Daily tokens" value={p.tokenLimitPerDay.toLocaleString()} detail="Resets daily"/><StatusCard label="Messages" value={`${p.requestsPerHour}/hour`} detail={`${p.minIntervalSeconds}s minimum interval`}/><StatusCard label="Output cap" value={String(p.maxCompletionTokens)} detail="tokens per response"/><StatusCard label="Mode" value="Text only" detail="Files, models, API, projects and tools stay locked"/></div></section>}{(me.status==='suspended'||me.status==='rejected')&&<section className="card" style={{marginTop:16}}><h3>AI access unavailable</h3><p className="muted">Chat and protected AI features are disabled for this account status.</p></section>}</>;
}
