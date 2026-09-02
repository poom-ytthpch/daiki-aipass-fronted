import {cookies} from 'next/headers';
import {createCipheriv,createDecipheriv,createHash,randomBytes} from 'node:crypto';

export type Session={sub:string;name:string;email?:string;roles:string[];exp:number;accessToken:string};
const COOKIE='daiki_session';
const secret=()=>process.env.SESSION_SECRET||'dev-only-change-me';
const key=()=>createHash('sha256').update(secret()).digest();
const b64=(v:Buffer)=>v.toString('base64url');

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
    return session.exp>Date.now()/1000?session:null;
  }catch{return null}
}

export async function getSession(){return decodeSession((await cookies()).get(COOKIE)?.value)}
export async function setSession(session:Session){
  (await cookies()).set(COOKIE,encodeSession(session),{
    httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE!=='false'&&process.env.NODE_ENV==='production',path:'/',
    maxAge:Math.max(60,session.exp-Math.floor(Date.now()/1000))
  })
}
export async function clearSession(){(await cookies()).delete(COOKIE)}
export const isAdmin=(s:Session|null)=>!!s?.roles.some(r=>['admin','ai-admin'].includes(r));
export const randomState=()=>randomBytes(24).toString('base64url');
export const oidc={
  issuer:()=>process.env.OIDC_ISSUER||'',
  internalIssuer:()=>process.env.OIDC_INTERNAL_ISSUER||process.env.OIDC_ISSUER||'',
  clientId:()=>process.env.OIDC_CLIENT_ID||'daiki-web',
  clientSecret:()=>process.env.OIDC_CLIENT_SECRET||'',
  redirectUri:()=>process.env.OIDC_REDIRECT_URI||'https://ai.infra.local/api/auth/callback',
  publicBase:()=>process.env.PUBLIC_BASE_URL||'https://ai.infra.local'
};
