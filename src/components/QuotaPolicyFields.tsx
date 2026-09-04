'use client';

export type Interval='hour'|'day'|'week'|'month'|'rolling'|'custom'|'lifetime';
export type ParallelLimit={id?:string;tokenLimit:number;intervalKind:Interval;intervalCount?:number;intervalSeconds?:number};
export type QuotaPolicy={quotaMode:'unlimited'|'limited';tokenLimit?:number;intervalKind:Interval;intervalCount?:number;intervalSeconds?:number;parallelLimits?:ParallelLimit[]};

export const defaultQuotaPolicy:QuotaPolicy={quotaMode:'unlimited',intervalKind:'month',intervalCount:1,parallelLimits:[]};
export const quotaWindows:Interval[]=['hour','day','week','month','rolling','custom','lifetime'];

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
  };
}

export function QuotaPolicyFields({policy,onChange}:{policy:QuotaPolicy;onChange:(next:QuotaPolicy)=>void}){
  const parallel=Array.isArray(policy.parallelLimits)?policy.parallelLimits:[];
  const updateParallel=(index:number,patch:Partial<ParallelLimit>)=>onChange({...policy,parallelLimits:parallel.map((x,i)=>i===index?{...x,...patch}:x)});
  const addParallel=()=>onChange({...policy,parallelLimits:[...parallel,{id:`parallel-${parallel.length+1}`,tokenLimit:10000,intervalKind:'hour',intervalCount:1}]});
  const removeParallel=(index:number)=>onChange({...policy,parallelLimits:parallel.filter((_,i)=>i!==index)});
  return <>
    <div className="formGrid sectionGap">
      <label><span>Mode</span><select className="input" value={policy.quotaMode} onChange={e=>onChange({...policy,quotaMode:e.target.value as QuotaPolicy['quotaMode']})}><option value="unlimited">Unlimited</option><option value="limited">Limited</option></select></label>
      <label><span>Primary window</span><select className="input" value={policy.intervalKind} onChange={e=>onChange({...policy,intervalKind:e.target.value as Interval,intervalCount:1})}>{quotaWindows.map(x=><option key={x}>{x}</option>)}</select></label>
      {policy.quotaMode==='limited'?<label><span>Primary token limit</span><input className="input" type="number" min="0" value={policy.tokenLimit??1000000} onChange={e=>onChange({...policy,tokenLimit:Number(e.target.value)})}/></label>:null}
      {policy.quotaMode==='limited'&&policy.intervalKind==='hour'?<label><span>Reset every (hours)</span><input className="input" type="number" min="1" max="8760" value={policy.intervalCount??1} onChange={e=>onChange({...policy,intervalCount:Math.max(1,Number(e.target.value))})}/></label>:null}
      {policy.quotaMode==='limited'&&['rolling','custom'].includes(policy.intervalKind)?<label><span>Interval seconds</span><input className="input" type="number" min="1" value={policy.intervalSeconds??3600} onChange={e=>onChange({...policy,intervalSeconds:Number(e.target.value)})}/></label>:null}
    </div>
    {policy.quotaMode==='limited'?<section className="parallelQuotaBox sectionGap">
      <div className="sectionHead"><div><strong>Parallel limits</strong><div className="muted small">Every token is counted against every limit. Example: 10M/week + 10K/hour means 5K used leaves 9.995M weekly and 5K hourly.</div></div><button type="button" className="btn compact" disabled={parallel.length>=8} onClick={addParallel}>+ Add limit</button></div>
      {parallel.length?<div className="parallelQuotaList">{parallel.map((limit,index)=><div className="parallelQuotaRow" key={limit.id||index}>
        <label><span>Tokens</span><input className="input" type="number" min="0" value={limit.tokenLimit} onChange={e=>updateParallel(index,{tokenLimit:Number(e.target.value)})}/></label>
        <label><span>Window</span><select className="input" value={limit.intervalKind} onChange={e=>updateParallel(index,{intervalKind:e.target.value as Interval,intervalCount:1})}>{quotaWindows.map(x=><option key={x}>{x}</option>)}</select></label>
        {limit.intervalKind==='hour'?<label><span>Reset every (hours)</span><input className="input" type="number" min="1" max="8760" value={limit.intervalCount??1} onChange={e=>updateParallel(index,{intervalCount:Math.max(1,Number(e.target.value))})}/></label>:null}
        {['rolling','custom'].includes(limit.intervalKind)?<label><span>Seconds</span><input className="input" type="number" min="1" value={limit.intervalSeconds??3600} onChange={e=>updateParallel(index,{intervalSeconds:Number(e.target.value)})}/></label>:null}
        <button type="button" className="btn compact ghost parallelQuotaRemove" onClick={()=>removeParallel(index)}>Remove</button>
      </div>)}</div>:<div className="muted small sectionGap">No parallel limit. Only the primary quota is enforced.</div>}
    </section>:null}
  </>;
}
