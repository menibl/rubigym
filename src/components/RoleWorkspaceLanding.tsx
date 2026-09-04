import React, { useMemo, useState } from 'react';
import {
  Apple,
  Bell,
  CalendarCheck,
  CalendarClock,
  Check,
  CheckCheck,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Edit3,
  MessageCircle,
  Megaphone,
  QrCode,
  Settings2,
  Trash2,
  UserPlus,
  UserRound
} from 'lucide-react';
import { Announcement, Gender, MEMBERSHIP_TYPE_LABELS, MembershipType, Message, Payment, TrainingSession, User, UserRole } from '../types';

export type WorkspaceView =
  | 'CLUB_MANAGEMENT'
  | 'TRAINING'
  | 'WORKOUT_PLANNING'
  | 'NUTRITION_PLANNING'
  | 'BOOKING'
  | 'MY_PROGRAM'
  | 'MY_NUTRITION'
  | 'MY_ACCOUNT'
  | 'MY_MEMBERSHIP'
  | 'CHECK_IN'
  | 'CHAT';

interface RoleWorkspaceLandingProps {
  activeUser: User;
  onSelect: (view: WorkspaceView, contactId?: string) => void;
  onOpenProfile: () => void;
  users?: User[];
  sessions?: TrainingSession[];
  announcements?: Announcement[];
  messages?: Message[];
  payments?: Payment[];
  onUpdateAnnouncements?: (announcements: Announcement[]) => void;
  onAcknowledgeStaffAlerts?: (alertIds: string[]) => void;
}

type HomeAction = {
  key: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  view?: WorkspaceView;
  onClick?: () => void;
  badge?: number;
};

