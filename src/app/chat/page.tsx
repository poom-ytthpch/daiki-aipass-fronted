'use client';

import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {Check,Copy,File,FolderOpen,Globe2,History,Image as ImageIcon,Menu,Paperclip,Pencil,Plus,Search,Send,Trash2,X} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Attachment={id:string;name:string;relativePath:string;source:'file'|'image'|'folder';mediaType:string;sizeBytes:number;extractStatus:string;createdAt:string};
type Msg={role:'user'|'ai';text:string;attachments?:Attachment[];researchSources?:number};
type ChatSession={id:string;title:string;modelAlias:string;createdAt:string;updatedAt:string};
type StoredMessage={id:number;role:'user'|'assistant';content:string;attachmentIds:string[];createdAt:string};
type PendingPolicy={model:string;tokenLimitPerDay:number;requestsPerHour:number;minIntervalSeconds:number;maxCompletionTokens:number;textOnly:boolean};
type Account={status?:'pending'|'approved'|'suspended'|'rejected';pendingChatPolicy?:PendingPolicy};
type Prefs={defaultModel?:string;responseStyle?:string;researchMode?:'auto'|'web'|'off'};
type CapabilityInfo={mode:string;maxToolRounds:number;skills:{id:string;name:string;description:string}[];tools:{id:string;name:string;description:string}[]};

const routes=[['auto','Auto'],['fast','Fast'],['balanced','Balanced'],['deep','Deep']] as const;
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

