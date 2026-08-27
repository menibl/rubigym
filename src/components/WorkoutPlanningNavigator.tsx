import React from 'react';
import {
  ArrowRight,
  BookOpen,
  CalendarCheck,
  ChevronLeft,
  ClipboardList,
  CopyPlus,
  FileText,
  FolderOpen,
  Plus,
  Search,
  Sparkles,
  UserRound,
  UsersRound
} from 'lucide-react';
import { GroupWorkoutProgram, TrainingSession, User, WorkoutPlan } from '../types';

export type WorkoutPlanningRoute =
  | 'HOME'
  | 'PERSONAL'
  | 'PERSONAL_TRAINEE'
  | 'PERSONAL_SESSION'
  | 'PERSONAL_EXISTING'
  | 'GROUP'
  | 'GROUP_SESSION'
  | 'GROUP_AUDIENCE'
  | 'GROUP_EXISTING'
  | 'LIBRARY'
  | 'LIBRARY_NEW'
  | 'LIBRARY_EXISTING'
  | 'ASSIGN';

interface WorkoutPlanningNavigatorProps {
  route: WorkoutPlanningRoute;
  onRouteChange: (route: WorkoutPlanningRoute) => void;
  trainees: User[];
  sessions: TrainingSession[];
  workoutPlans: WorkoutPlan[];
  groupPrograms: GroupWorkoutProgram[];
  onOpenPersonalTrainee: (traineeId: string) => void;
  onOpenPersonalSession: (session: TrainingSession) => void;
  onOpenPersonalPlan: (plan: WorkoutPlan) => void;
  onOpenGroupSession: (session: TrainingSession) => void;
  onOpenGroupAudience: (audience: string) => void;
  onOpenGroupProgram: (program: GroupWorkoutProgram) => void;
  onOpenPdfLibrary: () => void;
  assignmentContent: React.ReactNode;
}

type Tile = {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number }>;
  onClick: () => void;
  tone?: 'gold' | 'indigo' | 'emerald' | 'slate';
};

const routeMeta: Record<WorkoutPlanningRoute, { title: string; description: string; parent?: WorkoutPlanningRoute }> = {
  HOME: { title: 'בניית תוכניות אימון', description: 'בחרו את סוג התכנון הרצוי' },
  PERSONAL: { title: 'תוכנית אימון אישית', description: 'בנייה למתאמן, לאימון אישי או למאגר', parent: 'HOME' },
  PERSONAL_TRAINEE: { title: 'בחירת מתאמן', description: 'בחרו למי לבנות או לעדכן תוכנית', parent: 'PERSONAL' },
  PERSONAL_SESSION: { title: 'אימון אישי מהיומן', description: 'בחרו אימון 1:1 שאליו תשובץ התוכנית', parent: 'PERSONAL' },
  PERSONAL_EXISTING: { title: 'תוכניות אישיות קיימות', description: 'פתיחה, עדכון ושימוש חוזר', parent: 'PERSONAL' },
  GROUP: { title: 'תוכנית אימון קבוצתית', description: 'בנייה לאימון ביומן, לקבוצה ייעודית או למאגר', parent: 'HOME' },
  GROUP_SESSION: { title: 'אימון קבוצתי מהיומן', description: 'בחרו אירוע קיים והנרשמים ייטענו אוטומטית', parent: 'GROUP' },
  GROUP_AUDIENCE: { title: 'קבוצה ייעודית', description: 'בחרו אוכלוסיית יעד לתוכנית החדשה', parent: 'GROUP' },
  GROUP_EXISTING: { title: 'תוכניות קבוצתיות קיימות', description: 'פתיחה, עדכון, שכפול ופרסום', parent: 'GROUP' },
  LIBRARY: { title: 'מאגר תוכניות האימון', description: 'יצירת תבניות ושימוש חוזר בתוכניות', parent: 'HOME' },
  LIBRARY_NEW: { title: 'יצירת תוכנית חדשה למאגר', description: 'בחרו את סוג התבנית', parent: 'LIBRARY' },
  LIBRARY_EXISTING: { title: 'עדכון תוכנית קיימת', description: 'בחרו תוכנית אישית או קבוצתית', parent: 'LIBRARY' },
  ASSIGN: { title: 'שיבוץ תוכנית לאימון ביומן', description: 'בחירת אימון, תוכנית ופרסום', parent: 'HOME' }
};

