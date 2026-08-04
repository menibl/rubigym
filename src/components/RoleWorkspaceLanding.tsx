import React, { useMemo, useState } from 'react';
import {
  Bell,
  CalendarCheck,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Edit3,
  Inbox,
  MessageCircle,
  Megaphone,
  Send,
  Settings2,
  Trash2,
  UserRound
} from 'lucide-react';
import { Announcement, Gender, Message, User, UserRole } from '../types';

export type WorkspaceView =
  | 'CLUB_MANAGEMENT'
  | 'TRAINING'
  | 'WORKOUT_PLANNING'
  | 'BOOKING'
  | 'MY_PROGRAM'
  | 'MY_ACCOUNT';

interface RoleWorkspaceLandingProps {
  activeUser: User;
  onSelect: (view: WorkspaceView) => void;
  users?: User[];
  announcements?: Announcement[];
  messages?: Message[];
  onSendMessage?: (content: string, receiverId: string) => void;
  onUpdateAnnouncements?: (announcements: Announcement[]) => void;
}

const workspaceCards = {
  CLUB_MANAGEMENT: {
    title: 'ניהול המועדון',
    description: 'משתמשים, תשלומים, מנויים, יומן, הודעות והגדרות',
    icon: Settings2,
    accent: 'from-amber-400 to-amber-600',
    glow: 'hover:border-amber-400/60'
  },
  TRAINING: {
    title: 'אימונים',
    description: 'האימונים הקרובים, שיבוץ קבוצות ושליטה במסך האימון',
    icon: Dumbbell,
    accent: 'from-emerald-400 to-emerald-600',
    glow: 'hover:border-emerald-400/60'
  },
  WORKOUT_PLANNING: {
    title: 'תכנון אימונים',
    description: 'בניית תוכניות אישיות וקבוצתיות ומאגר אימונים',
    icon: ClipboardList,
    accent: 'from-indigo-400 to-indigo-600',
    glow: 'hover:border-indigo-400/60'
  },
  BOOKING: {
    title: 'הרשמה לאימון',
    description: 'צפייה ביומן והרשמה לאימון קבוצתי או Open Gym',
    icon: CalendarCheck,
    accent: 'from-emerald-400 to-emerald-600',
    glow: 'hover:border-emerald-400/60'
  },
  MY_PROGRAM: {
    title: 'תוכנית האימונים שלי',
    description: 'צפייה בתוכנית והפעלת מסך אימון אישי בטלפון',
    icon: Dumbbell,
    accent: 'from-sky-400 to-indigo-600',
    glow: 'hover:border-sky-400/60'
  },
  MY_ACCOUNT: {
    title: 'פרופיל ומנוי',
    description: 'תשלומים, החלפת מסלול, הקפאה, משפחה והגדרות',
    icon: CreditCard,
    accent: 'from-amber-400 to-orange-600',
    glow: 'hover:border-amber-400/60'
  }
} satisfies Record<WorkspaceView, {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  accent: string;
  glow: string;
}>;

