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
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  UsersRound
} from 'lucide-react';
import { GroupWorkoutProgram, TrainingSession, User, WorkoutPlan } from '../types';

export type WorkoutPlanningRoute =
  | 'HOME'
  | 'PERSONAL'
  | 'PERSONAL_TRAINEE'
  | 'PERSONAL_GENERAL'
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
  onOpenGeneralPersonal: (programName: string) => void;
  onOpenPersonalSession: (session: TrainingSession) => void;
  onOpenPersonalPlan: (plan: WorkoutPlan, traineeId?: string) => void;
  onOpenGroupSession: (session: TrainingSession) => void;
  onOpenGroupAudience: (audience: string) => void;
  onOpenGroupProgram: (program: GroupWorkoutProgram) => void;
  onDeletePersonalPlan: (plan: WorkoutPlan) => void;
  onDeleteGroupProgram: (program: GroupWorkoutProgram) => void;
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
  PERSONAL_GENERAL: { title: 'תוכנית אישית כללית', description: 'תוכנית בשם לבחירת המאמן, ללא שיוך למתאמן', parent: 'PERSONAL' },
  PERSONAL_SESSION: { title: 'אימון אישי מהיומן', description: 'בחרו אימון 1:1 שאליו תשובץ התוכנית', parent: 'PERSONAL' },
  PERSONAL_EXISTING: { title: 'תוכניות אישיות קיימות', description: 'פתיחה, עדכון ושימוש חוזר', parent: 'PERSONAL' },
  GROUP: { title: 'תוכנית אימון קבוצתית', description: 'בנייה לאימון ביומן, לקבוצה ייעודית או למאגר', parent: 'HOME' },
  GROUP_SESSION: { title: 'אימון קבוצתי מהיומן', description: 'בחרו אירוע קיים והנרשמים ייטענו אוטומטית', parent: 'GROUP' },
  GROUP_AUDIENCE: { title: 'קבוצה ייעודית', description: 'בחרו אוכלוסיית יעד לתוכנית החדשה', parent: 'GROUP' },
  GROUP_EXISTING: { title: 'תוכניות קבוצתיות קיימות', description: 'פתיחה, עדכון, שכפול ופרסום', parent: 'GROUP' },
  LIBRARY: { title: 'ניהול מאגר תוכניות האימון', description: 'הוספה, פתיחה לעריכה ומחיקת תוכניות במקום אחד', parent: 'HOME' },
  LIBRARY_NEW: { title: 'יצירת תוכנית חדשה למאגר', description: 'בחרו את סוג התבנית', parent: 'LIBRARY' },
  LIBRARY_EXISTING: { title: 'ניהול מאגר תוכניות האימון', description: 'הוספה, פתיחה לעריכה ומחיקת תוכניות במקום אחד', parent: 'HOME' },
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
  onOpenGeneralPersonal,
  onOpenPersonalSession,
  onOpenPersonalPlan,
  onOpenGroupSession,
  onOpenGroupAudience,
  onOpenGroupProgram,
  onDeletePersonalPlan,
  onDeleteGroupProgram,
  onOpenPdfLibrary,
  assignmentContent
}) => {
  const meta = routeMeta[route];
  const personalSessions = sessions.filter(session => session.isPersonalTraining)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const groupSessions = sessions.filter(session => !session.isPersonalTraining)
    .sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
  const personalExistingPlans = workoutPlans.filter(plan => !plan.sessionId && (plan.libraryEntry === true || plan.libraryEntry === undefined));
  const groupExistingPrograms = groupPrograms.filter(program => !program.sessionId);
  const personalTemplates = workoutPlans.filter(plan => !plan.sessionId && plan.libraryEntry === true);
  const groupTemplates = groupPrograms.filter(program => !program.sessionId && program.libraryEntry === true);
  const [libraryKind, setLibraryKind] = React.useState<'ALL' | 'PERSONAL' | 'GROUP'>('ALL');
  const [libraryQuery, setLibraryQuery] = React.useState('');
  const [libraryCreatedDate, setLibraryCreatedDate] = React.useState('');
  const [libraryTargetTraineeId, setLibraryTargetTraineeId] = React.useState(trainees[0]?.id || '');
  const [generalPersonalName, setGeneralPersonalName] = React.useState('');
  const normalizedLibraryQuery = libraryQuery.trim().toLocaleLowerCase('he-IL');
  const visiblePersonalTemplates = personalTemplates
    .filter(plan => !libraryCreatedDate || (plan.libraryCreatedAt || plan.lastUpdated).slice(0, 10) === libraryCreatedDate)
    .filter(plan => !normalizedLibraryQuery || `${plan.title || ''} ${trainees.find(item => item.id === plan.traineeId)?.name || ''}`.toLocaleLowerCase('he-IL').includes(normalizedLibraryQuery))
    .sort((a, b) => (b.libraryCreatedAt || b.lastUpdated).localeCompare(a.libraryCreatedAt || a.lastUpdated));
  const visibleGroupTemplates = groupTemplates
    .filter(program => !libraryCreatedDate || (program.createdAt || program.updatedAt).slice(0, 10) === libraryCreatedDate)
    .filter(program => !normalizedLibraryQuery || `${program.title} ${program.groupName}`.toLocaleLowerCase('he-IL').includes(normalizedLibraryQuery))
    .sort((a, b) => (b.createdAt || b.updatedAt).localeCompare(a.createdAt || a.updatedAt));

  const homeTiles: Tile[] = [
    { title: 'אימון חדש', description: 'בניית תוכנית אישית או קבוצתית חדשה', icon: Plus, tone: 'gold', onClick: () => onRouteChange('LIBRARY_NEW') },
    { title: 'ניהול מאגר האימונים', description: 'הוספה, עריכה, מחיקה ושימוש חוזר', icon: FolderOpen, tone: 'emerald', onClick: () => onRouteChange('LIBRARY') },
    { title: 'שיבוץ מהמאגר ליומן', description: 'שימוש בתוכנית בדיוק כפי שהיא באימון שנקבע', icon: CalendarCheck, tone: 'indigo', onClick: () => onRouteChange('ASSIGN') }
  ];

  const personalTiles: Tile[] = [
    { title: 'תוכנית למתאמן', description: 'בחירה לפי שם ונתוני המתאמן', icon: UserRound, tone: 'gold', onClick: () => onRouteChange('PERSONAL_TRAINEE') },
    { title: 'תוכנית אישית כללית', description: 'בנייה לפי שם, גם ללא מתאמן רשום', icon: CopyPlus, tone: 'emerald', onClick: () => onRouteChange('PERSONAL_GENERAL') },
    { title: 'תוכנית לאימון ביומן', description: 'שיבוץ לאימון אישי שכבר נקבע', icon: CalendarCheck, tone: 'indigo', onClick: () => onRouteChange('PERSONAL_SESSION') },
    { title: 'בחירת תוכנית מהמאגר', description: 'טעינת כל ההגדרות ומעבר ישיר לעריכה', icon: BookOpen, tone: 'emerald', onClick: () => onRouteChange('LIBRARY') },
    { title: 'תבנית אישית למאגר', description: 'יצירת תוכנית כללית חדשה בשם', icon: CopyPlus, tone: 'slate', onClick: () => onRouteChange('PERSONAL_GENERAL') }
  ];

  const groupTiles: Tile[] = [
    { title: 'תוכנית לאימון ביומן', description: 'כולל טעינת הנרשמים מהאירוע', icon: CalendarCheck, tone: 'indigo', onClick: () => onRouteChange('GROUP_SESSION') },
    { title: 'תוכנית לקבוצה ייעודית', description: 'נשים, גברים, נערים וקבוצות מטרה', icon: UsersRound, tone: 'gold', onClick: () => onRouteChange('GROUP_AUDIENCE') },
    { title: 'תוכנית קבוצתית למאגר', description: 'יצירת תבנית חדשה לשימוש חוזר', icon: Plus, tone: 'emerald', onClick: () => onOpenGroupAudience('קבוצה חדשה') },
    { title: 'בחירת תוכנית מהמאגר', description: 'טעינת כל ההגדרות ומעבר ישיר לעריכה', icon: ClipboardList, tone: 'slate', onClick: () => onRouteChange('LIBRARY') }
  ];

  return <section className="workout-planning-navigator" dir="rtl">
    <header className="planning-navigation-header">
      {meta.parent && <button type="button" onClick={() => onRouteChange(meta.parent!)}><ArrowRight size={18} /> חזרה</button>}
      <div><span><Sparkles size={16} /> תכנון חכם</span><h2>{meta.title}</h2><p>{meta.description}</p></div>
    </header>

    {route === 'HOME' && <TileGrid tiles={homeTiles} />}
    {route === 'PERSONAL' && <TileGrid tiles={personalTiles} />}
    {route === 'GROUP' && <TileGrid tiles={groupTiles} />}

    {route === 'LIBRARY_NEW' && <TileGrid tiles={[
      { title: 'תבנית אישית חדשה', description: 'יצירה כללית בשם בעזרת הצ׳אט, ללא מתאמן', icon: UserRound, tone: 'gold', onClick: () => onRouteChange('PERSONAL_GENERAL') },
      { title: 'תבנית קבוצתית חדשה', description: 'אימון רציף או תחנות מתחלפות', icon: UsersRound, tone: 'indigo', onClick: () => onOpenGroupAudience('קבוצה חדשה') },
      { title: 'יצירה מתוך PDF', description: 'העלאת מסמך והכנת טיוטה לעריכה', icon: FileText, tone: 'emerald', onClick: onOpenPdfLibrary }
    ]} />}

    {route === 'PERSONAL_TRAINEE' && <SelectionList empty={trainees.length === 0} emptyText="לא נמצאו מתאמנים">
      {trainees.map(trainee => <button type="button" key={trainee.id} className="planning-selection-card" onClick={() => onOpenPersonalTrainee(trainee.id)}>
        <img src={trainee.imageUrl} alt="" /><span><strong>{trainee.name}</strong><small>{trainee.membershipType || 'ללא מסלול'} · גיל {trainee.age}</small></span><ChevronLeft size={18} />
      </button>)}
    </SelectionList>}

    {route === 'PERSONAL_GENERAL' && <form className="planning-general-personal-form" onSubmit={event => {
      event.preventDefault();
      const name = generalPersonalName.trim();
      if (!name) return;
      onOpenGeneralPersonal(name);
    }}>
      <div>
        <CopyPlus size={24} />
        <span><strong>שם התוכנית האישית הכללית</strong><small>התוכנית תיבנה בעזרת הצ׳אט ותישמר במאגר ללא שיוך למתאמן.</small></span>
      </div>
      <label>
        <span>שם התוכנית</span>
        <input autoFocus required maxLength={80} value={generalPersonalName} onChange={event => setGeneralPersonalName(event.target.value)} placeholder="לדוגמה: תוכנית כוח למתחילים – 3 ימים" />
      </label>
      <button type="submit" disabled={!generalPersonalName.trim()}>המשך לבניית התוכנית <ChevronLeft size={18} /></button>
    </form>}

    {route === 'PERSONAL_SESSION' && <SelectionList empty={personalSessions.length === 0} emptyText="אין אימונים אישיים ביומן">
      {personalSessions.map(session => <button type="button" key={session.id} className="planning-selection-card" onClick={() => onOpenPersonalSession(session)}>
        <span className="planning-date-badge"><strong>{session.time}</strong><small>{session.date}</small></span><span><strong>{session.title}</strong><small>{session.demoTraineeName || trainees.find(item => item.id === (session.targetTraineeId || session.registeredUsers[0]))?.name || 'טרם נבחר מתאמן'}</small></span><ChevronLeft size={18} />
      </button>)}
    </SelectionList>}

    {(route === 'PERSONAL_EXISTING') && <SelectionList empty={personalExistingPlans.length === 0} emptyText="אין תוכניות אישיות קיימות">
      {personalExistingPlans.map(plan => <button type="button" key={plan.id} className="planning-selection-card" onClick={() => onOpenPersonalPlan(plan)}>
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

    {route === 'GROUP_EXISTING' && <SelectionList empty={groupExistingPrograms.length === 0} emptyText="אין תוכניות קבוצתיות קיימות">
      {groupExistingPrograms.map(program => <button type="button" key={program.id} className="planning-selection-card" onClick={() => onOpenGroupProgram(program)}>
        <span className="planning-list-icon"><UsersRound size={20} /></span><span><strong>{program.title}</strong><small>{program.groupName} · {program.mode === 'ROTATING_GROUPS' ? 'תחנות מתחלפות' : 'רצף קבוצתי'} · טעינה כגרסה חדשה</small></span><ChevronLeft size={18} />
      </button>)}
    </SelectionList>}

    {(route === 'LIBRARY' || route === 'LIBRARY_EXISTING') && <div className="planning-library-manager">
      <div className="planning-library-actions">
        <button type="button" onClick={() => onRouteChange('PERSONAL_GENERAL')}><Plus size={18} /><span><strong>הוסף תוכנית אישית כללית</strong><small>שם, צ׳אט ובנייה חדשה ללא מתאמן</small></span></button>
        <button type="button" onClick={() => onRouteChange('GROUP_AUDIENCE')}><Plus size={18} /><span><strong>הוסף תוכנית קבוצתית</strong><small>קבוצה, תחנות וזמנים</small></span></button>
      </div>
      <div className="planning-library-shortcuts">
        <button type="button" onClick={onOpenPdfLibrary}><FileText size={16} /> ייבוא תוכנית מ־PDF</button>
        <button type="button" onClick={() => onRouteChange('ASSIGN')}><CalendarCheck size={16} /> שיבוץ תוכנית ליומן</button>
      </div>
      <div className="planning-library-toolbar">
        <label><Search size={17} /><input value={libraryQuery} onChange={event => setLibraryQuery(event.target.value)} placeholder="חיפוש לפי שם אימון או מתאמן" /></label>
        <label className="planning-library-date-filter"><CalendarCheck size={17} /><input type="date" value={libraryCreatedDate} onChange={event => setLibraryCreatedDate(event.target.value)} aria-label="סינון לפי תאריך יצירה" /></label>
        <div>{([
          ['ALL', `הכול (${personalTemplates.length + groupTemplates.length})`],
          ['PERSONAL', `אישי (${personalTemplates.length})`],
          ['GROUP', `קבוצתי (${groupTemplates.length})`]
        ] as const).map(([kind, label]) => <button key={kind} type="button" className={libraryKind === kind ? 'active' : ''} onClick={() => setLibraryKind(kind)}>{label}</button>)}</div>
      </div>

      {(libraryKind === 'ALL' || libraryKind === 'PERSONAL') && <section className="planning-library-section">
        <div className="planning-library-section-title"><h3><UserRound size={18} /> תוכניות אישיות</h3><label>מתאמן יעד<select value={libraryTargetTraineeId} onChange={event => setLibraryTargetTraineeId(event.target.value)}>{trainees.map(trainee => <option key={trainee.id} value={trainee.id}>{trainee.name}</option>)}</select></label></div>
        <div className="planning-library-grid">
          {visiblePersonalTemplates.map(plan => <article key={plan.id} className="planning-library-card">
            <button type="button" className="planning-library-open" disabled={!libraryTargetTraineeId} onClick={() => onOpenPersonalPlan(plan, libraryTargetTraineeId)}>
              <span className="planning-list-icon"><UserRound size={20} /></span><span><strong>{plan.title || 'תוכנית אישית'}</strong><small>{trainees.find(item => item.id === plan.traineeId)?.name || 'תבנית כללית'} · {plan.trainingDaysPerWeek || 1} ימים · {plan.exercises.length} תרגילים</small></span><Pencil size={17} />
            </button>
            <button type="button" className="planning-library-delete" onClick={() => onDeletePersonalPlan(plan)} aria-label={`מחיקת ${plan.title || 'תוכנית אישית'}`}><Trash2 size={16} /> מחיקה</button>
          </article>)}
          {visiblePersonalTemplates.length === 0 && <div className="planning-library-empty">לא נמצאו תוכניות אישיות במאגר.</div>}
        </div>
      </section>}

      {(libraryKind === 'ALL' || libraryKind === 'GROUP') && <section className="planning-library-section">
        <h3><UsersRound size={18} /> תוכניות קבוצתיות</h3>
        <div className="planning-library-grid">
          {visibleGroupTemplates.map(program => <article key={program.id} className="planning-library-card">
            <button type="button" className="planning-library-open" onClick={() => onOpenGroupProgram(program)}>
              <span className="planning-list-icon"><UsersRound size={20} /></span><span><strong>{program.title || 'תוכנית קבוצתית'}</strong><small>{program.groupName} · {program.mode === 'ROTATING_GROUPS' ? `${program.stations?.length || 0} תחנות` : `${program.exercises.length} תרגילים`} · {program.roundsPerStation || 1} סבבים</small></span><Pencil size={17} />
            </button>
            <button type="button" className="planning-library-delete" onClick={() => onDeleteGroupProgram(program)} aria-label={`מחיקת ${program.title || 'תוכנית קבוצתית'}`}><Trash2 size={16} /> מחיקה</button>
          </article>)}
          {visibleGroupTemplates.length === 0 && <div className="planning-library-empty">לא נמצאו תוכניות קבוצתיות במאגר.</div>}
        </div>
      </section>}
    </div>}

    {route === 'ASSIGN' && <div className="planning-assignment-shell">{assignmentContent}</div>}
  </section>;
};
