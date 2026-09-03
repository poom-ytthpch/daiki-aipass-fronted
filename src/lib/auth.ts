import {cookies} from 'next/headers';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export type Session={
  sub:string;name:string;email?:string;emailVerified?:boolean;roles:string[];
  exp:number;accessToken:string;refreshToken?:string;refreshExp?:number;
};

type TokenResponse={access_token:string;expires_in?:number;refresh_token?:string;refresh_expires_in?:number};
const COOKIE='daiki_session';
const secret=()=>{const v=process.env.SESSION_SECRET||'';if(process.env.NODE_ENV==='production'&&(!v||v==='dev-only-change-me'||v.length<32))throw new Error('SESSION_SECRET must be configured with at least 32 characters in production');return v||'dev-only-change-me'};
const key=()=>createHash('sha256').update(secret()).digest();
const b64=(v:Buffer)=>v.toString('base64url');
const now=()=>Math.floor(Date.now()/1000);

export function encodeSession(session:Session){
  const nonce=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key(),nonce);
  const ciphertext=Buffer.concat([cipher.update(JSON.stringify(session),'utf8'),cipher.final()]);
  return `${b64(nonce)}.${b64(ciphertext)}.${b64(cipher.getAuthTag())}`;
}
export function decodeSession(value?:string|null):Session|null{
  if(!value)return null;
  try{
    const [nonceRaw,cipherRaw,tagRaw]=value.split('.');
    if(!nonceRaw||!cipherRaw||!tagRaw)return null;
    const decipher=createDecipheriv('aes-256-gcm',key(),Buffer.from(nonceRaw,'base64url'));
    decipher.setAuthTag(Buffer.from(tagRaw,'base64url'));
    const plain=Buffer.concat([decipher.update(Buffer.from(cipherRaw,'base64url')),decipher.final()]).toString('utf8');
    const session=JSON.parse(plain) as Session;
    const refreshValid=Boolean(session.refreshToken)&&(!session.refreshExp||session.refreshExp>now());
    return session.exp>now()||refreshValid?session:null;
  }catch{return null}
}
export async function getSession(){return decodeSession((await cookies()).get(COOKIE)?.value)}
export async function setSession(session:Session){
  const lifetime=Math.max(session.exp,session.refreshExp||0)-now();
  (await cookies()).set(COOKIE,encodeSession(session),{
    httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE!=='false'&&process.env.NODE_ENV==='production',path:'/',
    maxAge:Math.max(60,lifetime)
  })
}
export async function clearSession(){(await cookies()).delete(COOKIE)}

type RefreshResult={accessToken:string;exp:number;refreshToken:string;refreshExp?:number};
const refreshFlights=new Map<string,Promise<RefreshResult|null>>();

async function requestRefresh(session:Session):Promise<RefreshResult|null>{
  if(!session.refreshToken)return null;
  const tokenKey=createHash('sha256').update(session.refreshToken).digest('hex');
  const existing=refreshFlights.get(tokenKey);
  if(existing)return existing;
  const flight=(async()=>{
    const issuer=oidc.internalIssuer().replace(/\/$/,'');
    if(!issuer)return null;
    const body=new URLSearchParams({grant_type:'refresh_token',client_id:oidc.clientId(),refresh_token:session.refreshToken!});
    if(oidc.clientSecret())body.set('client_secret',oidc.clientSecret());
    const response=await fetch(`${issuer}/protocol/openid-connect/token`,{method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},body,cache:'no-store'});
    if(!response.ok)return null;
    const token=await response.json() as TokenResponse;
    if(!token.access_token)return null;
    return {
      accessToken:token.access_token,
      exp:now()+(token.expires_in||300),
      refreshToken:token.refresh_token||session.refreshToken!,
      refreshExp:token.refresh_expires_in?now()+token.refresh_expires_in:session.refreshExp,
    };
  })().finally(()=>refreshFlights.delete(tokenKey));
  refreshFlights.set(tokenKey,flight);
  return flight;
}

export async function refreshSession(force=false):Promise<Session|null>{
  const session=await getSession();
  if(!session)return null;
  if(!force&&session.exp>now()+90)return session;
  if(!session.refreshToken||session.refreshExp&&session.refreshExp<=now())return null;
  const refreshedToken=await requestRefresh(session);
  if(!refreshedToken){
    // Do not destroy a still-valid access-token session because of a transient
    // refresh failure. If it is already expired the caller will surface 401.
    if(session.exp>now())return session;
    try{await clearSession()}catch{}
    return null;
  }
  const refreshed:Session={...session,...refreshedToken};
  // Route handlers can persist cookies. Server components may call helpers that
  // reach this path but Next.js forbids cookie mutation there; the current
  // request can still use the refreshed access token safely.
  try{await setSession(refreshed)}catch{}
  return refreshed;
}

export const isAdmin=(s:Session|null)=>!!s&&(s.roles.some(r=>['admin','ai-admin'].includes(r))||Boolean(process.env.ADMIN_EMAIL&&s.emailVerified&&s.email&&s.email.toLowerCase()===process.env.ADMIN_EMAIL.toLowerCase()));
export const randomState=()=>randomBytes(24).toString('base64url');
export const oidc={
  issuer:()=>process.env.OIDC_ISSUER||'',
  internalIssuer:()=>process.env.OIDC_INTERNAL_ISSUER||process.env.OIDC_ISSUER||'',
  clientId:()=>process.env.OIDC_CLIENT_ID||'daiki-web',
  clientSecret:()=>process.env.OIDC_CLIENT_SECRET||'',
  redirectUri:()=>process.env.OIDC_REDIRECT_URI||'https://ai.infra.local/api/auth/callback',
  publicBase:()=>process.env.PUBLIC_BASE_URL||'https://ai.infra.local'
};
