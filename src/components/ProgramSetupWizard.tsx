import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardList, Edit3 } from 'lucide-react';

export type WizardValue = string | number | boolean;
export type WizardAnswers = Record<string, WizardValue>;

export interface WizardOption {
  value: string | number | boolean;
  label: string;
  description?: string;
}

export interface WizardQuestion {
  id: string;
  label: string;
  description?: string;
  type: 'choice' | 'select' | 'text' | 'textarea' | 'number';
  options?: WizardOption[];
  placeholder?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  visibleWhen?: (answers: WizardAnswers) => boolean;
}

interface ProgramSetupWizardProps {
  title: string;
  description: string;
  questions: WizardQuestion[];
  initialAnswers?: WizardAnswers;
  finishLabel?: string;
  onComplete: (answers: WizardAnswers) => void;
  onCancel?: () => void;
}

const hasValue = (value: WizardValue | undefined) => value !== undefined && value !== '';

export const ProgramSetupWizard: React.FC<ProgramSetupWizardProps> = ({
  title,
  description,
  questions,
  initialAnswers = {},
  finishLabel = 'מעבר לבניית התוכנית',
  onComplete,
  onCancel
}) => {
  const [answers, setAnswers] = useState<WizardAnswers>(initialAnswers);
  const [page, setPage] = useState(0);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobile(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const visibleQuestions = useMemo(
    () => questions.filter(question => !question.visibleWhen || question.visibleWhen(answers)),
    [questions, answers]
  );
  const pageSize = isMobile ? 2 : 4;
  const pageCount = Math.max(1, Math.ceil(visibleQuestions.length / pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const pageQuestions = visibleQuestions.slice(safePage * pageSize, safePage * pageSize + pageSize);
  const currentValid = pageQuestions.every(question => !question.required || hasValue(answers[question.id]));
  const progress = Math.round(((safePage + 1) / pageCount) * 100);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const setAnswer = (id: string, value: WizardValue) => setAnswers(current => ({ ...current, [id]: value }));

  return <section className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-amber-400/25 bg-zinc-950 text-white shadow-xl" dir="rtl">
    <header className="border-b border-zinc-800 bg-gradient-to-l from-zinc-900 to-zinc-950 p-5 sm:p-7">
      <div className="flex items-start gap-3">
        <span className="rounded-2xl bg-amber-400/15 p-3 text-amber-300"><ClipboardList size={24} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">שלב {safePage + 1} מתוך {pageCount}</p>
          <h2 className="mt-1 text-xl font-black sm:text-2xl">{title}</h2>
          <p className="mt-2 max-w-2xl text-xs leading-6 text-zinc-400 sm:text-sm">{description}</p>
        </div>
      </div>
      <div className="mt-5 h-2 overflow-hidden rounded-full bg-zinc-800"><div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${progress}%` }} /></div>
    </header>

    <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-7">
      {pageQuestions.map(question => <article key={question.id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
        <label className="block text-sm font-black text-white">{question.label}{question.required && <span className="mr-1 text-amber-300">*</span>}</label>
        {question.description && <p className="mt-1 text-[11px] leading-5 text-zinc-400">{question.description}</p>}

        {question.type === 'choice' && <div className="mt-4 grid grid-cols-2 gap-2">
          {(question.options || []).map(option => {
            const selected = answers[question.id] === option.value;
            return <button key={String(option.value)} type="button" onClick={() => setAnswer(question.id, option.value)} className={`min-h-16 rounded-xl border p-3 text-right transition ${selected ? 'border-amber-400 bg-amber-400 text-zinc-950' : 'border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-amber-400/60'}`}>
              <strong className="flex items-center justify-between text-xs">{option.label}{selected && <Check size={15} />}</strong>
              {option.description && <small className={`mt-1 block text-[9px] leading-4 ${selected ? 'text-zinc-800' : 'text-zinc-500'}`}>{option.description}</small>}
            </button>;
          })}
        </div>}

        {question.type === 'select' && <select value={String(answers[question.id] ?? '')} onChange={event => setAnswer(question.id, event.target.value)} className="mt-4 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm font-bold text-white">
          <option value="">בחירה...</option>
          {(question.options || []).map(option => <option key={String(option.value)} value={String(option.value)}>{option.label}</option>)}
        </select>}

        {(question.type === 'text' || question.type === 'number') && <input type={question.type} value={String(answers[question.id] ?? '')} min={question.min} max={question.max} step={question.step} placeholder={question.placeholder} onChange={event => setAnswer(question.id, question.type === 'number' ? Number(event.target.value) : event.target.value)} className="mt-4 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white placeholder:text-zinc-600" />}

        {question.type === 'textarea' && <textarea value={String(answers[question.id] ?? '')} rows={4} placeholder={question.placeholder} onChange={event => setAnswer(question.id, event.target.value)} className="mt-4 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-white placeholder:text-zinc-600" />}
      </article>)}
    </div>

    <footer className="flex items-center justify-between gap-3 border-t border-zinc-800 p-4 sm:px-7 sm:py-5">
      <div className="flex gap-2">
        {safePage > 0 && <button type="button" onClick={() => setPage(current => current - 1)} className="flex min-h-11 items-center gap-1 rounded-xl border border-zinc-700 px-4 text-xs font-black text-zinc-200"><ArrowRight size={15} /> הקודם</button>}
        {onCancel && safePage === 0 && <button type="button" onClick={onCancel} className="min-h-11 rounded-xl border border-zinc-700 px-4 text-xs font-black text-zinc-400">ביטול</button>}
      </div>
      {safePage < pageCount - 1
        ? <button type="button" disabled={!currentValid} onClick={() => setPage(current => current + 1)} className="flex min-h-11 items-center gap-1 rounded-xl bg-amber-400 px-5 text-xs font-black text-zinc-950 disabled:opacity-40">הבא <ArrowLeft size={15} /></button>
        : <button type="button" disabled={!currentValid} onClick={() => onComplete(answers)} className="flex min-h-11 items-center gap-2 rounded-xl bg-amber-400 px-5 text-xs font-black text-zinc-950 disabled:opacity-40"><Check size={16} /> {finishLabel}</button>}
    </footer>
  </section>;
};

interface ProgramBriefPanelProps {
  title?: string;
  items: Array<{ label: string; value?: WizardValue }>;
  onEdit: () => void;
}

export const ProgramBriefPanel: React.FC<ProgramBriefPanelProps> = ({ title = 'הגדרות התוכנית', items, onEdit }) => <section className="rounded-2xl border border-amber-400/25 bg-zinc-900 p-4 text-white" dir="rtl">
  <div className="flex items-center justify-between gap-3">
    <div><h3 className="text-sm font-black">{title}</h3><p className="mt-1 text-[10px] text-zinc-400">ה־AI משתמש בנתונים האלה בכל שינוי בתוכנית.</p></div>
    <button type="button" onClick={onEdit} className="flex items-center gap-1.5 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-[10px] font-black text-amber-300"><Edit3 size={13} /> עדכון תשובות</button>
  </div>
  <div className="mt-3 flex flex-wrap gap-2">{items.filter(item => hasValue(item.value)).map(item => <span key={item.label} className="rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-[10px] text-zinc-300"><strong className="text-zinc-500">{item.label}: </strong>{String(item.value)}</span>)}</div>
</section>;
