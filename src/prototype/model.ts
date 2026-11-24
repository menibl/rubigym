// Fictional catalog. Never imported by production billing or membership code.
export const STORAGE_KEY = 'baly-conversation-fictional-v1';
export const catalog = [
  { id: 'none', label: 'ללא מסלול ראשי', price: 0, recurring: false },
  { id: 'open', label: 'Open Gym', price: 280, recurring: true },
  { id: 'group', label: 'קבוצתי כולל Open Gym', price: 500, recurring: true },
] as const;
export const extras = [
  { id: 'program', label: 'תוכנית אימון אישית', price: 300 },
  { id: 'personal', label: '4 אימונים אישיים', price: 800 },
  { id: 'pair', label: '4 אימונים זוגיים', price: 600 },
] as const;
export type Member = { name: string; firstName: string; lastName: string; email: string; username: string; birth: string; phone: string; gender: string; health: string; plan: string; extras: string[]; credentialsReady: boolean; agreement: boolean; push: boolean; reminders: boolean };
export type Flow = 'register' | 'renew' | 'cancel' | 'add' | 'update' | 'extras' | 'freeze' | 'profile';
export type Draft = { version: 1; flow: Flow; family: boolean; familyName: string; billing: 'combined' | 'separate'; members: Member[]; member: number; step: string; discount: string; accepted: boolean; fromAccount: boolean; purchaseExtras: string[] };
export const blankMember = (): Member => ({ name: '', firstName:'', lastName:'', email:'', username:'', birth: '', phone: '', gender:'', health: '', plan: 'none', extras: [], credentialsReady:false,agreement:false,push:false,reminders:false });
export const initialDraft = (): Draft => ({ version: 1, flow: 'register', family: false, familyName:'', billing:'combined', members: [blankMember()], member: 0, step: 'welcome', discount: '', accepted: false, fromAccount:false,purchaseExtras:[] });
export const steps = ['welcome', 'kind', 'name', 'birth', 'gender', 'phone', 'otp', 'credentials', 'health', 'consent', 'plans', 'member', 'summary', 'payment', 'done', 'previous', 'cancel', 'account', 'freeze'] as const;
export const profileSteps = ['name','birth','gender','phone','otp','credentials','health','consent'];
export function checkoutMembers(d: Draft) {
  return d.flow==='register' || (d.flow==='renew' && !d.fromAccount) ? d.members : [d.members[d.member]];
}
export function demoAccount(): Draft {
  const members = ['דנה','נועם'].map((firstName,i) => ({...blankMember(),firstName,lastName:'לדוגמה',name:`${firstName} לדוגמה`,username:`demo${i+1}`,email:`demo${i+1}@example.com`,birth:i ? '2012-05-15':'1990-05-15',phone:'0500000000',gender:i ? 'male':'female',health:'demo',plan:'open',extras:['program'],credentialsReady:true,agreement:true}));
  return {...initialDraft(),family:true,familyName:'משפחת לדוגמה',members,step:'account',fromAccount:true};
}
export function readDraft(raw: string | null): Draft {
  try {
    const d = JSON.parse(raw || 'null');
    if (!d || d.version !== 1 || !steps.includes(d.step) || !['register','renew','cancel','add','update','extras','freeze','profile'].includes(d.flow) || typeof d.family !== 'boolean' || !Array.isArray(d.members) || d.members.length < 1 || d.members.length > 6 || !Number.isInteger(d.member) || d.member < 0 || d.member >= d.members.length) return initialDraft();
    for (const m of d.members) {
      if (!['name','birth','phone','health','plan'].every(k => typeof m[k] === 'string' && m[k].length < 150) || !catalog.some(p => p.id === m.plan) || !Array.isArray(m.extras) || m.extras.some((id: unknown) => !extras.some(e => e.id === id)) || new Set(m.extras).size !== m.extras.length) return initialDraft();
    }
    // Whitelist each field: never persist passwords, medical answers, IDs, files or unknown keys.
    return { ...initialDraft(), flow:d.flow,step:d.step,family:d.family,member:d.member,
      familyName: typeof d.familyName === 'string' ? d.familyName.slice(0,80) : '',billing:d.billing === 'separate' ? 'separate':'combined',fromAccount:d.fromAccount === true,
      purchaseExtras:Array.isArray(d.purchaseExtras) ? [...new Set<string>(d.purchaseExtras.filter((id: string)=>extras.some(e=>e.id===id)))]:[],
      members:d.members.map((m: Member) => ({ ...blankMember(),name:m.name,birth:m.birth,phone:m.phone,health:m.health,plan:m.plan,extras:m.extras,
        ...Object.fromEntries(['firstName','lastName','email','username','gender'].map(k => [k,typeof m[k as keyof Member] === 'string' ? String(m[k as keyof Member]).slice(0,120):''])),
        credentialsReady:m.credentialsReady === true,agreement:m.agreement === true,push:m.push === true,reminders:m.reminders === true })),
      discount: typeof d.discount === 'string' ? d.discount.slice(0,30) : '', accepted: d.accepted === true };
  } catch { return initialDraft(); }
}
export function totals(d: Draft) {
  const members = checkoutMembers(d);
  const monthly = d.flow === 'extras' ? 0 : members.reduce((n,m) => n + (catalog.find(p => p.id === m.plan)?.price || 0), 0);
  const once = members.reduce((n,m) => n + extras.filter(e => (d.flow==='extras' ? d.purchaseExtras:m.extras).includes(e.id)).reduce((v,e) => v+e.price,0),0);
  const discount = d.discount.trim().toUpperCase() === 'DEMO10' ? Math.round(once * .1) : 0;
  return { monthly, once, discount, due: monthly + once - discount };
}
export function hasSelection(m: Member) { return m.plan !== 'none' || m.extras.length > 0; }
export function selection(m: Member) { return [catalog.find(p => p.id === m.plan)?.label, ...extras.filter(e => m.extras.includes(e.id)).map(e => e.label)].filter(Boolean).join(' · '); }
