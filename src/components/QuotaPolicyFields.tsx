'use client';
export type Interval='hour'|'day'|'week'|'month'|'rolling'|'custom'|'lifetime';
export type ParallelLimit={id?:string;tokenLimit:number;intervalKind:Interval;intervalCount?:number;intervalSeconds?:number};
export type ResourceLimits={maxUploadsPerHour:number;maxStoredFiles:number;maxStoredBytes:number;maxAttachmentsPerMessage:number;maxFileBytes:number;maxImageBytes:number};
export type QuotaPolicy={quotaMode:'unlimited'|'limited';tokenLimit?:number;intervalKind:Interval;intervalCount?:number;intervalSeconds?:number;parallelLimits?:ParallelLimit[];resourceLimits?:Partial<ResourceLimits>};
export const defaultResourceLimits:ResourceLimits={maxUploadsPerHour:0,maxStoredFiles:0,maxStoredBytes:0,maxAttachmentsPerMessage:0,maxFileBytes:0,maxImageBytes:0};
export const defaultQuotaPolicy:QuotaPolicy={quotaMode:'unlimited',intervalKind:'month',intervalCount:1,parallelLimits:[],resourceLimits:defaultResourceLimits};
export const quotaWindows:Interval[]=['hour','day','week','month','rolling','custom','lifetime'];
const MiB=1024*1024;
const normalizeResources=(resource?:Partial<ResourceLimits>):ResourceLimits=>({
  maxUploadsPerHour:Math.max(0,Number(resource?.maxUploadsPerHour||0)),
  maxStoredFiles:Math.max(0,Number(resource?.maxStoredFiles||0)),
  maxStoredBytes:Math.max(0,Number(resource?.maxStoredBytes||0)),
  maxAttachmentsPerMessage:Math.max(0,Number(resource?.maxAttachmentsPerMessage||0)),
  maxFileBytes:Math.max(0,Number(resource?.maxFileBytes||0)),
  maxImageBytes:Math.max(0,Number(resource?.maxImageBytes||0)),
});
export function quotaPolicyPayload(policy:QuotaPolicy){
  return {
    ...policy,
    tokenLimit:policy.quotaMode==='limited'?Number(policy.tokenLimit||0):undefined,
    intervalCount:policy.intervalKind==='hour'?Math.max(1,Number(policy.intervalCount||1)):1,
    intervalSeconds:['rolling','custom'].includes(policy.intervalKind)?Math.max(1,Number(policy.intervalSeconds||3600)):undefined,
    parallelLimits:policy.quotaMode==='limited'?(policy.parallelLimits||[]).map((limit,index)=>({
      id:`parallel-${index+1}`,
      tokenLimit:Math.max(0,Number(limit.tokenLimit||0)),
      intervalKind:limit.intervalKind,
      intervalCount:limit.intervalKind==='hour'?Math.max(1,Number(limit.intervalCount||1)):1,
      intervalSeconds:['rolling','custom'].includes(limit.intervalKind)?Math.max(1,Number(limit.intervalSeconds||3600)):undefined,
    })):[],
    resourceLimits:normalizeResources(policy.resourceLimits),
  };
}
type ResourceKey=keyof ResourceLimits;
function ResourceLimitField({label,value,onChange,unit='count',max,detail}:{label:string;value:number;onChange:(value:number)=>void;unit?:'count'|'mib';max:number;detail?:string}){
  const limited=value>0;
  const shown=unit==='mib'?(limited?Math.max(0.1,value/MiB):1):(limited?value:1);
  return <label className="resourceLimitField"><span>{label}</span><div className="resourceLimitControl"><select className="input" value={limited?'limited':'unlimited'} onChange={e=>{if(e.target.value==='unlimited')onChange(0);else onChange(unit==='mib'?MiB:1)}}><option value="unlimited">Unlimited</option><option value="limited">Limited</option></select>{limited?<input className="input" type="number" min={unit==='mib'?0.1:1} step={unit==='mib'?0.1:1} max={unit==='mib'?max/MiB:max} value={shown} onChange={e=>{const n=Math.max(unit==='mib'?0.1:1,Number(e.target.value)||0);onChange(unit==='mib'?Math.round(n*MiB):Math.round(n))}}/>:null}{limited?<small>{unit==='mib'?'MiB':''}</small>:null}</div>{detail?<small>{detail}</small>:null}</label>;
}
export function QuotaPolicyFields({policy,onChange,showResources=true}:{policy:QuotaPolicy;onChange:(next:QuotaPolicy)=>void;showResources?:boolean}){
  const parallel=Array.isArray(policy.parallelLimits)?policy.parallelLimits:[];
  const resources=normalizeResources(policy.resourceLimits);
  const updateParallel=(index:number,patch:Partial<ParallelLimit>)=>onChange({...policy,parallelLimits:parallel.map((x,i)=>i===index?{...x,...patch}:x)});
  const addParallel=()=>onChange({...policy,parallelLimits:[...parallel,{id:`parallel-${parallel.length+1}`,tokenLimit:10000,intervalKind:'hour',intervalCount:1}]});
  const removeParallel=(index:number)=>onChange({...policy,parallelLimits:parallel.filter((_,i)=>i!==index)});
  const updateResource=(key:ResourceKey,value:number)=>onChange({...policy,resourceLimits:{...resources,[key]:value}});
  return <>
    <div className="formGrid sectionGap">
      <label><span>Token mode</span><select className="input" value={policy.quotaMode} onChange={e=>onChange({...policy,quotaMode:e.target.value as QuotaPolicy['quotaMode']})}><option value="unlimited">Unlimited</option><option value="limited">Limited</option></select></label>
      {policy.quotaMode==='limited'?<label><span>Primary window</span><select className="input" value={policy.intervalKind} onChange={e=>onChange({...policy,intervalKind:e.target.value as Interval,intervalCount:1})}>{quotaWindows.map(x=><option key={x}>{x}</option>)}</select></label>:null}
      {policy.quotaMode==='limited'?<label><span>Primary token limit</span><input className="input" type="number" min="0" value={policy.tokenLimit??1000000} onChange={e=>onChange({...policy,tokenLimit:Number(e.target.value)})}/></label>:null}
      {policy.quotaMode==='limited'&&policy.intervalKind==='hour'?<label><span>Reset every (hours)</span><input className="input" type="number" min="1" max="8760" value={policy.intervalCount??1} onChange={e=>onChange({...policy,intervalCount:Math.max(1,Number(e.target.value))})}/></label>:null}
      {policy.quotaMode==='limited'&&['rolling','custom'].includes(policy.intervalKind)?<label><span>Interval seconds</span><input className="input" type="number" min="1" value={policy.intervalSeconds??3600} onChange={e=>onChange({...policy,intervalSeconds:Number(e.target.value)})}/></label>:null}
    </div>
    {policy.quotaMode==='limited'?<section className="parallelQuotaBox sectionGap">
      <div className="sectionHead"><div><strong>Parallel token limits</strong><div className="muted small">Every token is counted against every active window.</div></div><button type="button" className="btn compact" disabled={parallel.length>=8} onClick={addParallel}>+ Add limit</button></div>
      {parallel.length?<div className="parallelQuotaList">{parallel.map((limit,index)=><div className="parallelQuotaRow" key={limit.id||index}>
        <label><span>Tokens</span><input className="input" type="number" min="0" value={limit.tokenLimit} onChange={e=>updateParallel(index,{tokenLimit:Number(e.target.value)})}/></label>
        <label><span>Window</span><select className="input" value={limit.intervalKind} onChange={e=>updateParallel(index,{intervalKind:e.target.value as Interval,intervalCount:1})}>{quotaWindows.map(x=><option key={x}>{x}</option>)}</select></label>
        {limit.intervalKind==='hour'?<label><span>Reset every (hours)</span><input className="input" type="number" min="1" max="8760" value={limit.intervalCount??1} onChange={e=>updateParallel(index,{intervalCount:Math.max(1,Number(e.target.value))})}/></label>:null}
        {['rolling','custom'].includes(limit.intervalKind)?<label><span>Seconds</span><input className="input" type="number" min="1" value={limit.intervalSeconds??3600} onChange={e=>updateParallel(index,{intervalSeconds:Number(e.target.value)})}/></label>:null}
        <button type="button" className="btn compact ghost parallelQuotaRemove" onClick={()=>removeParallel(index)}>Remove</button>
      </div>)}</div>:<div className="muted small sectionGap">No parallel limit. Only the primary token quota is enforced.</div>}
    </section>:null}
    {showResources?<section className="parallelQuotaBox resourceQuotaBox sectionGap"><div className="sectionHead"><div><strong>Files & images</strong><div className="muted small">0/Unlimited removes the admin quota while platform safety ceilings still apply: 25 MiB per file, 4 MiB per image, 100 attachments per message.</div></div></div><div className="formGrid resourceQuotaGrid sectionGap">
      <ResourceLimitField label="Uploads / hour" value={resources.maxUploadsPerHour} max={100000} onChange={v=>updateResource('maxUploadsPerHour',v)} detail="Reset quota now also clears this rolling counter."/>
      <ResourceLimitField label="Stored files" value={resources.maxStoredFiles} max={100000} onChange={v=>updateResource('maxStoredFiles',v)}/>
      <ResourceLimitField label="Stored size" value={resources.maxStoredBytes} unit="mib" max={1024*1024*1024*1024} onChange={v=>updateResource('maxStoredBytes',v)}/>
      <ResourceLimitField label="Attachments / message" value={resources.maxAttachmentsPerMessage} max={100} onChange={v=>updateResource('maxAttachmentsPerMessage',v)}/>
      <ResourceLimitField label="Max file size" value={resources.maxFileBytes} unit="mib" max={25*MiB} onChange={v=>updateResource('maxFileBytes',v)} detail="Platform maximum: 25 MiB."/>
      <ResourceLimitField label="Max image size" value={resources.maxImageBytes} unit="mib" max={4*MiB} onChange={v=>updateResource('maxImageBytes',v)} detail="Platform vision input maximum: 4 MiB."/>
    </div></section>:null}
  </>;
}
