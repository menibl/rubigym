import React from 'react';
import { Users } from 'lucide-react';
import {
  FamilyBillingMode,
  FamilyMemberPlanSelection,
  MembershipPlanConfig,
  MembershipType,
} from '../types';
import {
  familyPlanCatalog,
  familyPurchaseAmount,
  resizeFamilyPlans
} from '../data/familyMembership';
import { billingPeriodLabel } from '../data/membershipBilling';

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
  familyMembers?: Array<{ id: string; name: string }>;
  registrationMemberNames?: string[];
}

export const FamilyPlanConfigurator: React.FC<FamilyPlanConfiguratorProps> = ({ count, onCountChange, plans, onPlansChange, payerName, payerId, membershipPlans = [], familyMembers = [], registrationMemberNames }) => {
  const normalizedPlans = resizeFamilyPlans(plans, count, payerName, payerId);
  const catalog = familyPlanCatalog(membershipPlans);
  const changeCount = (nextCount: number) => {
    onCountChange(nextCount);
    onPlansChange(resizeFamilyPlans(plans, nextCount, payerName, payerId));
  };
  const updatePlan = (index: number, patch: Partial<FamilyMemberPlanSelection>) => onPlansChange(
    resizeFamilyPlans(plans, count, payerName, payerId).map((plan, planIndex) => planIndex === index ? { ...plan, ...patch } : plan)
  );
  const amount = familyPurchaseAmount('CUSTOM_COMBINED', count, normalizedPlans, membershipPlans);
  const priceFor = (membershipType: MembershipType) => catalog.find(plan => plan.id === membershipType)?.price ?? 0;

  return <section className="space-y-4 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4" dir="rtl">
    <div className="flex items-center gap-2"><Users size={18} className="text-indigo-700" /><strong className="text-sm text-slate-950">בחירת מבנה המנוי המשפחתי</strong></div>
    <p className="rounded-xl bg-indigo-900 p-3 text-sm text-white"><strong>משפחתי מותאם</strong> — מסלול נפרד לכל בן משפחה ותשלום מאוחד.</p>

    <label className="block text-xs font-bold text-slate-700">מספר בני משפחה
      <select value={count} onChange={event => changeCount(Number(event.target.value))} className="mt-1 w-full rounded-xl border border-indigo-200 bg-white px-3 py-2.5">
        {[2, 3, 4, 5, 6].map(memberCount => <option key={memberCount} value={memberCount}>{memberCount} מתאמנים</option>)}
      </select>
    </label>

    {!registrationMemberNames && familyMembers.length < count && <p role="alert" className="text-sm text-slate-800">אין מספיק בני משפחה משויכים. יש להוסיף בן משפחה דרך ניהול המשפחה לפני בחירת מסלול עבורו.</p>}
    <div className="space-y-3">
      {normalizedPlans.map((plan, index) => {
        const isTrainingCard = plan.membershipType === MembershipType.PERSONAL_TRAINING || plan.membershipType === MembershipType.DUO_TRAINING;
        return <article key={`${plan.memberId || index}-${index}`} className="grid gap-2 rounded-xl border border-indigo-100 bg-white p-3 sm:grid-cols-[1fr_1.4fr_.7fr]">
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
          <label className="text-[11px] font-bold text-slate-600">מסלול<select value={plan.membershipType} onChange={event => {
            const membershipType = event.target.value as MembershipType;
            const usesCard = membershipType === MembershipType.PERSONAL_TRAINING || membershipType === MembershipType.DUO_TRAINING;
            updatePlan(index, { membershipType, trainingSessionsCount: usesCard ? 10 : undefined });
          }} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs">
            {!catalog.some(config => config.id === plan.membershipType) && <option value={plan.membershipType} disabled>המסלול אינו זמין — יש לבחור מסלול פעיל</option>}
            {catalog.map(config => <option key={config.id} value={config.id}>{config.label} — ₪{config.price} · {billingPeriodLabel(config)}</option>)}
          </select></label>
          {isTrainingCard ? <label className="text-[11px] font-bold text-slate-600">מספר אימונים<input type="number" min={1} max={50} value={plan.trainingSessionsCount || 10} onChange={event => updatePlan(index, { trainingSessionsCount: Math.max(1, Math.min(50, Number(event.target.value) || 1)) })} className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs" /></label> : <div className="self-end rounded-lg bg-slate-100 px-3 py-2 text-center text-xs font-black text-slate-800">₪{priceFor(plan.membershipType)}</div>}
        </article>;
      })}
      <p className="rounded-xl bg-indigo-900 p-3 text-xs text-white">סך הכול לחיוב מאוחד לבעל המשפחה: <b className="text-base">₪{amount.toLocaleString('he-IL')}</b></p>
      <p className="text-xs text-slate-700">הסכום מחושב לפי מחירי מסלולי המועדון, ללא הנחה משפחתית אוטומטית. לפני התשלום יוצגו הקיזוז והיתרה המחושבים בשרת. התשלום חד־פעמי, ללא הוראת קבע.</p>
    </div>
  </section>;
};
