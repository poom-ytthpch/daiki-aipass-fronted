import {backendFetch} from '@/lib/backend';
type Pending={tokenLimitPerDay:number;requestsPerHour:number;minIntervalSeconds:number;maxCompletionTokens:number};
type Me={status:string;pendingChatPolicy?:Pending};
type Usage={usage?:{inputTokens?:number;outputTokens?:number;totalTokens?:number};quota?:{mode?:string;limit?:number;used?:number;remaining?:number;resetAt?:string;interval?:string;resetCredits?:{available?:number;nextExpiry?:string;lastResetAt?:string}}};
const fmt=(n?:number)=>new Intl.NumberFormat('en-US').format(n||0);
export default async function Plan(){
 let me:Me|null=null;let usage:Usage|null=null;
 try{const [mr,ur]=await Promise.all([backendFetch('/v1/me'),backendFetch('/v1/usage')]);if(mr.ok)me=await mr.json() as Me;if(ur.ok)usage=await ur.json() as Usage}catch{}
 const pending=me?.status==='pending';const p=me?.pendingChatPolicy;const q=usage?.quota;const u=usage?.usage;
 const managed=q?.mode==='limited';
 return <><header className="pageHeader"><div><div className="eyebrow">Your plan</div><h1>{pending?'Starter access':'Daiki access'}</h1><p>Your current token allowance, usage and reset window.</p></div><span className={`status status-${me?.status||'unknown'}`}>{me?.status||'unknown'}</span></header>
 <div className="planHero"><div><span className="planLabel">Current plan</span><h2>{q?.mode==='unlimited'?'Unlimited':managed?'Managed quota':pending?'Starter Chat':'Daiki access'}</h2><p>{pending?'Pending access can still have an administrator-defined quota override.':'Your current application entitlement and durable usage.'}</p></div><div className="planNumber">{q?.mode==='unlimited'?'∞':fmt(q?.remaining)}<span>{q?.mode==='unlimited'?'tokens':'tokens remaining'}</span></div></div>
 <div className="pastelGrid sectionGap"><div className="pastelCard peach"><span>Used</span><strong>{fmt(u?.totalTokens)}</strong><small>{fmt(u?.inputTokens)} in · {fmt(u?.outputTokens)} out</small></div><div className="pastelCard sky"><span>Limit</span><strong>{q?.mode==='unlimited'?'∞':fmt(q?.limit)}</strong><small>{q?.interval||'lifetime'}</small></div><div className="pastelCard mint"><span>Reset</span><strong>{q?.resetAt?new Date(q.resetAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—'}</strong><small>{q?.resetAt?new Date(q.resetAt).toLocaleString():'No scheduled reset'}</small></div></div>
 {pending&&p?<div className="notice butter sectionGap">Starter controls: {p.requestsPerHour} requests/hour · {p.minIntervalSeconds}s cooldown · {p.maxCompletionTokens} max output tokens.</div>:null}</>;
}
