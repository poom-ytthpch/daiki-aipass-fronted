import type {Locale} from './config';
import {thMessages} from './th';

const dictionaries:Record<Locale,Record<string,string>>={
  en:{},
  th:thMessages,
};

const thaiDynamicRules:Array<[RegExp,(m:RegExpMatchArray)=>string]>=[
  [/^(\d[\d,.]*|∞) waiting$/i,m=>`${m[1]} กำลังรอ`],
  [/^(\d[\d,.]*|∞) active$/i,m=>`${m[1]} กำลังทำงาน`],
  [/^(\d[\d,.]*|∞) configured$/i,m=>`${m[1]} รายการที่ตั้งค่าแล้ว`],
  [/^(\d[\d,.]*|∞) requests$/i,m=>`${m[1]} คำขอ`],
  [/^(\d[\d,.]*|∞) tokens$/i,m=>`${m[1]} โทเคน`],
  [/^(\d[\d,.]*|∞) shown · (\d[\d,.]*|∞) total$/i,m=>`แสดง ${m[1]} · ทั้งหมด ${m[2]}`],
  [/^(\d[\d,.]*|∞) pending approval$/i,m=>`${m[1]} รายการรออนุมัติ`],
  [/^(\d[\d,.]*|∞) total · (\d[\d,.]*|∞) revoked$/i,m=>`ทั้งหมด ${m[1]} · เพิกถอน ${m[2]}`],
  [/^(\d[\d,.]*|∞) reset(s?) available$/i,m=>`มีสิทธิรีเซ็ต ${m[1]} ครั้ง`],
  [/^(\d[\d,.]*|∞) file(s?)$/i,m=>`${m[1]} ไฟล์`],
  [/^(\d[\d,.]*|∞) stored$/i,m=>`จัดเก็บ ${m[1]} รายการ`],
  [/^(\d[\d,.]*|∞) req$/i,m=>`${m[1]} คำขอ`],
  [/^(\d[\d,.]*|∞)\/hour$/i,m=>`${m[1]}/ชั่วโมง`],
  [/^(\d[\d,.]*|∞)\/day$/i,m=>`${m[1]}/วัน`],
  [/^Quota · (.+) left$/i,m=>`โควตา · เหลือ ${m[1]}`],
  [/^Web searched · (\d+)$/i,m=>`ค้นเว็บแล้ว · ${m[1]}`],
  [/^Web · (\d+) sources?$/i,m=>`เว็บ · ${m[1]} แหล่งอ้างอิง`],
  [/^Sources · (\d+)$/i,m=>`แหล่งอ้างอิง · ${m[1]}`],
  [/^Source (\d+)$/i,m=>`แหล่งอ้างอิง ${m[1]}`],
  [/^Research: (.+)$/i,m=>`การค้นคว้า: ${m[1]}`],
  [/^Query: (.+)$/i,m=>`คำค้น: ${m[1]}`],
  [/^Think: (.+)$/i,m=>`คิด: ${translateText(m[1],'th')}`],
  [/^Thinking · (.+)…$/i,m=>`กำลังคิด · ${translateText(m[1],'th')}…`],
  [/^Thought · (.+)$/i,m=>`คิด · ${m[1]}`],
  [/^Tokens · (.+)$/i,m=>`โทเคน · ${m[1]}`],
  [/^Request (.+)$/i,m=>`คำขอ ${m[1]}`],
  [/^Resets (.+)$/i,m=>`รีเซ็ต ${m[1]}`],
  [/^Reset (.+)$/i,m=>`รีเซ็ต ${m[1]}`],
  [/^Expires (.+)$/i,m=>`หมดอายุ ${m[1]}`],
  [/^expires (.+)$/i,m=>`หมดอายุ ${m[1]}`],
  [/^Earliest expiry (.+)$/i,m=>`หมดอายุเร็วสุด ${m[1]}`],
  [/^Approved (.+)$/i,m=>`อนุมัติเมื่อ ${m[1]}`],
  [/^(\d[\d,.]*) input · (\d[\d,.]*) output$/i,m=>`${m[1]} อินพุต · ${m[2]} เอาต์พุต`],
  [/^(\d[\d,.]*) in · (\d[\d,.]*) out$/i,m=>`${m[1]} เข้า · ${m[2]} ออก`],
  [/^(\d[\d,.]*) in · (\d[\d,.]*) out · (\d[\d,.]*) requests$/i,m=>`${m[1]} เข้า · ${m[2]} ออก · ${m[3]} คำขอ`],
  [/^(\d[\d,.]*) skills · (\d[\d,.]*) tools$/i,m=>`${m[1]} สกิล · ${m[2]} เครื่องมือ`],
  [/^Found (\d+) models on (.+)\.$/i,m=>`พบ ${m[1]} โมเดลบน ${m[2]}`],
  [/^Connected to (.+) · (\d+) models · (.+)$/i,m=>`เชื่อมต่อ ${m[1]} แล้ว · ${m[2]} โมเดล · ${m[3]}`],
  [/^Connected to (.+)\. (.+)$/i,m=>`เชื่อมต่อ ${m[1]} แล้ว ${m[2]}`],
  [/^Revoke (.+)\?$/i,m=>`เพิกถอน ${m[1]}?`],
  [/^Delete provider (.+) and its registered models\?$/i,m=>`ลบผู้ให้บริการ ${m[1]} และโมเดลที่ลงทะเบียนไว้ทั้งหมดหรือไม่?`],
  [/^Remove (.+) from LiteLLM\?$/i,m=>`ลบ ${m[1]} ออกจาก LiteLLM หรือไม่?`],
  [/^Model ID for (.+)$/i,m=>`Model ID สำหรับ ${m[1]}`],
  [/^More options for (.+)$/i,m=>`ตัวเลือกเพิ่มเติมสำหรับ ${m[1]}`],
  [/^Remove (.+)$/i,m=>`เอา ${m[1]} ออก`],
  [/^Please wait (\d+)s before sending another Guest message\.$/i,m=>`กรุณารอ ${m[1]} วินาทีก่อนส่งข้อความ Guest อีกครั้ง`],
];