const TileGrid: React.FC<{ tiles: Tile[] }> = ({ tiles }) => (
  <div className="planning-tile-grid">
    {tiles.map(tile => {
      const Icon = tile.icon;
      return <button key={tile.title} type="button" className={`planning-nav-tile tone-${tile.tone || 'slate'}`} onClick={tile.onClick}>
        <span className="planning-nav-icon"><Icon size={27} /></span>
        <span className="planning-nav-copy"><strong>{tile.title}</strong><small>{tile.description}</small></span>
        <ChevronLeft size={18} className="planning-nav-arrow" />
      </button>;
    })}
  </div>
);

const SelectionList: React.FC<{
  children: React.ReactNode;
  empty: boolean;
  emptyText: string;
}> = ({ children, empty, emptyText }) => (
  <div className="planning-selection-list">
    {children}
    {empty && <div className="planning-empty"><Search size={28} /><strong>{emptyText}</strong><span>אפשר לחזור וליצור תוכנית חדשה.</span></div>}
  </div>
);

export const WorkoutPlanningNavigator: React.FC<WorkoutPlanningNavigatorProps> = ({
  route,
  onRouteChange,
  trainees,
  sessions,
  workoutPlans,
  groupPrograms,
  onOpenPersonalTrainee,
  onOpenPersonalSession,
  onOpenPersonalPlan,
  onOpenGroupSession,
  onOpenGroupAudience,
  onOpenGroupProgram,
  onOpenPdfLibrary,
  assignmentContent
}) => {
  const meta = routeMeta[route];
  const personalSessions = sessions.filter(session => session.isPersonalTraining)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const groupSessions = sessions.filter(session => !session.isPersonalTraining)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const personalTemplates = workoutPlans.filter(plan => !plan.sessionId && (plan.libraryEntry === true || plan.libraryEntry === undefined));
  const groupTemplates = groupPrograms.filter(program => !program.sessionId);

  const homeTiles: Tile[] = [
    { title: 'אימון חדש', description: 'בניית תוכנית אישית או קבוצתית חדשה', icon: Plus, tone: 'gold', onClick: () => onRouteChange('LIBRARY_NEW') },
    { title: 'בחירה ממאגר', description: 'טעינה, צפייה ויצירת גרסה חדשה לעריכה', icon: FolderOpen, tone: 'emerald', onClick: () => onRouteChange('LIBRARY_EXISTING') },
    { title: 'שיבוץ מהמאגר ליומן', description: 'שימוש בתוכנית בדיוק כפי שהיא באימון שנקבע', icon: CalendarCheck, tone: 'indigo', onClick: () => onRouteChange('ASSIGN') }
  ];

  const personalTiles: Tile[] = [
    { title: 'תוכנית למתאמן', description: 'בחירה לפי שם ונתוני המתאמן', icon: UserRound, tone: 'gold', onClick: () => onRouteChange('PERSONAL_TRAINEE') },
    { title: 'תוכנית לאימון ביומן', description: 'שיבוץ לאימון אישי שכבר נקבע', icon: CalendarCheck, tone: 'indigo', onClick: () => onRouteChange('PERSONAL_SESSION') },
    { title: 'תוכניות אישיות קיימות', description: 'עדכון תוכנית או יצירת גרסה חדשה', icon: BookOpen, tone: 'emerald', onClick: () => onRouteChange('PERSONAL_EXISTING') },
    { title: 'תבנית אישית למאגר', description: 'בחרו מתאמן בסיס והתאימו תבנית', icon: CopyPlus, tone: 'slate', onClick: () => onRouteChange('PERSONAL_TRAINEE') }
  ];

  const groupTiles: Tile[] = [
    { title: 'תוכנית לאימון ביומן', description: 'כולל טעינת הנרשמים מהאירוע', icon: CalendarCheck, tone: 'indigo', onClick: () => onRouteChange('GROUP_SESSION') },
    { title: 'תוכנית לקבוצה ייעודית', description: 'נשים, גברים, נערים וקבוצות מטרה', icon: UsersRound, tone: 'gold', onClick: () => onRouteChange('GROUP_AUDIENCE') },
    { title: 'תוכנית קבוצתית למאגר', description: 'יצירת תבנית חדשה לשימוש חוזר', icon: Plus, tone: 'emerald', onClick: () => onOpenGroupAudience('קבוצה חדשה') },
    { title: 'תוכניות קבוצתיות קיימות', description: 'עדכון, שכפול, מחיקה ופרסום', icon: ClipboardList, tone: 'slate', onClick: () => onRouteChange('GROUP_EXISTING') }
  ];

  return <section className="workout-planning-navigator" dir="rtl">
    <header className="planning-navigation-header">
      {meta.parent && <button type="button" onClick={() => onRouteChange(meta.parent!)}><ArrowRight size={18} /> חזרה</button>}
      <div><span><Sparkles size={16} /> תכנון חכם</span><h2>{meta.title}</h2><p>{meta.description}</p></div>
    </header>

    {route === 'HOME' && <TileGrid tiles={homeTiles} />}
    {route === 'PERSONAL' && <TileGrid tiles={personalTiles} />}
    {route === 'GROUP' && <TileGrid tiles={groupTiles} />}

    {route === 'LIBRARY' && <TileGrid tiles={[
      { title: 'יצירת תוכנית חדשה', description: 'אישית, קבוצתית או מתוך PDF', icon: Plus, tone: 'gold', onClick: () => onRouteChange('LIBRARY_NEW') },
      { title: 'עדכון תוכנית קיימת', description: 'חיפוש ופתיחת תוכנית מהמאגר', icon: ClipboardList, tone: 'indigo', onClick: () => onRouteChange('LIBRARY_EXISTING') },
      { title: 'ייבוא תוכנית מ־PDF', description: 'שימוש בקובצי המאמן כבסיס לתכנון', icon: FileText, tone: 'emerald', onClick: onOpenPdfLibrary },
      { title: 'שיבוץ מהמאגר ליומן', description: 'בחירת אירוע ושיבוץ עותק עצמאי', icon: CalendarCheck, tone: 'slate', onClick: () => onRouteChange('ASSIGN') }
    ]} />}

    {route === 'LIBRARY_NEW' && <TileGrid tiles={[
      { title: 'תבנית אישית חדשה', description: 'בחירת מתאמן בסיס ויצירה בעזרת הצ׳אט', icon: UserRound, tone: 'gold', onClick: () => onRouteChange('PERSONAL_TRAINEE') },
      { title: 'תבנית קבוצתית חדשה', description: 'אימון רציף או תחנות מתחלפות', icon: UsersRound, tone: 'indigo', onClick: () => onOpenGroupAudience('קבוצה חדשה') },
      { title: 'יצירה מתוך PDF', description: 'העלאת מסמך והכנת טיוטה לעריכה', icon: FileText, tone: 'emerald', onClick: onOpenPdfLibrary }
    ]} />}

    {route === 'PERSONAL_TRAINEE' && <SelectionList empty={trainees.length === 0} emptyText="לא נמצאו מתאמנים">
      {trainees.map(trainee => <button type="button" key={trainee.id} className="planning-selection-card" onClick={() => onOpenPersonalTrainee(trainee.id)}>
        <img src={trainee.imageUrl} alt="" /><span><strong>{trainee.name}</strong><small>{trainee.membershipType || 'ללא מסלול'} · גיל {trainee.age}</small></span><ChevronLeft size={18} />
      </button>)}
    </SelectionList>}

    {route === 'PERSONAL_SESSION' && <SelectionList empty={personalSessions.length === 0} emptyText="אין אימונים אישיים ביומן">
      {personalSessions.map(session => <button type="button" key={session.id} className="planning-selection-card" onClick={() => onOpenPersonalSession(session)}>
        <span className="planning-date-badge"><strong>{session.time}</strong><small>{session.date}</small></span><span><strong>{session.title}</strong><small>{trainees.find(item => item.id === (session.targetTraineeId || session.registeredUsers[0]))?.name || 'טרם נבחר מתאמן'}</small></span><ChevronLeft size={18} />
      </button>)}
    </SelectionList>}

    {(route === 'PERSONAL_EXISTING') && <SelectionList empty={personalTemplates.length === 0} emptyText="אין תוכניות אישיות במאגר">
      {personalTemplates.map(plan => <button type="button" key={plan.id} className="planning-selection-card" onClick={() => onOpenPersonalPlan(plan)}>
        <span className="planning-list-icon"><BookOpen size={20} /></span><span><strong>{plan.title || 'תוכנית אישית'}</strong><small>{trainees.find(item => item.id === plan.traineeId)?.name || 'תבנית כללית'} · {plan.exercises.length} תרגילים · טעינה כגרסה חדשה</small></span><ChevronLeft size={18} />
      </button>)}
    </SelectionList>}

    {route === 'GROUP_SESSION' && <SelectionList empty={groupSessions.length === 0} emptyText="אין אימונים קבוצתיים ביומן">
      {groupSessions.map(session => <button type="button" key={session.id} className="planning-selection-card" onClick={() => onOpenGroupSession(session)}>
        <span className="planning-date-badge"><strong>{session.time}</strong><small>{session.date}</small></span><span><strong>{session.title}</strong><small>{session.registeredUsers.length}/{session.maxParticipants} נרשמים</small></span><ChevronLeft size={18} />
      </button>)}
    </SelectionList>}

    {route === 'GROUP_AUDIENCE' && <TileGrid tiles={['שומרי משקל', 'נשים אחרי לידה', 'נשים', 'גברים', 'נערים', 'קבוצה מותאמת'].map((audience, index) => ({
      title: audience,
      description: index === 5 ? 'שם ומאפייני קבוצה לבחירת המאמן' : 'יצירת תבנית ייעודית חדשה',
      icon: UsersRound,
      tone: index % 2 ? 'indigo' : 'gold',
      onClick: () => onOpenGroupAudience(audience)
    }))} />}

    {route === 'GROUP_EXISTING' && <SelectionList empty={groupTemplates.length === 0} emptyText="אין תוכניות קבוצתיות במאגר">
      {groupTemplates.map(program => <button type="button" key={program.id} className="planning-selection-card" onClick={() => onOpenGroupProgram(program)}>
        <span className="planning-list-icon"><UsersRound size={20} /></span><span><strong>{program.title}</strong><small>{program.groupName} · {program.mode === 'ROTATING_GROUPS' ? 'תחנות מתחלפות' : 'רצף קבוצתי'} · טעינה כגרסה חדשה</small></span><ChevronLeft size={18} />
      </button>)}
    </SelectionList>}

    {route === 'LIBRARY_EXISTING' && <div className="space-y-5">
      <section><h3 className="planning-section-title">תוכניות אישיות</h3><SelectionList empty={personalTemplates.length === 0} emptyText="אין תוכניות אישיות במאגר">{personalTemplates.map(plan => <button type="button" key={plan.id} className="planning-selection-card" onClick={() => onOpenPersonalPlan(plan)}><span className="planning-list-icon"><UserRound size={20} /></span><span><strong>{plan.title || 'תוכנית אישית'}</strong><small>{trainees.find(item => item.id === plan.traineeId)?.name || 'תבנית כללית'} · {plan.exercises.length} תרגילים</small></span><ChevronLeft size={18} /></button>)}</SelectionList></section>
      <section><h3 className="planning-section-title">תוכניות קבוצתיות</h3><SelectionList empty={groupTemplates.length === 0} emptyText="אין תוכניות קבוצתיות במאגר">{groupTemplates.map(program => <button type="button" key={program.id} className="planning-selection-card" onClick={() => onOpenGroupProgram(program)}><span className="planning-list-icon"><UsersRound size={20} /></span><span><strong>{program.title}</strong><small>{program.groupName}</small></span><ChevronLeft size={18} /></button>)}</SelectionList></section>
    </div>}

    {route === 'ASSIGN' && <div className="planning-assignment-shell">{assignmentContent}</div>}
  </section>;
};
