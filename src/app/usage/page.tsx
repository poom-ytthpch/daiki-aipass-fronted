import {backendFetch} from '@/lib/backend';
import {StatusCard} from '@/components/StatusCard';

type UsageResponse={usage?:{inputTokens?:number;outputTokens?:number;totalTokens?:number};quota?:{mode?:string;limit?:number;used?:number;remaining?:number;resetAt?:string;interval?:string;resetCredits?:{available?:number;nextExpiry?:string;lastResetAt?:string}};source?:string};
const fmt=(n?:number)=>new Intl.NumberFormat('en-US').format(n||0);
export default async function Usage(){
  let data:UsageResponse={};
  try{const r=await backendFetch('/v1/usage');if(r.ok)data=await r.json() as UsageResponse}catch{}
  const q=data.quota||{};const u=data.usage||{};
  return <><div className="top"><div><div className="h1">Usage</div><div className="muted">Durable token accounting and current entitlement</div></div><span className="pill">{q.mode||'unknown'} · {q.interval||'—'}</span></div><div className="grid cards"><StatusCard label="Tokens used" value={fmt(u.totalTokens)} detail={`${fmt(u.inputTokens)} input · ${fmt(u.outputTokens)} output`}/><StatusCard label="Remaining" value={q.mode==='unlimited'?'Unlimited':fmt(q.remaining)} detail={q.limit?`${fmt(q.limit)} token limit`:'No hard limit'}/><StatusCard label="Reset" value={q.resetAt?new Date(q.resetAt).toLocaleString():'—'} detail={q.interval||'lifetime'}/><StatusCard label="Reset credits" value={fmt(q.resetCredits?.available)} detail={q.resetCredits?.nextExpiry?`Expires ${new Date(q.resetCredits.nextExpiry).toLocaleString()}`:'No active reset credits'}/><StatusCard label="Source" value="Ledger" detail="PostgreSQL + Redis reservations"/></div></>;
}
