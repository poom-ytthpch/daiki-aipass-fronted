'use client';

import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Brain,Check,Copy,File,FolderOpen,Globe2,History,Image as ImageIcon,Menu,Paperclip,Pause,Pencil,Play,Plus,RotateCcw,Search,Send,Trash2,X} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Attachment={id:string;name:string;relativePath:string;source:'file'|'image'|'folder';mediaType:string;sizeBytes:number;extractStatus:string;createdAt:string};
type TokenUsage={input:number;reasoning:number;answer:number;total:number};
type RunSource={index?:number;title?:string;url?:string;engine?:string;snippet?:string};
type ResetGrant={id:number;remainingResets:number;totalResets?:number;expiresAt:string;createdAt?:string;note?:string};
type ResetCredits={available:number;nextExpiry?:string;lastResetAt?:string;grants?:ResetGrant[]};
type QuotaState={mode?:string;limit?:number;used?:number;remaining?:number;resetAt?:string;interval?:string;windowStart?:string;resetCredits?:ResetCredits};
type UsageResponse={usage?:{inputTokens?:number;outputTokens?:number;totalTokens?:number};quota?:QuotaState};
type RunActivity={phase?:string;durationMs?:number;requestId?:string;httpStatus?:number;retryAfterSeconds?:number;quota?:QuotaState;research?:{mode?:string;query?:string;used?:boolean;error?:string;sourceCount?:number;sources?:RunSource[]};thinking?:{mode?:string;reasoningBudget?:number;estimate?:unknown};tokens?:TokenUsage};
type ChatRun={id:string;sessionId:string;status:'queued'|'running'|'paused'|'completed'|'failed'|'cancelled';researchMode:string;thinkingMode:string;requestId?:string;content:string;error?:string;activity?:RunActivity;createdAt:string;startedAt?:string;completedAt?:string;updatedAt:string};
type Msg={id?:number;role:'user'|'ai';text:string;attachments?:Attachment[];runId?:string;run?:ChatRun};
type ChatSession={id:string;title:string;modelAlias:string;createdAt:string;updatedAt:string};
type StoredMessage={id:number;role:'user'|'assistant';content:string;attachmentIds:string[];runId?:string;createdAt:string};
type PendingPolicy={model:string;tokenLimitPerDay:number;requestsPerHour:number;minIntervalSeconds:number;maxCompletionTokens:number;textOnly:boolean};
type Account={status?:'pending'|'approved'|'suspended'|'rejected';pendingChatPolicy?:PendingPolicy};
type ThinkingMode='off'|'low'|'medium'|'high';
type Prefs={defaultModel?:string;responseStyle?:string;researchMode?:'auto'|'web'|'off';thinkingMode?:ThinkingMode};
type CapabilityInfo={mode:string;maxToolRounds:number;skills:{id:string;name:string;description:string}[];tools:{id:string;name:string;description:string}[]};

