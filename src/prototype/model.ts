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
export type Member = { name: string; birth: string; phone: string; health: string; plan: string; extras: string[] };
export type Draft = { version: 1; flow: 'register' | 'renew' | 'cancel'; family: boolean; members: Member[]; member: number; step: string; discount: string; accepted: boolean };
export const blankMember = (): Member => ({ name: '', birth: '', phone: '', health: '', plan: 'none', extras: [] });
export const initialDraft = (): Draft => ({ version: 1, flow: 'register', family: false, members: [blankMember()], member: 0, step: 'welcome', discount: '', accepted: false });
export const steps = ['welcome', 'kind', 'name', 'birth', 'phone', 'health', 'plans', 'member', 'summary', 'payment', 'done', 'previous', 'cancel'] as const;
export function readDraft(raw: string | null): Draft {
  try {
    const d = JSON.parse(raw || 'null');
    if (!d || d.version !== 1 || !steps.includes(d.step) || !['register','renew','cancel'].includes(d.flow) || typeof d.family !== 'boolean' || !Array.isArray(d.members) || d.members.length < 1 || d.members.length > 6 || !Number.isInteger(d.member) || d.member < 0 || d.member >= d.members.length) return initialDraft();
    for (const m of d.members) {
      if (!['name','birth','phone','health','plan'].every(k => typeof m[k] === 'string' && m[k].length < 150) || !catalog.some(p => p.id === m.plan) || !Array.isArray(m.extras) || m.extras.some((id: unknown) => !extras.some(e => e.id === id)) || new Set(m.extras).size !== m.extras.length) return initialDraft();
    }
    return { ...d, discount: typeof d.discount === 'string' ? d.discount.slice(0,30) : '', accepted: d.accepted === true };
  } catch { return initialDraft(); }
}
export function totals(d: Draft) {
  const monthly = d.members.reduce((n,m) => n + (catalog.find(p => p.id === m.plan)?.price || 0), 0);
  const once = d.members.reduce((n,m) => n + extras.filter(e => m.extras.includes(e.id)).reduce((v,e) => v+e.price,0),0);
  const discount = d.discount.trim().toUpperCase() === 'DEMO10' ? Math.round(once * .1) : 0;
  return { monthly, once, discount, due: monthly + once - discount };
}
export function hasSelection(m: Member) { return m.plan !== 'none' || m.extras.length > 0; }
export function selection(m: Member) { return [catalog.find(p => p.id === m.plan)?.label, ...extras.filter(e => m.extras.includes(e.id)).map(e => e.label)].filter(Boolean).join(' · '); }
