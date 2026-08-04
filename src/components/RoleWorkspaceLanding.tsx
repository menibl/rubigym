import React from 'react';
import {
  CalendarCheck,
  ChevronLeft,
  ClipboardList,
  CreditCard,
  Dumbbell,
  Settings2,
  UserRound
} from 'lucide-react';
import { User, UserRole } from '../types';

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

export const RoleWorkspaceLanding: React.FC<RoleWorkspaceLandingProps> = ({ activeUser, onSelect }) => {
  const views: WorkspaceView[] = activeUser.role === UserRole.MANAGER
    ? ['CLUB_MANAGEMENT', 'TRAINING', 'WORKOUT_PLANNING']
    : activeUser.role === UserRole.COACH
      ? ['TRAINING', 'WORKOUT_PLANNING']
      : ['BOOKING', 'MY_PROGRAM', 'MY_ACCOUNT'];

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
    </section>
  );
};
