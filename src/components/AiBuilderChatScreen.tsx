import React, { useEffect, useRef } from 'react';
import { Bot, CheckCircle2, Library, Loader2, PanelRightClose, PanelRightOpen, RotateCcw, Send, X } from 'lucide-react';

export interface AiBuilderChatMessage {
  id: string;
  role: 'COACH' | 'ASSISTANT';
  content: string;
  author?: string;
}

interface AiBuilderChatScreenProps {
  open: boolean;
  title: string;
  subtitle: string;
  messages: AiBuilderChatMessage[];
  input: string;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  isGenerating?: boolean;
  suggestions?: string[];
  onSuggestion?: (suggestion: string) => void;
  drawerOpen: boolean;
  onDrawerToggle: () => void;
  drawerTitle: string;
  drawerDescription?: string;
  drawerContent: React.ReactNode;
  drawerTabs?: Array<{ id: string; label: string }>;
  activeDrawerTab?: string;
  onDrawerTabChange?: (tabId: string) => void;
  statusText?: string;
  emptyTitle: string;
  emptyDescription: string;
  onReset?: () => void;
}

export const AiBuilderChatScreen: React.FC<AiBuilderChatScreenProps> = ({
  open,
  title,
  subtitle,
  messages,
  input,
  onInputChange,
  onSubmit,
  onClose,
  onConfirm,
  confirmLabel = 'אישור תוכנית',
  confirmDisabled = false,
  isGenerating = false,
  suggestions = [],
  onSuggestion,
  drawerOpen,
  onDrawerToggle,
  drawerTitle,
  drawerDescription,
  drawerContent,
  drawerTabs = [],
  activeDrawerTab,
  onDrawerTabChange,
  statusText,
  emptyTitle,
  emptyDescription,
  onReset
}) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [isGenerating, messages.length, open]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!input.trim() || isGenerating) return;
    onSubmit();
  };

  return (
    <section className="fixed inset-0 z-[200] flex h-[100dvh] flex-col overflow-hidden bg-[#0b0d12] text-white" dir="rtl" aria-label={title}>
      <header className="flex min-h-16 shrink-0 items-center gap-2 border-b border-white/10 bg-[#11141b] px-3 py-2 sm:px-5">
        <button type="button" onClick={onClose} className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-zinc-300 hover:bg-white/10" aria-label="חזרה למסך התוכנית"><X size={21} /></button>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400 text-zinc-950"><Bot size={22} /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2"><h2 className="truncate text-sm font-black sm:text-base">{title}</h2><span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[9px] font-black text-emerald-300">OpenAI</span></div>
          <p className="truncate text-[10px] text-zinc-400 sm:text-xs">{subtitle}</p>
        </div>
        {statusText && <span className="hidden rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold text-zinc-300 sm:block">{statusText}</span>}
        {onReset && <button type="button" onClick={onReset} className="hidden items-center gap-1 rounded-xl border border-white/10 px-3 py-2 text-[10px] font-bold text-zinc-300 hover:bg-white/10 sm:flex"><RotateCcw size={13} /> איפוס</button>}
        <button type="button" onClick={onDrawerToggle} className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${drawerOpen ? 'border-amber-400 bg-amber-400 text-zinc-950' : 'border-white/10 text-zinc-200 hover:bg-white/10'}`} aria-label="פתיחת תפריט צד">
          {drawerOpen ? <PanelRightClose size={20} /> : <PanelRightOpen size={20} />}
        </button>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {drawerOpen && <button type="button" onClick={onDrawerToggle} className="absolute inset-0 z-20 bg-black/60 lg:hidden" aria-label="סגירת המאגר" />}
        <aside className={`${drawerOpen ? 'translate-x-0' : 'translate-x-full'} absolute inset-y-0 right-0 z-30 flex w-[94vw] max-w-md flex-col border-l border-white/10 bg-[#151922] shadow-2xl transition-transform lg:static lg:w-[28rem] lg:max-w-none lg:shrink-0 xl:w-[34rem] ${drawerOpen ? 'lg:flex' : 'lg:hidden'}`}>
          <div className="flex items-start justify-between gap-3 border-b border-white/10 p-4">
            <div><h3 className="flex items-center gap-2 text-sm font-black"><Library size={17} className="text-amber-300" />{drawerTitle}</h3>{drawerDescription && <p className="mt-1 text-[10px] leading-5 text-zinc-400">{drawerDescription}</p>}</div>
            <button type="button" onClick={onDrawerToggle} className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 hover:bg-white/10 lg:hidden"><X size={17} /></button>
          </div>
          {drawerTabs.length > 0 && <nav className="flex shrink-0 gap-1 overflow-x-auto border-b border-white/10 p-2" aria-label="אפשרויות עוזר הבנייה">
            {drawerTabs.map(tab => <button key={tab.id} type="button" onClick={() => onDrawerTabChange?.(tab.id)} className={`min-h-9 min-w-fit rounded-lg px-3 text-[10px] font-black transition ${activeDrawerTab === tab.id ? 'bg-amber-400 text-zinc-950' : 'bg-white/5 text-zinc-300 hover:bg-white/10'}`}>{tab.label}</button>)}
          </nav>}
          <div className="min-h-0 flex-1 overflow-y-auto p-3">{drawerContent}</div>
        </aside>

        <main className="flex min-w-0 flex-1 flex-col bg-[#0b0d12]">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-5 sm:px-6">
            <div className="mx-auto w-full max-w-3xl space-y-5">
              {messages.length === 0 && (
                <div className="mx-auto flex max-w-lg flex-col items-center justify-center px-5 py-16 text-center">
                  <div className="mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-400 text-zinc-950 shadow-lg shadow-amber-400/10"><Bot size={29} /></div>
                  <h3 className="text-lg font-black">{emptyTitle}</h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-400">{emptyDescription}</p>
                </div>
              )}
              {messages.map(message => (
                <article key={message.id} className={`flex items-start gap-3 ${message.role === 'COACH' ? 'flex-row-reverse' : ''}`}>
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-black ${message.role === 'COACH' ? 'bg-zinc-700 text-white' : 'bg-amber-400 text-zinc-950'}`}>{message.role === 'COACH' ? 'מאמן' : <Bot size={17} />}</span>
                  <div className={`max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-7 shadow-sm ${message.role === 'COACH' ? 'rounded-tl-sm bg-[#2a2f3a] text-white' : 'rounded-tr-sm border border-white/10 bg-[#171b23] text-zinc-100'}`}>
                    <strong className={`mb-1 block text-[10px] ${message.role === 'COACH' ? 'text-zinc-400' : 'text-amber-300'}`}>{message.role === 'COACH' ? message.author || 'המאמן' : 'עוזר הבנייה החכם'}</strong>
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  </div>
                </article>
              ))}
              {isGenerating && <div className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center rounded-full bg-amber-400 text-zinc-950"><Bot size={17} /></span><div className="flex items-center gap-2 rounded-2xl rounded-tr-sm border border-white/10 bg-[#171b23] px-4 py-3 text-sm text-zinc-300"><Loader2 className="animate-spin text-amber-300" size={16} /> חושב ומעדכן את התוכנית…</div></div>}
              <div ref={endRef} />
            </div>
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-[#11141b] px-3 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-2 sm:px-5">
            <div className="mx-auto w-full max-w-3xl">
              {suggestions.length > 0 && <div className="mb-2 flex gap-2 overflow-x-auto pb-1 scrollbar-none">{suggestions.map(suggestion => <button key={suggestion} type="button" disabled={isGenerating} onClick={() => onSuggestion?.(suggestion)} className="min-w-fit rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-bold text-zinc-300 hover:border-amber-400/60 hover:text-amber-200 disabled:opacity-40">{suggestion}</button>)}</div>}
              <form onSubmit={submit} className="flex items-end gap-2 rounded-2xl border border-white/15 bg-[#20242d] p-2 shadow-xl focus-within:border-amber-400/60">
                <textarea
                  value={input}
                  onChange={event => onInputChange(event.target.value)}
                  onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); if (input.trim() && !isGenerating) onSubmit(); } }}
                  rows={1}
                  className="max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent px-2 py-2.5 text-sm leading-6 text-white outline-none placeholder:text-zinc-500"
                  placeholder="כתוב לעוזר מה לבנות או לשנות…"
                />
                <button type="submit" disabled={!input.trim() || isGenerating} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-400 text-zinc-950 disabled:bg-zinc-700 disabled:text-zinc-500"><Send size={19} /></button>
              </form>
              <div className="mt-2 flex items-center justify-between gap-3">
                <span className="truncate text-[9px] text-zinc-500">הטיוטה נשמרת תוך כדי השיחה ואינה מתפרסמת ללא אישור המאמן.</span>
                <button type="button" disabled={confirmDisabled || isGenerating} onClick={onConfirm} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-500 px-4 text-xs font-black text-white disabled:cursor-not-allowed disabled:opacity-35"><CheckCircle2 size={16} /> {confirmLabel}</button>
              </div>
            </div>
          </footer>
        </main>
      </div>
    </section>
  );
};