const routes=[['auto','Auto'],['fast','Fast'],['balanced','Balanced'],['deep','Deep']] as const;
const thinkingLevels=[
  {id:'off' as const,label:'Off',reasoning:0,completion:1024},
  {id:'low' as const,label:'Low',reasoning:384,completion:1536},
  {id:'medium' as const,label:'Medium',reasoning:768,completion:2560},
  {id:'high' as const,label:'High',reasoning:1536,completion:4096},
];
const fmtTokens=(n:number)=>n>=1000?`${(n/1000).toFixed(n>=10000?0:1)}K`:String(Math.max(0,Math.round(n)));
const starters=[
  ['Explain','Explain this simply: '],
  ['Plan','Make a practical plan for '],
  ['Research','Research the latest information about '],
  ['Build','Help me build '],
] as const;
const size=(n:number)=>n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(1)} KB`:`${(n/1024/1024).toFixed(1)} MB`;
const rel=(f:File)=>(f as File & {webkitRelativePath?:string}).webkitRelativePath||f.name;
const errorText=(value:unknown):string=>{
  if(typeof value==='string')return value;
  if(value&&typeof value==='object'){
    const v=value as Record<string,unknown>;
    for(const key of ['message','detail','error']){const text=errorText(v[key]);if(text)return text}
    try{return JSON.stringify(value)}catch{return 'Gateway unavailable'}
  }
  return value==null?'':String(value);
};

function MessageContent({message}:{message:Msg}){
  if(message.role==='user')return <div className="userText">{message.text}</div>;
  if(!message.text)return <div className="typingDots" aria-label="Daiki is thinking"><i/><i/><i/></div>;
  return <div className="markdownBody"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.text}</ReactMarkdown></div>;
}

function RunActivityDetails({run}:{run:ChatRun}){
  const activity=run.activity||{};const research=activity.research;const thinking=activity.thinking;const tokens=activity.tokens;const sources=research?.sources||[];
  const label=run.status==='running'?'Working':run.status==='queued'?'Queued':run.status==='paused'?'Paused':run.status==='failed'?'Failed':run.status==='cancelled'?'Stopped':'Completed';
  return <details className={`runActivity ${run.status}`} open={run.status==='failed'}>
    <summary><span><Brain size={12}/>{label}</span><small>{research?.used?`Web · ${sources.length||research.sourceCount||0} sources`:`Web: ${research?.mode||run.researchMode}`} · Think: {thinking?.mode||run.thinkingMode}</small></summary>
    <div className="runActivityBody">
      <div className="activityFacts"><div><span>Status</span><strong>{label}</strong></div><div><span>Thinking</span><strong>{thinking?.mode||run.thinkingMode}</strong></div>{activity.durationMs!=null?<div><span>Duration</span><strong>{(activity.durationMs/1000).toFixed(1)}s</strong></div>:null}</div>
      <section><strong>Web research</strong>{research?.query?<p>Query: <code>{research.query}</code></p>:<p>{research?.mode==='off'?'Web research disabled.':run.status==='running'||run.status==='queued'?'Research is evaluated by the backend while this run continues.':'No web query was required for this answer.'}</p>}{research?.error?<p className="activityError">{research.error}</p>:null}{sources.length?<div className="activitySources">{sources.map((source,i)=><a key={`${source.url||i}`} href={source.url||'#'} target="_blank" rel="noreferrer"><span>{source.title||source.url||`Source ${i+1}`}</span>{source.snippet?<small>{source.snippet}</small>:null}<em>{source.engine||'web'}</em></a>)}</div>:null}</section>
      <section><strong>Thinking</strong><p>Mode: {thinking?.mode||run.thinkingMode}{thinking?.reasoningBudget!=null?` · budget ${fmtTokens(thinking.reasoningBudget)} tokens`:''}. Private chain-of-thought is not exposed.</p></section>
      {tokens?<section><strong>Token usage</strong><p>{fmtTokens(tokens.input)} input · {fmtTokens(tokens.reasoning)} thinking · {fmtTokens(tokens.answer)} answer · {fmtTokens(tokens.total)} total</p></section>:null}
      {run.error?<section><strong>Error</strong><p className="activityError">{run.error==='quota_exhausted'?`Token quota used up${activity.quota?.resetAt?` · resets ${new Date(activity.quota.resetAt).toLocaleString()}`:''}`:run.error==='pending_chat_rate_limited'?`Please wait ${activity.retryAfterSeconds||1}s before sending again.`:run.error}</p></section>:null}
      {activity.requestId||run.requestId?<small className="activityRequestId">Request {activity.requestId||run.requestId}</small>:null}
    </div>
  </details>;
}

export default function Chat(){
  const [text,setText]=useState('');
  const [localBusy,setBusy]=useState(false);
  const [capabilities,setCapabilities]=useState<CapabilityInfo|null>(null);
  const [uploading,setUploading]=useState(0);
  const [model,setModel]=useState('auto');
  const [researchMode,setResearchMode]=useState<'auto'|'web'|'off'>('auto');
  const [thinkingMode,setThinkingMode]=useState<ThinkingMode>('medium');
  const [account,setAccount]=useState<Account|null>(null);
  const [msgs,setMsgs]=useState<Msg[]>([]);
  const [currentRun,setCurrentRun]=useState<ChatRun|null>(null);
  const [attachments,setAttachments]=useState<Attachment[]>([]);
  const [attachMenu,setAttachMenu]=useState(false);
  const [uploadError,setUploadError]=useState('');
  const [sessions,setSessions]=useState<ChatSession[]>([]);
  const [sessionId,setSessionId]=useState('');
  const [historyBusy,setHistoryBusy]=useState(false);
  const [historyQuery,setHistoryQuery]=useState('');
  const [historyOpen,setHistoryOpen]=useState(false);
  const [renamingId,setRenamingId]=useState('');
  const [renameText,setRenameText]=useState('');
  const [editingMessageId,setEditingMessageId]=useState<number|null>(null);
  const [editText,setEditText]=useState('');
  const [copiedKey,setCopiedKey]=useState('');
  const [usageInfo,setUsageInfo]=useState<UsageResponse|null>(null);
  const [quotaClock,setQuotaClock]=useState(Date.now());
  const [resetBusy,setResetBusy]=useState(false);
  const [resetGiftNotice,setResetGiftNotice]=useState('');
  const fileRef=useRef<HTMLInputElement>(null);
  const imageRef=useRef<HTMLInputElement>(null);
  const folderRef=useRef<HTMLInputElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const scrollRef=useRef<HTMLDivElement>(null);

  const runBlocking=Boolean(currentRun&&['queued','running','paused'].includes(currentRun.status));
  const busy=localBusy||runBlocking;
  const pending=account?.status==='pending';
  const currentSession=sessions.find(x=>x.id===sessionId);
  const quota=usageInfo?.quota;
  const quotaExhausted=quota?.mode==='limited'&&Number(quota.remaining||0)<=0;
  const quotaBlocked=quotaExhausted||currentRun?.error==='quota_exhausted';
  const resetCredits=quota?.resetCredits;
  const resetsAvailable=Number(resetCredits?.available||0);
  const resetRemainingMs=quota?.resetAt?Math.max(0,new Date(quota.resetAt).getTime()-quotaClock):0;
  const resetRemainingLabel=resetRemainingMs>0?`${Math.floor(resetRemainingMs/60000)}m ${Math.floor((resetRemainingMs%60000)/1000)}s`:'now';
  const effectiveThinkingMode:ThinkingMode=pending?'off':thinkingMode;
  const thinkingIndex=Math.max(0,thinkingLevels.findIndex(x=>x.id===effectiveThinkingMode));
  const thinking=thinkingLevels[thinkingIndex]||thinkingLevels[2];
  const estimatedInput=useMemo(()=>{
    const content=[...msgs.map(m=>m.text),text].join('\n');
    const bytes=new TextEncoder().encode(content).length;
    return Math.min(16000,Math.ceil(bytes/4)+256);
  },[msgs,text]);
  const estimatedVisible=Math.max(256,thinking.completion-thinking.reasoning);
  const estimatedTotal=estimatedInput+thinking.completion;
  const filteredSessions=useMemo(()=>{
    const q=historyQuery.trim().toLowerCase();
    return q?sessions.filter(s=>s.title.toLowerCase().includes(q)):sessions;
  },[sessions,historyQuery]);

  useEffect(()=>{
    folderRef.current?.setAttribute('webkitdirectory','');
    folderRef.current?.setAttribute('directory','');
    const prefTimer=window.setTimeout(()=>{
      try{
        const p=JSON.parse(localStorage.getItem('daiki_preferences')||'{}') as Prefs;
        if(p.defaultModel)setModel(p.defaultModel);
        if(p.researchMode)setResearchMode(p.researchMode);
        if(p.thinkingMode)setThinkingMode(p.thinkingMode);
      }catch{}
    },0);
    void fetch('/api/account',{cache:'no-store'}).then(async r=>{if(r.ok){const a=await r.json() as Account;setAccount(a);if(a.status==='pending')setModel('fast')}}).catch(()=>{});
    void fetch('/api/chat-sessions',{cache:'no-store'}).then(async r=>{if(r.ok){const d=await r.json() as {sessions:ChatSession[]};setSessions(d.sessions||[]);const saved=localStorage.getItem('daiki_current_session');if(saved)void openSession(saved,false)}}).catch(()=>{});
    void fetch('/api/capabilities',{cache:'no-store'}).then(async r=>{if(r.ok)setCapabilities(await r.json() as CapabilityInfo)}).catch(()=>{});
    void refreshUsage();
    return()=>window.clearTimeout(prefTimer);
    // Session restore is intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})},[msgs,currentRun?.status]);
  useEffect(()=>{const el=textareaRef.current;if(!el)return;el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,180)}px`},[text]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setHistoryOpen(false);setAttachMenu(false);setEditingMessageId(null)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
  useEffect(()=>{if(!quota?.resetAt)return;const timer=window.setInterval(()=>setQuotaClock(Date.now()),1000);return()=>window.clearInterval(timer)},[quota?.resetAt]);
  useEffect(()=>{const timer=window.setInterval(()=>void refreshUsage(),20000);const wake=()=>{if(document.visibilityState==='visible')void refreshUsage()};window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);return()=>{window.clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)}},[]);
  useEffect(()=>{
    const runId=currentRun?.id;if(!runId||!sessionId||!['queued','running'].includes(currentRun.status))return;
    let closed=false;
    const tick=async()=>{
      try{
        const r=await fetch(`/api/chat-runs/${encodeURIComponent(runId)}`,{cache:'no-store'});if(!r.ok||closed)return;
        const run=await r.json() as ChatRun;setCurrentRun(run);
        if(run.status==='completed'){await loadSessionData(sessionId,false,true);setCurrentRun(null);await refreshUsage();await refreshSessions()}else if(run.status==='failed'||run.status==='cancelled'){await refreshUsage()}
      }catch{}
    };
    const timer=window.setInterval(()=>void tick(),1500);
    const wake=()=>{if(document.visibilityState==='visible')void tick()};
    window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);void tick();
    return()=>{closed=true;window.clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)};
    // Polling is keyed by persisted run identity/status; helper identity is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[currentRun?.id,currentRun?.status,sessionId]);

  const updateThinkingMode=(next:ThinkingMode)=>{
    setThinkingMode(next);
    try{const p=JSON.parse(localStorage.getItem('daiki_preferences')||'{}');localStorage.setItem('daiki_preferences',JSON.stringify({...p,thinkingMode:next}))}catch{}
  };
  const copyMessage=async(value:string,key:string)=>{try{await navigator.clipboard.writeText(value);setCopiedKey(key);window.setTimeout(()=>setCopiedKey(''),1400)}catch{}};
  const refreshUsage=async()=>{try{const r=await fetch('/api/usage',{cache:'no-store'});if(r.ok){const next=await r.json() as UsageResponse;const grants=next.quota?.resetCredits?.grants||[];const latest=[...grants].sort((a,b)=>Number(b.id)-Number(a.id))[0];if(latest){const key='daiki_seen_reset_grant';const seen=Number(localStorage.getItem(key)||0);if(latest.id>seen){setResetGiftNotice(`You received ${latest.totalResets||latest.remainingResets} quota reset${(latest.totalResets||latest.remainingResets)===1?'':'s'} · expires ${new Date(latest.expiresAt).toLocaleString()}`);localStorage.setItem(key,String(latest.id))}}setUsageInfo(next)}}catch{}};
  const redeemQuotaReset=async()=>{if(resetBusy||resetsAvailable<=0)return;setResetBusy(true);setUploadError('');try{const r=await fetch('/api/quota-resets/use',{method:'POST'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||'Could not use reset');await refreshUsage();if(currentRun?.error==='quota_exhausted')await controlRun('resume')}catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{setResetBusy(false)}};
  const refreshSessions=async()=>{const r=await fetch('/api/chat-sessions',{cache:'no-store'});if(r.ok){const d=await r.json() as {sessions:ChatSession[]};setSessions(d.sessions||[])}};
  const mapMessages=(messages:StoredMessage[],runs:ChatRun[])=>{const byRun=new Map(runs.map(run=>[run.id,run]));return messages.map(m=>({id:m.id,role:m.role==='assistant'?'ai' as const:'user' as const,text:m.content,runId:m.runId,run:m.runId?byRun.get(m.runId):undefined}))};
  const loadSessionData=async(id:string,closeHistory=true,preserveComposer=false)=>{
    const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{cache:'no-store'});if(!r.ok)return false;
    const d=await r.json() as {session:ChatSession;messages:StoredMessage[];runs:ChatRun[]};const runs=d.runs||[];const latest=runs[runs.length-1];
    setSessionId(d.session.id);setModel(d.session.modelAlias||'auto');setMsgs(mapMessages(d.messages||[],runs));
    setCurrentRun(latest&&latest.status!=='completed'?latest:null);localStorage.setItem('daiki_current_session',d.session.id);
    setAttachments([]);if(!preserveComposer)setText('');if(closeHistory)setHistoryOpen(false);return true;
  };
  const newChat=()=>{setSessionId('');setMsgs([]);setCurrentRun(null);setAttachments([]);setText('');setUploadError('');setHistoryOpen(false);setEditingMessageId(null);localStorage.removeItem('daiki_current_session')};
  const openSession=async(id:string,closeHistory=true)=>{setHistoryBusy(true);try{await loadSessionData(id,closeHistory,false)}finally{setHistoryBusy(false)}};
  const deleteSession=async(id:string)=>{if(id===sessionId&&runBlocking)return;const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{method:'DELETE'});if(r.ok){if(sessionId===id)newChat();await refreshSessions()}};
  const renameSession=async(id:string)=>{const title=renameText.trim();if(!title)return;const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({title})});if(r.ok){const updated=await r.json() as ChatSession;setSessions(xs=>xs.map(x=>x.id===id?updated:x));setRenamingId('');setRenameText('')}};
  const ensureSession=async(title:string)=>{
    if(sessionId)return sessionId;
    const r=await fetch('/api/chat-sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:title.slice(0,80)||'New chat',modelAlias:pending?'fast':model})});
    if(!r.ok)throw new Error('Could not create chat session');
    const x=await r.json() as ChatSession;setSessionId(x.id);setSessions(old=>[x,...old]);localStorage.setItem('daiki_current_session',x.id);return x.id;
  };
  const updateSessionModel=async(next:string)=>{setModel(next);if(!sessionId)return;const r=await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({modelAlias:next})});if(r.ok){const updated=await r.json() as ChatSession;setSessions(xs=>xs.map(x=>x.id===updated.id?updated:x))}};
  const saveSessionMessage=async(id:string,role:'user'|'assistant',content:string,attachmentIds:string[]=[])=>{const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role,content,attachmentIds})});if(!r.ok)throw new Error('Could not save chat history');return await r.json() as StoredMessage};
  const startRun=async(id:string)=>{
    const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}/runs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({researchMode,thinkingMode:effectiveThinkingMode})});const d=await r.json().catch(()=>({})) as ChatRun&{error?:string;run?:ChatRun};
    if(r.status===409&&d.run){setCurrentRun(d.run);return d.run}if(!r.ok)throw new Error(errorText(d.error)||'Could not start background run');setCurrentRun(d);return d;
  };
  const controlRun=async(action:'pause'|'resume')=>{if(!currentRun)return;setBusy(true);try{const r=await fetch(`/api/chat-runs/${encodeURIComponent(currentRun.id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||'Could not update run');setCurrentRun(d as ChatRun)}catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}};
  const uploadOne=async(file:File,source:'file'|'image'|'folder')=>{const form=new FormData();form.set('file',file);form.set('source',source);form.set('relativePath',source==='folder'?rel(file):file.name);const r=await fetch('/api/attachments',{method:'POST',body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||`Could not upload ${file.name}`);return d as Attachment};
  const uploadFiles=async(files:FileList|File[],source:'file'|'image'|'folder')=>{if(pending||runBlocking||localBusy)return;const list=Array.from(files);if(!list.length)return;setAttachMenu(false);setUploadError('');setUploading(x=>x+list.length);try{const uploaded:Attachment[]=[];for(const f of list)uploaded.push(await uploadOne(f,source));setAttachments(x=>[...x,...uploaded])}catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{setUploading(x=>Math.max(0,x-list.length))}};
  const removeAttachment=async(a:Attachment)=>{setAttachments(x=>x.filter(v=>v.id!==a.id));void fetch(`/api/attachments/${encodeURIComponent(a.id)}`,{method:'DELETE'}).catch(()=>{})};
  const send=async()=>{
    if((!text.trim()&&!attachments.length)||busy||uploading>0||quotaBlocked)return;setBusy(true);setAttachMenu(false);setUploadError('');
    const q=text.trim();const currentAttachments=[...attachments];const content=q||'Please review the attached content.';
    try{
      const current=await ensureSession(content);const stored=await saveSessionMessage(current,'user',content,currentAttachments.map(a=>a.id));
      setMsgs(old=>[...old,{id:stored.id,role:'user',text:stored.content,attachments:currentAttachments}]);setText('');setAttachments([]);await startRun(current);await refreshSessions();
    }catch(e){setMsgs(old=>[...old,{role:'ai',text:`I couldn’t start the run: ${e instanceof Error?e.message:String(e)}`}])}finally{setBusy(false)}
  };
  const editAndRetry=async(message:Msg,content:string)=>{
    if(!sessionId||!message.id||busy)return;const next=content.trim();if(!next)return;setBusy(true);setUploadError('');
    try{const r=await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}/messages/${message.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({content:next})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||'Could not edit message');setEditingMessageId(null);setEditText('');await loadSessionData(sessionId,false,true);await startRun(sessionId);await refreshSessions()}catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  };
  const retryFromAssistant=async(index:number)=>{for(let i=index-1;i>=0;i--){const m=msgs[i];if(m.role==='user'&&m.id){await editAndRetry(m,m.text);return}}};
  const submit=(e:FormEvent)=>{e.preventDefault();void send()};

  return <div className="chatPage">
    {historyOpen?<button className="chatHistoryBackdrop" aria-label="Close history" onClick={()=>setHistoryOpen(false)}/>:null}
    <aside className={`chatHistory ${historyOpen?'open':''}`}>
      <div className="chatHistoryHead"><button className="newChatButton" type="button" onClick={newChat}><Plus size={17}/><span>New chat</span></button><button className="historyClose" type="button" aria-label="Close history" onClick={()=>setHistoryOpen(false)}><X size={18}/></button></div>
      <label className="historySearch"><Search size={15}/><input value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)} placeholder="Search chats"/></label>
      <div className="historyList chatHistoryList">
        {filteredSessions.length?filteredSessions.map(s=><div key={s.id} className={`historyItem ${sessionId===s.id?'active':''}`}>
          {renamingId===s.id?<form className="renameForm" onSubmit={e=>{e.preventDefault();void renameSession(s.id)}}><input autoFocus value={renameText} onChange={e=>setRenameText(e.target.value)} onBlur={()=>{if(renameText.trim())void renameSession(s.id);else setRenamingId('')}}/></form>:<button type="button" disabled={historyBusy} onClick={()=>void openSession(s.id)}><History size={14}/><span><strong>{s.title}</strong><small>{new Date(s.updatedAt).toLocaleDateString()}</small></span></button>}
          <div className="historyActions"><button type="button" aria-label={`Rename ${s.title}`} onClick={()=>{setRenamingId(s.id);setRenameText(s.title)}}><Pencil size={12}/></button><button type="button" aria-label={`Delete ${s.title}`} onClick={()=>void deleteSession(s.id)}><Trash2 size={12}/></button></div>
        </div>):<div className="historyEmpty">{historyQuery?'No matching chats':'Your chats will appear here.'}</div>}
      </div>
      {capabilities?<div className="chatHistoryFoot"><span>Smart Assist</span><strong>On</strong><small>{capabilities.skills.length} skills · {capabilities.tools.length} tools</small></div>:null}
    </aside>

    <section className="chatStage">
      <header className="chatTopbar">
        <div className="chatTopbarTitle"><button className="iconButton historyToggle" type="button" aria-label="Open chat history" onClick={()=>setHistoryOpen(true)}><Menu size={19}/></button><div><strong>{currentSession?.title||'New chat'}</strong><small>{busy?'Daiki is thinking…':'Daiki AI Passport'}</small></div></div>
        <div className="chatTopbarControls">
          <details className="thinkingControl">
            <summary aria-disabled={pending}><Brain size={13}/><span>Think: {thinking.label}</span></summary>
            <div className="thinkingPopover">
              <div className="thinkingPopoverHead"><div><strong>Thinking</strong><small>{thinking.label}</small></div><strong>{fmtTokens(thinking.reasoning)}</strong></div>
              <input aria-label="Thinking level" type="range" min={0} max={thinkingLevels.length-1} step={1} value={thinkingIndex} disabled={pending} onChange={e=>updateThinkingMode(thinkingLevels[Number(e.target.value)].id)}/>
              <div className="thinkingTicks">{thinkingLevels.map(x=><span key={x.id}>{x.label}</span>)}</div>
              <div className="tokenBudget"><span>Estimated token budget</span><div><b>{fmtTokens(estimatedInput)}</b><small>input</small><i>+</i><b>{fmtTokens(thinking.reasoning)}</b><small>thinking</small><i>+</i><b>{fmtTokens(estimatedVisible)}</b><small>answer</small><i>=</i><b>{fmtTokens(estimatedTotal)}</b><small>total max</small></div></div>
              <p>{pending?'Pending access uses Thinking Off and the account completion cap.':'Formula: estimated input + thinking budget + visible answer budget. Actual usage replaces the estimate under each answer.'} Hidden reasoning content is never displayed.</p>
            </div>
          </details>
          <select aria-label="Research mode" value={researchMode} onChange={e=>{const v=e.target.value as 'auto'|'web'|'off';setResearchMode(v);try{const p=JSON.parse(localStorage.getItem('daiki_preferences')||'{}');localStorage.setItem('daiki_preferences',JSON.stringify({...p,researchMode:v}))}catch{}}}><option value="auto">Web: Auto</option><option value="web">Web: On</option><option value="off">Web: Off</option></select>
          <select aria-label="Model route" value={pending?'fast':model} disabled={pending} onChange={e=>void updateSessionModel(e.target.value)}>{(pending?[['fast','Fast'] as const]:routes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
        </div>
      </header>

      <div className="chatScroll" ref={scrollRef} onDragOver={e=>{if(!pending)e.preventDefault()}} onDrop={e=>{if(pending)return;e.preventDefault();void uploadFiles(e.dataTransfer.files,'file')}}>
        {!msgs.length&&!currentRun?<div className="chatEmptyState"><div className="emptyMark">D</div><h1>What can I help with?</h1><p>Ask anything, research the web, or drop in files and project folders.</p><div className="promptStarters">{starters.map(([label,prompt])=><button key={label} type="button" onClick={()=>setText(prompt)}><span>{label}</span><small>{prompt}</small></button>)}</div></div>:<div className="messageFeed">
          {msgs.map((m,i)=>{const copyKey=`${m.role}-${m.id??i}`;const tokens=m.run?.activity?.tokens;const research=m.run?.activity?.research;return <div key={copyKey} className={`messageRow ${m.role}`}><div className="messageAvatar">{m.role==='ai'?'D':'You'}</div><div className="messageStack"><div className="bubble">{m.role==='user'&&editingMessageId===m.id?<div className="messageEditor"><textarea autoFocus value={editText} onChange={e=>setEditText(e.target.value)} rows={Math.min(8,Math.max(2,editText.split('\n').length))}/><div><button type="button" onClick={()=>{setEditingMessageId(null);setEditText('')}}>Cancel</button><button type="button" className="primary" onClick={()=>void editAndRetry(m,editText)}>Save & Retry</button></div></div>:<MessageContent message={m}/>}</div>
            {m.text?<div className="messageActions"><button type="button" aria-label="Copy message" onClick={()=>void copyMessage(m.text,copyKey)}>{copiedKey===copyKey?<Check size={13}/>:<Copy size={13}/>}<span>{copiedKey===copyKey?'Copied':'Copy'}</span></button>{m.role==='user'&&m.id?<button type="button" disabled={busy} onClick={()=>{setEditingMessageId(m.id!);setEditText(m.text)}}><Pencil size={13}/><span>Edit</span></button>:null}{m.role==='ai'?<button type="button" disabled={busy} onClick={()=>void retryFromAssistant(i)}><RotateCcw size={13}/><span>Retry</span></button>:null}</div>:null}
            {research?.used?<span className="researchBadge"><Globe2 size={12}/>Web searched · {research.sources?.length||research.sourceCount||0} sources</span>:null}
            {tokens?<span className="tokenUsageBadge"><Brain size={12}/>Tokens · {fmtTokens(tokens.input)} in · {fmtTokens(tokens.reasoning)} think · {fmtTokens(tokens.answer)} answer · {fmtTokens(tokens.total)} total</span>:null}
            {m.run?<RunActivityDetails run={m.run}/>:null}
            {m.attachments?.length?<div className="sentAttachments">{m.attachments.map(a=><a key={a.id} className="sentAttachment" href={`/api/attachments/${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer">{a.mediaType.startsWith('image/')?<ImageIcon size={14}/>:a.source==='folder'?<FolderOpen size={14}/>:<File size={14}/>}<span>{a.relativePath}</span></a>)}</div>:null}
          </div></div>})}
          {currentRun&&currentRun.status!=='completed'?<div className="messageRow ai runMessage"><div className="messageAvatar">D</div><div className="messageStack"><div className="bubble">{currentRun.status==='queued'||currentRun.status==='running'?<div className="backgroundRunStatus"><div className="typingDots" aria-label="Daiki is working in background"><i/><i/><i/></div><span>{currentRun.status==='queued'?'Queued for processing':'Working in background — you can leave this page.'}</span></div>:currentRun.status==='paused'?<div className="backgroundRunStatus"><Pause size={15}/><span>Paused</span></div>:<div className="backgroundRunStatus error"><span>{currentRun.error==='quota_exhausted'?`Token quota used up${currentRun.activity?.quota?.resetAt?` · resets ${new Date(currentRun.activity.quota.resetAt).toLocaleTimeString()}`:''}`:currentRun.error==='pending_chat_rate_limited'?`Please wait ${currentRun.activity?.retryAfterSeconds||1}s before trying again.`:currentRun.error||'Run stopped before completion.'}</span></div>}</div><div className="runControls">{currentRun.status==='running'||currentRun.status==='queued'?<button type="button" disabled={localBusy} onClick={()=>void controlRun('pause')}><Pause size={13}/>Pause</button>:currentRun.status==='paused'||currentRun.status==='failed'||currentRun.status==='cancelled'?<button type="button" disabled={localBusy} onClick={()=>void controlRun('resume')}><Play size={13}/>Play</button>:null}</div><RunActivityDetails run={currentRun}/></div></div>:null}
        </div>}
      </div>

      <div className="composerDock">
        {resetGiftNotice?<div className="notice resetGiftNotice"><div><strong>Quota reset received</strong><span>{resetGiftNotice}</span></div><button type="button" className="btn compact ghost" onClick={()=>setResetGiftNotice('')}>Got it</button></div>:null}
        {!quotaBlocked&&resetsAvailable>0?<div className="notice resetGiftNotice persistent"><div><strong>{resetsAvailable} quota reset{resetsAvailable===1?'':'s'} available</strong><span>Use one when your token quota is blocked{resetCredits?.nextExpiry?` · earliest expiry ${new Date(resetCredits.nextExpiry).toLocaleString()}`:''}</span></div></div>:null}
        {quota?.mode==='limited'?<div className={`notice ${quotaBlocked?'quotaNoticeExhausted':'butter'} quotaNotice`}><div><strong>{quotaBlocked?'Token quota blocked':`${fmtTokens(Number(quota.used||usageInfo?.usage?.totalTokens||0))} / ${fmtTokens(Number(quota.limit||0))} tokens used`}</strong><span>{quotaBlocked?`Natural reset${quota.resetAt?` in ${resetRemainingLabel} (${new Date(quota.resetAt).toLocaleTimeString()})`:''}`:`${fmtTokens(Number(quota.remaining||0))} remaining · resets ${quota.resetAt?new Date(quota.resetAt).toLocaleTimeString():'—'}`}</span>{resetsAvailable>0?<small>{resetsAvailable} reset{resetsAvailable===1?'':'s'} available{resetCredits?.nextExpiry?` · expires ${new Date(resetCredits.nextExpiry).toLocaleString()}`:''}</small>:null}</div>{quotaBlocked&&resetsAvailable>0?<button type="button" className="btn compact primary" disabled={resetBusy} onClick={()=>void redeemQuotaReset()}>{resetBusy?'Resetting…':'Use 1 reset & retry'}</button>:null}</div>:null}
        <form className="composerBox" onSubmit={submit}>
          {attachments.length||uploading?<div className="attachmentTray">{attachments.map(a=><div className="attachmentChip" key={a.id}><span className="attachmentIcon">{a.mediaType.startsWith('image/')?<ImageIcon size={16}/>:a.source==='folder'?<FolderOpen size={16}/>:<File size={16}/>}</span><div><strong>{a.name}</strong><small>{a.source==='folder'?a.relativePath:size(a.sizeBytes)} · {a.extractStatus}</small></div><button type="button" aria-label={`Remove ${a.name}`} onClick={()=>void removeAttachment(a)}><X size={14}/></button></div>)}{uploading?<div className="attachmentChip uploading"><span className="attachmentIcon"><Paperclip size={16}/></span><div><strong>Uploading…</strong><small>{uploading} file{uploading>1?'s':''}</small></div></div>:null}</div>:null}
          {uploadError?<div className="attachmentError">{uploadError}</div>:null}
          <div className="composerRow"><div className="attachmentMenuWrap"><button className="attachBtn" type="button" aria-label="Add attachment" disabled={pending||busy} onClick={()=>setAttachMenu(x=>!x)}><Plus size={20}/></button>{attachMenu?<div className="attachmentMenu"><button type="button" onClick={()=>imageRef.current?.click()}><ImageIcon size={17}/><span><strong>Image</strong><small>PNG, JPEG, WebP and more</small></span></button><button type="button" onClick={()=>fileRef.current?.click()}><File size={17}/><span><strong>File</strong><small>Text, code, data or documents</small></span></button><button type="button" onClick={()=>folderRef.current?.click()}><FolderOpen size={17}/><span><strong>Folder</strong><small>Upload a project directory</small></span></button></div>:null}</div><textarea ref={textareaRef} className="chatInput" rows={1} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder={pending?'Message Daiki…':'Message Daiki'}/><button className="sendBtn" aria-label="Send message" disabled={busy||uploading>0||quotaBlocked||(!text.trim()&&!attachments.length)} type="submit"><Send size={18}/></button></div>
          <input ref={imageRef} hidden type="file" accept="image/*" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'image');e.currentTarget.value=''}}/><input ref={fileRef} hidden type="file" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'file');e.currentTarget.value=''}}/><input ref={folderRef} hidden type="file" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'folder');e.currentTarget.value=''}}/>
        </form>
        <div className="composerHint">Daiki can make mistakes. Check important information.</div>
      </div>
    </section>
  </div>;
}