export default function Chat(){
  const [text,setText]=useState('');
  const [busy,setBusy]=useState(false);
  const [capabilities,setCapabilities]=useState<CapabilityInfo|null>(null);
  const [uploading,setUploading]=useState(0);
  const [model,setModel]=useState('auto');
  const [researchMode,setResearchMode]=useState<'auto'|'web'|'off'>('auto');
  const [account,setAccount]=useState<Account|null>(null);
  const [msgs,setMsgs]=useState<Msg[]>([]);
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
  const fileRef=useRef<HTMLInputElement>(null);
  const imageRef=useRef<HTMLInputElement>(null);
  const folderRef=useRef<HTMLInputElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const scrollRef=useRef<HTMLDivElement>(null);
  const [copiedIndex,setCopiedIndex]=useState<number|null>(null);

  useEffect(()=>{
    folderRef.current?.setAttribute('webkitdirectory','');
    folderRef.current?.setAttribute('directory','');
    const prefTimer=window.setTimeout(()=>{
      try{
        const p=JSON.parse(localStorage.getItem('daiki_preferences')||'{}') as Prefs;
        if(p.defaultModel)setModel(p.defaultModel);
        if(p.researchMode)setResearchMode(p.researchMode);
      }catch{}
    },0);
    void fetch('/api/account',{cache:'no-store'}).then(async r=>{if(r.ok){const a=await r.json() as Account;setAccount(a);if(a.status==='pending')setModel('fast')}}).catch(()=>{});
    void fetch('/api/chat-sessions',{cache:'no-store'}).then(async r=>{if(r.ok){const d=await r.json() as {sessions:ChatSession[]};setSessions(d.sessions||[])}}).catch(()=>{});
    void fetch('/api/capabilities',{cache:'no-store'}).then(async r=>{if(r.ok)setCapabilities(await r.json() as CapabilityInfo)}).catch(()=>{});
    return()=>window.clearTimeout(prefTimer);
  },[]);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})},[msgs]);
  useEffect(()=>{const el=textareaRef.current;if(!el)return;el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,180)}px`},[text]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setHistoryOpen(false);setAttachMenu(false)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
  const copyAnswer=async(text:string,index:number)=>{try{await navigator.clipboard.writeText(text);setCopiedIndex(index);window.setTimeout(()=>setCopiedIndex(null),1400)}catch{}};

  const pending=account?.status==='pending';
  const currentSession=sessions.find(x=>x.id===sessionId);
  const filteredSessions=useMemo(()=>{
    const q=historyQuery.trim().toLowerCase();
    return q?sessions.filter(s=>s.title.toLowerCase().includes(q)):sessions;
  },[sessions,historyQuery]);
  const refreshSessions=async()=>{const r=await fetch('/api/chat-sessions',{cache:'no-store'});if(r.ok){const d=await r.json() as {sessions:ChatSession[]};setSessions(d.sessions||[])}};
  const newChat=()=>{if(busy)return;setSessionId('');setMsgs([]);setAttachments([]);setText('');setUploadError('');setHistoryOpen(false)};
  const openSession=async(id:string)=>{
    if(busy)return;
    setHistoryBusy(true);
    try{
      const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{cache:'no-store'});
      if(!r.ok)return;
      const d=await r.json() as {session:ChatSession;messages:StoredMessage[]};
      setSessionId(d.session.id);setModel(d.session.modelAlias||'auto');
      setMsgs((d.messages||[]).map(m=>({role:m.role==='assistant'?'ai':'user',text:m.content})));
      setAttachments([]);setText('');setHistoryOpen(false);
    }finally{setHistoryBusy(false)}
  };
  const deleteSession=async(id:string)=>{if(busy)return;const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{method:'DELETE'});if(r.ok){if(sessionId===id)newChat();await refreshSessions()}};
  const renameSession=async(id:string)=>{
    const title=renameText.trim();if(!title)return;
    const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({title})});
    if(r.ok){const updated=await r.json() as ChatSession;setSessions(xs=>xs.map(x=>x.id===id?updated:x));setRenamingId('');setRenameText('')}
  };
  const ensureSession=async(title:string)=>{
    if(sessionId)return sessionId;
    const r=await fetch('/api/chat-sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:title.slice(0,80)||'New chat',modelAlias:pending?'fast':model})});
    if(!r.ok)throw new Error('Could not create chat session');
    const x=await r.json() as ChatSession;setSessionId(x.id);setSessions(old=>[x,...old]);return x.id;
  };
  const updateSessionModel=async(next:string)=>{
    setModel(next);
    if(!sessionId)return;
    const r=await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({modelAlias:next})});
    if(r.ok){const updated=await r.json() as ChatSession;setSessions(xs=>xs.map(x=>x.id===updated.id?updated:x))}
  };
  const saveSessionMessage=async(id:string,role:'user'|'assistant',content:string,attachmentIds:string[]=[])=>{const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role,content,attachmentIds})});if(!r.ok)throw new Error('Could not save chat history')};
  const uploadOne=async(file:File,source:'file'|'image'|'folder')=>{const form=new FormData();form.set('file',file);form.set('source',source);form.set('relativePath',source==='folder'?rel(file):file.name);const r=await fetch('/api/attachments',{method:'POST',body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||`Could not upload ${file.name}`);return d as Attachment};
  const uploadFiles=async(files:FileList|File[],source:'file'|'image'|'folder')=>{
    if(pending||busy)return;const list=Array.from(files);if(!list.length)return;
    setAttachMenu(false);setUploadError('');setUploading(x=>x+list.length);
    try{const uploaded:Attachment[]=[];for(const f of list)uploaded.push(await uploadOne(f,source));setAttachments(x=>[...x,...uploaded])}
    catch(e){setUploadError(e instanceof Error?e.message:String(e))}
    finally{setUploading(x=>Math.max(0,x-list.length))}
  };
  const removeAttachment=async(a:Attachment)=>{setAttachments(x=>x.filter(v=>v.id!==a.id));void fetch(`/api/attachments/${encodeURIComponent(a.id)}`,{method:'DELETE'}).catch(()=>{})};
  const send=async()=>{
    if((!text.trim()&&!attachments.length)||busy||uploading>0)return;
    setBusy(true);setAttachMenu(false);setUploadError('');
    const q=text.trim();const currentAttachments=[...attachments];
    const userMsg:Msg={role:'user',text:q||'Please review the attached content.',attachments:currentAttachments};
    try{
      const history=[...msgs,userMsg];
      const current=await ensureSession(userMsg.text);
      await saveSessionMessage(current,'user',userMsg.text,currentAttachments.map(a=>a.id));
      setMsgs([...history,{role:'ai',text:''}]);setText('');setAttachments([]);
      const r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({model:pending?'fast':model,researchMode,messages:history.map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text})),attachmentIds:currentAttachments.map(a=>a.id),stream:true})});
      if(!r.ok||!r.body){const d=await r.json().catch(()=>({error:'Gateway unavailable'}));const suffix=d.retryAfterSeconds?` Try again in ${d.retryAfterSeconds}s.`:'';throw new Error((errorText(d.error||d.detail)||'Gateway unavailable')+suffix)}
      const researchSources=Number(r.headers.get('x-daiki-research-sources')||0);
      if(researchSources>0)setMsgs(x=>x.map((m,i)=>i===x.length-1?{...m,researchSources}:m));
      const reader=r.body.getReader();const dec=new TextDecoder();let buf='';let answer='';
      while(true){
        const {done,value}=await reader.read();if(done)break;
        buf+=dec.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop()||'';
        for(const raw of lines){
          const line=raw.trim();if(!line.startsWith('data:'))continue;
          const data=line.slice(5).trim();if(!data||data==='[DONE]')continue;
          try{const j=JSON.parse(data);if(j?.error)throw new Error(errorText(j.error));const chunk=j?.choices?.[0]?.delta?.content||'';if(chunk){answer+=chunk;setMsgs(x=>x.map((m,i)=>i===x.length-1?{...m,text:answer}:m))}}
          catch(err){if(err instanceof Error&&err.message)throw err}
        }
      }
      if(answer){await saveSessionMessage(current,'assistant',answer);await refreshSessions()}
      else setMsgs(x=>x.map((m,i)=>i===x.length-1?{...m,text:'I didn’t get a response back. Please try again.'}:m));
    }catch(e){
      const message=e instanceof Error?e.message:String(e);
      setMsgs(x=>{const last=x[x.length-1];if(last?.role==='ai'&&!last.text)return x.map((m,i)=>i===x.length-1?{...m,text:`I couldn’t connect: ${message}`}:m);return [...x,{role:'ai',text:`I couldn’t connect: ${message}`}]});
    }finally{setBusy(false)}
  };
  const submit=(e:FormEvent)=>{e.preventDefault();void send()};

  return <div className="chatPage">
    {historyOpen?<button className="chatHistoryBackdrop" aria-label="Close history" onClick={()=>setHistoryOpen(false)}/>:null}
    <aside className={`chatHistory ${historyOpen?'open':''}`}>
      <div className="chatHistoryHead"><button className="newChatButton" type="button" onClick={newChat}><Plus size={17}/><span>New chat</span></button><button className="historyClose" type="button" aria-label="Close history" onClick={()=>setHistoryOpen(false)}><X size={18}/></button></div>
      <label className="historySearch"><Search size={15}/><input value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)} placeholder="Search chats"/></label>
      <div className="historyList chatHistoryList">
        {filteredSessions.length?filteredSessions.map(s=><div key={s.id} className={`historyItem ${sessionId===s.id?'active':''}`}>
          {renamingId===s.id?<form className="renameForm" onSubmit={e=>{e.preventDefault();void renameSession(s.id)}}><input autoFocus value={renameText} onChange={e=>setRenameText(e.target.value)} onBlur={()=>{if(renameText.trim())void renameSession(s.id);else setRenamingId('')}}/></form>:<button type="button" disabled={historyBusy||busy} onClick={()=>void openSession(s.id)}><History size={14}/><span><strong>{s.title}</strong><small>{new Date(s.updatedAt).toLocaleDateString()}</small></span></button>}
          <div className="historyActions"><button type="button" aria-label={`Rename ${s.title}`} onClick={()=>{setRenamingId(s.id);setRenameText(s.title)}}><Pencil size={12}/></button><button type="button" aria-label={`Delete ${s.title}`} onClick={()=>void deleteSession(s.id)}><Trash2 size={12}/></button></div>
        </div>):<div className="historyEmpty">{historyQuery?'No matching chats':'Your chats will appear here.'}</div>}
      </div>
      {capabilities?<div className="chatHistoryFoot"><span>Smart Assist</span><strong>On</strong><small>{capabilities.skills.length} skills · {capabilities.tools.length} tools</small></div>:null}
    </aside>

    <section className="chatStage">
      <header className="chatTopbar">
        <div className="chatTopbarTitle"><button className="iconButton historyToggle" type="button" aria-label="Open chat history" onClick={()=>setHistoryOpen(true)}><Menu size={19}/></button><div><strong>{currentSession?.title||'New chat'}</strong><small>{busy?'Daiki is thinking…':'Daiki AI Passport'}</small></div></div>
        <div className="chatTopbarControls">
          <select aria-label="Research mode" value={researchMode} onChange={e=>{const v=e.target.value as 'auto'|'web'|'off';setResearchMode(v);try{const p=JSON.parse(localStorage.getItem('daiki_preferences')||'{}');localStorage.setItem('daiki_preferences',JSON.stringify({...p,researchMode:v}))}catch{}}}><option value="auto">Web: Auto</option><option value="web">Web: On</option><option value="off">Web: Off</option></select>
          <select aria-label="Model route" value={pending?'fast':model} disabled={pending} onChange={e=>void updateSessionModel(e.target.value)}>{(pending?[['fast','Fast'] as const]:routes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
        </div>
      </header>

      <div className="chatScroll" ref={scrollRef} onDragOver={e=>{if(!pending)e.preventDefault()}} onDrop={e=>{if(pending)return;e.preventDefault();void uploadFiles(e.dataTransfer.files,'file')}}>
        {!msgs.length?<div className="chatEmptyState"><div className="emptyMark">D</div><h1>What can I help with?</h1><p>Ask anything, research the web, or drop in files and project folders.</p><div className="promptStarters">{starters.map(([label,prompt])=><button key={label} type="button" onClick={()=>setText(prompt)}><span>{label}</span><small>{prompt}</small></button>)}</div></div>:<div className="messageFeed">{msgs.map((m,i)=><div key={i} className={`messageRow ${m.role}`}><div className="messageAvatar">{m.role==='ai'?'D':'You'}</div><div className="messageStack"><div className="bubble"><MessageContent message={m}/></div>{m.role==='ai'&&m.text?<div className="messageActions"><button type="button" aria-label="Copy response" onClick={()=>void copyAnswer(m.text,i)}>{copiedIndex===i?<Check size={13}/>:<Copy size={13}/>}<span>{copiedIndex===i?'Copied':'Copy'}</span></button></div>:null}{m.researchSources?<span className="researchBadge"><Globe2 size={12}/>Web searched · {m.researchSources} sources</span>:null}{m.attachments?.length?<div className="sentAttachments">{m.attachments.map(a=><a key={a.id} className="sentAttachment" href={`/api/attachments/${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer">{a.mediaType.startsWith('image/')?<ImageIcon size={14}/>:a.source==='folder'?<FolderOpen size={14}/>:<File size={14}/>}<span>{a.relativePath}</span></a>)}</div>:null}</div></div>)}</div>}
      </div>

      <div className="composerDock">
        <form className="composerBox" onSubmit={submit}>
          {attachments.length||uploading?<div className="attachmentTray">{attachments.map(a=><div className="attachmentChip" key={a.id}><span className="attachmentIcon">{a.mediaType.startsWith('image/')?<ImageIcon size={16}/>:a.source==='folder'?<FolderOpen size={16}/>:<File size={16}/>}</span><div><strong>{a.name}</strong><small>{a.source==='folder'?a.relativePath:size(a.sizeBytes)} · {a.extractStatus}</small></div><button type="button" aria-label={`Remove ${a.name}`} onClick={()=>void removeAttachment(a)}><X size={14}/></button></div>)}{uploading?<div className="attachmentChip uploading"><span className="attachmentIcon"><Paperclip size={16}/></span><div><strong>Uploading…</strong><small>{uploading} file{uploading>1?'s':''}</small></div></div>:null}</div>:null}
          {uploadError?<div className="attachmentError">{uploadError}</div>:null}
          <div className="composerRow"><div className="attachmentMenuWrap"><button className="attachBtn" type="button" aria-label="Add attachment" disabled={pending||busy} onClick={()=>setAttachMenu(x=>!x)}><Plus size={20}/></button>{attachMenu?<div className="attachmentMenu"><button type="button" onClick={()=>imageRef.current?.click()}><ImageIcon size={17}/><span><strong>Image</strong><small>PNG, JPEG, WebP and more</small></span></button><button type="button" onClick={()=>fileRef.current?.click()}><File size={17}/><span><strong>File</strong><small>Text, code, data or documents</small></span></button><button type="button" onClick={()=>folderRef.current?.click()}><FolderOpen size={17}/><span><strong>Folder</strong><small>Upload a project directory</small></span></button></div>:null}</div><textarea ref={textareaRef} className="chatInput" rows={1} value={text} onChange={e=>setText(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}} placeholder={pending?'Message Daiki…':'Message Daiki'}/><button className="sendBtn" aria-label="Send message" disabled={busy||uploading>0||(!text.trim()&&!attachments.length)} type="submit"><Send size={18}/></button></div>
          <input ref={imageRef} hidden type="file" accept="image/*" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'image');e.currentTarget.value=''}}/><input ref={fileRef} hidden type="file" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'file');e.currentTarget.value=''}}/><input ref={folderRef} hidden type="file" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'folder');e.currentTarget.value=''}}/>
        </form>
        <div className="composerHint">Daiki can make mistakes. Check important information.</div>
      </div>
    </section>
  </div>;
}
