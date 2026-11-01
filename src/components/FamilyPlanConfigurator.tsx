import React, { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import {
  FamilyBillingMode,
  FamilyMemberPlanSelection,
  MembershipPlanConfig,
  MembershipType,
  User,
} from '../types';
import {
  familyPlanCatalog,
  familyMemberPlanPrice,
  familyPurchaseAmount,
  resizeFamilyPlans
} from '../data/familyMembership';
import { billingPeriodLabel } from '../data/membershipBilling';
import { isMembershipFreezeActive } from '../data/membershipPolicy';
import { canPurchasePlan } from '../../shared/youth-plan.js';
import { familyRecurringSelections } from '../../shared/recurring-billing.js';

interface FamilyPlanConfiguratorProps {
  mode: FamilyBillingMode;
  onModeChange: (mode: FamilyBillingMode) => void;
  count: number;
  onCountChange: (count: number) => void;
  plans: FamilyMemberPlanSelection[];
  onPlansChange: (plans: FamilyMemberPlanSelection[]) => void;
  payerName: string;
  payerId?: string;
  membershipPlans?: MembershipPlanConfig[];
  familyMembers?: Array<Pick<User, 'id' | 'name' | 'isMembershipFrozen' | 'membershipFrozenUntil' | 'membershipFreezeRequestedAt'> & Partial<Pick<User, 'age' | 'birthDate'>>>;
  registrationMemberBirthDates?: string[];
  onRequestFreeze?: (memberId: string) => void;
  registrationMemberNames?: string[];
  onEditingChange?: (editing: boolean) => void;
}

export const FamilyPlanConfigurator: React.FC<FamilyPlanConfiguratorProps> = ({ count, onCountChange, plans, onPlansChange, payerName, payerId, membershipPlans = [], familyMembers = [], registrationMemberNames, registrationMemberBirthDates, onRequestFreeze, onEditingChange }) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [validation, setValidation] = useState('');
  useEffect(() => { onEditingChange?.(editingIndex !== null); }, [editingIndex, onEditingChange]);
  const normalizedPlans = resizeFamilyPlans(plans, count, payerName, payerId);
  const catalog = familyPlanCatalog(membershipPlans);
  const changeCount = (nextCount: number) => {
    setEditingIndex(null); setValidation('');
    onCountChange(nextCount);
    onPlansChange(resizeFamilyPlans(plans, nextCount, payerName, payerId));
  };
  const updatePlan = (index: number, patch: Partial<FamilyMemberPlanSelection>) => onPlansChange(
    resizeFamilyPlans(plans, count, payerName, payerId).map((plan, planIndex) => planIndex === index ? { ...plan, ...patch } : plan)
  );
  const amount = familyPurchaseAmount('CUSTOM_COMBINED', count, normalizedPlans, membershipPlans);
  const recurringSelections = familyRecurringSelections(normalizedPlans, catalog);

  return <section className="space-y-4 rounded-2xl border border-slate-600 bg-slate-950 p-4 text-slate-100" dir="rtl">
    <div className="flex items-center gap-2"><Users size={18} className="text-amber-200" /><strong className="text-sm text-amber-100">בחירת מבנה המנוי המשפחתי</strong></div>
    <p className="rounded-xl bg-indigo-900 p-3 text-sm text-white"><strong>משפחתי מותאם</strong> — מסלול ראשי ותוספות לכל בן משפחה. {recurringSelections.length ? 'מסלולים מתחדשים וחד־פעמיים משולמים בנפרד.' : 'תשלום חד־פעמי מאוחד.'}</p>

    <label className="block text-xs font-bold text-slate-700">מספר בני משפחה
      <select value={count} onChange={event => changeCount(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5">
        {[2, 3, 4, 5, 6].map(memberCount => <option key={memberCount} value={memberCount}>{memberCount} מתאמנים</option>)}
      </select>
    </label>

    {!registrationMemberNames && familyMembers.length < count && <p role="alert" className="text-sm text-slate-800">אין מספיק בני משפחה משויכים. יש להוסיף בן משפחה דרך ניהול המשפחה לפני בחירת מסלול עבורו.</p>}
    <p className="text-sm font-bold text-slate-900">בחרו בן משפחה, בחרו מסלול ותוספות, ואשרו לפני המעבר לבא. ברירת המחדל היא ללא מסלול וללא חיוב ברכישה זו — מנויים שכבר שולמו אינם משתנים.</p>
    {validation && <p role="alert" className="rounded-lg bg-slate-950 p-3 font-bold text-amber-100">{validation}</p>}
    <div className="space-y-3">
      {normalizedPlans.map((plan, index) => {
        const member = familyMembers.find(item => item.id === plan.memberId);
        const person = registrationMemberBirthDates ? { birthDate: registrationMemberBirthDates[index] } : member;
        const memberCatalog = catalog.filter(config => canPurchasePlan(config, person));
        const frozen = member && isMembershipFreezeActive(member as User);
        const included = !plan.participation || plan.participation === 'INCLUDED';
        const isTrainingCard = plan.membershipType === MembershipType.PERSONAL_TRAINING || plan.membershipType === MembershipType.DUO_TRAINING;
        const summary = included ? [plan, ...(plan.additionalPlans || [])].map(selection => {
          const config = catalog.find(config => config.id === selection.membershipType);
          if (!config) return selection.membershipType ? 'מסלול לא זמין' : 'יש לבחור מסלול';
          const price = familyMemberPlanPrice({ ...plan, ...selection, trainingSessionsCount: selection.trainingSessionsCount, additionalPlans: [], participation: 'INCLUDED' }, membershipPlans);
          return `${config.label} — ₪${price.toLocaleString('he-IL')} · ${billingPeriodLabel(config)}`;
        }).join(' + ')
          : plan.participation === 'SKIP' ? 'לא לחדש כעת / כבר שולם — ללא חיוב נוסף' : plan.participation === 'FROZEN' ? 'מוקפא — ללא חיוב' : 'ללא מסלול — טרם מתחיל, ללא חיוב';
        return <article key={`${plan.memberId || index}-${index}`} className="rounded-xl border border-slate-600 bg-white p-3 text-slate-100">
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0"><h3 className="font-black">{registrationMemberNames?.[index] || member?.name || plan.memberName}</h3><p className="mt-1 text-sm">{summary}</p><p className="font-bold">סך הכול עבור {plan.memberName}: ₪{familyMemberPlanPrice(plan, membershipPlans).toLocaleString('he-IL')}</p></div>
            <button type="button" aria-expanded={editingIndex === index} aria-controls={`family-plan-editor-${index}`} className="min-h-11 rounded-lg bg-slate-950 px-4 py-3 font-bold text-amber-100" onClick={() => {
              if (editingIndex !== null && editingIndex !== index) { setValidation('יש לאשר את בחירת בן המשפחה הפתוח לפני המעבר לבא.'); return; }
              setValidation(''); setEditingIndex(index);
              if (!included && !frozen) updatePlan(index, { participation: 'INCLUDED', membershipType: '' as MembershipType, additionalPlans: [], trainingSessionsCount: undefined });
            }}>{included ? 'עריכת בחירת מסלול' : 'בחירת מסלול'}</button>
          </header>
          <div id={`family-plan-editor-${index}`} hidden={editingIndex !== index} style={editingIndex !== index ? { display: 'none' } : undefined} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1.4fr_.7fr]">
          <label className="text-[11px] font-bold text-slate-600">{index === 0 ? 'המשלם הראשי' : `בן/בת משפחה ${index + 1}`}
            {registrationMemberNames ? <input readOnly value={registrationMemberNames[index] || ''} placeholder="יש להשלים את פרטי בן המשפחה בטופס" className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" />
              : <select value={index === 0 ? payerId || '' : familyMembers.some(member => member.id === plan.memberId) ? plan.memberId : ''} disabled={index === 0} onChange={event => {
                const member = familyMembers.find(candidate => candidate.id === event.target.value);
                updatePlan(index, { memberId: member?.id, memberName: member?.name || '' });
              }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
                <option value="">בחרו בן משפחה משויך</option>
                {familyMembers.map(member => <option key={member.id} value={member.id} disabled={index !== 0 && (member.id === payerId || normalizedPlans.some((other, otherIndex) => otherIndex !== index && other.memberId === member.id))}>{member.name}</option>)}
              </select>}
          </label>
          {<div className="sm:col-span-3">
            <label className="block text-sm font-bold">השתתפות ברכישה — {plan.memberName}
              <select className="mt-1 w-full rounded-lg border p-3" value={plan.participation || 'INCLUDED'} onChange={event => updatePlan(index, { participation: event.target.value as FamilyMemberPlanSelection['participation'] })}>
                <option value="INCLUDED" disabled={Boolean(frozen)}>כלול בתשלום — בחירת מסלול</option>
                <option value="NOT_STARTED">טרם מתחיל להתאמן — ללא חיוב ברכישה זו</option>
                <option value="SKIP">לא לחדש כעת / כבר שולם — ללא חיוב ברכישה זו</option>
                {frozen && <option value="FROZEN">מנוי מוקפא — ללא חיוב ברכישה זו</option>}
              </select>
            </label>
            {frozen && <p className="mt-2 text-sm">המנוי מוקפא עד {member?.membershipFrozenUntil}. יש לבחור ללא חיוב.</p>}
            {!included && <p className="mt-2 text-sm">לא יחויב ולא יופעל מסלול חדש. זכויות ששולמו והתחייבויות קיימות נשארות ללא שינוי; ללא מנוי תקף לא ניתן להירשם לאימון.</p>}
            {onRequestFreeze && member && !frozen && <button type="button" disabled={Boolean(member.membershipFreezeRequestedAt)} className="mt-2 rounded-lg border px-3 py-2 text-sm" onClick={() => onRequestFreeze(member.id)}>{member.membershipFreezeRequestedAt ? 'בקשת הקפאה ממתינה לאישור מנהל' : 'בקשת הקפאה לחודש מהמנהל'}</button>}
          </div>}
          {included && <label className="text-sm font-bold text-slate-900">מסלול<select value={plan.membershipType} onChange={event => {
            const membershipType = event.target.value as MembershipType;
            const usesCard = membershipType === MembershipType.PERSONAL_TRAINING || membershipType === MembershipType.DUO_TRAINING;
            updatePlan(index, { membershipType, trainingSessionsCount: usesCard ? 10 : undefined,
              additionalPlans: (plan.additionalPlans || []).filter(item => item.membershipType !== membershipType) });
          }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            {!plan.membershipType && <option value="">בחרו מסלול לתשלום</option>}
            {plan.membershipType && !memberCatalog.some(config => config.id === plan.membershipType) && <option value={plan.membershipType} disabled>המסלול אינו זמין או אינו מתאים לגיל — יש לבחור מסלול אחר</option>}
            {memberCatalog.map(config => <option key={config.id} value={config.id}>{config.label} — ₪{config.price} · {billingPeriodLabel(config)}</option>)}
          </select></label>}
          {included && isTrainingCard && <label className="text-[11px] font-bold text-slate-600">מספר אימונים<input type="number" min={1} max={50} value={plan.trainingSessionsCount || 1} onChange={event => updatePlan(index, { trainingSessionsCount: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></label>}
          {included && <fieldset className="sm:col-span-3 rounded-xl bg-slate-950 p-3 text-slate-100">
            <legend className="rounded-lg bg-slate-950 px-2 text-sm font-bold">מסלולים נוספים — {plan.memberName}</legend>
            <p className="mb-2 text-xs text-slate-300">אפשר לסמן כמה תוספות, כגון תוכנית אימון ותוכנית תזונה.</p>
            {(plan.additionalPlans || []).filter(item => !memberCatalog.some(config => config.id === item.membershipType && config.category === 'ADD_ON')).map(item => <div key={item.membershipType} role="alert" className="mb-2 rounded-lg border border-amber-400 p-2 text-sm">
              המסלול {membershipPlans.find(config => config.id === item.membershipType)?.label || item.membershipType} אינו זמין לרכישה או אינו מתאים לגיל.
              <button type="button" className="mr-2 min-h-11 underline" onClick={() => updatePlan(index, { additionalPlans: (plan.additionalPlans || []).filter(other => other.membershipType !== item.membershipType) })}>הסר תוספת</button>
            </div>)}
            <div className="space-y-2">{memberCatalog.filter(config => config.category === 'ADD_ON' && config.id !== plan.membershipType).map(config => {
              const selected = plan.additionalPlans?.find(item => item.membershipType === config.id);
              const training = [MembershipType.PERSONAL_TRAINING, MembershipType.DUO_TRAINING].includes(config.id as MembershipType);
              return <div key={config.id} className="rounded-lg border border-slate-700 p-2">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
                  <input type="checkbox" className="h-5 w-5 shrink-0" checked={Boolean(selected)} onChange={event => updatePlan(index, { additionalPlans: event.target.checked
                    ? [...(plan.additionalPlans || []), { membershipType: config.id as MembershipType, trainingSessionsCount: training ? 1 : undefined }]
                    : (plan.additionalPlans || []).filter(item => item.membershipType !== config.id) })} />
                  <span>{config.label} — ₪{config.price} · {billingPeriodLabel(config)}</span>
                </label>
                {selected && training && <label className="block text-xs">מספר אימונים — {config.label}<input type="number" min={1} max={50} value={selected.trainingSessionsCount || 1} onChange={event => updatePlan(index, { additionalPlans: (plan.additionalPlans || []).map(item => item.membershipType === config.id
                  ? { ...item, trainingSessionsCount: Math.max(1, Math.min(50, Math.round(Number(event.target.value) || 1))) } : item) })} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-white" /></label>}
              </div>;
            })}</div>
          </fieldset>}
          <div className="sm:col-span-3 rounded-lg bg-slate-100 px-3 py-2 text-center text-sm font-black text-slate-800">סך הכול עבור {plan.memberName}: ₪{familyMemberPlanPrice(plan, membershipPlans).toLocaleString('he-IL')}</div>
          <button type="button" className="min-h-12 rounded-lg bg-indigo-900 p-3 font-bold text-white sm:col-span-3" onClick={() => {
            if (included && (frozen || !memberCatalog.some(config => config.id === plan.membershipType)
              || (plan.additionalPlans || []).some(selection => !memberCatalog.some(config => config.id === selection.membershipType && config.category === 'ADD_ON')))) {
              setValidation('יש לבחור מסלול פעיל ותוספות המתאימים לגיל. מסלולי נוער מיועדים עד גיל 18 כולל ונדרש גיל מעודכן. אפשר גם לבחור ללא חיוב.'); return;
            }
            if (!registrationMemberNames && (!plan.memberId || normalizedPlans.some((other, otherIndex) => otherIndex !== index && other.memberId === plan.memberId))) {
              setValidation('יש לבחור בן משפחה משויך ושונה לכל שורה.'); return;
            }
            setValidation('');
            setEditingIndex(null);
          }}>אישור הבחירה — {plan.memberName}</button>
          </div>
        </article>;
      })}
      <p className="rounded-xl bg-indigo-900 p-3 text-xs text-white">{recurringSelections.length ? 'סכום המסלולים לתצוגה בלבד — אינו חיוב מאוחד:' : 'סך הכול לחיוב מאוחד לבעל המשפחה:'} <b className="text-base">₪{amount.toLocaleString('he-IL')}</b></p>
      {recurringSelections.length > 0 ? <div role="alert" className="rounded-xl border-2 border-amber-500 bg-slate-950 p-4 text-base font-bold text-amber-100">
        <p>החבילה כוללת הוראת קבע — לא תשלום חד־פעמי.</p>
        <ul className="mt-2 list-inside list-disc">{recurringSelections.map((selection, index) => <li key={index}>{selection.memberName}: {selection.plan.label} — ₪{selection.plan.price} בכל חודש, 12 חיובים.</li>)}</ul>
          <p className="mt-2">בבחירה בחיוב מאוחד, הוראות קבע חדשות לאותה תקופה ותנאי חיוב ישולמו יחד, ואחריהן התוספות החד־פעמיות בתשלום אחד נפרד. לפני כל מעבר יוצג סכום לאחר ההנחה. ההנחה של הוראת הקבע נשמרת לכל 12 החיובים. מסלול שכבר שולם או שיש לו הוראת קבע קיימת לא יחויב שוב; בסיום כל שלב ניתן להמשיך למסלול הבא. שינוי הבחירה אינו מבטל הוראת קבע קיימת.</p>
      </div> : <p className="text-xs text-slate-700">הסכום מחושב לפי מחירי מסלולי המועדון, ללא הנחה משפחתית אוטומטית. לפני התשלום יוצגו הקיזוז והיתרה המחושבים בשרת. התשלום חד־פעמי למסלולים הכלולים בלבד, ללא יצירה או ביטול של הוראת קבע.</p>}
      {normalizedPlans.some(plan => plan.participation && plan.participation !== 'INCLUDED') && <p className="text-sm">ברכישה חלקית נגבה רק מחיר המסלולים שנבחרו. לא מקוזז שוב תשלום של מי שלא נכלל ברכישה. אם כבר שילמתם עבור עצמכם, בחרו עבורכם ״כבר שולם״ וכללו רק את בן המשפחה החדש.</p>}
    </div>
  </section>;
};