export function translateText(value:string,locale:Locale):string{
  if(locale==='en'||!value)return value;
  const match=value.match(/^(\s*)([\s\S]*?)(\s*)$/);
  const leading=match?.[1]||'';
  const core=match?.[2]??value;
  const trailing=match?.[3]||'';
  if(!core)return value;
  const direct=dictionaries[locale]?.[core];
  if(direct!=null)return `${leading}${direct}${trailing}`;
  if(locale==='th'){
    const lowerDirect=dictionaries.th[core.charAt(0).toUpperCase()+core.slice(1)];
    if(lowerDirect&&core===core.toLowerCase())return `${leading}${lowerDirect}${trailing}`;
    for(const [pattern,render] of thaiDynamicRules){
      const dynamic=core.match(pattern);
      if(dynamic)return `${leading}${render(dynamic)}${trailing}`;
    }
    const status:Record<string,string>={pending:'รออนุมัติ',approved:'อนุมัติแล้ว',suspended:'ระงับ',rejected:'ปฏิเสธ',active:'ใช้งานอยู่',revoked:'เพิกถอนแล้ว',ready:'พร้อม',degraded:'ประสิทธิภาพลดลง',down:'ล่ม',offline:'ออฟไลน์',online:'ออนไลน์',running:'กำลังทำงาน',queued:'อยู่ในคิว',paused:'หยุดชั่วคราว',failed:'ล้มเหลว',cancelled:'ยกเลิกแล้ว',completed:'เสร็จสิ้น',limited:'จำกัด',unlimited:'ไม่จำกัด',hour:'ชั่วโมง',day:'วัน',week:'สัปดาห์',month:'เดือน',rolling:'Rolling',custom:'กำหนดเอง',lifetime:'ตลอดอายุ'};
    if(status[core.toLowerCase()])return `${leading}${status[core.toLowerCase()]}${trailing}`;
  }
  return value;
}

export function t(locale:Locale,key:string):string{
  return translateText(key,locale);
}
