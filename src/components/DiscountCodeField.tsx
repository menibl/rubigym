import React, { useState } from 'react';
import { CheckCircle2, Tag } from 'lucide-react';
import { DiscountCode } from '../types';
import { validateRivhitDiscountCode } from '../data/rivhitPayments';
import { isPagesDemoMode } from '../data/appMode';

interface DiscountCodeFieldProps {
  discountCodes: DiscountCode[];
  value: string;
  onChange: (value: string) => void;
  applied: DiscountCode | null;
  onApplied: (discount: DiscountCode | null) => void;
  onMessage?: (message: string, isError: boolean) => void;
}

export const DiscountCodeField: React.FC<DiscountCodeFieldProps> = ({ discountCodes, value, onChange, applied, onApplied, onMessage }) => {
  const [validating, setValidating] = useState(false);

  const applyCode = async () => {
    const normalized = value.trim().toUpperCase();
    if (!normalized) {
      onApplied(null);
      onMessage?.('יש להזין קוד הנחה.', true);
      return;
    }
    setValidating(true);
    try {
      const match = isPagesDemoMode()
        ? discountCodes.find(code => code.code.toUpperCase() === normalized && (!code.isSingleUse || !code.isUsed)) || null
        : await validateRivhitDiscountCode(normalized);
      onApplied(match);
      onMessage?.(match ? `קוד ${match.code} הופעל בהצלחה.` : 'קוד ההנחה אינו תקין או שכבר נוצל.', !match);
    } catch (error) {
      onApplied(null);
      onMessage?.(error instanceof Error ? error.message : 'קוד ההנחה אינו תקין או שכבר נוצל.', true);
    } finally {
      setValidating(false);
    }
  };

  return <section className="rounded-xl border border-amber-200 bg-amber-50 p-4" dir="rtl">
    <div className="mb-2 flex items-center gap-2 text-xs font-black text-amber-950"><Tag size={15} /> קוד הנחה לפני תשלום</div>
    <div className="flex gap-2">
      <input value={value} onChange={event => { onChange(event.target.value.toUpperCase()); if (applied) onApplied(null); }} placeholder="הזנת קוד הנחה" className="min-w-0 flex-1 rounded-lg border border-amber-200 bg-white px-3 py-2.5 text-sm font-bold uppercase text-slate-900" />
      <button type="button" onClick={() => void applyCode()} disabled={validating} className="rounded-lg bg-slate-950 px-4 py-2 text-xs font-black text-white disabled:opacity-60">{validating ? 'בודק…' : 'הפעל'}</button>
    </div>
    {applied && <p className="mt-2 flex items-center gap-1 text-[11px] font-bold text-emerald-700"><CheckCircle2 size={13} /> הקוד {applied.code} פעיל</p>}
  </section>;
};