export const RoleWorkspaceLanding: React.FC<RoleWorkspaceLandingProps> = ({
  activeUser,
  onSelect,
  onOpenProfile,
  users = [],
  sessions = [],
  announcements = [],
  messages = [],
  payments = [],
  onUpdateAnnouncements,
  onAcknowledgeStaffAlerts
}) => {
  const isTrainee = activeUser.role === UserRole.TRAINEE;
  const [announcementTitle, setAnnouncementTitle] = useState('');
  const [announcementContent, setAnnouncementContent] = useState('');
  const [editingAnnouncementId, setEditingAnnouncementId] = useState('');

  const roleLabel = activeUser.role === UserRole.MANAGER
    ? 'מנהל המועדון'
    : activeUser.role === UserRole.COACH
      ? 'מאמן'
      : 'מתאמן';
  const unreadChatCount = messages.filter(message => message.receiverId === activeUser.id && !message.read).length;
  const openChat = (contactId = '') => {
    onSelect('CHAT', contactId);
  };

  const nextSession = useMemo(() => {
    const now = Date.now();
    return sessions
      .filter(session => {
        const startsAt = new Date(`${session.date}T${session.time || '00:00'}:00`).getTime();
        if (!Number.isFinite(startsAt) || startsAt < now) return false;
        return isTrainee
          ? session.registeredUsers.includes(activeUser.id)
          : session.coachId === activeUser.id;
      })
      .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`))[0];
  }, [activeUser.id, isTrainee, sessions]);

  const actions: HomeAction[] = isTrainee
    ? [
        { key: 'booking', title: 'רישום לאימון', description: 'יומן, הרשמה וביטול', icon: CalendarCheck, view: 'BOOKING' },
        { key: 'profile', title: 'פרופיל', description: 'פרטים, מנוי ובריאות', icon: UserRound, view: 'MY_ACCOUNT' },
        { key: 'workout', title: 'תוכנית אימון', description: 'צפייה והפעלת האימון', icon: Dumbbell, view: 'MY_PROGRAM' },
        { key: 'nutrition', title: 'תוכנית תזונה', description: 'ארוחות, יעדים והחלפות', icon: Apple, view: 'MY_NUTRITION' },
        { key: 'chat', title: 'צ׳אט עם המאמן', description: unreadChatCount ? `${unreadChatCount} הודעות חדשות` : 'שיחה עם צוות המועדון', icon: MessageCircle, onClick: () => openChat(), badge: unreadChatCount }
      ]
    : [
        { key: 'training', title: 'אימונים ולו״ז', description: 'האימונים הקרובים והפעלת מסך', icon: CalendarClock, view: 'TRAINING' },
        { key: 'profile', title: 'פרופיל', description: 'פרטים והגדרות חשבון', icon: UserRound, onClick: onOpenProfile },
        { key: 'workout-planning', title: 'בניית תוכניות אימון', description: 'אישי, קבוצתי, מאגר ושיבוץ ליומן', icon: ClipboardList, view: 'WORKOUT_PLANNING' },
        { key: 'nutrition-planning', title: 'בניית תוכנית תזונה', description: 'יעדים, ארוחות ופרסום', icon: Apple, view: 'NUTRITION_PLANNING' },
        { key: 'chat', title: 'צ׳אט עם מתאמנים', description: unreadChatCount ? `${unreadChatCount} הודעות חדשות` : 'שיחות והודעות אישיות', icon: MessageCircle, onClick: () => openChat(), badge: unreadChatCount }
      ];

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

  const incomingStaffMessages = useMemo(() => messages
    .filter(message => message.receiverId === activeUser.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp)), [activeUser.id, messages]);

  const staffAlerts = useMemo(() => {
    if (isTrainee) return [];
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    cutoff.setHours(0, 0, 0, 0);
    const cutoffTime = cutoff.getTime();
    const alerts: Array<{
      id: string;
      kind: 'JOINED' | 'PURCHASE' | 'CHAT';
      title: string;
      detail: string;
      timestamp: string;
      contactId?: string;
    }> = [];

    users
      .filter(user => user.role === UserRole.TRAINEE && user.membershipStartedAt)
      .forEach(user => {
        const startedAt = new Date(`${user.membershipStartedAt}T12:00:00`);
        if (!Number.isFinite(startedAt.getTime()) || startedAt.getTime() < cutoffTime) return;
        const membershipLabel = user.membershipType
          ? MEMBERSHIP_TYPE_LABELS[user.membershipType]?.label || user.membershipType
          : 'ללא מסלול';
        alerts.push({
          id: `joined-${user.id}-${user.membershipStartedAt}`,
          kind: 'JOINED',
          title: `${user.name} הצטרף/ה למועדון`,
          detail: membershipLabel,
          timestamp: startedAt.toISOString()
        });
      });

    payments
      .filter(payment => payment.status === 'PAID')
      .forEach(payment => {
        const paidAt = new Date(payment.timestamp || `${payment.date}T12:00:00`);
        if (!Number.isFinite(paidAt.getTime()) || paidAt.getTime() < cutoffTime) return;
        const purchaseLabel = MEMBERSHIP_TYPE_LABELS[payment.membershipTypePurchased]?.label || payment.membershipTypePurchased;
        const purchaseDetail = [MembershipType.NUTRITION_COACHING, MembershipType.NUTRITION_PLAN].includes(payment.membershipTypePurchased)
          ? 'תוכנית תזונה'
          : [MembershipType.WORKOUT_COACHING, MembershipType.WORKOUT_PLAN, MembershipType.OPEN_GYM_WITH_PLAN].includes(payment.membershipTypePurchased)
            ? 'תוכנית אימון'
            : purchaseLabel;
        alerts.push({
          id: `purchase-${payment.id}`,
          kind: 'PURCHASE',
          title: `${payment.traineeName} — רכישה חדשה`,
          detail: `${purchaseDetail} · ₪${payment.amount.toLocaleString('he-IL')}`,
          timestamp: paidAt.toISOString()
        });
      });

    incomingStaffMessages
      .filter(message => !message.read)
      .forEach(message => alerts.push({
        id: `chat-${message.id}`,
        kind: 'CHAT',
        title: `ממתינה הודעה בצ׳אט מאת ${message.senderName}`,
        detail: message.content,
        timestamp: message.timestamp,
        contactId: message.senderId
      }));

    const acknowledged = new Set(activeUser.staffAlertAcknowledgements || []);
    return alerts
      .filter(alert => !acknowledged.has(alert.id))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [activeUser.staffAlertAcknowledgements, incomingStaffMessages, isTrainee, payments, users]);

  const latestClubAnnouncements = useMemo(() => [...announcements]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5), [announcements]);

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

  return (
    <section className="workspace-landing mobile-role-home" dir="rtl">
      <section className="role-home-summary">
        <div className="role-home-greeting">
          <div>
            <span>{roleLabel}</span>
            <h2>שלום {activeUser.name}</h2>
          </div>
          <img src={activeUser.imageUrl} alt={activeUser.name} />
        </div>
        <div className="role-home-next">
          <CalendarClock size={20} />
          <div>
            <span>{isTrainee ? 'האימון הבא שלך' : 'האימון הבא שלך כמאמן'}</span>
            {nextSession
              ? <strong>{nextSession.title} · {nextSession.date} בשעה {nextSession.time}</strong>
              : <strong>אין כרגע אימון משובץ</strong>}
          </div>
        </div>
        {!isTrainee && (
          <section className="role-home-alert-center" aria-label="הודעות חדשות למאמן ולמנהל">
            <header>
              <div><Bell size={18} /><strong>הודעות חדשות</strong></div>
              <div className="role-home-alert-actions">
                {staffAlerts.length > 0 && <button type="button" onClick={() => onAcknowledgeStaffAlerts?.(staffAlerts.map(alert => alert.id))}><CheckCheck size={15} /> אישור הכול</button>}
                {staffAlerts.length > 0 && <span>{staffAlerts.length}</span>}
              </div>
            </header>
            <div className="role-home-alert-list">
              {staffAlerts.slice(0, 6).map(alert => {
                const AlertIcon = alert.kind === 'PURCHASE' ? CreditCard : alert.kind === 'JOINED' ? UserPlus : MessageCircle;
                return (
                  <article key={alert.id} className={`role-home-alert ${alert.kind.toLowerCase()}`}>
                    <span className="role-home-alert-icon"><AlertIcon size={17} /></span>
                    <div>
                      <strong>{alert.title}</strong>
                      <p>{alert.detail}</p>
                    </div>
                    <time>{new Date(alert.timestamp).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}</time>
                    {alert.kind === 'CHAT' && alert.contactId && <button type="button" className="role-home-alert-open" onClick={() => openChat(alert.contactId)}>פתיחת צ׳אט</button>}
                    <button type="button" className="role-home-alert-ack" onClick={() => onAcknowledgeStaffAlerts?.([alert.id])} aria-label={`אישור ההתראה: ${alert.title}`}><Check size={15} /> אישור</button>
                  </article>
                );
              })}
              {staffAlerts.length === 0 && <div className="role-home-alert-empty">אין כרגע עדכונים חדשים.</div>}
            </div>
          </section>
        )}
        {activeUser.role === UserRole.MANAGER && (
          <button type="button" className="role-home-management-link" onClick={() => onSelect('CLUB_MANAGEMENT')}>
            <Settings2 size={17} /> פאנל ניהול המועדון <ChevronLeft size={16} />
          </button>
        )}
      </section>

      <section className="role-home-actions" aria-label="פעולות מהירות">
        {actions.map(action => {
          const Icon = action.icon;
          return (
            <button
              key={action.key}
              type="button"
              onClick={() => action.onClick ? action.onClick() : action.view && onSelect(action.view)}
            >
              <span className="role-home-action-icon"><Icon size={25} /></span>
              <strong>{action.title}</strong>
              <small>{action.description}</small>
              <ChevronLeft size={17} className="role-home-action-arrow" />
              {action.badge ? <b className="absolute left-3 top-3 grid h-6 min-w-6 place-items-center rounded-full bg-red-500 px-1 text-[11px] text-white shadow-lg">{action.badge}</b> : null}
            </button>
          );
        })}
      </section>

      {isTrainee && (
        <button type="button" className="check-in-home-strip" onClick={() => onSelect('CHECK_IN')}>
          <span><QrCode size={23} /></span>
          <span><strong>סריקת ברקוד לכניסה למועדון</strong><small>פתיחת המצלמה ואישור כניסה לפי האימון והלו״ז שלך</small></span>
          <ChevronLeft size={18} />
        </button>
      )}

      <section className="role-home-communications">
        {isTrainee ? (
          <>
            <section className="role-home-panel">
              <div className="role-home-panel-title"><Bell size={20} /><div><h3>הודעות המערכת</h3><p>עדכונים מצוות המועדון</p></div></div>
              <div className="role-home-feed">
                {targetedAnnouncements.slice(0, 3).map(announcement => (
                  <article key={announcement.id}>
                    <div><span>{announcement.createdBy}</span><time>{announcement.date}</time></div>
                    <h4>{announcement.title}</h4>
                    <p>{announcement.content}</p>
                  </article>
                ))}
                {targetedAnnouncements.length === 0 && <div className="role-home-empty">אין כרגע הודעות חדשות.</div>}
              </div>
            </section>

          </>
        ) : (
          <>
            <section className="role-home-panel">
              <div className="role-home-panel-title"><Megaphone size={20} /><div><h3>הודעות המועדון</h3><p>פרסום, עריכה ומחיקה</p></div></div>
              <form onSubmit={saveClubAnnouncement} className="role-home-announcement-form">
                <input value={announcementTitle} onChange={event => setAnnouncementTitle(event.target.value)} placeholder="כותרת ההודעה" aria-label="כותרת הודעת מועדון" />
                <textarea value={announcementContent} onChange={event => setAnnouncementContent(event.target.value)} placeholder="תוכן ההודעה לכל חברי המועדון..." rows={3} aria-label="תוכן הודעת מועדון" />
                <div>
                  {editingAnnouncementId && <button type="button" className="secondary" onClick={() => { setEditingAnnouncementId(''); setAnnouncementTitle(''); setAnnouncementContent(''); }}>ביטול עריכה</button>}
                  <button type="submit" disabled={!announcementTitle.trim() || !announcementContent.trim()}><Megaphone size={16} /> {editingAnnouncementId ? 'שמירת עדכון' : 'פרסום למועדון'}</button>
                </div>
              </form>
              <div className="role-home-feed compact">
                {latestClubAnnouncements.map(announcement => (
                  <article key={announcement.id}>
                    <div><span>{announcement.createdBy} · {announcement.date}</span><span className="role-home-item-actions"><button type="button" onClick={() => startEditingAnnouncement(announcement)} aria-label="עריכת הודעה"><Edit3 size={14} /></button><button type="button" onClick={() => { if (window.confirm('למחוק את הודעת המועדון?')) onUpdateAnnouncements?.(announcements.filter(item => item.id !== announcement.id)); }} aria-label="מחיקת הודעה"><Trash2 size={14} /></button></span></div>
                    <h4>{announcement.title}</h4>
                    <p>{announcement.content}</p>
                  </article>
                ))}
                {latestClubAnnouncements.length === 0 && <div className="role-home-empty">עדיין לא פורסמו הודעות מועדון.</div>}
              </div>
            </section>
          </>
        )}
      </section>
    </section>
  );
};
