import React from 'react';
import {
  ArrowLeft,
  ArrowUpLeft,
  Check,
  ChevronDown,
  Clock3,
  Dumbbell,
  HeartPulse,
  KeyRound,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Target,
  UserPlus,
  UsersRound
} from 'lucide-react';
import clubHero from '../assets/baly-club-hero.png';
import personalCoaching from '../assets/baly-personal-coaching.png';
import { MembershipPlanConfig, MembershipType } from '../types';
import { RubisLogo } from './RubisLogo';

interface PublicLandingPageProps {
  plans: MembershipPlanConfig[];
  heroImageUrl?: string | null;
  coachingImageUrl?: string | null;
  onLogin: () => void;
  onRegister: (plan?: MembershipType) => void;
}

const featuredPlanOrder: MembershipType[] = [
  MembershipType.CORE_GROUPS,
  MembershipType.OPEN_GYM,
  MembershipType.PERSONAL_TRAINING,
  MembershipType.YOUTH_TWICE_WEEKLY
];

const planIcons: Partial<Record<MembershipType, React.ReactNode>> = {
  [MembershipType.CORE_GROUPS]: <UsersRound size={24} />,
  [MembershipType.OPEN_GYM]: <Dumbbell size={24} />,
  [MembershipType.PERSONAL_TRAINING]: <Target size={24} />,
  [MembershipType.YOUTH_TWICE_WEEKLY]: <Sparkles size={24} />
};

