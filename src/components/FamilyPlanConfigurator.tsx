import React from 'react';
import { Users } from 'lucide-react';
import {
  FAMILY_MEMBERSHIP_PRICES,
  FamilyBillingMode,
  FamilyMemberPlanSelection,
  MembershipPlanConfig,
  MembershipType,
  MEMBERSHIP_PRICES,
  MEMBERSHIP_TYPE_LABELS
} from '../types';
import {
  CUSTOM_FAMILY_PLAN_OPTIONS,
  FAMILY_MONTHLY_PRICE_PER_MEMBER,
  familyPurchaseAmount,
  resizeFamilyPlans
} from '../data/familyMembership';

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
}

export const FamilyPlanConfigurator: React.FC<FamilyPlanConfiguratorProps> = ({ mode, onModeChange, count, onCountChange, plans, onPlansChange, payerName, payerId, membershipPlans = [] }) => {
  const normalizedPlans = resizeFamilyPlans(plans, count, payerName, payerId);
  const changeCount = (nextCount: number) => {
    onCountChange(nextCount);
    onPlansChange(resizeFamilyPlans(plans, nextCount, payerName, payerId));
  };
  const updatePlan = (index: number, patch: Partial<FamilyMemberPlanSelection>) => onPlansChange(
    resizeFamilyPlans(plans, count, payerName, payerId).map((plan, planIndex) => planIndex === index ? { ...plan, ...patch } : plan)
  );
  const selectMode = (nextMode: FamilyBillingMode) => {
    onModeChange(nextMode);
    if (nextMode === 'CUSTOM_COMBINED') onPlansChange(normalizedPlans);
  };
  const amount = familyPurchaseAmount(mode, count, normalizedPlans, membershipPlans);
  const priceFor = (membershipType: MembershipType) => membershipPlans.find(plan => plan.id === membershipType && plan.active)?.price ?? MEMBERSHIP_PRICES[membershipType] ?? 0;

  return <section className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4" dir="rtl">
    <div className="flex items-center gap-2"><Users size={18} className="text-indigo-700" /><strong className="text-sm text-slate-950">בחירת מבנה המנוי המשפחתי</strong></div>
    <div className="grid gap-2 sm:grid-cols-3">
      {([
        ['ANNUAL_BY_SIZE', 'משפחתי שנתי', 'מחיר קבוע לפי מספר נפשות, התחייבות לשנה'],
        ['MONTHLY_PER_MEMBER', 'משפחתי חודשי', `₪${FAMILY_MONTHLY_PRICE_PER_MEMBER} לכל מתאמן בחודש`],
        ['CUSTOM_COMBINED', 'משפחתי מותאם', 'מסלול אחר לכל בן משפחה ותשלום מאוחד']
      ] as Array<[FamilyBillingMode, string, string]>).map(([value, title, description]) => <button key={value} type="button" onClick={() => selectMode(value)} className={`rounded-xl border p-3 text-right ${mode === value ? 'border-indigo-600 bg-indigo-700 text-white' : 'border-indigo-200 bg-white text-slate-800'}`}><strong className="block text-xs">{title}</strong><span className={`mt-1 block text-[10px] ${mode === value ? 'text-indigo-100' : 'text-slate-500'}`}>{description}</span></button>)}
    </div>

    <label className="block text-xs font-bold text-slate-700">מספר בני משפחה
      <select value={count} onChange={event => changeCount(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5">
        {[2, 3, 4, 5, 6].map(memberCount => <option key={memberCount} value={memberCount}>{memberCount} מתאמנים</option>)}
      </select>
    </label>

    {mode === 'ANNUAL_BY_SIZE' && <p className="rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">מחיר החבילה: <b>₪{FAMILY_MEMBERSHIP_PRICES[count]?.toLocaleString('he-IL')}</b> לחודש, בהתחייבות ל־12 חודשים.</p>}
    {mode === 'MONTHLY_PER_MEMBER' && <p className="rounded-xl bg-white p-3 text-xs leading-5 text-slate-700">₪{FAMILY_MONTHLY_PRICE_PER_MEMBER} × {count} מתאמנים = <b>₪{amount.toLocaleString('he-IL')} לחודש</b>, ללא התחייבות שנתית.</p>}

    {mode === 'CUSTOM_COMBINED' && <div className="space-y-3">
      {normalizedPlans.map((plan, index) => {
        const isTrainingCard = plan.membershipType === MembershipType.PERSONAL_TRAINING || plan.membershipType === MembershipType.DUO_TRAINING;
        return <article key={`${plan.memberId || index}-${index}`} className="grid gap-2 rounded-xl border border-indigo-100 bg-white p-3 sm:grid-cols-[1fr_1.4fr_.7fr]">
          <label className="text-[11px] font-bold text-slate-600">{index === 0 ? 'המשלם הראשי' : `בן/בת משפחה ${index + 1}`}<input value={plan.memberName} onChange={event => updatePlan(index, { memberName: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></label>
          <label className="text-[11px] font-bold text-slate-600">מסלול<select value={plan.membershipType} onChange={event => {
            const membershipType = event.target.value as MembershipType;
            const usesCard = membershipType === MembershipType.PERSONAL_TRAINING || membershipType === MembershipType.DUO_TRAINING;
            updatePlan(index, { membershipType, trainingSessionsCount: usesCard ? 10 : undefined });
          }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            {CUSTOM_FAMILY_PLAN_OPTIONS.map(type => <option key={type} value={type}>{MEMBERSHIP_TYPE_LABELS[type].label} — ₪{priceFor(type)}{type === MembershipType.PERSONAL_TRAINING || type === MembershipType.DUO_TRAINING ? ' לאימון' : ' לחודש'}</option>)}
          </select></label>
          {isTrainingCard ? <label className="text-[11px] font-bold text-slate-600">מספר אימונים<input type="number" min={1} max={50} value={plan.trainingSessionsCount || 10} onChange={event => updatePlan(index, { trainingSessionsCount: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></label> : <div className="self-end rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-black text-slate-800">₪{priceFor(plan.membershipType)}</div>}
        </article>;
      })}
      <p className="rounded-xl bg-indigo-900 p-3 text-xs text-white">סך הכול לחיוב מאוחד לבעל המשפחה: <b className="text-base">₪{amount.toLocaleString('he-IL')}</b></p>
    </div>}
  </section>;
};
