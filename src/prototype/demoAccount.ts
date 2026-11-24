import {Gender,MembershipStatus,MembershipType,UserRole,type User} from '../types';
import {hasSelection,readDraft,type Draft} from './model';

const PREFIX='baly-demo-pbkdf2-v1';
const hex=(bytes:ArrayBuffer|Uint8Array)=>Array.from(new Uint8Array(bytes instanceof Uint8Array ? bytes.buffer:bytes),b=>b.toString(16).padStart(2,'0')).join('');
const unhex=(value:string)=>new Uint8Array(value.match(/../g)!.map(v=>parseInt(v,16)));
export const validDemoVerifier=(value:unknown):value is string=>typeof value==='string' && /^baly-demo-pbkdf2-v1\$120000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(value);
export async function createDemoVerifier(password:string) {
  if(password.length<8 || password.length>80) throw new Error('סיסמת הדמה חייבת להכיל 8–80 תווים.');
  const salt=crypto.getRandomValues(new Uint8Array(16));
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt,iterations:120000,hash:'SHA-256'},key,256);
  return `${PREFIX}$120000$${hex(salt)}$${hex(bits)}`;
}
export async function checkDemoVerifier(password:string,verifier:string) {
  if(!validDemoVerifier(verifier) || password.length>80) return false;
  const [, ,salt,expected]=verifier.split('$');
  const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
  const actual=hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:unhex(salt),iterations:120000,hash:'SHA-256'},key,256));
  return actual===expected;
}
export function buildDemoChatAccounts(raw:Draft,verifiers:string[],registrationId:string,existing:User[],now=new Date()) {
  const d=readDraft(JSON.stringify(raw));
  if(!/^[a-f0-9-]{36}$/i.test(registrationId) || d.flow!=='register' || d.fromAccount || d.step!=='done') throw new Error('יש להשלים את הרשמת הדמה לפני שמירת חשבון.');
  const normalized=(s:string)=>s.trim().toLowerCase().replace(/[^\p{L}\p{N}@.+]/gu,'');
  const ids=d.members.map((_,i)=>`demo-chat-${registrationId}-${i}`);
  const saved=existing.filter(u=>ids.includes(u.id));
  if(saved.length===ids.length) {
    const users=ids.map(id=>saved.find(u=>u.id===id)!);
    if(users.some((u,i)=>normalized(u.username || '')!==normalized(d.members[i].username) || normalized(u.email)!==normalized(d.members[i].email) || u.name!==d.members[i].name.trim())) throw new Error('הרשמת הדמה הזו כבר נשמרה עם פרטים אחרים. יש להיכנס לחשבון הקיים או להתחיל הרשמה חדשה.');
    return {users,alreadySaved:true};
  }
  if(saved.length) throw new Error('הרשמת דמה חלקית קיימת. אין ליצור חשבון כפול.');
  const names=new Set<string>();const phones=new Set<string>();
  d.members.forEach((m,i)=>{
    if(!m.firstName.trim() || !m.lastName.trim() || !m.username.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email) || !/^\d{4}-\d{2}-\d{2}$/.test(m.birth) || m.birth>now.toISOString().slice(0,10) || !['female','male'].includes(m.gender) || !m.agreement || !hasSelection(m) || !validDemoVerifier(verifiers[i])) throw new Error('יש להשלים פרטים וסיסמת דמה לכל בן משפחה.');
    if(!i && !/^05\d{8}$/.test(m.phone) || m.phone && !/^05\d{8}$/.test(m.phone)) throw new Error('מספר הטלפון אינו תקין.');
    const login=normalized(m.username),phone=normalized(m.phone),email=normalized(m.email);
    if(names.has(login) || phone && phones.has(phone) || existing.some(u=>[u.username,u.email,u.phone].filter(Boolean).some(v=>[login,email,phone].filter(Boolean).includes(normalized(String(v)))))) throw new Error('שם המשתמש, האימייל או הטלפון כבר שמורים בסביבת ההדגמה.');
    names.add(login);if(phone) phones.add(phone);
  });
  const planMap:Record<string,MembershipType>={open:MembershipType.OPEN_GYM,group:MembershipType.GROUP_MONTHLY,program:MembershipType.WORKOUT_PLAN,personal:MembershipType.PERSONAL_TRAINING,pair:MembershipType.DUO_TRAINING};
  const familyId=d.family ? `demo-family-${registrationId}`:undefined;
  const users=d.members.map((m,i):User=>{
    const plans=[m.plan,...m.extras].map(id=>planMap[id]).filter(Boolean);
    const birthday=new Date(`${m.birth}T12:00:00Z`);
    let age=now.getUTCFullYear()-birthday.getUTCFullYear();
    if(now.toISOString().slice(5,10)<m.birth.slice(5,10)) age--;
    return {id:ids[i],name:`${m.firstName.trim()} ${m.lastName.trim()}`,username:m.username.trim(),email:m.email.trim().toLowerCase(),phone:m.phone,
      role:UserRole.TRAINEE,gender:m.gender==='female' ? Gender.FEMALE:Gender.MALE,age:Math.max(0,age),birthDate:m.birth,priorityScore:100,
      membershipType:plans[0],secondaryMemberships:[...new Set(plans.slice(1))],membershipStatus:MembershipStatus.DEBT,
      registrationIncomplete:false,registrationPaymentPending:true,registrationCompletedAt:now.toISOString(),
      familyId,familyName:familyId ? d.familyName || `משפחת ${m.lastName}`:undefined,isFamilyPayer:familyId ? i===0:undefined,
      familyPayerId:familyId ? ids[0]:undefined,familyMembersCount:familyId ? Math.max(2,d.members.length):undefined,
      // Mock acknowledgements are never recorded as genuine signatures or payment.
      healthDeclarationSigned:false,clubAgreementSigned:false,pushNotificationsEnabled:false,workoutRemindersEnabled:false};
  });
  return {users,alreadySaved:false};
}
