import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCheck, MessageCircle, Search, Send, UserRound } from 'lucide-react';
import { Message, User, UserRole } from '../types';

interface ClubChatCenterProps {
  activeUser: User;
  users: User[];
  messages: Message[];
  initialContactId?: string;
  onSendMessage: (content: string, receiverId: string) => void;
  onUpdateMessages: (messages: Message[]) => void;
  onBack: () => void;
}

const messageTime = (timestamp: string) => new Date(timestamp).toLocaleString('he-IL', {
  day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
});

export const ClubChatCenter: React.FC<ClubChatCenterProps> = ({
  activeUser,
  users,
  messages,
  initialContactId = '',
  onSendMessage,
  onUpdateMessages,
  onBack
}) => {
  const isTrainee = activeUser.role === UserRole.TRAINEE;
  const contacts = useMemo(() => users
    .filter(user => user.id !== activeUser.id)
    .filter(user => isTrainee
      ? user.role === UserRole.COACH || user.role === UserRole.MANAGER
      : user.role === UserRole.TRAINEE)
    .map(user => {
      const contactMessages = messages.filter(message =>
        (message.senderId === activeUser.id && message.receiverId === user.id)
        || (message.senderId === user.id && message.receiverId === activeUser.id));
      const latest = [...contactMessages].sort((a, b) => b.timestamp.localeCompare(a.timestamp))[0];
      const unread = contactMessages.filter(message => message.senderId === user.id && message.receiverId === activeUser.id && !message.read).length;
      return { user, latest, unread };
    })
    .sort((a, b) => (b.latest?.timestamp || '').localeCompare(a.latest?.timestamp || '') || a.user.name.localeCompare(b.user.name, 'he')),
  [activeUser.id, isTrainee, messages, users]);
  const validInitialContact = contacts.some(contact => contact.user.id === initialContactId) ? initialContactId : '';
  const [selectedContactId, setSelectedContactId] = useState(validInitialContact);
  const [search, setSearch] = useState('');
  const [input, setInput] = useState('');
  const endRef = useRef<HTMLDivElement | null>(null);
  const selectedContact = contacts.find(contact => contact.user.id === selectedContactId)?.user;
  const conversation = useMemo(() => messages
    .filter(message => selectedContactId && (
      (message.senderId === activeUser.id && message.receiverId === selectedContactId)
      || (message.senderId === selectedContactId && message.receiverId === activeUser.id)
    ))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
  [activeUser.id, messages, selectedContactId]);
  const visibleContacts = contacts.filter(contact => contact.user.name.toLocaleLowerCase('he-IL').includes(search.trim().toLocaleLowerCase('he-IL')));

  useEffect(() => {
    if (!initialContactId || !contacts.some(contact => contact.user.id === initialContactId)) return;
    setSelectedContactId(initialContactId);
  }, [contacts, initialContactId]);

  useEffect(() => {
    if (!selectedContactId) return;
    const hasUnread = messages.some(message => message.senderId === selectedContactId && message.receiverId === activeUser.id && !message.read);
    if (hasUnread) {
      onUpdateMessages(messages.map(message => message.senderId === selectedContactId && message.receiverId === activeUser.id
        ? { ...message, read: true }
        : message));
    }
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [activeUser.id, messages, onUpdateMessages, selectedContactId]);

  const selectContact = (contactId: string) => {
    setSelectedContactId(contactId);
    const url = new URL(window.location.href);
    url.searchParams.set('workspace', 'chat');
    url.searchParams.set('contact', contactId);
    window.history.replaceState({}, '', url);
  };

  const send = (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || !selectedContactId) return;
    onSendMessage(content, selectedContactId);
    setInput('');
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };

  return (
    <section className="mx-auto h-[calc(100dvh-210px)] min-h-[560px] max-w-6xl overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl" dir="rtl">
      <div className="grid h-full md:grid-cols-[320px_minmax(0,1fr)]">
        <aside className={`${selectedContact ? 'hidden md:flex' : 'flex'} min-h-0 flex-col border-l border-zinc-700 bg-zinc-900`}>
          <header className="border-b border-zinc-700 p-4">
            <div className="flex items-center justify-between gap-2">
              <div><h1 className="text-lg font-black text-white">{isTrainee ? 'צ׳אט עם המאמן' : 'צ׳אט עם מתאמנים'}</h1><p className="text-xs text-zinc-400">{contacts.length} אנשי קשר</p></div>
              <MessageCircle className="text-amber-400" size={25} />
            </div>
            <label className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3">
              <Search size={16} className="text-zinc-500" />
              <input value={search} onChange={event => setSearch(event.target.value)} placeholder="חיפוש איש קשר" className="min-h-11 w-full bg-transparent text-sm text-white outline-none placeholder:text-zinc-500" />
            </label>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {visibleContacts.map(contact => (
              <button type="button" key={contact.user.id} onClick={() => selectContact(contact.user.id)} className="flex w-full items-center gap-3 border-b border-zinc-800 p-3 text-right transition hover:bg-zinc-800">
                {contact.user.imageUrl
                  ? <img src={contact.user.imageUrl} alt="" className="h-11 w-11 shrink-0 rounded-full border border-zinc-700 object-cover" />
                  : <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-zinc-700 text-zinc-300"><UserRound size={21} /></span>}
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-white">{contact.user.name}</strong>
                  <small className="block truncate text-[11px] text-zinc-400">{contact.latest?.content || (isTrainee ? 'אפשר להתחיל שיחה עם המאמן' : 'אפשר להתחיל שיחה עם המתאמן')}</small>
                </span>
                <span className="grid justify-items-end gap-1">
                  {contact.latest && <time className="text-[9px] text-zinc-500">{messageTime(contact.latest.timestamp).split(',')[0]}</time>}
                  {contact.unread > 0 && <b className="grid h-5 min-w-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] text-white">{contact.unread}</b>}
                </span>
              </button>
            ))}
            {visibleContacts.length === 0 && <div className="p-8 text-center text-sm text-zinc-500">לא נמצאו אנשי קשר.</div>}
          </div>
        </aside>

        <div className={`${selectedContact ? 'flex' : 'hidden md:flex'} min-h-0 flex-col bg-[#111b21]`}>
          {selectedContact ? <>
            <header className="flex min-h-16 items-center gap-3 border-b border-zinc-700 bg-zinc-900 px-3 py-2">
              <button type="button" onClick={() => setSelectedContactId('')} className="grid h-10 w-10 place-items-center rounded-full text-zinc-300 md:hidden" aria-label="חזרה לרשימת אנשי קשר"><ArrowRight size={20} /></button>
              {selectedContact.imageUrl
                ? <img src={selectedContact.imageUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
                : <span className="grid h-10 w-10 place-items-center rounded-full bg-zinc-700"><UserRound size={19} /></span>}
              <div><strong className="block text-sm text-white">{selectedContact.name}</strong><small className="text-[10px] text-emerald-400">{selectedContact.role === UserRole.TRAINEE ? 'מתאמן/ת' : 'צוות המועדון'}</small></div>
            </header>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto bg-[radial-gradient(circle_at_top,#1b2a2f_0,#111b21_45%)] p-3 sm:p-5">
              {conversation.map(message => {
                const mine = message.senderId === activeUser.id;
                if (message.systemGenerated) return (
                  <article key={message.id} className="mx-auto max-w-[92%] rounded-xl border border-amber-500/30 bg-amber-950/50 px-3 py-2 text-center shadow">
                    <p className="whitespace-pre-wrap break-words text-xs font-bold leading-5 text-amber-100">{message.content}</p>
                    <time className="mt-1 block text-[9px] text-amber-300/80">{messageTime(message.timestamp)}</time>
                  </article>
                );
                return (
                  <article key={message.id} className={`w-fit max-w-[86%] rounded-xl px-3 py-2 shadow ${mine ? 'mr-auto bg-[#005c4b]' : 'ml-auto bg-[#202c33]'}`}>
                    <p className="whitespace-pre-wrap break-words text-sm leading-6 text-white">{message.content}</p>
                    <footer className="mt-1 flex items-center justify-end gap-1 text-[9px] text-zinc-300"><time>{messageTime(message.timestamp)}</time>{mine && <CheckCheck size={12} className={message.read ? 'text-sky-300' : ''} />}</footer>
                  </article>
                );
              })}
              {conversation.length === 0 && <div className="mx-auto mt-8 w-fit rounded-full bg-zinc-900/90 px-4 py-2 text-xs text-zinc-400">זו תחילת השיחה עם {selectedContact.name}</div>}
              <div ref={endRef} />
            </div>
            <form onSubmit={send} className="flex items-end gap-2 border-t border-zinc-700 bg-zinc-900 p-3">
              <textarea value={input} onChange={event => setInput(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} rows={1} placeholder="כתיבת הודעה…" className="max-h-28 min-h-11 flex-1 resize-none rounded-2xl border border-zinc-700 bg-zinc-800 px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-emerald-500" />
              <button type="submit" disabled={!input.trim()} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-emerald-600 text-white disabled:opacity-40" aria-label="שליחת הודעה"><Send size={18} /></button>
            </form>
          </> : <div className="grid h-full place-items-center p-6 text-center"><div><MessageCircle className="mx-auto text-amber-400" size={42} /><h2 className="mt-3 text-lg font-black text-white">בחרו איש קשר</h2><p className="mt-1 text-sm text-zinc-400">השיחה תופיע כאן.</p><button type="button" onClick={onBack} className="mt-5 rounded-xl border border-zinc-700 px-4 py-2 text-xs font-bold text-white">חזרה לדף הבית</button></div></div>}
        </div>
      </div>
    </section>
  );
};