export const RoleWorkspaceLanding: React.FC<RoleWorkspaceLandingProps> = ({
  activeUser,
  onSelect,
  users = [],
  announcements = [],
  messages = [],
  onSendMessage,
  onUpdateAnnouncements
}) => {
  const coaches = users.filter(user => user.role === UserRole.COACH || user.role === UserRole.MANAGER);
  const [selectedCoachId, setSelectedCoachId] = useState(() => coaches[0]?.id || '');
  const [chatInput, setChatInput] = useState('');
  const staffRecipients = users.filter(user => user.id !== activeUser.id);
  const [selectedRecipientId, setSelectedRecipientId] = useState(() => staffRecipients[0]?.id || '');
  const [staffMessageInput, setStaffMessageInput] = useState('');
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState('');

  const views: WorkspaceView[] = activeUser.role === UserRole.MANAGER
    ? ['CLUB_MANAGEMENT', 'TRAINING', 'WORKOUT_PLANNING']
    : activeUser.role === UserRole.COACH
      ? ['TRAINING', 'WORKOUT_PLANNING']
      : ['BOOKING', 'MY_PROGRAM', 'MY_ACCOUNT'];

  const targetedAnnouncements = useMemo(() => announcements
    .filter(announcement => {
      if (announcement.targetGender !== Gender.ALL && announcement.targetGender !== activeUser.gender) return false;
      if (announcement.targetAgeMin && activeUser.age < announcement.targetAgeMin) return false;
      if (announcement.targetAgeMax && activeUser.age > announcement.targetAgeMax) return false;
      if (
        announcement.targetMembershipTypes?.length
        && activeUser.membershipType
        && !announcement.targetMembershipTypes.includes(activeUser.membershipType)
      ) return false;
      return true;
    })
    .sort((a, b) => b.date.localeCompare(a.date)), [activeUser, announcements]);

  const coachMessages = useMemo(() => messages
    .filter(message =>
      (message.senderId === activeUser.id && message.receiverId === selectedCoachId)
      || (message.senderId === selectedCoachId && message.receiverId === activeUser.id)
    )
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
    .slice(-4), [activeUser.id, messages, selectedCoachId]);

  const incomingStaffMessages = useMemo(() => messages
    .filter(message => message.receiverId === activeUser.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [activeUser.id, messages]);

  const latestClubAnnouncements = useMemo(() => [...announcements]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5), [announcements]);

  const sendChatMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const content = chatInput.trim();
    if (!content || !selectedCoachId || !onSendMessage) return;
    onSendMessage(content, selectedCoachId);
    setChatInput('');
  };

  const sendStaffMessage = (event: React.FormEvent) => {
    event.preventDefault();
    const content = staffMessageInput.trim();
    if (!content || !selectedRecipientId || !onSendMessage) return;
    onSendMessage(content, selectedRecipientId);
    setStaffMessageInput('');
  };

  const saveClubAnnouncement = (event: React.FormEvent) => {
    event.preventDefault();
    const title = announcementTitle.trim();
    const content = announcementContent.trim();
    if (!title || !content || !onUpdateAnnouncements) return;
    if (editingAnnouncementId) {
      onUpdateAnnouncements(announcements.map(announcement => announcement.id === editingAnnouncementId
        ? { ...announcement, title, content, createdBy: activeUser.name, creatorRole: activeUser.role as UserRole.MANAGER | UserRole.COACH, date: new Date().toISOString().split('T')[0] }
        : announcement));
    } else {
      onUpdateAnnouncements([{
        id: `announcement-${Date.now()}`,
        title,
        content,
        createdBy: activeUser.name,
        creatorRole: activeUser.role as UserRole.MANAGER | UserRole.COACH,
        date: new Date().toISOString().split('T')[0],
        targetGender: Gender.ALL
      }, ...announcements]);
    }
    setAnnouncementTitle('');
    setAnnouncementContent('');
    setEditingAnnouncementId('');
  };

  const startEditingAnnouncement = (announcement: Announcement) => {
    setEditingAnnouncementId(announcement.id);
    setAnnouncementTitle(announcement.title);
    setAnnouncementContent(announcement.content);
  };

  const roleLabel = activeUser.role === UserRole.MANAGER
    ? 'מנהל המועדון'
    : activeUser.role === UserRole.COACH
      ? 'מאמן'
      : 'מתאמן';

  return (
    <section className="workspace-landing" dir="rtl">
      <div className="mb-6 rounded-3xl border border-zinc-800 bg-gradient-to-l from-zinc-950 via-zinc-900 to-zinc-950 px-5 py-7 text-white shadow-2xl sm:px-8">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-amber-400/30 bg-amber-400/10 text-amber-400">
            <UserRound size={24} />
          </div>
          <div>
            <p className="text-xs font-bold text-amber-400">סביבת עבודה · {roleLabel}</p>
            <h2 className="mt-1 text-2xl font-black">שלום {activeUser.name}, במה נתמקד עכשיו?</h2>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-zinc-400">
          כל אזור מציג רק את הכלים הנדרשים למשימה, כך שקל לעבוד גם מהטלפון בזמן אימון.
        </p>
      </div>

      <div className={`grid gap-4 ${views.length === 2 ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}>
        {views.map(view => {
          const card = workspaceCards[view];
          const Icon = card.icon;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onSelect(view)}
              className={`group min-h-56 rounded-3xl border border-zinc-800 bg-zinc-900 p-6 text-right text-white shadow-xl transition duration-200 hover:-translate-y-1 hover:bg-zinc-800 ${card.glow}`}
            >
              <span className={`grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br ${card.accent} text-white shadow-lg`}>
                <Icon size={27} />
              </span>
              <h3 className="mt-7 text-xl font-black">{card.title}</h3>
              <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-400">{card.description}</p>
              <span className="mt-5 flex items-center gap-1 text-xs font-black text-amber-400">
                כניסה לאזור <ChevronLeft size={16} className="transition group-hover:-translate-x-1" />
              </span>
            </button>
          );
        })}
      </div>

      {activeUser.role !== UserRole.TRAINEE && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-sky-400/10 text-sky-400"><Inbox size={20} /></span>
                <div><h3 className="font-black">הודעות שנשלחו אליי</h3><p className="text-[11px] text-zinc-500">פניות ממתאמנים ומצוות המועדון</p></div>
              </div>
              {incomingStaffMessages.some(message => !message.read) && (
                <span className="rounded-full bg-sky-500 px-2.5 py-1 text-[10px] font-black text-white">
                  {incomingStaffMessages.filter(message => !message.read).length} חדשות
                </span>
              )}
            </div>
            <form onSubmit={sendStaffMessage} className="mb-4 rounded-2xl border border-sky-500/20 bg-sky-500/5 p-3">
              <p className="mb-2 text-xs font-black text-sky-300">כתיבת הודעה חדשה</p>
              <div className="grid gap-2 sm:grid-cols-[minmax(130px,0.45fr)_1fr_auto]">
                <select value={selectedRecipientId} onChange={event => setSelectedRecipientId(event.target.value)} className="min-h-11 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-xs font-bold text-white">
                  {staffRecipients.map(recipient => <option key={recipient.id} value={recipient.id}>{recipient.name} · {recipient.role === UserRole.TRAINEE ? 'מתאמן' : recipient.role === UserRole.COACH ? 'מאמן' : 'מנהל'}</option>)}
                </select>
                <input value={staffMessageInput} onChange={event => setStaffMessageInput(event.target.value)} placeholder="כתיבת הודעה..." className="min-h-11 min-w-0 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-sky-400" />
                <button type="submit" disabled={!staffMessageInput.trim() || !selectedRecipientId} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-sky-500 px-4 text-xs font-black text-white disabled:opacity-40"><Send size={15} /> שליחה</button>
              </div>
            </form>
            <div className="space-y-2.5">
              {incomingStaffMessages.slice(0, 6).map(message => (
                <article key={message.id} className={`rounded-2xl border p-3.5 ${message.read ? 'border-zinc-800 bg-zinc-950/60' : 'border-sky-500/40 bg-sky-500/10'}`}>
                  <div className="flex items-start gap-3">
                    <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${message.read ? 'bg-zinc-700' : 'bg-sky-400'}`} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-xs text-white">{message.senderName}</strong>
                        <time className="text-[10px] text-zinc-500">{new Date(message.timestamp).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time>
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-400">{message.content}</p>
                    </div>
                  </div>
                </article>
              ))}
              {incomingStaffMessages.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-700 p-7 text-center text-xs text-zinc-500">לא התקבלו עדיין הודעות אישיות.</div>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/10 text-amber-400"><Megaphone size={20} /></span>
                <div><h3 className="font-black">הודעות המועדון</h3><p className="text-[11px] text-zinc-500">עדכונים שפורסמו לצוות ולמתאמנים</p></div>
              </div>
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-black text-zinc-300">{announcements.length} מודעות</span>
            </div>
            <form onSubmit={saveClubAnnouncement} className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-black text-amber-300">{editingAnnouncementId ? 'עריכת הודעת מועדון' : 'פרסום הודעה לכל המועדון'}</p>
                {editingAnnouncementId && <button type="button" onClick={() => { setEditingAnnouncementId(''); setAnnouncementTitle(''); setAnnouncementContent(''); }} className="text-[10px] font-bold text-zinc-400">ביטול עריכה</button>}
              </div>
              <input value={announcementTitle} onChange={event => setAnnouncementTitle(event.target.value)} placeholder="כותרת ההודעה" className="mb-2 min-h-10 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-sm text-white outline-none focus:border-amber-400" />
              <textarea value={announcementContent} onChange={event => setAnnouncementContent(event.target.value)} placeholder="תוכן ההודעה לכל חברי המועדון..." rows={3} className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-amber-400" />
              <button type="submit" disabled={!announcementTitle.trim() || !announcementContent.trim()} className="mt-2 flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-4 text-xs font-black text-zinc-950 disabled:opacity-40"><Megaphone size={15} /> {editingAnnouncementId ? 'שמור עדכון' : 'פרסם לכל המועדון'}</button>
            </form>
            <div className="space-y-3">
              {latestClubAnnouncements.map(announcement => (
                <article key={announcement.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1"><div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500"><span>פורסם על ידי {announcement.createdBy}</span><time>{announcement.date}</time></div>
                    <h4 className="mt-2 text-sm font-black text-white">{announcement.title}</h4>
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{announcement.content}</p></div>
                    <div className="flex shrink-0 gap-1">
                      <button type="button" onClick={() => startEditingAnnouncement(announcement)} className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-800 text-zinc-300 hover:text-amber-400" aria-label="עריכת הודעה"><Edit3 size={14} /></button>
                      <button type="button" onClick={() => { if (window.confirm('למחוק את הודעת המועדון?')) onUpdateAnnouncements?.(announcements.filter(item => item.id !== announcement.id)); }} className="grid h-8 w-8 place-items-center rounded-lg bg-zinc-800 text-zinc-300 hover:text-red-400" aria-label="מחיקת הודעה"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </article>
              ))}
              {latestClubAnnouncements.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-700 p-7 text-center text-xs text-zinc-500">עדיין לא פורסמו הודעות מועדון.</div>
              )}
            </div>
          </section>
        </div>
      )}

      {activeUser.role === UserRole.TRAINEE && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <section className="rounded-3xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-xl">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-400/10 text-amber-400"><Bell size={20} /></span>
                <div><h3 className="font-black">לוח המודעות</h3><p className="text-[11px] text-zinc-500">עדכונים מצוות המועדון</p></div>
              </div>
              <span className="rounded-full bg-zinc-800 px-2.5 py-1 text-[10px] font-black text-zinc-300">{targetedAnnouncements.length} הודעות</span>
            </div>
            <div className="space-y-3">
              {targetedAnnouncements.slice(0, 3).map(announcement => (
                <article key={announcement.id} className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-4">
                  <div className="flex items-center justify-between gap-2 text-[10px] text-zinc-500"><span>{announcement.createdBy}</span><time>{announcement.date}</time></div>
                  <h4 className="mt-2 text-sm font-black text-white">{announcement.title}</h4>
                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-400">{announcement.content}</p>
                </article>
              ))}
              {targetedAnnouncements.length === 0 && (
                <div className="rounded-2xl border border-dashed border-zinc-700 p-6 text-center text-xs text-zinc-500">אין כרגע הודעות חדשות עבורך.</div>
              )}
            </div>
          </section>

          <section className="flex min-h-80 flex-col rounded-3xl border border-zinc-800 bg-zinc-900 p-5 text-white shadow-xl">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-400/10 text-emerald-400"><MessageCircle size={20} /></span>
                <div><h3 className="font-black">צ׳אט עם המאמן</h3><p className="text-[11px] text-zinc-500">שאלה, עדכון או התייעצות</p></div>
              </div>
              <select value={selectedCoachId} onChange={event => setSelectedCoachId(event.target.value)} className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-white">
                {coaches.map(coach => <option key={coach.id} value={coach.id}>{coach.name}</option>)}
              </select>
            </div>
            <div className="mb-4 flex-1 space-y-2 overflow-hidden rounded-2xl bg-zinc-950/70 p-3">
              {coachMessages.map(message => (
                <div key={message.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-5 ${message.senderId === activeUser.id ? 'mr-auto bg-amber-500 text-zinc-950' : 'ml-auto bg-zinc-800 text-zinc-200'}`}>
                  <strong className="mb-0.5 block text-[10px]">{message.senderId === activeUser.id ? 'אני' : message.senderName}</strong>
                  {message.content}
                </div>
              ))}
              {coachMessages.length === 0 && <p className="py-8 text-center text-xs text-zinc-600">אפשר להתחיל שיחה חדשה עם המאמן.</p>}
            </div>
            <form onSubmit={sendChatMessage} className="flex gap-2">
              <input value={chatInput} onChange={event => setChatInput(event.target.value)} placeholder="כתיבת הודעה למאמן..." className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-sm text-white outline-none focus:border-amber-400" />
              <button type="submit" disabled={!chatInput.trim() || !selectedCoachId} className="grid h-12 w-12 place-items-center rounded-xl bg-amber-500 text-zinc-950 transition hover:bg-amber-400 disabled:opacity-40" aria-label="שליחת הודעה"><Send size={18} /></button>
            </form>
          </section>
        </div>
      )}
    </section>
  );
};