export const PublicLandingPage: React.FC<PublicLandingPageProps> = ({ plans, heroImageUrl, coachingImageUrl, onLogin, onRegister }) => {
  const preferredPlans = featuredPlanOrder
    .map(type => plans.find(plan => plan.id === type))
    .filter((plan): plan is MembershipPlanConfig => Boolean(plan));
  const featuredPlans = [
    ...preferredPlans,
    ...plans.filter(plan => !preferredPlans.some(featured => featured.id === plan.id))
  ].slice(0, 4);

  const scrollTo = (id: string) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <main className="landing-page" dir="rtl">
      <header className="landing-header">
        <a className="landing-logo" href="#top" onClick={scrollTo('top')} aria-label="BALY Wellness — חזרה לראש הדף">
          <RubisLogo size={112} />
        </a>
        <nav className="landing-nav" aria-label="ניווט ראשי">
          <a href="#club" onClick={scrollTo('club')}>המועדון</a>
          <a href="#tracks" onClick={scrollTo('tracks')}>מסלולים</a>
          <a href="#rubi" onClick={scrollTo('rubi')}>על רובי</a>
          <a href="#contact" onClick={scrollTo('contact')}>יצירת קשר</a>
        </nav>
        <div className="landing-header-actions">
          <button className="landing-login-link" onClick={onLogin}><KeyRound size={16} /> כניסה</button>
          <button className="landing-button landing-button-small" onClick={() => onRegister()}><UserPlus size={16} /> להרשמה</button>
        </div>
      </header>

      <section className="landing-hero" id="top">
        <img src={heroImageUrl || clubHero} alt="תמונת אווירה של אימון קבוצתי בסטודיו כושר בוטיק" />
        <div className="landing-hero-shade" />
        <div className="landing-hero-content">
          <div className="landing-eyebrow"><MapPin size={16} /> מושב שילת · מועדון כושר בוטיק</div>
          <h1>לא עוד חדר כושר.<br /><span>מקום שמכיר אותך.</span></h1>
          <p>אימוני כוח, קבוצות, Open Gym וליווי אישי — בסביבה מקצועית, אינטימית ומדויקת למטרות שלך.</p>
          <div className="landing-hero-actions">
            <button className="landing-button" onClick={() => onRegister()}><UserPlus size={19} /> מתחילים להתאמן <ArrowLeft size={18} /></button>
            <a className="landing-outline-button" href="#tracks" onClick={scrollTo('tracks')}>למסלולי האימון <ChevronDown size={18} /></a>
          </div>
          <div className="landing-hero-proof">
            <span><Check size={15} /> התאמה אישית</span>
            <span><Check size={15} /> יחס בגובה העיניים</span>
            <span><Check size={15} /> אפליקציה לניהול האימונים</span>
          </div>
        </div>
        <aside className="landing-location-card">
          <MapPin size={23} />
          <div><small>קרוב לבית, רחוק מההמולה</small><strong>BALY Wellness · מושב שילת</strong></div>
        </aside>
      </section>

      <section className="landing-intro landing-section" id="club">
        <div className="landing-section-heading">
          <span>הדרך שלנו</span>
          <h2>מועדון קטן בכוונה.<br />יחס אישי כחלק מהאימון.</h2>
        </div>
        <div className="landing-intro-copy">
          <p>BALY הוא מועדון לאנשים שרוצים להתאמן נכון, להתקדם בעקביות ולהרגיש שיש מי שרואה אותם. לא הולכים לאיבוד בין מכשירים — מקבלים מסגרת, הכוונה וקשר ישיר עם הצוות.</p>
          <a href="#rubi" onClick={scrollTo('rubi')}>להכיר את רובי <ArrowUpLeft size={17} /></a>
        </div>
      </section>

      <section className="landing-benefits landing-section" aria-label="יתרונות המועדון">
        <article><span><Target size={22} /></span><h3>מתחילים מהמטרה שלך</h3><p>מתאימים את המסלול, הקצב וסוג האימון לנקודת הפתיחה וליעד האישי.</p></article>
        <article><span><ShieldCheck size={22} /></span><h3>מקצועיות לפני הכול</h3><p>דגש על טכניקה, עבודה מבוקרת והתקדמות שאפשר להתמיד בה לאורך זמן.</p></article>
        <article><span><MessageCircle size={22} /></span><h3>תמיד יש עם מי לדבר</h3><p>קשר אישי וישיר, משוב אמיתי ומענה כשצריך לדייק או לשנות כיוון.</p></article>
        <article><span><HeartPulse size={22} /></span><h3>כושר שמתאים לחיים</h3><p>מעטפת שמחברת בין אימון, הרגלים ובריאות — בלי רעש ובלי קיצורי דרך.</p></article>
      </section>

      <section className="landing-tracks landing-section" id="tracks">
        <div className="landing-section-heading landing-section-heading-center">
          <span>המסלולים שלנו</span>
          <h2>בוחרים את הדרך שנכונה לך</h2>
          <p>כל המסלולים מתחברים לאותה מעטפת מקצועית ולאפליקציית BALY.</p>
        </div>
        <div className="landing-plan-grid">
          {featuredPlans.map((plan, index) => (
            <article className={index === 0 ? 'featured' : ''} key={plan.id}>
              {index === 0 && <b className="landing-plan-badge">מסלול מרכזי</b>}
              <span className="landing-plan-icon">{planIcons[plan.id as MembershipType] || <Dumbbell size={24} />}</span>
              <small>מסלול {String(index + 1).padStart(2, '0')}</small>
              <h3>{plan.label}</h3>
              <p>{plan.description}</p>
              <button onClick={() => onRegister(plan.id as MembershipType)}>בחירת המסלול <ArrowLeft size={17} /></button>
            </article>
          ))}
        </div>
        <p className="landing-tracks-note">מחפשים אימון זוגי, ליווי תזונתי או מסלול משפחתי? כל האפשרויות מחכות בתהליך ההרשמה.</p>
      </section>

      <section className="landing-rubi landing-section" id="rubi">
        <div className="landing-rubi-image">
          <img src={coachingImageUrl || personalCoaching} alt="תמונת אווירה המדגימה ליווי אישי ותיקון טכניקה באימון" loading="lazy" />
          <span>תמונת אווירה · ליווי אישי במועדון</span>
        </div>
        <div className="landing-rubi-copy">
          <span className="landing-eyebrow">האדם שמאחורי המועדון</span>
          <h2>רובי באלי.<br />מקצועיות שמתחילה בהקשבה.</h2>
          <p>רובי, מנהל המועדון, מביא אל רצפת האימון גישה מקצועית, עין לפרטים ויכולת לפגוש כל מתאמן במקום שבו הוא נמצא. מבחינתו, תוכנית טובה מתחילה בהיכרות אמיתית — עם המטרות, הקצב, היכולות וגם עם החיים שמחוץ למועדון.</p>
          <p>הדרך המקצועית שלו מורגשת בכל אימון: בבחירת התרגילים, בדיוק הטכניקה, במעקב אחר ההתקדמות וביחס אישי שלא מסתיים כשנגמרת השעה.</p>
          <div className="landing-rubi-principle"><small>העיקרון שמוביל את העבודה</small><strong>לא רק לסיים עוד אימון — לבנות דרך שאפשר לחיות איתה ולהתקדם בה.</strong></div>
          <div className="landing-rubi-values">
            <span><Check size={16} /> היכרות אישית</span>
            <span><Check size={16} /> מעקב והכוונה</span>
            <span><Check size={16} /> תקשורת ישירה</span>
          </div>
        </div>
      </section>

      <section className="landing-app landing-section">
        <div>
          <span className="landing-eyebrow">המועדון ממשיך איתך גם מחוץ לאימון</span>
          <h2>כל מה שצריך,<br />באפליקציה אחת.</h2>
          <p>נרשמים לאימונים, מנהלים את המסלול, עוקבים אחרי התוכנית ונשארים בקשר ישיר עם צוות המועדון.</p>
        </div>
        <div className="landing-app-features">
          <span><Clock3 size={20} /><b>הרשמה נוחה</b><small>לאימונים ולמערכת השעות</small></span>
          <span><Dumbbell size={20} /><b>התוכנית שלך</b><small>מסודרת ונגישה בכל זמן</small></span>
          <span><MessageCircle size={20} /><b>קשר ישיר</b><small>עם צוות המועדון</small></span>
        </div>
      </section>

      <section className="landing-cta landing-section" id="contact">
        <RubisLogo size={134} />
        <span>זה הזמן שלך להתחיל</span>
        <h2>מוכנים למצוא את המסלול שלכם?</h2>
        <p>הצטרפו ל־BALY במושב שילת והתחילו להתאמן עם מסגרת, מקצועיות ויחס אישי.</p>
        <div className="landing-hero-actions">
          <button className="landing-button" onClick={() => onRegister()}><UserPlus size={18} /> הרשמה למועדון</button>
          <button className="landing-outline-button" onClick={onLogin}><KeyRound size={18} /> כבר חברים? כניסה</button>
        </div>
        <div className="landing-contact-row">
          <a href="tel:+972546995885" dir="ltr">054-6995885</a>
          <i />
          <a href="https://wa.me/972546995885" target="_blank" rel="noopener noreferrer"><MessageCircle size={17} /> WhatsApp לרובי</a>
          <i />
          <span><MapPin size={17} /> מושב שילת</span>
        </div>
      </section>

      <footer className="landing-footer">
        <span>© {new Date().getFullYear()} BALY Wellness</span>
        <span>מועדון כושר, כוח ו־Wellness במושב שילת</span>
      </footer>
    </main>
  );
};
