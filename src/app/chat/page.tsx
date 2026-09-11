'use client';

import Link from 'next/link';
import {FormEvent,useEffect,useMemo,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Brain,Check,Copy,File,FolderOpen,Globe2,Image as ImageIcon,MoreHorizontal,Paperclip,Pause,Pencil,Pin,PinOff,Play,Plus,RotateCcw,Search,Send,Trash2,X} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Attachment={id:string;name:string;relativePath:string;source:'file'|'image'|'folder'|'generated-file'|'generated-image';mediaType:string;sizeBytes:number;extractStatus:string;createdAt:string};
type TokenUsage={input:number;reasoning:number;answer:number;total:number};
type RunSource={index?:number;title?:string;url?:string;engine?:string;snippet?:string;region?:string;authority?:string;sourceType?:string;platform?:string;stage?:string;qualityScore?:number;relevanceScore?:number;freshnessScore?:number;authorityScore?:number;evidenceScore?:number};
type ResetGrant={id:number;remainingResets:number;totalResets?:number;expiresAt:string;createdAt?:string;note?:string};
type ResetCredits={available:number;nextExpiry?:string;lastResetAt?:string;grants?:ResetGrant[]};
type QuotaLimitState={id:string;primary?:boolean;limit:number;used:number;remaining:number;resetAt?:string;interval:string;intervalCount?:number;windowStart?:string};
type QuotaState={mode?:string;limit?:number;used?:number;remaining?:number;resetAt?:string;interval?:string;intervalCount?:number;windowStart?:string;blocked?:boolean;blockingLimitId?:string;limits?:QuotaLimitState[];resetCredits?:ResetCredits};
type UsageResponse={usage?:{inputTokens?:number;outputTokens?:number;totalTokens?:number};quota?:QuotaState};
type RunActivity={phase?:string;durationMs?:number;requestId?:string;httpStatus?:number;retryAfterSeconds?:number;quota?:QuotaState;research?:{mode?:string;query?:string;resolvedQuery?:string;used?:boolean;error?:string;sourceCount?:number;sources?:RunSource[];region?:string;locale?:string;scope?:string;depth?:string;focus?:string;phase?:string;queries?:string[];localSourceCount?:number;globalSourceCount?:number;socialSourceCount?:number;socialPlatforms?:string[];qualityScore?:number;qualityGrade?:string};thinking?:{mode?:string;reasoningBudget?:number;requestedEffort?:string;effectiveEffort?:string;nativeReasoning?:boolean;model?:string;estimate?:unknown};tokens?:TokenUsage};
type ChatRun={id:string;sessionId:string;status:'queued'|'running'|'paused'|'completed'|'failed'|'cancelled';researchMode:string;thinkingMode:string;commandMode?:string;commandSkills?:string[];requestId?:string;content:string;error?:string;activity?:RunActivity;createdAt:string;startedAt?:string;completedAt?:string;updatedAt:string};
type Msg={id?:number;role:'user'|'ai';text:string;progress?:string;attachments?:Attachment[];sources?:RunSource[];runId?:string;run?:ChatRun};
type ChatSession={id:string;title:string;modelAlias:string;pinnedAt?:string;createdAt:string;updatedAt:string};
type StoredMessage={id:number;role:'user'|'assistant';content:string;attachmentIds:string[];runId?:string;createdAt:string};
type PendingPolicy={model:string;tokenLimitPerDay:number;requestsPerHour:number;minIntervalSeconds:number;maxCompletionTokens:number;textOnly:boolean};
type Account={status?:'pending'|'approved'|'suspended'|'rejected';pendingChatPolicy?:PendingPolicy};
type GuestPolicy={enabled:boolean;model:string;quotaMode?:'limited'|'unlimited';tokenLimit:number;intervalKind:string;requestsPerHour:number;minIntervalSeconds:number;maxCompletionTokens:number;allowUploads:boolean;allowImageGeneration:boolean;allowFileGeneration:boolean;maxUploadBytes:number;maxImageUploadBytes?:number;maxUploadsPerHour:number;maxStoredFiles:number;maxStoredBytes:number;maxAttachmentsPerMessage?:number;attachmentRetentionHours:number;imageGenerationsPerDay:number;fileGenerationsPerDay:number;maxGeneratedFileBytes:number;maxGeneratedImageBytes?:number;quota?:QuotaState;rateRetryAfterSeconds?:number};
type ThinkingMode='off'|'low'|'medium'|'high';
type Prefs={defaultModel?:string;responseStyle?:string;researchMode?:'auto'|'web'|'off';thinkingMode?:ThinkingMode};
type CommandOption={id:string;name:string;description:string;guest?:boolean};
type CommandCatalog={modes:CommandOption[];skills:CommandOption[]};
type CapabilityInfo={mode:string;maxToolRounds:number;skills:{id:string;name:string;description:string}[];tools:{id:string;name:string;description:string}[];commands?:CommandCatalog};
type GuestHistoryEntry={role:'user'|'ai';text:string};
type GuestAutoContinueReason='guest_rate_limited'|'guest_quota_exhausted'|'provider_rate_limited'|'transport_retry';
type DeepSearchScope='local-first'|'local-only'|'global';
type ResearchPrefs={region:string;locale:string;scope:DeepSearchScope;depth:'standard'|'deep';focus:string};
type DeepSearchEvidence='balanced'|'official'|'social';
type DeepSearchWizardState={step:number;prefs:ResearchPrefs;prompt:string;evidence:DeepSearchEvidence};
type PendingGuestTurn={id:string;history:GuestHistoryEntry[];attachments:Attachment[];commandMode:string;commandSkills:string[];research:ResearchPrefs;reason:GuestAutoContinueReason;retryAt:number;attempts:number;createdAt:number};
type GuestQuotaError={error?:unknown;detail?:unknown;retryAfterSeconds?:number;quota?:QuotaState};
const AUTO_CONTINUE_POLL_MS=20_000;
const PENDING_GUEST_TURN_KEY='daiki_guest_pending_turn_v1';
const browserResearchPrefs=(depth:'standard'|'deep'='standard'):ResearchPrefs=>{
  if(typeof window==='undefined')return {region:'GLOBAL',locale:'en',scope:'global',depth,focus:''};
  const locale=(navigator.language||'en').slice(0,32);
  let timezone='';try{timezone=Intl.DateTimeFormat().resolvedOptions().timeZone||''}catch{}
  const thailand=timezone==='Asia/Bangkok'||locale.toLowerCase().startsWith('th');
  return {region:thailand?'TH':'GLOBAL',locale,scope:thailand?'local-first':'global',depth,focus:''};
};
const deepSearchFocusOptions=(prompt:string)=>{
  const thai=prefersThai(prompt);
  return thai?[
    {id:'decision',label:'ข้อมูลสำคัญสำหรับตัดสินใจ',detail:'เน้นข้อเท็จจริงล่าสุด ราคา ความพร้อมใช้ และประเด็นที่มีผลต่อการตัดสินใจ',focus:'ข้อมูลล่าสุดที่สำคัญต่อการตัดสินใจ ราคา ความพร้อมใช้ และข้อจำกัด'},
    {id:'technical',label:'สเปก สมรรถนะ และเทคโนโลยี',detail:'เจาะรายละเอียดทางเทคนิค ความสามารถ ข้อจำกัด และเอกสารจากผู้ผลิต',focus:'สเปก สมรรถนะ เทคโนโลยี ข้อจำกัด และข้อมูลทางเทคนิคจากแหล่งทางการ'},
    {id:'market',label:'ราคา รุ่นย่อย โปรโมชั่น และข้อมูลในไทย',detail:'เน้นตลาดไทย ตัวแทนจำหน่าย การรับประกัน ศูนย์บริการ และโปรโมชันล่าสุด',focus:'ราคา รุ่นย่อย โปรโมชั่น ตัวแทนจำหน่าย การรับประกัน ศูนย์บริการ และตลาดประเทศไทย'},
    {id:'compare',label:'เปรียบเทียบตัวเลือกและคู่แข่ง',detail:'เทียบข้อดีข้อเสีย ความคุ้มค่า และตัวเลือกที่ใกล้เคียงกัน',focus:'เปรียบเทียบคู่แข่ง ข้อดีข้อเสีย ความคุ้มค่า และทางเลือกที่ใกล้เคียง'},
  ]:[
    {id:'decision',label:'Decision-relevant facts',detail:'Prioritize current facts, pricing, availability and constraints that affect a decision.',focus:'current decision-relevant facts, price, availability and constraints'},
    {id:'technical',label:'Specs, performance and technology',detail:'Go deeper on technical capabilities, limitations and first-party documentation.',focus:'technical specifications, performance, technology, limitations and official documentation'},
    {id:'market',label:'Local market, pricing and availability',detail:'Prioritize local variants, dealers, warranty, service and promotions.',focus:'local market pricing, variants, promotions, dealers, warranty and service'},
    {id:'compare',label:'Competitors and alternatives',detail:'Compare strengths, weaknesses, value and close alternatives.',focus:'competitor comparison, strengths, weaknesses, value and alternatives'},
  ];
};
const deepSearchEvidenceOptions=(prompt:string):Array<{id:DeepSearchEvidence;label:string;detail:string;focus:string}>=>{
  const thai=prefersThai(prompt);
  return thai?[
    {id:'balanced',label:'สมดุลทุกแหล่งข้อมูล',detail:'ใช้แหล่งทางการ ข่าว/เว็บอิสระ และ Social เพื่อ cross-check กัน',focus:'ให้น้ำหนักสมดุลระหว่างแหล่งทางการ แหล่งอิสระ และข้อมูลสาธารณะจาก social/community พร้อม cross-check ข้อเท็จจริงสำคัญ'},
    {id:'official',label:'เน้นแหล่งทางการและข้อมูลยืนยันได้',detail:'ใช้ Social เพื่อหา pain point/กระแส แต่ข้อเท็จจริงหลักต้องยืนยันจากแหล่งทางการหรือหลายแหล่ง',focus:'ให้ความสำคัญกับแหล่งทางการและ primary source เป็นหลัก ใช้ social เพื่อค้นหาประเด็นและประสบการณ์ผู้ใช้เท่านั้น และยืนยันข้อเท็จจริงสำคัญจากแหล่งที่เชื่อถือได้'},
    {id:'social',label:'เน้นเสียงผู้ใช้จริงและ Social',detail:'ค้น Facebook, Instagram, TikTok, YouTube, Reddit, Pantip, X และ Threads มากขึ้น แล้วตรวจสอบข้อเท็จจริงกับแหล่งทางการ',focus:'เน้น public social/community และประสบการณ์ผู้ใช้จริงจาก Facebook Instagram TikTok YouTube Reddit Pantip X Threads พร้อมจัดกลุ่มประเด็นที่เกิดซ้ำ และ corroborate hard facts ด้วยแหล่งทางการ'},
  ]:[
    {id:'balanced',label:'Balanced evidence',detail:'Blend official sources, independent web sources and public social evidence, then cross-check them.',focus:'balance official sources, independent web sources and public social/community evidence, cross-checking important claims'},
    {id:'official',label:'Official & verified first',detail:'Use social to discover issues and sentiment, but verify core facts with primary or independent sources.',focus:'prioritize official and primary sources; use social for issue discovery and user experience, while verifying important claims independently'},
    {id:'social',label:'User voices & social first',detail:'Search Facebook, Instagram, TikTok, YouTube, Reddit, X, Threads and local communities more deeply, then verify hard facts.',focus:'prioritize public social/community user experiences and recurring themes across Facebook Instagram TikTok YouTube Reddit X Threads, while corroborating hard facts with official sources'},
  ];
};
const isGuestAutoContinueReason=(value:string):value is GuestAutoContinueReason=>value==='guest_rate_limited'||value==='guest_quota_exhausted'||value==='provider_rate_limited'||value==='transport_retry';
const retryableRunError=(run?:ChatRun|null)=>Boolean(run?.status==='failed'&&(run.error==='quota_exhausted'||run.error==='pending_chat_rate_limited'));
const runAutoContinueAt=(run?:ChatRun|null)=>{
  if(!run||!retryableRunError(run))return 0;
  if(run.error==='quota_exhausted'){
    const resetAt=run.activity?.quota?.resetAt?new Date(run.activity.quota.resetAt).getTime():0;
    // Lifetime/manual-only quotas are readiness-polled instead of repeatedly
    // invoking inference, which could consume another independent rate limit.
    return Number.isFinite(resetAt)&&resetAt>Date.now()?resetAt:0;
  }
  const updatedAt=new Date(run.updatedAt).getTime();
  const base=Number.isFinite(updatedAt)?updatedAt:Date.now();
  const seconds=Math.max(1,Number(run.activity?.retryAfterSeconds||AUTO_CONTINUE_POLL_MS/1000));
  return base+seconds*1000;
};
const quotaAutoContinueAt=(payload:GuestQuotaError,response?:Response)=>{
  const headerSeconds=Number(response?.headers.get('retry-after')||0);
  const seconds=Math.max(0,Number(payload.retryAfterSeconds||headerSeconds||0));
  if(seconds>0)return Date.now()+seconds*1000;
  const resetAt=payload.quota?.resetAt?new Date(payload.quota.resetAt).getTime():0;
  if(Number.isFinite(resetAt)&&resetAt>Date.now())return resetAt;
  return Date.now()+AUTO_CONTINUE_POLL_MS;
};
const autoContinueTimeLabel=(retryAt:number,now:number)=>{
  const seconds=Math.max(0,Math.ceil((retryAt-now)/1000));
  if(seconds<60)return `${seconds}s`;
  const minutes=Math.floor(seconds/60);const remainder=seconds%60;
  return remainder?`${minutes}m ${remainder}s`:`${minutes}m`;
};
const guestTurnMessages=(turn:PendingGuestTurn):Msg[]=>{
  let lastUser=-1;
  for(let i=turn.history.length-1;i>=0;i--){if(turn.history[i].role==='user'){lastUser=i;break}}
  return turn.history.map((m,i)=>({role:m.role,text:m.text,attachments:i===lastUser?turn.attachments:undefined}));
};
const guestDeviceHeaders=()=>{
  if(typeof window==='undefined')return {} as Record<string,string>;
  let id=localStorage.getItem('daiki_guest_device_id')||'';
  if(!id){id=globalThis.crypto?.randomUUID?.()||`web-${Date.now()}-${Math.random().toString(36).slice(2)}`;localStorage.setItem('daiki_guest_device_id',id)}
  const nav=navigator as Navigator&{userAgentData?:{platform?:string}};
  const detected=(nav.userAgentData?.platform||navigator.platform||'Browser').trim();
  const name=(localStorage.getItem('daiki_guest_device_name')||detected||'Browser').slice(0,120);
  document.cookie=`daiki_guest_device_id=${encodeURIComponent(id)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  document.cookie=`daiki_guest_device_name=${encodeURIComponent(name)}; Path=/; Max-Age=31536000; SameSite=Lax`;
  return {'x-daiki-guest-device-id':id,'x-daiki-guest-device-name':name};
};

const routes=[['auto','Auto'],['fast','Fast'],['balanced','Balanced'],['deep','Deep']] as const;
const thinkingLevels=[
  {id:'off' as const,label:'Off',effort:'none',completion:1024,description:'Fastest. Native reasoning is disabled when the selected model supports it.'},
  {id:'low' as const,label:'Low',effort:'low',completion:1536,description:'Light native reasoning for short checks and straightforward decisions.'},
  {id:'medium' as const,label:'Medium',effort:'medium',completion:2560,description:'Balanced native reasoning for analysis, coding and multi-step questions.'},
  {id:'high' as const,label:'High',effort:'high',completion:4096,description:'Deeper native reasoning for difficult analysis, edge cases and complex planning.'},
];
type HistoryGroup={label:string;sessions:ChatSession[]};
function groupChatSessions(rows:ChatSession[]):HistoryGroup[]{
  const pinned=rows.filter(x=>Boolean(x.pinnedAt));
  const recent=rows.filter(x=>!x.pinnedAt);
  const groups:HistoryGroup[]=[];
  if(pinned.length)groups.push({label:'Pinned',sessions:pinned});
  if(recent.length)groups.push({label:'Recents',sessions:recent});
  return groups;
}
const fmtTokens=(n:number)=>n>=1_000_000?`${Number((n/1_000_000).toFixed(n>=10_000_000?0:2))}M`:n>=1000?`${Number((n/1000).toFixed(n>=100_000?0:1))}K`:String(Math.max(0,Math.round(n)));
const starters=[
  ['Explain','Explain this simply: '],
  ['Plan','Make a practical plan for '],
  ['Research','Research the latest information about '],
  ['Build','Help me build '],
] as const;
const size=(n:number)=>n<1024?`${n} B`:n<1024*1024?`${(n/1024).toFixed(1)} KB`:`${(n/1024/1024).toFixed(1)} MB`;
const rel=(f:File)=>(f as File & {webkitRelativePath?:string}).webkitRelativePath||f.name;
const attachmentAutoSkill=(a:Pick<Attachment,'name'|'mediaType'|'source'>)=>{
  const mime=(a.mediaType||'').toLowerCase().split(';')[0].trim();const ext=a.name.toLowerCase().match(/\.[^.]+$/)?.[0]||'';
  if(a.source==='image'||mime.startsWith('image/'))return 'image';
  if(ext==='.pdf'||mime==='application/pdf')return 'pdf';
  if(['.xlsx','.xls','.xlsm','.ods'].includes(ext)||mime.includes('spreadsheet')||mime.includes('excel')||mime.includes('opendocument.spreadsheet'))return 'sheet';
  if(['.csv','.tsv'].includes(ext)||mime==='text/csv'||mime==='text/tab-separated-values')return 'csv';
  if(['.json','.jsonl','.ndjson'].includes(ext)||mime.includes('json'))return 'data';
  if(['.js','.jsx','.ts','.tsx','.mjs','.cjs','.py','.go','.rs','.java','.kt','.swift','.c','.cc','.cpp','.h','.hpp','.sql','.sh','.bash','.zsh','.graphql','.gql'].includes(ext))return 'code';
  return 'document';
};
const mergeAttachmentAutoSkills=(current:string[],rows:Attachment[])=>{
  const next=[...current];for(const row of rows){const skill=attachmentAutoSkill(row);if(!next.includes(skill)&&next.length<4)next.push(skill)}return next;
};
type GeneratedFileFormat='csv'|'pdf'|'json'|'md'|'txt';
const requestedFileGenerationFormat=(value:string):GeneratedFileFormat|''=>{
  const text=value.trim().toLowerCase();if(!text)return '';
  const has=(patterns:RegExp[])=>patterns.some(pattern=>pattern.test(text));
  if(has([/(?:generate|create|make|export|save)(?:\s|.{0,24})+(?:a\s+)?pdf\b/i,/(?:สร้าง|ทำ|ส่งออก|บันทึก)(?:.{0,24})(?:ไฟล์|รายงาน|เอกสาร)?\s*(?:เป็น)?\s*(?:pdf|พีดีเอฟ)/i]))return 'pdf';
  if(has([/(?:generate|create|make|export|save)(?:\s|.{0,24})+(?:a\s+)?csv\b/i,/(?:สร้าง|ทำ|ส่งออก|บันทึก)(?:.{0,24})(?:ไฟล์|ตาราง|ข้อมูล)?\s*(?:เป็น)?\s*(?:csv|ซีเอสวี)/i]))return 'csv';
  if(has([/(?:generate|create|make|export|save)(?:\s|.{0,24})+json\b/i,/(?:สร้าง|ทำ|ส่งออก|บันทึก)(?:.{0,24})json/i]))return 'json';
  if(has([/(?:generate|create|make|export|save)(?:\s|.{0,24})+(?:markdown|\.md)\b/i,/(?:สร้าง|ทำ|ส่งออก|บันทึก)(?:.{0,24})(?:markdown|มาร์กดาวน์)/i]))return 'md';
  if(has([/(?:generate|create|make)(?:\s|.{0,16})+(?:a\s+)?(?:text\s+)?file\b/i,/(?:สร้างไฟล์|ทำไฟล์)(?:ข้อความ)?/i]))return 'txt';
  return '';
};
const errorText=(value:unknown):string=>{
  if(typeof value==='string')return value;
  if(value&&typeof value==='object'){
    const v=value as Record<string,unknown>;
    for(const key of ['message','detail','error']){const text=errorText(v[key]);if(text)return text}
    try{return JSON.stringify(value)}catch{return 'Gateway unavailable'}
  }
  return value==null?'':String(value);
};
const errorCode=(value:unknown):string=>{
  if(typeof value==='string')return value.trim().toLowerCase();
  if(value&&typeof value==='object'){
    const v=value as Record<string,unknown>;
    if(typeof v.code==='string'&&v.code.trim())return v.code.trim().toLowerCase();
    if(v.error!==undefined)return errorCode(v.error);
  }
  return '';
};
const prefersThai=(text:string)=>/[\u0E00-\u0E7F]/.test(text)||(typeof navigator!=='undefined'&&navigator.language?.toLowerCase().startsWith('th'));
const guestProgressLabel=(turn:PendingGuestTurn,stage:'analyzing'|'generating')=>{
  const latest=[...turn.history].reverse().find(m=>m.role==='user')?.text||'';
  const thai=prefersThai(latest);
  if(stage==='generating')return thai?'กำลังสร้างคำตอบ…':'Generating response…';
  if(turn.attachments.some(a=>a.mediaType.startsWith('image/')))return thai?'กำลังอ่านรูปภาพและวิเคราะห์…':'Reading the image and analyzing…';
  if(turn.attachments.length)return thai?'กำลังอ่านไฟล์และวิเคราะห์…':'Reading the attachment and analyzing…';
  return thai?'กำลังวิเคราะห์คำถาม…':'Analyzing your question…';
};
const runProgressLabel=(run:ChatRun,messages:Msg[])=>{
  const latest=[...messages].reverse().find(m=>m.role==='user');
  const thai=prefersThai(latest?.text||'');
  const research=run.activity?.research;
  const phase=research?.phase||'';
  if(run.commandMode==='deep-search'||research?.depth==='deep'){
    if(phase==='planning'||run.status==='queued')return thai?'กำลังวางแผนการค้นคว้า…':'Planning the research…';
    if(phase==='searching-local')return thai?'กำลังค้นหาแหล่งข้อมูลในประเทศไทยก่อน…':'Searching local sources first…';
    if(phase==='searching-social-local')return thai?'กำลังค้นหา Facebook, Instagram, TikTok และ Social ในไทย…':'Searching Thailand-relevant Facebook, Instagram, TikTok and social sources…';
    if(phase==='searching-global')return thai?'กำลังขยายการค้นหาไปยังแหล่งข้อมูลสากล…':'Expanding the search globally…';
    if(phase==='searching-social-global')return thai?'กำลังขยายไปยัง Social และชุมชนผู้ใช้ทั่วโลก…':'Expanding into global social and community sources…';
    if(phase==='reading-sources')return thai?'กำลังอ่านแหล่งข้อมูลที่เกี่ยวข้อง…':'Reading the most relevant sources…';
    if(phase==='verifying-sources')return thai?'กำลังตรวจสอบและเทียบข้อมูลหลายแหล่ง…':'Cross-checking sources and claims…';
    if(phase==='synthesizing')return thai?'กำลังสร้างรายงานการค้นคว้า…':'Building the research report…';
    if(phase==='failed')return thai?'การค้นคว้าพบปัญหา กำลังเตรียมคำตอบที่มีข้อมูลเท่าที่ตรวจสอบได้…':'Research hit a problem; preparing the best verified answer available…';
  }
  if(run.status==='queued')return thai?'กำลังเข้าคิวประมวลผล…':'Queued for processing…';
  if(latest?.attachments?.some(a=>a.mediaType.startsWith('image/')))return thai?'กำลังอ่านรูปภาพและวิเคราะห์…':'Reading the image and analyzing…';
  if(latest?.attachments?.length)return thai?'กำลังอ่านไฟล์และวิเคราะห์…':'Reading the attachment and analyzing…';
  if(run.thinkingMode!=='off')return thai?'กำลังวิเคราะห์และสร้างคำตอบ…':`Thinking · ${run.thinkingMode.charAt(0).toUpperCase()+run.thinkingMode.slice(1)}…`;
  return thai?'กำลังสร้างคำตอบ…':'Generating response…';
};
const isAutoAttachmentPrompt=(value:string)=>{const n=value.trim().toLowerCase().replace(/[.!?]+$/,'');return ['please review the attached content','please review the attached file','please review the attached image','review the attached content'].includes(n)};
const attachmentReviewPrompt=(messages:Msg[])=>{
  for(let i=messages.length-1;i>=0;i--){const m=messages[i];if(m.role!=='user'||!m.text.trim()||isAutoAttachmentPrompt(m.text))continue;const t=m.text;if(/[\u0E00-\u0E7F]/.test(t))return 'ช่วยตรวจสอบไฟล์ที่แนบมานี้';if(/[\u3040-\u30FF]/.test(t))return '添付した内容を確認してください。';if(/[\uAC00-\uD7AF]/.test(t))return '첨부한 내용을 검토해 주세요.';if(/[\u4E00-\u9FFF]/.test(t))return '请查看附件内容。';if(/[A-Za-z]/.test(t))return 'Please review the attached content.'}
  if(typeof navigator!=='undefined'&&navigator.language?.toLowerCase().startsWith('th'))return 'ช่วยตรวจสอบไฟล์ที่แนบมานี้';
  return 'Please review the attached content.';
};
const friendlyGuestError=(code:string,retryAfterSeconds?:number)=>{
  const normalized=code.trim().toLowerCase();
  const thai=prefersThai('');
  if(normalized==='guest_rate_limited')return thai?`กรุณารอ ${Math.max(1,Number(retryAfterSeconds||1))} วินาที ระบบจะลองส่งข้อความ Guest ต่อให้อัตโนมัติ`:`Please wait ${Math.max(1,Number(retryAfterSeconds||1))}s before sending another Guest message.`;
  if(normalized==='guest_quota_exhausted')return thai?'โควตา Guest รอบนี้ถูกใช้ครบแล้ว ข้อความจะถูกเก็บไว้และทำต่อเมื่อโควตาพร้อม':'Guest token quota has been used up for the current window.';
  if(normalized==='image_generation_provider_auth_failed')return thai?'ยังสร้างรูปไม่ได้ เพราะผู้ให้บริการสร้างรูปต้องอัปเดต API key ในหน้า Admin Providers':'Image generation needs a valid provider API key. Ask an admin to update the image provider credentials.';
  if(normalized==='image_generation_unavailable')return thai?'บริการสร้างรูปยังไม่พร้อมใช้งาน กรุณาลองใหม่หลังตรวจสอบ Image Provider':'Image generation is temporarily unavailable. Check the configured image provider and try again.';
  if(normalized==='guest_image_generation_limit')return thai?'ใช้สิทธิสร้างรูปของ Guest ครบสำหรับวันนี้แล้ว':'Guest image-generation quota has been used up for today.';
  if(normalized==='generated_image_invalid')return thai?'รูปที่ผู้ให้บริการส่งกลับมาไม่ใช่ไฟล์ภาพที่ระบบอนุญาต':'The image provider returned an unsupported or invalid image.';
  if(normalized==='generated_image_exceeds_limit')return thai?'รูปที่สร้างมีขนาดเกิน limit ที่ตั้งไว้':'The generated image exceeds the configured size limit.';
  if(normalized==='generated_image_storage_failed')return thai?'สร้างรูปได้แล้วแต่บันทึก attachment ไม่สำเร็จ':'The image was generated, but the attachment could not be stored.';
  if(normalized==='guest_file_generation_limit')return thai?'ใช้สิทธิสร้างไฟล์ของ Guest ครบสำหรับวันนี้แล้ว':'Guest file-generation quota has been used up for today.';
  if(normalized==='guest_file_generation_failed'||normalized==='file_generation_failed')return thai?'สร้างไฟล์ไม่สำเร็จในครั้งนี้ กรุณาลองใหม่อีกครั้ง':'File generation failed this time. Please try again.';
  if(normalized==='guest_file_generation_invalid'||normalized==='file_generation_invalid')return thai?'เนื้อหาที่สร้างมาไม่ผ่านการตรวจสอบรูปแบบไฟล์ กรุณาลองใหม่':'The generated content did not pass file-format validation. Please try again.';
  if(normalized==='generated_file_exceeds_limit')return thai?'ไฟล์ที่สร้างมีขนาดเกิน limit ที่ตั้งไว้':'The generated file exceeds the configured size limit.';
  if(normalized==='generated_file_storage_failed')return thai?'สร้างเนื้อหาได้แล้วแต่บันทึกไฟล์ไม่สำเร็จ กรุณาลองใหม่':'The content was generated, but the file could not be stored. Please try again.';
  if(normalized==='attachment_storage_limit')return thai?'พื้นที่หรือจำนวน attachment ถูกใช้ถึง limit ที่ตั้งไว้แล้ว':'The attachment storage limit has been reached.';
  if(normalized==='quota_exhausted')return thai?'โควตาโทเคนถูกใช้ครบแล้ว ระบบจะสร้างไฟล์ได้อีกครั้งเมื่อโควตารีเซ็ต':'Token quota has been exhausted. File generation will be available after the quota resets.';
  if(normalized==='route unavailable')return 'This attachment needs a vision route, but no compatible model is currently available.';
  if(normalized==='load failed'||normalized.includes('load failed'))return 'Daiki could not load this attachment for analysis. Please retry this message.';
  if(normalized.includes('attachment'))return code;
  if(normalized.includes('unavailable'))return 'Daiki is temporarily unavailable. Please try this message again.';
  return code||'Gateway unavailable';
};
const friendlyRunError=(value?:string)=>{
  const raw=(value||'').trim();
  const lower=raw.toLowerCase();
  if(!raw)return 'The run stopped before completion. Retry to continue.';
  if(lower.includes('tool call validation failed')&&lower.includes('clarify'))return 'The clarification step received too many answer choices. Daiki can retry this turn without losing the chat.';
  if(lower.includes('hermes unavailable'))return 'The agent runtime was temporarily unavailable. Retry to continue from this chat.';
  if(lower.includes('rate')&&lower.includes('limit'))return 'The selected model is temporarily rate limited. Daiki will retry or use the configured fallback when possible.';
  if(lower.includes('authentication')||lower.includes('user not found'))return 'The selected provider rejected authentication. Daiki will use the configured fallback when available.';
  if(lower.includes('api call failed')||lower.includes('apiconnectionerror'))return 'The model provider rejected this turn before an answer was produced. Retry to continue.';
  if(raw.length>180)return 'The run stopped before completion. Open technical details below for the provider error, then retry to continue.';
  return raw;
};

function decodeGuestResearchSources(response:Response):RunSource[]{
  const encoded=response.headers.get('x-daiki-research-sources-json');
  if(!encoded)return [];
  try{const binary=atob(encoded);const bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));const value=JSON.parse(new TextDecoder().decode(bytes));return Array.isArray(value)?value as RunSource[]:[]}catch{return []}
}

function sourceHost(value?:string){
  if(!value)return '';
  try{return new URL(value).hostname.replace(/^www\./,'')}catch{return ''}
}

function sourceAuthorityLabel(value?:string){
  switch(value){
    case 'primary':return 'Primary';
    case 'provided':return 'Provided URL';
    case 'government':return 'Government';
    case 'academic':return 'Academic';
    case 'community':return 'Community';
    default:return '';
  }
}

function linkResearchCitations(text:string,sources:RunSource[]){
  if(!sources.length)return text;
  const byIndex=new Map(sources.map((source,i)=>[source.index||i+1,source]));
  return text.replace(/\[(\d+)\](?!\()/g,(raw,indexText)=>{
    const source=byIndex.get(Number(indexText));
    return source?.url?`[${indexText}](${source.url})`:raw;
  });
}

function ResearchSources({sources}:{sources:RunSource[]}){
  if(!sources.length)return null;
  return <details className="assistantSources">
    <summary aria-label={`Open ${sources.length} research source${sources.length===1?'':'s'}`}><Globe2 size={12}/><strong>Sources</strong><span>{sources.length}</span><i className="sourceDomainPreview">{sources.slice(0,2).map((source,i)=><b key={`${source.url||i}`}>{sourceHost(source.url).slice(0,1).toUpperCase()||String(i+1)}</b>)}</i></summary>
    <div className="assistantSourcePanel"><div className="assistantSourcePanelHead"><div><strong>Sources</strong><small>Web, primary, government and public social evidence used for this answer</small></div><span>{sources.length}</span></div><div className="assistantSourceList">{sources.slice(0,8).map((source,i)=><a key={`${source.url||source.title||i}`} href={source.url||'#'} target="_blank" rel="noreferrer"><b>{source.index||i+1}</b><span><strong>{source.title||sourceHost(source.url)||`Source ${i+1}`}</strong><span className="sourceMeta"><small>{sourceHost(source.url)||source.engine||'Web source'}</small>{source.region==='TH'?<em>Thailand</em>:null}{sourceAuthorityLabel(source.authority)?<em>{sourceAuthorityLabel(source.authority)}</em>:null}{source.qualityScore!=null?<em>Q {source.qualityScore}</em>:null}{source.sourceType==='social'?<em className="social">{source.platform||'Social'}</em>:null}</span></span></a>)}</div></div>
  </details>;
}

function MessageContent({message,sources=[]}:{message:Msg;sources?:RunSource[]}){
  if(message.role==='user')return <div className="userText">{message.text}</div>;
  if(!message.text)return <div className="backgroundRunStatus thinking"><div className="typingDots" aria-label={message.progress||'Daiki is thinking'}><i/><i/><i/></div><span>{message.progress||'Daiki is thinking…'}</span></div>;
  const content=linkResearchCitations(message.text,sources);
  return <div className="markdownBody"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{a:({href,children,...props})=>{const label=String(children??'');const citation=/^\d+$/.test(label)&&Boolean(href?.startsWith('http'));return <a {...props} className={citation?'citationLink':undefined} href={href} target={href?.startsWith('http')?'_blank':undefined} rel={href?.startsWith('http')?'noreferrer':undefined}>{children}</a>}}}>{content}</ReactMarkdown></div>;
}

function RunActivityDetails({run}:{run:ChatRun}){
  const activity=run.activity||{};const research=activity.research;const thinking=activity.thinking;const tokens=activity.tokens;const sources=research?.sources||[];
  const label=run.status==='running'?'Working':run.status==='queued'?'Queued':run.status==='paused'?'Paused':run.status==='failed'?'Failed':run.status==='cancelled'?'Stopped':'Completed';
  return <details className={`runActivity ${run.status}`} open={run.status==='failed'}>
    <summary><span><Brain size={12}/>{label}</span><small>{run.commandMode==='deep-search'||research?.depth==='deep'?`Deep Search · ${sources.length||research?.sourceCount||0} sources${research?.socialSourceCount?` · ${research.socialSourceCount} social`:''}${research?.qualityScore!=null?` · Q ${research.qualityScore}/${research.qualityGrade||'?'}`:''}`:research?.used?`Web · ${sources.length||research.sourceCount||0} sources`:`Web: ${research?.mode||run.researchMode}`} · Think: {thinking?.mode||run.thinkingMode}</small></summary>
    <div className="runActivityBody">
      {run.commandMode==='deep-search'||research?.depth==='deep'?<DeepResearchProgress run={run}/>:null}
      <div className="activityFacts"><div><span>Status</span><strong>{label}</strong></div><div><span>Thinking</span><strong>{thinking?.mode||run.thinkingMode}</strong></div>{activity.durationMs!=null?<div><span>Duration</span><strong>{(activity.durationMs/1000).toFixed(1)}s</strong></div>:null}</div>
      <section><strong>Web research</strong>{research?.query?<p>Query: <code>{research.query}</code>{research.region?` · Region ${research.region}`:''}{research.scope?` · ${research.scope}`:''}</p>:<p>{research?.mode==='off'?'Web research disabled.':run.status==='running'||run.status==='queued'?'Research is evaluated by the backend while this run continues.':'No web query was required for this answer.'}</p>}{research?.error?<p className="activityError">{research.error}</p>:null}{sources.length?<div className="activitySources">{sources.map((source,i)=><a key={`${source.url||i}`} href={source.url||'#'} target="_blank" rel="noreferrer"><span>{source.title||source.url||`Source ${i+1}`}</span>{source.snippet?<small>{source.snippet}</small>:null}<em>{[source.region==='TH'?'TH':'',sourceAuthorityLabel(source.authority),source.qualityScore!=null?`Q ${source.qualityScore}`:'',source.sourceType==='social'?(source.platform||'Social'):'',source.engine||'web'].filter(Boolean).join(' · ')}</em></a>)}</div>:null}</section>
      <section><strong>Thinking</strong><p>Mode: {thinking?.mode||run.thinkingMode}{thinking?.effectiveEffort?` · native effort ${thinking.effectiveEffort}`:''}{thinking?.model?` · ${thinking.model}`:''}{thinking?.nativeReasoning===false&&thinking?.mode!=='off'?' · prompt-guided fallback':''}. Private chain-of-thought is not exposed.</p>{tokens?<p>{fmtTokens(tokens.reasoning)} actual reasoning tokens reported by the provider.</p>:null}</section>
      {tokens?<section><strong>Token usage</strong><p>{fmtTokens(tokens.input)} input · {fmtTokens(tokens.reasoning)} thinking · {fmtTokens(tokens.answer)} answer · {fmtTokens(tokens.total)} total</p></section>:null}
      {run.error?<section><strong>Error</strong>{run.error==='quota_exhausted'?<p className="activityError">{`Token quota used up${activity.quota?.resetAt?` · resets ${new Date(activity.quota.resetAt).toLocaleString()}`:''}. This run is saved and auto-continues when quota allows.`}</p>:run.error==='pending_chat_rate_limited'?<p className="activityError">{`Rate limit reached · this run is saved and auto-continues after ${activity.retryAfterSeconds||20}s.`}</p>:<div className="runErrorSummary"><strong>{friendlyRunError(run.error)}</strong><span>Your chat and sources are preserved. Use Retry/Play to continue after the runtime recovers.</span><details className="runErrorTechnical"><summary>Technical details</summary><code>{run.error}</code></details></div>}</section>:null}
      {activity.requestId||run.requestId?<small className="activityRequestId">Request {activity.requestId||run.requestId}</small>:null}
    </div>
  </details>;
}

function DeepResearchProgress({run}:{run:ChatRun}){
  const research=run.activity?.research;
  if(run.commandMode!=='deep-search'&&research?.depth!=='deep')return null;
  const thai=prefersThai(research?.query||'');
  const phase=research?.phase||(run.status==='completed'?'completed':'planning');
  const steps:Array<{id:string;label:string}>=[];
  steps.push({id:'planning',label:thai?'วางแผนคำค้นและหัวข้อย่อย':'Plan queries and research facets'});
  if(research?.region==='TH'&&research?.scope!=='global'){
    steps.push({id:'searching-local',label:thai?'ค้นหาแหล่งข้อมูลในประเทศไทยก่อน':'Search Thailand-relevant sources first'});
    steps.push({id:'searching-social-local',label:thai?'ค้น Facebook, Instagram, TikTok และ Social ในไทย':'Search Thailand social sources'});
  }
  if(research?.scope!=='local-only'){
    steps.push({id:'searching-global',label:thai?'ขยายไปยังแหล่งข้อมูลสากล':'Expand to global web sources'});
    steps.push({id:'searching-social-global',label:thai?'ค้น Social และชุมชนผู้ใช้ทั่วโลก':'Search global social and communities'});
  }
  steps.push({id:'reading-sources',label:thai?'อ่านแหล่งข้อมูลที่เกี่ยวข้อง':'Read the strongest sources'});
  steps.push({id:'verifying-sources',label:thai?'ตรวจสอบข้อเท็จจริงและความขัดแย้ง':'Cross-check facts and conflicts'});
  steps.push({id:'synthesizing',label:thai?'สังเคราะห์เป็นรายงานพร้อมอ้างอิง':'Synthesize the cited report'});
  const phaseIndex=steps.findIndex(step=>step.id===phase);
  const complete=run.status==='completed'||phase==='completed';
  const activeIndex=complete?steps.length:phaseIndex>=0?phaseIndex:0;
  return <div className="deepResearchProgress">
    <div className="deepResearchProgressHead"><div><Globe2 size={15}/><span><strong>{thai?'การค้นคว้าเชิงลึก':'Deep research'}</strong><small>{research?.region==='TH'&&research?.scope!=='global'?(thai?'ประเทศไทยก่อน · แล้วขยาย Global':'Thailand first · then Global'):(thai?'ค้นหาแบบ Global':'Global research')}</small></span></div><div className="researchStrategyChips">{research?.localSourceCount?<b>TH {research.localSourceCount}</b>:null}{research?.globalSourceCount?<b>Global {research.globalSourceCount}</b>:null}{research?.socialSourceCount?<b className="social">Social {research.socialSourceCount}</b>:null}{research?.qualityScore!=null?<b>Quality {research.qualityScore}/100 · {research.qualityGrade||'?'}</b>:null}</div></div>
    <div className="deepResearchSteps">{steps.map((step,index)=>{const state=complete||index<activeIndex?'done':index===activeIndex?'active':'pending';return <div className={state} key={step.id}><i>{state==='done'?<Check size={11}/>:null}</i><span>{step.label}</span></div>})}</div>
    {research?.socialPlatforms?.length?<div className="socialPlatforms"><span>{thai?'Social ที่พบ':'Social found'}</span>{research.socialPlatforms.map(platform=><b key={platform}>{platform}</b>)}</div>:null}
    {research?.queries?.length?<details className="researchQueries"><summary>{thai?`คำค้น ${research.queries.length} ชุด`:`${research.queries.length} search queries`}</summary><div>{research.queries.map((query,index)=><code key={`${query}-${index}`}>{query}</code>)}</div></details>:null}
  </div>;
}

export default function Chat(){
  const [text,setText]=useState('');
  const [localBusy,setBusy]=useState(false);
  const [capabilities,setCapabilities]=useState<CapabilityInfo|null>(null);
  const [commandMode,setCommandMode]=useState('');
  const [commandSkills,setCommandSkills]=useState<string[]>([]);
  const [commandMenu,setCommandMenu]=useState<'mode'|'skill'|''>('');
  const [commandQuery,setCommandQuery]=useState('');
  const [commandIndex,setCommandIndex]=useState(0);
  const [uploading,setUploading]=useState(0);
  const [model,setModel]=useState('auto');
  const [researchMode,setResearchMode]=useState<'auto'|'web'|'off'>('auto');
  const [thinkingMode,setThinkingMode]=useState<ThinkingMode>('medium');
  const [account,setAccount]=useState<Account|null>(null);
  const [guest,setGuest]=useState(false);
  const [accessReady,setAccessReady]=useState(false);
  const [guestPolicy,setGuestPolicy]=useState<GuestPolicy|null>(null);
  const [guestGenerating,setGuestGenerating]=useState<'image'|'file'|''>('');
  const [msgs,setMsgs]=useState<Msg[]>([]);
  const [currentRun,setCurrentRun]=useState<ChatRun|null>(null);
  const [attachments,setAttachments]=useState<Attachment[]>([]);
  const [attachMenu,setAttachMenu]=useState(false);
  const [uploadError,setUploadError]=useState('');
  const [generationNotice,setGenerationNotice]=useState('');
  const [sessions,setSessions]=useState<ChatSession[]>([]);
  const [sessionId,setSessionId]=useState('');
  const [historyBusy,setHistoryBusy]=useState(false);
  const [historyQuery,setHistoryQuery]=useState('');
  const [historyResults,setHistoryResults]=useState<ChatSession[]>([]);
  const [historySearching,setHistorySearching]=useState(false);
  const [sidebarTarget,setSidebarTarget]=useState<HTMLElement|null>(null);
  const [renamingId,setRenamingId]=useState('');
  const [renameText,setRenameText]=useState('');
  const [editingMessageId,setEditingMessageId]=useState<number|null>(null);
  const [editText,setEditText]=useState('');
  const [copiedKey,setCopiedKey]=useState('');
  const [usageInfo,setUsageInfo]=useState<UsageResponse|null>(null);
  const [quotaClock,setQuotaClock]=useState(Date.now());
  const [resetBusy,setResetBusy]=useState(false);
  const [resetGiftNotice,setResetGiftNotice]=useState('');
  const [quotaIndicatorHidden,setQuotaIndicatorHidden]=useState(false);
  const [pendingGuestTurn,setPendingGuestTurn]=useState<PendingGuestTurn|null>(null);
  const [autoContinueClock,setAutoContinueClock]=useState(Date.now());
  const [deepSearchWizard,setDeepSearchWizard]=useState<DeepSearchWizardState|null>(null);
  const fileRef=useRef<HTMLInputElement>(null);
  const imageRef=useRef<HTMLInputElement>(null);
  const folderRef=useRef<HTMLInputElement>(null);
  const textareaRef=useRef<HTMLTextAreaElement>(null);
  const historySearchRef=useRef<HTMLInputElement>(null);
  const scrollRef=useRef<HTMLDivElement>(null);
  const autoContinueLockRef=useRef(false);
  const runControlLockRef=useRef(false);
  const deepSearchPrefsRef=useRef<ResearchPrefs|null>(null);

  const runBlocking=Boolean(currentRun&&['queued','running','paused'].includes(currentRun.status));
  const busy=localBusy||runBlocking;
  const autoRunWaiting=retryableRunError(currentRun);
  const autoRunRetryAt=runAutoContinueAt(currentRun);
  const autoContinueWaiting=Boolean(pendingGuestTurn)||autoRunWaiting;
  const guestAutoWaitLabel=pendingGuestTurn?autoContinueTimeLabel(pendingGuestTurn.retryAt,autoContinueClock):'';
  const runAutoWaitLabel=autoRunWaiting&&autoRunRetryAt?autoContinueTimeLabel(autoRunRetryAt,autoContinueClock):'';
  const pendingGuestTurnId=pendingGuestTurn?.id||'';
  const pendingGuestTurnReason=pendingGuestTurn?.reason||'';
  const pending=account?.status==='pending';
  const uploadRestricted=!accessReady||(guest?!guestPolicy?.allowUploads:false);
  const canGenerateAttachment=!pending&&(!guest||Boolean(guestPolicy?.allowImageGeneration||guestPolicy?.allowFileGeneration));
  const attachmentMenuRestricted=!accessReady||(uploadRestricted&&!canGenerateAttachment);
  const currentSession=sessions.find(x=>x.id===sessionId);
  const quota=usageInfo?.quota;
  const quotaExhausted=quota?.mode==='limited'&&(quota.blocked??Number(quota.remaining||0)<=0);
  // Keep a failed run's historical error visible, but do not let that stale
  // error lock the composer after a user/admin reset has restored quota.
  const quotaBlocked=quotaExhausted||(usageInfo==null&&currentRun?.error==='quota_exhausted');
  const quotaChangedForWaitingRun=Boolean(autoRunWaiting&&currentRun?.error==='quota_exhausted'&&quota&&currentRun.activity?.quota&&(quota.mode==='unlimited'||(quota.windowStart&&quota.windowStart!==currentRun.activity.quota.windowStart)||Number(quota.limit||0)>Number(currentRun.activity.quota.limit||0)||Number(quota.remaining||0)>Number(currentRun.activity.quota.remaining||0)));
  const resetCredits=quota?.resetCredits;
  const resetsAvailable=Number(resetCredits?.available||0);
  const resetRemainingMs=quota?.resetAt?Math.max(0,new Date(quota.resetAt).getTime()-quotaClock):0;
  const resetRemainingLabel=resetRemainingMs>0?`${Math.floor(resetRemainingMs/60000)}m ${Math.floor((resetRemainingMs%60000)/1000)}s`:'now';
  const quotaLimitSummary=(quota?.limits||[]).map(l=>`${fmtTokens(l.used)} / ${fmtTokens(l.limit)} ${l.interval}${l.interval==='hour'&&Number(l.intervalCount||1)>1?` (every ${l.intervalCount}h)`:''}`).join(' · ');
  const effectiveThinkingMode:ThinkingMode=(pending||guest)?'off':thinkingMode;
  const thinkingIndex=Math.max(0,thinkingLevels.findIndex(x=>x.id===effectiveThinkingMode));
  const thinking=thinkingLevels[thinkingIndex]||thinkingLevels[2];
  const commandCatalog=capabilities?.commands;
  const commandItems=useMemo(()=>{const rows=commandMenu==='mode'?(commandCatalog?.modes||[]):commandMenu==='skill'?(commandCatalog?.skills||[]):[];const q=commandQuery.trim().toLowerCase();return (q?rows.filter(x=>x.id.includes(q)||x.name.toLowerCase().includes(q)||x.description.toLowerCase().includes(q)):rows).slice(0,9)},[commandCatalog,commandMenu,commandQuery]);
  const selectedModeOption=commandCatalog?.modes.find(x=>x.id===commandMode);
  const selectedSkillOptions=commandSkills.map(id=>commandCatalog?.skills.find(x=>x.id===id)).filter((x):x is CommandOption=>Boolean(x));
  const automaticAttachmentSkillIds=mergeAttachmentAutoSkills([],attachments);
  const automaticAttachmentSkillOptions=automaticAttachmentSkillIds.filter(id=>!commandSkills.includes(id)).map(id=>commandCatalog?.skills.find(x=>x.id===id)).filter((x):x is CommandOption=>Boolean(x));
  const estimatedInput=useMemo(()=>{
    const content=[...msgs.map(m=>m.text),text].join('\n');
    const bytes=new TextEncoder().encode(content).length;
    return Math.min(16000,Math.ceil(bytes/4)+256);
  },[msgs,text]);
  const estimatedTotal=estimatedInput+thinking.completion;
  const visibleHistorySessions=historyQuery.trim()?historyResults:sessions;
  const historyGroups=useMemo(()=>historyQuery.trim()?[{label:'Search results',sessions:visibleHistorySessions}]:groupChatSessions(visibleHistorySessions),[historyQuery,visibleHistorySessions]);
  const deepSearchThai=deepSearchWizard?prefersThai(deepSearchWizard.prompt):false;
  const deepSearchFocusChoices=deepSearchWizard?deepSearchFocusOptions(deepSearchWizard.prompt):[];
  const deepSearchEvidenceChoices=deepSearchWizard?deepSearchEvidenceOptions(deepSearchWizard.prompt):[];

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
    void (async()=>{
      try{
        const accountRes=await fetch('/api/account',{cache:'no-store'});
        if(accountRes.ok){
          const a=await accountRes.json() as Account;setAccount(a);if(a.status==='pending')setModel('fast');
          const [sessionsRes,capabilitiesRes]=await Promise.all([fetch('/api/chat-sessions',{cache:'no-store'}),fetch('/api/capabilities',{cache:'no-store'})]);
          if(sessionsRes.ok){const d=await sessionsRes.json() as {sessions:ChatSession[]};setSessions(d.sessions||[]);const saved=localStorage.getItem('daiki_current_session');if(saved)void openSession(saved,false)}
          if(capabilitiesRes.ok)setCapabilities(await capabilitiesRes.json() as CapabilityInfo);
          await refreshUsage();setAccessReady(true);return;
        }
      }catch{}
      guestDeviceHeaders();setGuest(true);setModel('fast');setResearchMode('off');setThinkingMode('off');
      try{const [gp,cap]=await Promise.all([fetch('/api/guest/policy',{cache:'no-store'}),fetch('/api/guest/capabilities',{cache:'no-store',headers:guestDeviceHeaders()})]);if(gp.ok)setGuestPolicy(await gp.json() as GuestPolicy);if(cap.ok)setCapabilities(await cap.json() as CapabilityInfo)}catch{}
      try{
        const raw=localStorage.getItem(PENDING_GUEST_TURN_KEY);
        if(raw){
          const restored=JSON.parse(raw) as PendingGuestTurn;
          if(restored?.id&&Array.isArray(restored.history)&&isGuestAutoContinueReason(restored.reason)){
            setPendingGuestTurn(restored);setMsgs(guestTurnMessages(restored));
          }else localStorage.removeItem(PENDING_GUEST_TURN_KEY);
        }
      }catch{localStorage.removeItem(PENDING_GUEST_TURN_KEY)}
      setAccessReady(true);
    })();
    return()=>window.clearTimeout(prefTimer);
    // Session restore is intentionally mount-only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{setSidebarTarget(document.getElementById('chat-sidebar-slot'))},[]);
  useEffect(()=>{
    if(!accessReady||guest)return;
    const q=historyQuery.trim();
    if(!q){setHistoryResults([]);setHistorySearching(false);return}
    let cancelled=false;setHistoryResults([]);setHistorySearching(true);
    const timer=window.setTimeout(async()=>{
      try{const r=await fetch(`/api/chat-sessions?q=${encodeURIComponent(q)}`,{cache:'no-store'});if(r.ok&&!cancelled){const d=await r.json() as {sessions:ChatSession[]};setHistoryResults(d.sessions||[])}}catch{}finally{if(!cancelled)setHistorySearching(false)}
    },250);
    return()=>{cancelled=true;window.clearTimeout(timer)};
  },[accessReady,guest,historyQuery]);
  useEffect(()=>{
    const onSearch=(e:KeyboardEvent)=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();window.dispatchEvent(new Event('daiki-open-navigation'));window.setTimeout(()=>historySearchRef.current?.focus(),180)}};
    window.addEventListener('keydown',onSearch);return()=>window.removeEventListener('keydown',onSearch);
  },[]);
  useEffect(()=>{scrollRef.current?.scrollTo({top:scrollRef.current.scrollHeight,behavior:'smooth'})},[msgs,currentRun?.status]);
  useEffect(()=>{const el=textareaRef.current;if(!el)return;el.style.height='auto';el.style.height=`${Math.min(el.scrollHeight,180)}px`},[text]);
  useEffect(()=>{const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape'){setAttachMenu(false);setCommandMenu('');setEditingMessageId(null)}};window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
  useEffect(()=>{if(!quota?.resetAt)return;const timer=window.setInterval(()=>setQuotaClock(Date.now()),1000);return()=>window.clearInterval(timer)},[quota?.resetAt]);
  useEffect(()=>{if(!accessReady||guest)return;const timer=window.setInterval(()=>void refreshUsage(),20000);const wake=()=>{if(document.visibilityState==='visible')void refreshUsage()};window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);return()=>{window.clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)}},[accessReady,guest]);
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

  const updateComposerText=(value:string)=>{
    setText(value);
    const match=value.match(/(?:^|\s)([/@])([a-zA-Z0-9-]*)$/);
    if(match)setAttachMenu(false);
    if(!match){setCommandMenu('');setCommandQuery('');return}
    setCommandMenu(match[1]==='/'?'mode':'skill');setCommandQuery(match[2].toLowerCase());setCommandIndex(0);
  };
  const selectCommand=(option:CommandOption)=>{
    const match=text.match(/(?:^|\s)([/@])([a-zA-Z0-9-]*)$/);
    let next=text;
    if(match&&match.index!=null){const prefix=text.slice(0,match.index);const leading=match[0].match(/^\s/)?.[0]||'';next=(prefix+leading).replace(/[ \t]+$/,' ')}
    if(commandMenu==='mode')setCommandMode(option.id);
    if(commandMenu==='skill')setCommandSkills(xs=>xs.includes(option.id)?xs:[...xs,option.id].slice(0,4));
    setText(next);setCommandMenu('');setCommandQuery('');setCommandIndex(0);window.setTimeout(()=>textareaRef.current?.focus(),0);
  };
  const handleComposerKeyDown=(e:React.KeyboardEvent<HTMLTextAreaElement>)=>{
    if(commandMenu&&commandItems.length){
      if(e.key==='ArrowDown'){e.preventDefault();setCommandIndex(i=>(i+1)%commandItems.length);return}
      if(e.key==='ArrowUp'){e.preventDefault();setCommandIndex(i=>(i-1+commandItems.length)%commandItems.length);return}
      if((e.key==='Enter'&&!e.shiftKey)||e.key==='Tab'){e.preventDefault();selectCommand(commandItems[Math.min(commandIndex,commandItems.length-1)]);return}
      if(e.key==='Escape'){e.preventDefault();setCommandMenu('');return}
    }
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}
  };

  const updateThinkingMode=(next:ThinkingMode)=>{
    setThinkingMode(next);
    try{const p=JSON.parse(localStorage.getItem('daiki_preferences')||'{}');localStorage.setItem('daiki_preferences',JSON.stringify({...p,thinkingMode:next}))}catch{}
  };
  const copyMessage=async(value:string,key:string)=>{
    let copied=false;
    if(navigator.clipboard?.writeText){
      try{
        await navigator.clipboard.writeText(value);
        copied=true;
      }catch{}
    }
    if(!copied){
      try{
        const area=document.createElement('textarea');
        area.value=value;
        area.setAttribute('readonly','');
        area.style.position='fixed';
        area.style.top='-1000px';
        area.style.left='-1000px';
        area.style.opacity='0';
        document.body.appendChild(area);
        area.focus();
        area.select();
        area.setSelectionRange(0,area.value.length);
        copied=document.execCommand('copy');
        area.remove();
      }catch{}
    }
    if(copied){
      setUploadError('');
      setCopiedKey(key);
      window.setTimeout(()=>setCopiedKey(''),1400);
    }else{
      setUploadError('Could not copy this message.');
    }
  };
  const refreshUsage=async()=>{try{const r=await fetch('/api/usage',{cache:'no-store'});if(r.ok){const next=await r.json() as UsageResponse;const grants=next.quota?.resetCredits?.grants||[];const latest=[...grants].sort((a,b)=>Number(b.id)-Number(a.id))[0];if(latest){const key='daiki_seen_reset_grant';const seen=Number(localStorage.getItem(key)||0);if(latest.id>seen){setResetGiftNotice(`You received ${latest.totalResets||latest.remainingResets} quota reset${(latest.totalResets||latest.remainingResets)===1?'':'s'} · expires ${new Date(latest.expiresAt).toLocaleString()}`);localStorage.setItem(key,String(latest.id))}}setUsageInfo(next)}}catch{}};
  const redeemQuotaReset=async()=>{if(resetBusy||resetsAvailable<=0)return;setResetBusy(true);setUploadError('');try{const r=await fetch('/api/quota-resets/use',{method:'POST'});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||'Could not use reset');await refreshUsage();if(currentRun?.error==='quota_exhausted')await controlRun('resume')}catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{setResetBusy(false)}};
  const refreshSessions=async()=>{if(guest)return;const r=await fetch('/api/chat-sessions',{cache:'no-store'});if(r.ok){const d=await r.json() as {sessions:ChatSession[]};setSessions(d.sessions||[])}};
  const mapMessages=(messages:StoredMessage[],runs:ChatRun[],attachmentRows:Attachment[]=[])=>{const byRun=new Map(runs.map(run=>[run.id,run]));const byAttachment=new Map(attachmentRows.map(a=>[a.id,a]));return messages.map(m=>({id:m.id,role:m.role==='assistant'?'ai' as const:'user' as const,text:m.content,attachments:(m.attachmentIds||[]).map(id=>byAttachment.get(id)).filter((a):a is Attachment=>Boolean(a)),runId:m.runId,run:m.runId?byRun.get(m.runId):undefined}))};
  const loadSessionData=async(id:string,closeHistory=true,preserveComposer=false)=>{
    const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{cache:'no-store'});if(!r.ok)return false;
    const d=await r.json() as {session:ChatSession;messages:StoredMessage[];runs:ChatRun[];attachments?:Attachment[]};const runs=d.runs||[];const latest=runs[runs.length-1];
    setSessionId(d.session.id);setModel(d.session.modelAlias||'auto');setMsgs(mapMessages(d.messages||[],runs,d.attachments||[]));
    setCurrentRun(latest&&latest.status!=='completed'?latest:null);localStorage.setItem('daiki_current_session',d.session.id);
    setAttachments([]);if(!preserveComposer)setText('');if(closeHistory)window.dispatchEvent(new Event('daiki-close-navigation'));return true;
  };
  const newChat=()=>{setSessionId('');setMsgs([]);setCurrentRun(null);setAttachments([]);setText('');setCommandMode('');setCommandSkills([]);setCommandMenu('');setUploadError('');setGenerationNotice('');setEditingMessageId(null);setHistoryQuery('');setHistoryResults([]);setPendingGuestTurn(null);setDeepSearchWizard(null);deepSearchPrefsRef.current=null;localStorage.removeItem('daiki_current_session');localStorage.removeItem(PENDING_GUEST_TURN_KEY);window.dispatchEvent(new Event('daiki-close-navigation'))};
  const openSession=async(id:string,closeHistory=true)=>{setHistoryBusy(true);try{await loadSessionData(id,closeHistory,false)}finally{setHistoryBusy(false)}};
  const deleteSession=async(id:string)=>{if(id===sessionId&&runBlocking)return;const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{method:'DELETE'});if(r.ok){setHistoryResults(xs=>xs.filter(x=>x.id!==id));if(sessionId===id)newChat();await refreshSessions()}};
  const updateSessionInLists=(updated:ChatSession)=>{setSessions(xs=>xs.map(x=>x.id===updated.id?updated:x));setHistoryResults(xs=>xs.map(x=>x.id===updated.id?updated:x))};
  const renameSession=async(id:string)=>{const title=renameText.trim();if(!title)return;const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({title})});if(r.ok){const updated=await r.json() as ChatSession;updateSessionInLists(updated);setRenamingId('');setRenameText('')}};
  const togglePinSession=async(session:ChatSession)=>{const r=await fetch(`/api/chat-sessions/${encodeURIComponent(session.id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({pinned:!session.pinnedAt})});if(r.ok){const updated=await r.json() as ChatSession;updateSessionInLists(updated);await refreshSessions()}};
  const ensureSession=async(title:string)=>{
    if(guest)return '';
    if(sessionId)return sessionId;
    const r=await fetch('/api/chat-sessions',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:title.slice(0,80)||'New chat',modelAlias:pending?'fast':model})});
    if(!r.ok)throw new Error('Could not create chat session');
    const x=await r.json() as ChatSession;setSessionId(x.id);setSessions(old=>[x,...old]);localStorage.setItem('daiki_current_session',x.id);return x.id;
  };
  const updateSessionModel=async(next:string)=>{setModel(next);if(!sessionId)return;const r=await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({modelAlias:next})});if(r.ok){const updated=await r.json() as ChatSession;setSessions(xs=>xs.map(x=>x.id===updated.id?updated:x))}};
  const saveSessionMessage=async(id:string,role:'user'|'assistant',content:string,attachmentIds:string[]=[])=>{const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}/messages`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({role,content,attachmentIds})});if(!r.ok)throw new Error('Could not save chat history');return await r.json() as StoredMessage};
  const startRun=async(id:string,selectedCommandMode=commandMode,selectedCommandSkills=commandSkills,researchPrefs:ResearchPrefs=browserResearchPrefs(selectedCommandMode==='deep-search'?'deep':'standard'))=>{
    const r=await fetch(`/api/chat-sessions/${encodeURIComponent(id)}/runs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({
      researchMode,thinkingMode:effectiveThinkingMode,commandMode:selectedCommandMode,commandSkills:selectedCommandSkills,researchRegion:researchPrefs.region,researchLocale:researchPrefs.locale,researchScope:researchPrefs.scope,researchDepth:researchPrefs.depth,researchFocus:researchPrefs.focus,
    })});const d=await r.json().catch(()=>({})) as ChatRun&{error?:string;run?:ChatRun};
    if(r.status===409&&d.run){setCurrentRun(d.run);return d.run}if(!r.ok)throw new Error(errorText(d.error)||'Could not start background run');setCurrentRun(d);return d;
  };
  const controlRun=async(action:'pause'|'resume'|'cancel')=>{if(!currentRun||runControlLockRef.current)return;runControlLockRef.current=true;setBusy(true);try{const r=await fetch(`/api/chat-runs/${encodeURIComponent(currentRun.id)}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({action})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||'Could not update run');setCurrentRun(d as ChatRun)}catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{runControlLockRef.current=false;setBusy(false)}};
  const uploadOne=async(file:File,source:'file'|'image'|'folder')=>{if(guest&&source==='folder')throw new Error('Guest folder upload is disabled');const form=new FormData();form.set('file',file);form.set('source',source);form.set('relativePath',source==='folder'?rel(file):file.name);const r=await fetch(guest?'/api/guest/attachments':'/api/attachments',{method:'POST',headers:guest?guestDeviceHeaders():undefined,body:form});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||`Could not upload ${file.name}`);return d as Attachment};
  const uploadFiles=async(files:FileList|File[],source:'file'|'image'|'folder')=>{if(uploadRestricted||runBlocking||localBusy||(guest&&source==='folder'))return;const list=Array.from(files);if(!list.length)return;setAttachMenu(false);setUploadError('');setGenerationNotice('');setUploading(x=>x+list.length);try{const uploaded:Attachment[]=[];for(const f of list)uploaded.push(await uploadOne(f,source));setAttachments(x=>[...x,...uploaded])}catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{setUploading(x=>Math.max(0,x-list.length))}};
  const removeAttachment=async(a:Attachment)=>{setAttachments(x=>x.filter(v=>v.id!==a.id));void fetch(`${guest?'/api/guest/attachments':'/api/attachments'}/${encodeURIComponent(a.id)}`,{method:'DELETE',headers:guest?guestDeviceHeaders():undefined}).catch(()=>{})};
  const requestGeneratedFile=async(prompt:string,format:GeneratedFileFormat|'')=>{
    const endpoint=guest?'/api/guest/generate/file':'/api/generate/file';const ext=format||'txt';
    const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(guest?guestDeviceHeaders():{})},body:JSON.stringify({prompt,format,name:`generated.${ext}`})});
    const d=await r.json().catch(()=>({})) as {attachment?:Attachment;error?:unknown;detail?:unknown};
    if(!r.ok||!d.attachment){const raw=errorCode(d.error)||errorText(d.error||d.detail)||'file generation unavailable';throw new Error(friendlyGuestError(raw))}
    return d.attachment;
  };
  const requestGeneratedImage=async(prompt:string)=>{const endpoint=guest?'/api/guest/generate/image':'/api/generate/image';const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(guest?guestDeviceHeaders():{})},body:JSON.stringify({prompt,name:'generated.png'})});const d=await r.json().catch(()=>({})) as {attachment?:Attachment;error?:unknown;detail?:unknown};if(!r.ok||!d.attachment){const raw=errorCode(d.error)||errorText(d.error||d.detail)||'image generation unavailable';throw new Error(friendlyGuestError(raw))}return d.attachment;};
  const generateAttachment=async(kind:'image'|'file')=>{
    const prompt=text.trim();if(!prompt||pending)return;
    setAttachMenu(false);setUploadError('');setGenerationNotice('');setGuestGenerating(kind);
    try{
      const generated=kind==='file'?await requestGeneratedFile(prompt,requestedFileGenerationFormat(prompt)):await requestGeneratedImage(prompt);
      setAttachments(x=>[...x,generated]);
      setGenerationNotice(`Generated ${generated.name} and added it to this message.`);
    }catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{setGuestGenerating('')}
  };
  const persistPendingGuestTurn=(turn:PendingGuestTurn|null)=>{try{if(turn)localStorage.setItem(PENDING_GUEST_TURN_KEY,JSON.stringify(turn));else localStorage.removeItem(PENDING_GUEST_TURN_KEY)}catch{}};
  const deferGuestTurn=(turn:PendingGuestTurn,payload:GuestQuotaError,response?:Response)=>{
    const code=errorCode(payload.error||payload.detail)||errorText(payload.error||payload.detail).trim().toLowerCase();
    if(!isGuestAutoContinueReason(code))return false;
    const next:PendingGuestTurn={...turn,reason:code,retryAt:quotaAutoContinueAt(payload,response),attempts:turn.attempts+1};
    setPendingGuestTurn(next);persistPendingGuestTurn(next);setMsgs(guestTurnMessages(turn));
    return true;
  };
  const clearPendingGuestTurn=()=>{setPendingGuestTurn(null);persistPendingGuestTurn(null)};
  const deferGuestTransport=(turn:PendingGuestTurn)=>{
    const next:PendingGuestTurn={...turn,reason:'transport_retry',retryAt:Date.now()+AUTO_CONTINUE_POLL_MS,attempts:turn.attempts+1};
    setPendingGuestTurn(next);persistPendingGuestTurn(next);setMsgs(guestTurnMessages(turn));
    return 'deferred' as const;
  };
  const attemptGuestTurn=async(turn:PendingGuestTurn)=>{
    const history=guestTurnMessages(turn);
    setMsgs([...history,{role:'ai',text:'',progress:guestProgressLabel(turn,'analyzing')}]);
    const turnResearch=turn.research||browserResearchPrefs(turn.commandMode==='deep-search'?'deep':'standard');
    let r:Response;
    try{
      r=await fetch('/api/chat',{method:'POST',headers:{'content-type':'application/json',...guestDeviceHeaders()},body:JSON.stringify({model:'fast',commandMode:turn.commandMode,commandSkills:turn.commandSkills,researchRegion:turnResearch.region,researchLocale:turnResearch.locale,researchScope:turnResearch.scope,researchDepth:turnResearch.depth,researchFocus:turnResearch.focus,attachmentIds:turn.attachments.map(a=>a.id),messages:turn.history.map(m=>({role:m.role==='ai'?'assistant':'user',content:m.text})),stream:true})});
    }catch(e){
      const message=(e instanceof Error?e.message:String(e)).toLowerCase();
      if(message.includes('load failed')||message.includes('failed to fetch')||message.includes('network'))return deferGuestTransport(turn);
      throw e;
    }
    if(!r.ok||!r.body){
      const d=await r.json().catch(()=>({error:'Gateway unavailable'})) as GuestQuotaError;
      if(r.status===429&&deferGuestTurn(turn,d,r))return 'deferred' as const;
      clearPendingGuestTurn();
      const raw=errorText(d.error||d.detail)||'Gateway unavailable';throw new Error(friendlyGuestError(raw,d.retryAfterSeconds));
    }
    clearPendingGuestTurn();
    setMsgs(xs=>xs.map((m,i)=>i===xs.length-1?{...m,progress:guestProgressLabel(turn,'generating')}:m));
    const guestSources=decodeGuestResearchSources(r);if(guestSources.length)setMsgs(xs=>xs.map((m,i)=>i===xs.length-1?{...m,sources:guestSources}:m));
    const reader=r.body.getReader();const dec=new TextDecoder();let buf='';let answer='';
    while(true){const {done,value}=await reader.read();if(done)break;buf+=dec.decode(value,{stream:true});const lines=buf.split('\n');buf=lines.pop()||'';for(const raw of lines){const line=raw.trim();if(!line.startsWith('data:'))continue;const data=line.slice(5).trim();if(!data||data==='[DONE]')continue;const j=JSON.parse(data);if(j?.error)throw new Error(friendlyGuestError(errorText(j.error)));const chunk=j?.choices?.[0]?.delta?.content||'';if(chunk){answer+=chunk;setMsgs(xs=>xs.map((m,i)=>i===xs.length-1?{...m,text:answer}:m))}}}
    if(!answer)setMsgs(xs=>xs.map((m,i)=>i===xs.length-1?{...m,text:'I didn’t get a response back. Please try again.'}:m));
    return 'completed' as const;
  };
  const sendGuest=async(content:string,currentAttachments:Attachment[],selectedCommandMode:string,selectedCommandSkills:string[],researchPrefs:ResearchPrefs)=>{
    const userMsg:Msg={role:'user',text:content,attachments:currentAttachments};const visibleHistory=[...msgs,userMsg];
    const turn:PendingGuestTurn={id:globalThis.crypto?.randomUUID?.()||`guest-turn-${Date.now()}`,history:visibleHistory.map(m=>({role:m.role,text:m.text})),attachments:currentAttachments,commandMode:selectedCommandMode,commandSkills:selectedCommandSkills,research:researchPrefs,reason:'guest_rate_limited',retryAt:Date.now(),attempts:0,createdAt:Date.now()};
    setText('');setAttachments([]);setCommandMode('');setCommandSkills([]);setCommandMenu('');
    await attemptGuestTurn(turn);
  };
  useEffect(()=>{
    if(!pendingGuestTurn&&!autoRunWaiting)return;
    const timer=window.setInterval(()=>setAutoContinueClock(Date.now()),1000);
    return()=>window.clearInterval(timer);
  },[pendingGuestTurn,autoRunWaiting]);
  useEffect(()=>{
    if(!guest||!pendingGuestTurnId)return;
    let cancelled=false;
    const check=async()=>{
      try{
        const r=await fetch('/api/guest/policy',{cache:'no-store',headers:guestDeviceHeaders()});
        if(!r.ok||cancelled)return;
        const policy=await r.json() as GuestPolicy;setGuestPolicy(policy);
        setPendingGuestTurn(current=>{
          if(!current||current.id!==pendingGuestTurnId)return current;
          let retryAt=current.retryAt;
          if(current.reason==='guest_rate_limited'){
            const seconds=Math.max(0,Number(policy.rateRetryAfterSeconds||0));
            retryAt=seconds===0?Date.now():Date.now()+seconds*1000;
          }else if(current.reason==='guest_quota_exhausted'){
            const remaining=Number(policy.quota?.remaining||0);
            if(policy.quotaMode==='unlimited'||remaining>0)retryAt=Date.now();
            else if(policy.quota?.resetAt){const resetAt=new Date(policy.quota.resetAt).getTime();if(Number.isFinite(resetAt))retryAt=resetAt}
		  }else{
		    retryAt=current.retryAt;
          }
          if(retryAt===current.retryAt)return current;
          const next={...current,retryAt};try{localStorage.setItem(PENDING_GUEST_TURN_KEY,JSON.stringify(next))}catch{}return next;
        });
      }catch{}
    };
    void check();const timer=window.setInterval(()=>void check(),AUTO_CONTINUE_POLL_MS);
    const wake=()=>{if(document.visibilityState==='visible')void check()};window.addEventListener('focus',wake);document.addEventListener('visibilitychange',wake);
    return()=>{cancelled=true;window.clearInterval(timer);window.removeEventListener('focus',wake);document.removeEventListener('visibilitychange',wake)};
  },[guest,pendingGuestTurnId,pendingGuestTurnReason]);
  useEffect(()=>{
    if(!guest||!pendingGuestTurn||autoContinueClock<pendingGuestTurn.retryAt)return;
    const timer=window.setTimeout(()=>{
      if(autoContinueLockRef.current)return;
      autoContinueLockRef.current=true;setBusy(true);setUploadError('');
      void attemptGuestTurn(pendingGuestTurn).catch(e=>{
        const message=e instanceof Error?e.message:String(e);
        setMsgs(old=>{const last=old[old.length-1];if(last?.role==='ai'&&!last.text)return old.map((m,i)=>i===old.length-1?{...m,text:message}:m);return [...old,{role:'ai',text:message}]});
      }).finally(()=>{autoContinueLockRef.current=false;setBusy(false)});
    },0);
    return()=>window.clearTimeout(timer);
    // Retry uses the persisted turn snapshot; helper identity is intentionally excluded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[guest,pendingGuestTurn?.id,pendingGuestTurn?.retryAt,autoContinueClock]);
  useEffect(()=>{
    if(guest||!currentRun||!autoRunWaiting)return;
    if(!quotaChangedForWaitingRun&&(!autoRunRetryAt||autoContinueClock<autoRunRetryAt))return;
    const timer=window.setTimeout(()=>{
      if(autoContinueLockRef.current)return;
      autoContinueLockRef.current=true;
      void controlRun('resume').finally(()=>{autoContinueLockRef.current=false});
    },0);
    return()=>window.clearTimeout(timer);
    // Auto-resume is keyed by persisted run id/error/update time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[guest,currentRun?.id,currentRun?.error,currentRun?.updatedAt,autoRunWaiting,autoRunRetryAt,autoContinueClock,quotaChangedForWaitingRun]);
  const cancelGuestAutoContinue=()=>{clearPendingGuestTurn();setUploadError('')};
  const send=async()=>{
    if(!accessReady||(!text.trim()&&!attachments.length)||busy||autoContinueWaiting||uploading>0)return;
    const q=text.trim();const selectedCommandMode=commandMode;const selectedCommandSkills=[...commandSkills];
    if(selectedCommandMode==='deep-search'&&!deepSearchPrefsRef.current){
      const defaults=browserResearchPrefs('deep');const firstFocus=deepSearchFocusOptions(q)[0]?.focus||'';
      setDeepSearchWizard({step:1,prefs:{...defaults,focus:firstFocus},prompt:q,evidence:'balanced'});return;
    }
    const researchPrefs=selectedCommandMode==='deep-search'?(deepSearchPrefsRef.current||browserResearchPrefs('deep')):browserResearchPrefs('standard');
    setBusy(true);setAttachMenu(false);setUploadError('');setGenerationNotice('');
    let currentAttachments=[...attachments];const content=q||attachmentReviewPrompt(msgs);
    try{
      const autoFileFormat=q&&!pending?requestedFileGenerationFormat(q):'';
      if(autoFileFormat&&!currentAttachments.some(a=>a.source==='generated-file'&&a.name.toLowerCase().endsWith(`.${autoFileFormat}`))){
        setGuestGenerating('file');
        try{const generated=await requestGeneratedFile(q,autoFileFormat);currentAttachments=[...currentAttachments,generated];setAttachments(currentAttachments)}finally{setGuestGenerating('')}
      }
      if(guest){await sendGuest(content,currentAttachments,selectedCommandMode,selectedCommandSkills,researchPrefs);deepSearchPrefsRef.current=null;return}
      const current=await ensureSession(content);const stored=await saveSessionMessage(current,'user',content,currentAttachments.map(a=>a.id));
      setMsgs(old=>[...old,{id:stored.id,role:'user',text:stored.content,attachments:currentAttachments}]);setText('');setAttachments([]);setCommandMode('');setCommandSkills([]);setCommandMenu('');await startRun(current,selectedCommandMode,selectedCommandSkills,researchPrefs);deepSearchPrefsRef.current=null;await refreshSessions();
    }catch(e){setMsgs(old=>{const last=old[old.length-1];const message=e instanceof Error?e.message:String(e);const display=guest?message:`I couldn’t connect: ${message}`;if(last?.role==='ai'&&!last.text)return old.map((m,i)=>i===old.length-1?{...m,text:display}:m);return [...old,{role:'ai',text:guest?message:`I couldn’t start the run: ${message}`}]})}finally{setBusy(false)}
  };
  const editAndRetry=async(message:Msg,content:string)=>{
    if(!sessionId||!message.id||busy)return;const next=content.trim();if(!next)return;setBusy(true);setUploadError('');
    try{const r=await fetch(`/api/chat-sessions/${encodeURIComponent(sessionId)}/messages/${message.id}`,{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({content:next})});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(errorText(d.error)||'Could not edit message');setEditingMessageId(null);setEditText('');await loadSessionData(sessionId,false,true);await startRun(sessionId);await refreshSessions()}catch(e){setUploadError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  };
  const retryFromAssistant=async(index:number)=>{for(let i=index-1;i>=0;i--){const m=msgs[i];if(m.role==='user'&&m.id){await editAndRetry(m,m.text);return}}};
  const confirmDeepSearch=()=>{
    const wizard=deepSearchWizard;if(!wizard)return;
    const evidence=deepSearchEvidenceOptions(wizard.prompt).find(option=>option.id===wizard.evidence);
    deepSearchPrefsRef.current={...wizard.prefs,depth:'deep',focus:[wizard.prefs.focus,evidence?.focus||''].filter(Boolean).join(' · ')};
    setDeepSearchWizard(null);
    window.setTimeout(()=>void send(),0);
  };
  const closeDeepSearchWizard=()=>{deepSearchPrefsRef.current=null;setDeepSearchWizard(null)};
  const submit=(e:FormEvent)=>{e.preventDefault();void send()};

  const chatSidebar=<>
    <div className="chatHistoryHead"><button className="newChatButton" type="button" onClick={newChat}><Plus size={17}/><span>New chat</span></button></div>
    <label className="historySearch"><Search size={15}/><input ref={historySearchRef} value={historyQuery} onChange={e=>setHistoryQuery(e.target.value)} placeholder="Search chats"/><kbd>⌘K</kbd></label>
    <div className="historyList chatHistoryList" aria-busy={historySearching}>
      {historySearching?<div className="historySearching"><span/><span/><span/></div>:null}
      {visibleHistorySessions.length?historyGroups.map(group=><section className="historyGroup" key={group.label}><div className="historyGroupLabel">{group.label}</div>{group.sessions.map(s=><div key={s.id} className={`historyItem ${sessionId===s.id?'active':''}`}>
        {renamingId===s.id?<form className="renameForm" onSubmit={e=>{e.preventDefault();void renameSession(s.id)}}><input autoFocus value={renameText} onChange={e=>setRenameText(e.target.value)} onBlur={()=>{if(renameText.trim())void renameSession(s.id);else setRenamingId('')}}/></form>:<button type="button" disabled={historyBusy} onClick={()=>void openSession(s.id)} title={s.title}><strong>{s.title}</strong></button>}
        <details className="historyMenu"><summary aria-label={`More options for ${s.title}`}><MoreHorizontal size={16}/></summary><div className="historyMenuPopover"><button type="button" onClick={e=>{const details=e.currentTarget.closest('details');if(details)details.open=false;void togglePinSession(s)}}>{s.pinnedAt?<PinOff size={14}/>:<Pin size={14}/>}<span>{s.pinnedAt?'Unpin':'Pin'}</span></button><button type="button" onClick={e=>{const details=e.currentTarget.closest('details');if(details)details.open=false;setRenamingId(s.id);setRenameText(s.title)}}><Pencil size={14}/><span>Rename</span></button><button className="danger" type="button" onClick={e=>{const details=e.currentTarget.closest('details');if(details)details.open=false;void deleteSession(s.id)}}><Trash2 size={14}/><span>Delete</span></button></div></details>
      </div>)}</section>):<div className="historyEmpty">{historyQuery?(historySearching?'Searching…':'No matching chats'):'Your chats will appear here.'}</div>}
    </div>
    {capabilities?<div className="chatHistoryFoot"><span>Smart Assist</span><strong>On</strong><small>{capabilities.skills.length} skills · {capabilities.tools.length} tools</small></div>:null}
  </>;
  return <div className="chatPage">
    {!guest&&sidebarTarget?createPortal(chatSidebar,sidebarTarget):null}
    {deepSearchWizard?<div className="modalBackdrop deepSearchBackdrop" role="dialog" aria-modal="true" aria-label={deepSearchThai?'ปรับการค้นคว้าเชิงลึก':'Deep research context'} onMouseDown={e=>{if(e.target===e.currentTarget)closeDeepSearchWizard()}}><div className="modalCard deepSearchWizard">
      <div className="deepSearchWizardHead"><div><span className="deepSearchIcon"><Globe2 size={18}/></span><div><strong>{deepSearchThai?'บริบทการค้นคว้า':'Research context'}</strong><small>{deepSearchWizard.step}/3 {deepSearchThai?'คำถาม':'questions'} · Deep Search</small></div></div><button type="button" aria-label="Close" onClick={closeDeepSearchWizard}><X size={18}/></button></div>
      <div className="deepSearchPromptPreview"><span>{deepSearchThai?'หัวข้อ':'Topic'}</span><strong>{deepSearchWizard.prompt||attachmentReviewPrompt(msgs)}</strong></div>
      {deepSearchWizard.step===1?<section className="deepSearchQuestion"><div className="deepSearchQuestionHead"><span>1</span><div><strong>{deepSearchThai?'ต้องการเน้นข้อมูลด้านใดเป็นพิเศษ?':'What should the research focus on?'}</strong><small>{deepSearchThai?'เลือกมุมหลักก่อน ระบบยังจะค้นประเด็นสำคัญอื่นประกอบให้':'Choose the primary angle; Daiki will still cover important adjacent findings.'}</small></div></div><div className="deepSearchOptionList">{deepSearchFocusChoices.map(option=><button type="button" key={option.id} className={deepSearchWizard.prefs.focus===option.focus?'selected':''} onClick={()=>setDeepSearchWizard(current=>current?{...current,prefs:{...current.prefs,focus:option.focus}}:current)}><i>{deepSearchWizard.prefs.focus===option.focus?<Check size={13}/>:null}</i><span><strong>{option.label}</strong><small>{option.detail}</small></span></button>)}</div><label className="deepSearchCustom"><span>{deepSearchThai?'หรือระบุมุมค้นหาเอง':'Or add a custom focus'}</span><input value={deepSearchWizard.prefs.focus} onChange={e=>setDeepSearchWizard(current=>current?{...current,prefs:{...current.prefs,focus:e.target.value}}:current)} placeholder={deepSearchThai?'เช่น ปัญหาที่ผู้ใช้จริงเจอบ่อยในไทย':'e.g. recurring real-user issues in Thailand'}/></label></section>:null}
      {deepSearchWizard.step===2?<section className="deepSearchQuestion"><div className="deepSearchQuestionHead"><span>2</span><div><strong>{deepSearchThai?'ต้องการให้ให้น้ำหนักพื้นที่แบบไหน?':'Which geographic scope should be prioritized?'}</strong><small>{deepSearchThai?'ถ้าอยู่ไทย แนะนำประเทศไทยก่อนแล้วค่อยขยาย Global':'For Thailand-based use, Thailand first then Global is recommended.'}</small></div></div><div className="deepSearchOptionList">
        <button type="button" className={deepSearchWizard.prefs.region==='TH'&&deepSearchWizard.prefs.scope==='local-first'?'selected':''} onClick={()=>setDeepSearchWizard(current=>current?{...current,prefs:{...current.prefs,region:'TH',scope:'local-first'}}:current)}><i>{deepSearchWizard.prefs.region==='TH'&&deepSearchWizard.prefs.scope==='local-first'?<Check size={13}/>:null}</i><span><strong>{deepSearchThai?'ประเทศไทยก่อน แล้วค่อย Global':'Thailand first, then Global'}</strong><small>{deepSearchThai?'ราคา รุ่น โปรโมชั่น กฎหมาย การรับประกัน ศูนย์บริการ และเสียงผู้ใช้ไทยมาก่อน':'Prioritize Thai market facts, rules, availability, service and local user voices before global context.'}</small></span><em>{deepSearchThai?'แนะนำ':'Recommended'}</em></button>
        <button type="button" className={deepSearchWizard.prefs.region==='TH'&&deepSearchWizard.prefs.scope==='local-only'?'selected':''} onClick={()=>setDeepSearchWizard(current=>current?{...current,prefs:{...current.prefs,region:'TH',scope:'local-only'}}:current)}><i>{deepSearchWizard.prefs.region==='TH'&&deepSearchWizard.prefs.scope==='local-only'?<Check size={13}/>:null}</i><span><strong>{deepSearchThai?'เฉพาะประเทศไทย':'Thailand only'}</strong><small>{deepSearchThai?'เหมาะเมื่อผลลัพธ์ต้องอิงตลาดหรือบริบทไทยเท่านั้น':'Use when the answer must stay within Thai-market or Thai-context evidence.'}</small></span></button>
        <button type="button" className={deepSearchWizard.prefs.scope==='global'?'selected':''} onClick={()=>setDeepSearchWizard(current=>current?{...current,prefs:{...current.prefs,region:'GLOBAL',scope:'global'}}:current)}><i>{deepSearchWizard.prefs.scope==='global'?<Check size={13}/>:null}</i><span><strong>Global</strong><small>{deepSearchThai?'ค้นทั่วโลกโดยไม่ให้น้ำหนักประเทศไทยเป็นพิเศษ':'Search worldwide without a Thailand-first ranking boost.'}</small></span></button>
      </div></section>:null}
      {deepSearchWizard.step===3?<section className="deepSearchQuestion"><div className="deepSearchQuestionHead"><span>3</span><div><strong>{deepSearchThai?'ต้องการให้น้ำหนักแหล่งข้อมูลแบบใด?':'Which evidence mix should be emphasized?'}</strong><small>{deepSearchThai?'Deep Search จะค้น Web + Social และ cross-check ให้อัตโนมัติ':'Deep Search searches both the web and public social sources, then cross-checks them.'}</small></div></div><div className="deepSearchOptionList">{deepSearchEvidenceChoices.map(option=><button type="button" key={option.id} className={deepSearchWizard.evidence===option.id?'selected':''} onClick={()=>setDeepSearchWizard(current=>current?{...current,evidence:option.id}:current)}><i>{deepSearchWizard.evidence===option.id?<Check size={13}/>:null}</i><span><strong>{option.label}</strong><small>{option.detail}</small></span></button>)}</div><div className="deepSearchSocialNote"><Globe2 size={15}/><div><strong>{deepSearchThai?'Social discovery เปิดใช้งาน':'Social discovery enabled'}</strong><span>Facebook · Instagram · TikTok · YouTube · Reddit · Pantip · X · Threads · LinkedIn</span></div></div></section>:null}
      <div className="deepSearchWizardFoot"><button type="button" className="btn ghost" onClick={closeDeepSearchWizard}>{deepSearchThai?'ยกเลิก':'Cancel'}</button><div>{deepSearchWizard.step>1?<button type="button" className="btn ghost" onClick={()=>setDeepSearchWizard(current=>current?{...current,step:Math.max(1,current.step-1)}:current)}>{deepSearchThai?'ย้อนกลับ':'Back'}</button>:null}{deepSearchWizard.step<3?<button type="button" className="btn primary" onClick={()=>setDeepSearchWizard(current=>current?{...current,step:Math.min(3,current.step+1)}:current)}>{deepSearchThai?'ถัดไป':'Next'}</button>:<button type="button" className="btn primary" onClick={confirmDeepSearch}><Search size={15}/>{deepSearchThai?'เริ่ม Deep Search':'Start Deep Search'}</button>}</div></div>
    </div></div>:null}
    <section className="chatStage">
      <header className="chatTopbar">
        <div className="chatTopbarTitle">{guest?<div className="guestMark">D</div>:null}<div><strong>{!accessReady?'Daiki AI Passport':guest?'Guest chat':currentSession?.title||'New chat'}</strong><small>{!accessReady?'Preparing chat…':busy?'Daiki is thinking…':guest?'Fast mode · temporary chat':'Daiki AI Passport'}</small></div></div>
        {!accessReady?<div className="guestTopbarControls"><span>Checking access…</span></div>:guest?<div className="guestTopbarControls"><span>Guest · Fast</span><Link className="btn compact primary" href="/login">Sign in</Link></div>:<div className="chatTopbarControls">
          {quota?.mode==='limited'&&!quotaIndicatorHidden?<details className={`quotaControl ${quotaBlocked?'blocked':''}`}>
            <summary><span className="quotaStatusDot"/><span>{quotaBlocked?'Quota blocked':`Quota · ${fmtTokens(Number(quota.remaining||0))} left`}</span></summary>
            <div className="quotaPopover">
              <div className="quotaPopoverHead"><div><strong>Token quota</strong><small>{quotaBlocked?'Usage is currently blocked':'Usage updates automatically'}</small></div><button type="button" aria-label="Hide quota indicator" onClick={()=>setQuotaIndicatorHidden(true)}><X size={14}/></button></div>
              <div className="quotaPopoverTotal"><strong>{fmtTokens(Number(quota.used||usageInfo?.usage?.totalTokens||0))} / {fmtTokens(Number(quota.limit||0))}</strong><span>{fmtTokens(Number(quota.remaining||0))} remaining{quota.resetAt?` · resets ${new Date(quota.resetAt).toLocaleTimeString()}`:''}</span></div>
              {(quota.limits||[]).length?<div className="quotaPopoverWindows">{(quota.limits||[]).map(l=><div key={l.id}><span>{l.interval}{l.interval==='hour'&&Number(l.intervalCount||1)>1?` · every ${l.intervalCount}h`:''}</span><strong>{fmtTokens(l.used)} / {fmtTokens(l.limit)}</strong></div>)}</div>:null}
              {resetsAvailable>0?<small className="quotaPopoverReset">{resetsAvailable} reset{resetsAvailable===1?'':'s'} available{resetCredits?.nextExpiry?` · earliest expiry ${new Date(resetCredits.nextExpiry).toLocaleString()}`:''}</small>:null}
            </div>
          </details>:null}
          <details className="thinkingControl">
            <summary aria-disabled={pending}><Brain size={13}/><span>Think: {thinking.label}</span></summary>
            <div className="thinkingPopover">
              <div className="thinkingPopoverHead"><div><strong>Thinking</strong><small>{thinking.label}</small></div><strong>{thinking.effort==='none'?'Off':thinking.effort}</strong></div>
              <input aria-label="Thinking level" type="range" min={0} max={thinkingLevels.length-1} step={1} value={thinkingIndex} disabled={pending} onChange={e=>updateThinkingMode(thinkingLevels[Number(e.target.value)].id)}/>
              <div className="thinkingTicks">{thinkingLevels.map(x=><span key={x.id}>{x.label}</span>)}</div>
              <div className="tokenBudget"><span>Request ceiling</span><div><b>{fmtTokens(estimatedInput)}</b><small>input est.</small><i>+</i><b>{fmtTokens(thinking.completion)}</b><small>completion max</small><i>=</i><b>{fmtTokens(estimatedTotal)}</b><small>total max</small></div></div>
              <p>{pending?'Pending access uses Thinking Off and the account completion cap.':thinking.description} Native reasoning depth is provider-controlled; actual reasoning tokens are shown under the completed answer. Hidden reasoning content is never displayed.</p>
            </div>
          </details>
          <select aria-label="Research mode" value={researchMode} onChange={e=>{const v=e.target.value as 'auto'|'web'|'off';setResearchMode(v);try{const p=JSON.parse(localStorage.getItem('daiki_preferences')||'{}');localStorage.setItem('daiki_preferences',JSON.stringify({...p,researchMode:v}))}catch{}}}><option value="auto">Web: Auto</option><option value="web">Web: On</option><option value="off">Web: Off</option></select>
          <select aria-label="Model route" value={pending?'fast':model} disabled={pending} onChange={e=>void updateSessionModel(e.target.value)}>{(pending?[['fast','Fast'] as const]:routes).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select>
        </div>}
      </header>

      {guest&&accessReady?<aside className="guestUnlockBanner"><div className="guestUnlockCopy"><strong>Unlock the full Daiki experience</strong><span>Sign in to unlock saved chat history, more models, background runs, and advanced agent tools.</span></div><div className="guestUnlockActions"><Link className="btn compact primary" href="/login">Sign in</Link><a className="btn compact ghost" href="/api/auth/register">Create account</a></div></aside>:null}

      <div className="chatScroll" ref={scrollRef} onDragOver={e=>{if(!uploadRestricted)e.preventDefault()}} onDrop={e=>{if(uploadRestricted)return;e.preventDefault();void uploadFiles(e.dataTransfer.files,'file')}}>
        {!msgs.length&&!currentRun?<div className="chatEmptyState"><div className="emptyMark">D</div><h1>What can I help with?</h1><p>{guest?'Chat through Hermes with Fast. Type / for modes and @ for skills, including Deep Search and document/data skills; sign in for history, more models and full agent tools.':'Ask anything, research the web, or drop in files and project folders.'}</p>{guest?<div className="guestPolicyStrip"><span>Fast only</span><span>{guestPolicy?(guestPolicy.requestsPerHour===0?'Unlimited requests':`${guestPolicy.requestsPerHour}/hour`):'Rate policy'}</span><span>{guestPolicy?(guestPolicy.quotaMode==='unlimited'?'Unlimited tokens':`${new Intl.NumberFormat().format(guestPolicy.tokenLimit)} tokens/${guestPolicy.intervalKind}`):'Token policy'}</span>{guestPolicy?.allowUploads?<span>Uploads · {guestPolicy.maxUploadsPerHour===0?'Unlimited':`${guestPolicy.maxUploadsPerHour}/hour`}</span>:null}{guestPolicy?.allowImageGeneration?<span>Images · {guestPolicy.imageGenerationsPerDay===0?'Unlimited':`${guestPolicy.imageGenerationsPerDay}/day`}</span>:null}{guestPolicy?.allowFileGeneration?<span>Files · {guestPolicy.fileGenerationsPerDay===0?'Unlimited':`${guestPolicy.fileGenerationsPerDay}/day`}</span>:null}</div>:null}<div className="promptStarters">{starters.map(([label,prompt])=><button key={label} type="button" onClick={()=>setText(prompt)}><span>{label}</span><small>{prompt}</small></button>)}</div></div>:<div className="messageFeed">
          {msgs.map((m,i)=>{const copyKey=`${m.role}-${m.id??i}`;const tokens=m.run?.activity?.tokens;const research=m.run?.activity?.research;const sources=m.sources||research?.sources||[];const runThinking=m.run?.activity?.thinking;const thinkingModeLabel=runThinking?.mode||m.run?.thinkingMode||'off';const effectiveEffort=runThinking?.effectiveEffort;const reasoningTokens=tokens?.reasoning||0;return <div key={copyKey} className={`messageRow ${m.role}`}><div className="messageAvatar">{m.role==='ai'?'D':'You'}</div><div className="messageStack"><div className="bubble">{m.role==='user'&&editingMessageId===m.id?<div className="messageEditor"><textarea autoFocus value={editText} onChange={e=>setEditText(e.target.value)} rows={Math.min(8,Math.max(2,editText.split('\n').length))}/><div><button type="button" onClick={()=>{setEditingMessageId(null);setEditText('')}}>Cancel</button><button type="button" className="primary" onClick={()=>void editAndRetry(m,editText)}>Save & Retry</button></div></div>:<MessageContent message={m} sources={sources}/>}</div>
            {m.text?<div className="messageActions"><button type="button" aria-label="Copy message" onClick={()=>void copyMessage(m.text,copyKey)}>{copiedKey===copyKey?<Check size={13}/>:<Copy size={13}/>}<span>{copiedKey===copyKey?'Copied':'Copy'}</span></button>{m.role==='user'&&m.id?<button type="button" disabled={busy} onClick={()=>{setEditingMessageId(m.id!);setEditText(m.text)}}><Pencil size={13}/><span>Edit</span></button>:null}{m.role==='ai'&&!guest?<button type="button" disabled={busy} onClick={()=>void retryFromAssistant(i)}><RotateCcw size={13}/><span>Retry</span></button>:null}</div>:null}
            {m.role==='ai'&&(sources.length||research?.used||m.run||tokens)?<div className="responseMetaBar">
              {research?.used||sources.length?<><ResearchSources sources={sources}/><span className="researchBadge"><Globe2 size={12}/>{m.run?.commandMode==='deep-search'||research?.depth==='deep'?'Deep Search':'Web searched'} · {research?.sourceCount||sources.length}</span>{research?.socialSourceCount?<span className="socialResearchBadge">Social · {research.socialSourceCount}{research.socialPlatforms?.length?` · ${research.socialPlatforms.slice(0,3).join(', ')}`:''}</span>:null}{research?.region==='TH'&&research.scope!=='global'?<span className="localResearchBadge">Thailand first</span>:null}</>:null}
              {m.run&&thinkingModeLabel!=='off'?<span className="thinkingBadge"><Brain size={12}/>Thought · {thinkingModeLabel}{effectiveEffort&&effectiveEffort!==thinkingModeLabel?` → ${effectiveEffort}`:''}{m.run.activity?.durationMs!=null?` · ${(m.run.activity.durationMs/1000).toFixed(1)}s`:''}{reasoningTokens>0?` · ${fmtTokens(reasoningTokens)} reasoning`:''}</span>:null}
              {tokens?<span className="tokenUsageBadge">Tokens · {fmtTokens(tokens.total)}</span>:null}
              {m.run?<RunActivityDetails run={m.run}/>:null}
            </div>:null}
            {m.attachments?.length?<div className="sentAttachments">{m.attachments.map(a=><a key={a.id} className="sentAttachment" href={`${guest?'/api/guest/attachments':'/api/attachments'}/${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer">{a.mediaType.startsWith('image/')?<ImageIcon size={14}/>:a.source==='folder'?<FolderOpen size={14}/>:<File size={14}/>}<span>{a.relativePath}</span></a>)}</div>:null}
          </div></div>})}
          {pendingGuestTurn?<div className="messageRow ai runMessage autoContinueMessage"><div className="messageAvatar">D</div><div className="messageStack"><div className="bubble"><div className="backgroundRunStatus waiting"><RotateCcw size={15}/><span>{pendingGuestTurn.reason==='guest_rate_limited'?'Guest rate limit reached.':pendingGuestTurn.reason==='provider_rate_limited'?'Model provider is temporarily rate limited.':pendingGuestTurn.reason==='transport_retry'?'Connection interrupted. Daiki will reconnect automatically.':'Guest token quota is waiting for reset.'} Your message is saved and will continue automatically in <strong>{guestAutoWaitLabel}</strong>.</span></div></div><div className="runControls"><button type="button" disabled={localBusy} onClick={cancelGuestAutoContinue}><X size={13}/>Stop waiting</button></div></div></div>:null}
          {currentRun&&currentRun.status!=='completed'?<div className="messageRow ai runMessage"><div className="messageAvatar">D</div><div className="messageStack"><div className="bubble">{currentRun.status==='queued'||currentRun.status==='running'?<div className="backgroundRunStatus thinking"><div className="typingDots" aria-label="Daiki is thinking"><i/><i/><i/></div><span>{runProgressLabel(currentRun,msgs)}</span></div>:currentRun.status==='paused'?<div className="backgroundRunStatus"><Pause size={15}/><span>Paused</span></div>:autoRunWaiting?<div className="backgroundRunStatus waiting"><RotateCcw size={15}/><span>{currentRun.error==='pending_chat_rate_limited'?'Rate limit reached.':'Token quota is waiting for reset.'} {autoRunRetryAt?<><span>This message is saved and will continue automatically in </span><strong>{runAutoWaitLabel}</strong>.</>:<span>This message is saved and will continue automatically when quota becomes available.</span>}</span></div>:<div className="backgroundRunStatus error"><span>{friendlyRunError(currentRun.error)}</span></div>}</div><DeepResearchProgress run={currentRun}/><div className="runControls">{currentRun.status==='running'||currentRun.status==='queued'?<button type="button" disabled={localBusy} onClick={()=>void controlRun('pause')}><Pause size={13}/>Pause</button>:autoRunWaiting?<><button type="button" disabled={localBusy} onClick={()=>void controlRun('resume')}><Play size={13}/>Continue now</button><button type="button" disabled={localBusy} onClick={()=>void controlRun('cancel')}><X size={13}/>Stop waiting</button></>:currentRun.status==='paused'||currentRun.status==='failed'||currentRun.status==='cancelled'?<button type="button" disabled={localBusy} onClick={()=>void controlRun('resume')}><Play size={13}/>Play</button>:null}</div><RunActivityDetails run={currentRun}/></div></div>:null}
        </div>}
      </div>

      <div className="composerDock">
        {resetGiftNotice?<div className="notice resetGiftNotice"><div><strong>Quota reset received</strong><span>{resetGiftNotice}</span></div><button type="button" className="btn compact ghost" onClick={()=>setResetGiftNotice('')}>Got it</button></div>:null}
        {quota?.mode==='limited'&&quotaBlocked?<div className="notice quotaNoticeExhausted quotaNotice"><div><strong>Token quota blocked</strong><span>{`Natural reset${quota.resetAt?` in ${resetRemainingLabel} (${new Date(quota.resetAt).toLocaleTimeString()})`:''}`}</span>{quotaLimitSummary?<small>{quotaLimitSummary}</small>:null}{resetsAvailable>0?<small>{resetsAvailable} reset{resetsAvailable===1?'':'s'} available{resetCredits?.nextExpiry?` · expires ${new Date(resetCredits.nextExpiry).toLocaleString()}`:''}</small>:null}</div>{resetsAvailable>0?<button type="button" className="btn compact primary" disabled={resetBusy} onClick={()=>void redeemQuotaReset()}>{resetBusy?'Resetting…':'Use 1 reset & retry'}</button>:null}</div>:null}
        <form className="composerBox" onSubmit={submit}>
          {commandMode||commandSkills.length||automaticAttachmentSkillOptions.length?<div className="commandSelectionTray">{selectedModeOption?<button type="button" className="commandChip mode" onClick={()=>setCommandMode('')} title="Remove mode"><b>/</b>{selectedModeOption.name}<X size={12}/></button>:null}{selectedSkillOptions.map(skill=><button type="button" className="commandChip skill" key={skill.id} onClick={()=>setCommandSkills(xs=>xs.filter(id=>id!==skill.id))} title={`Remove ${skill.name}`}><b>@</b>{skill.name}<X size={12}/></button>)}{automaticAttachmentSkillOptions.map(skill=><span className="commandChip skill autoSkill" key={`auto-${skill.id}`} title={`${skill.name} is selected automatically from the attachment`}><b>@</b>{skill.name}<small>Auto</small></span>)}</div>:null}
          {commandMenu&&commandItems.length?<div className="commandPalette" role="listbox" aria-label={commandMenu==='mode'?'Modes':'Skills'}><div className="commandPaletteHead"><strong>{commandMenu==='mode'?'Modes':'Skills'}</strong><span>{commandMenu==='mode'?'Choose how Daiki should work':'Choose up to 4 skills for this turn'}</span></div>{commandItems.map((item,index)=><button type="button" role="option" aria-selected={index===commandIndex} className={index===commandIndex?'active':''} key={item.id} onMouseDown={e=>e.preventDefault()} onClick={()=>selectCommand(item)}><code>{commandMenu==='mode'?'/':'@'}{item.id}</code><span><strong>{item.name}</strong><small>{item.description}</small></span>{guest&&item.guest?<em>Guest</em>:null}</button>)}</div>:null}
          {attachments.length||uploading||guestGenerating?<div className="attachmentTray">{attachments.map(a=><div className="attachmentChip" key={a.id}><span className="attachmentIcon">{a.mediaType.startsWith('image/')?<ImageIcon size={16}/>:a.source==='folder'?<FolderOpen size={16}/>:<File size={16}/>}</span><div><strong>{a.name}</strong><small>{a.source==='folder'?a.relativePath:size(a.sizeBytes)} · {a.extractStatus}</small></div><button type="button" aria-label={`Remove ${a.name}`} onClick={()=>void removeAttachment(a)}><X size={14}/></button></div>)}{uploading?<div className="attachmentChip uploading"><span className="attachmentIcon"><Paperclip size={16}/></span><div><strong>Uploading…</strong><small>{uploading} file{uploading>1?'s':''}</small></div></div>:null}{guestGenerating?<div className="attachmentChip uploading"><span className="attachmentIcon">{guestGenerating==='image'?<ImageIcon size={16}/>:<File size={16}/>}</span><div><strong>{guestGenerating==='image'?'Generating image…':'Generating file…'}</strong><small>{guestGenerating==='image'?'Calling the configured image provider and validating the result':'Validating and packaging CSV/PDF/JSON/Markdown/text output'}</small></div></div>:null}</div>:null}
          {generationNotice&&!uploadError?<div className="attachmentSuccess">{generationNotice}</div>:null}
          {uploadError?<div className="attachmentError">{uploadError}</div>:null}
          <div className="composerRow"><div className="attachmentMenuWrap"><button className="attachBtn" type="button" aria-label="Add or generate attachment" disabled={attachmentMenuRestricted||busy||autoContinueWaiting||Boolean(guestGenerating)} onClick={()=>{setCommandMenu('');setAttachMenu(x=>!x)}}><Plus size={20}/></button>{attachMenu?<div className="attachmentMenu">
            {!uploadRestricted?<><button type="button" onClick={()=>imageRef.current?.click()}><ImageIcon size={17}/><span><strong>Upload image</strong><small>PNG, JPEG, WebP and more</small></span></button><button type="button" onClick={()=>fileRef.current?.click()}><File size={17}/><span><strong>Upload file</strong><small>Text, code, data or documents</small></span></button>{!guest?<button type="button" onClick={()=>folderRef.current?.click()}><FolderOpen size={17}/><span><strong>Folder</strong><small>Upload a project directory</small></span></button>:null}</>:null}
            {((guest&&guestPolicy?.allowImageGeneration)||(!guest&&!pending))?<button type="button" disabled={!text.trim()||Boolean(guestGenerating)} onClick={()=>void generateAttachment('image')}><ImageIcon size={17}/><span><strong>Generate image</strong><small>{guest?(guestPolicy?.imageGenerationsPerDay===0?'Unlimited · uses current prompt':`${guestPolicy?.imageGenerationsPerDay||0}/day · uses current prompt`):'Uses configured image provider · current prompt'}</small></span></button>:null}
            {((guest&&guestPolicy?.allowFileGeneration)||(!guest&&!pending))?<button type="button" disabled={!text.trim()||Boolean(guestGenerating)} onClick={()=>void generateAttachment('file')}><File size={17}/><span><strong>Generate file</strong><small>{guest?(guestPolicy?.fileGenerationsPerDay===0?'Unlimited · ':`${guestPolicy?.fileGenerationsPerDay||0}/day · `):''}CSV, PDF, JSON, Markdown or text</small></span></button>:null}
          </div>:null}</div><textarea ref={textareaRef} className="chatInput" rows={1} value={text} onChange={e=>updateComposerText(e.target.value)} onKeyDown={handleComposerKeyDown} placeholder={guest?'Message Daiki…  / modes  @ skills':pending?'Message Daiki…  / modes  @ skills':'Message Daiki…  / modes  @ skills'}/><button className="sendBtn" aria-label="Send message" disabled={!accessReady||busy||autoContinueWaiting||uploading>0||Boolean(guestGenerating)||(!text.trim()&&!attachments.length)} type="submit"><Send size={18}/></button></div>
          <input ref={imageRef} hidden type="file" accept="image/*" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'image');e.currentTarget.value=''}}/><input ref={fileRef} hidden type="file" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'file');e.currentTarget.value=''}}/><input ref={folderRef} hidden type="file" multiple onChange={e=>{if(e.target.files)void uploadFiles(e.target.files,'folder');e.currentTarget.value=''}}/>
        </form>
        <div className="composerHint">{guest?<><span>Guest chat is temporary · / modes · @ skills · quota applies · </span><Link href="/login">Sign in for full access</Link></>:<>Type / for modes · @ for skills · Daiki can make mistakes. Check important information.</>}</div>
      </div>
    </section>
  </div>;
}
