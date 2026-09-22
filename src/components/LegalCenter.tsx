import React, { useEffect, useRef, useState } from 'react';
import { Cookie, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { SystemSettings } from '../types';

export type LegalDocumentId = 'privacy' | 'terms' | 'cookies' | 'refunds' | 'accessibility' | 'business';

const updatedAt = '22.09.2026';

const documents: Record<LegalDocumentId, { title: string; content: React.ReactNode }> = {
  privacy: {
    title: 'מדיניות פרטיות',
    content: <>
      <p>אנו אוספים רק מידע הדרוש להפעלת המועדון והאפליקציה: פרטי זיהוי וקשר, נתוני חברות ותשלום, הרשמות ונוכחות, הצהרות בריאות ומסמכים שהועלו, תוכניות אימון ותזונה, שיחות עם הצוות והעדפות התראה.</p>
      <h3>מטרות השימוש</h3><p>ניהול חברות ותשלומים, מתן שירות, התאמת אימונים, שמירה על בטיחות, שליחת הודעות תפעוליות, אבטחה ועמידה בחובות הדין. מידע רפואי נגיש רק לבעלי תפקידים הזקוקים לו.</p>
      <h3>שיתוף מידע</h3><p>מידע מועבר לספקים רק לצורך השירות: Google Cloud לאחסון ותפעול, רווחית/iCredit לתשלום והפקת מסמכים, Pulseem לשליחת SMS, שירותי Push של הדפדפן ו־OpenAI רק כאשר צוות מורשה מפעיל את עוזר התכנון. פרטי כרטיס מלאים אינם נשמרים באפליקציה.</p>
      <h3>שמירה וזכויות</h3><p>המידע נשמר כל עוד הוא דרוש לחברות, לשירות או לחובה חוקית. ניתן לפנות למועדון בבקשה לעיין, לתקן או למחוק מידע, בכפוף לחובות שמירה ולזכויות אחרות לפי דין.</p>
    </>
  },
  terms: {
    title: 'תנאי שימוש והצטרפות',
    content: <>
      <p>השימוש באפליקציה מיועד לחברי BALY WELLNESS ולצוות המורשה. יש למסור פרטים נכונים, לשמור על סודיות אמצעי הכניסה ולעדכן את המועדון במקרה של שימוש בלתי מורשה.</p>
      <h3>אימונים ובריאות</h3><p>השתתפות באימון כפופה למסלול פעיל, הרשמה מתאימה והצהרת בריאות תקפה. תוכניות אימון ותזונה הן הנחיה מקצועית כללית ואינן תחליף לייעוץ רפואי. במקרה של כאב, מגבלה או שינוי רפואי יש לעצור ולעדכן את הצוות.</p>
      <h3>הרשמה וביטול</h3><p>מקומות נשמרים לפי זמינות וכללי המועדון. ביטול מאוחר עשוי לחייב אימון או להירשם כאי־הגעה בהתאם לחלון הביטול המוצג במערכת ובהסכם המסלול.</p>
      <h3>קניין ושימוש הוגן</h3><p>התוכניות, התוכן והמדיה מיועדים לשימוש אישי של החבר ואין להפיץ אותם ללא אישור. המועדון רשאי לעדכן את השירות, ויעשה מאמץ סביר לשמור על זמינותו.</p>
    </>
  },
  cookies: {
    title: 'מדיניות קוקיז ואחסון מקומי',
    content: <>
      <p>האפליקציה משתמשת בעוגיית התחברות הכרחית ומאובטחת כדי לשמור את המשתמש מחובר. בנוסף נשמרות בדפדפן העדפות תצוגה, הסכמות, מצב תשלום זמני ונתונים הנדרשים להפעלת PWA ו־Push.</p>
      <h3>הכרחי מול אופציונלי</h3><p>עוגיות התחברות ואבטחה הכרחיות להפעלת החשבון ואינן ניתנות לכיבוי מתוך האפליקציה. נכון לעדכון מדיניות זו לא מופעל כלי אנליטיקה או פרסום צד שלישי. אם יתווסף כלי כזה, הוא לא יופעל לפני קבלת הסכמה מתאימה.</p>
      <p>ניתן למחוק נתונים מקומיים דרך הגדרות הדפדפן; פעולה זו עשויה לנתק את החשבון או לאפס העדפות.</p>
    </>
  },
  refunds: {
    title: 'מדיניות ביטולים והחזרים',
    content: <>
      <p>בקשת ביטול או החזר נבדקת לפי סוג המסלול, מועד הרכישה, שירותים שכבר נוצלו, תנאי ההתחייבות והוראות הדין. אין במדיניות זו כדי לגרוע מזכות קוגנטית המוקנית לצרכן.</p>
      <h3>איך מגישים בקשה</h3><p>פונים לרובי באלי בטלפון או WhatsApp ומציינים שם, מספר טלפון, מסלול וסיבת הבקשה. לאחר בדיקה יימסר אישור בכתב. החזר מאושר מבוצע לאמצעי התשלום המקורי ככל שניתן ומופיע ביומן העסקאות.</p>
      <h3>מסלולים מחזוריים וכרטיסיות</h3><p>ביטול הוראת קבע אינו מבטל אוטומטית חיובים שכבר בוצעו. מסלול עם התחייבות, הקפאה, כרטיסייה או אימון אישי כפוף לתנאים שהוצגו בעת הרכישה. שינוי מסלול עשוי ליצור הפרש לתשלום או החזר.</p>
    </>
  },
  accessibility: {
    title: 'הצהרת נגישות',
    content: <>
      <p>BALY WELLNESS פועל להנגשת האפליקציה, לרבות ניווט במקלדת, תוויות לטפסים, טקסט חלופי לתמונות משמעותיות, מוקדי פוקוס ברורים וניגודיות טקסט.</p>
      <p>אם נתקלתם בקושי, שלחו צילום מסך ותיאור הפעולה ל־WhatsApp של רובי באלי או התקשרו 054-6995885. נשתדל לספק חלופה נגישה ולטפל בפנייה בהקדם.</p>
      <p>רכז הנגישות: רובי באלי. עודכן לאחרונה: {updatedAt}.</p>
    </>
  },
  business: {
    title: 'פרטי העסק ויצירת קשר',
    content: <>
      <p><strong>שם מסחרי:</strong> BALY WELLNESS</p><p><strong>מנהל:</strong> רובי באלי</p><p><strong>טלפון:</strong> <a href="tel:+972546995885">054-6995885</a></p><p><strong>כתובת פעילות:</strong> מושב שילת</p>
      <p><a href="https://wa.me/972546995885" target="_blank" rel="noopener noreferrer">פתיחת שיחה ב־WhatsApp <ExternalLink size={14} className="inline" /></a></p>
    </>
  }
};

export const LegalDocumentModal: React.FC<{ documentId: LegalDocumentId | null; onClose: () => void; businessDetails?: SystemSettings['businessDetails'] }> = ({ documentId, onClose, businessDetails }) => {
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!documentId) return;
    closeButtonRef.current?.focus();
    const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [documentId, onClose]);
  if (!documentId) return null;
  const document = documentId === 'business' && businessDetails ? {
    title: documents.business.title,
    content: <><p><strong>שם העסק:</strong> {businessDetails.legalName || 'BALY WELLNESS'}</p>{businessDetails.registrationNumber && <p><strong>מספר עוסק / ח.פ.:</strong> {businessDetails.registrationNumber}</p>}<p><strong>איש קשר:</strong> {businessDetails.managerName || 'רובי באלי'}</p><p><strong>טלפון:</strong> {businessDetails.phone || '054-6995885'}</p>{businessDetails.email && <p><strong>דוא״ל:</strong> {businessDetails.email}</p>}<p><strong>כתובת:</strong> {businessDetails.address || 'מושב שילת'}</p></>
  } : documents[documentId];
  return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/75 p-4" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-amber-400/30 bg-[#f8f5ed] p-5 text-right text-slate-900 shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="legal-title" dir="rtl">
      <div className="sticky top-0 mb-4 flex items-center justify-between gap-3 border-b border-slate-300 bg-[#f8f5ed] pb-3">
        <div><h2 id="legal-title" className="text-xl font-black">{document.title}</h2><small className="text-slate-600">עודכן לאחרונה: {updatedAt}</small></div>
        <button ref={closeButtonRef} type="button" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-300 bg-white" aria-label="סגירת החלון"><X /></button>
      </div>
      <div className="legal-document space-y-3 text-sm leading-7 [&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-black [&_a]:font-bold [&_a]:text-blue-800">{document.content}</div>
    </section>
  </div>;
};

export const LegalLinks: React.FC<{ className?: string; businessDetails?: SystemSettings['businessDetails'] }> = ({ className = '', businessDetails }) => {
  const [open, setOpen] = useState<LegalDocumentId | null>(null);
  const links: Array<[LegalDocumentId, string]> = [['privacy', 'פרטיות'], ['terms', 'תנאי שימוש'], ['cookies', 'קוקיז'], ['refunds', 'ביטולים והחזרים'], ['accessibility', 'נגישות'], ['business', 'פרטי העסק']];
  return <><nav className={className} aria-label="מידע משפטי">{links.map(([id, label]) => <button type="button" key={id} onClick={() => setOpen(id)}>{label}</button>)}</nav><LegalDocumentModal documentId={open} onClose={() => setOpen(null)} businessDetails={businessDetails} /></>;
};

const consentKey = 'baly_cookie_consent_v1';

export const CookieConsentBanner: React.FC = () => {
  const [visible, setVisible] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  useEffect(() => { setVisible(!localStorage.getItem(consentKey)); }, []);
  const save = (value: 'necessary' | 'all') => {
    localStorage.setItem(consentKey, JSON.stringify({ value, updatedAt: new Date().toISOString(), analytics: false }));
    setVisible(false);
  };
  if (!visible) return <LegalDocumentModal documentId={showPolicy ? 'cookies' : null} onClose={() => setShowPolicy(false)} />;
  return <><aside className="fixed inset-x-3 bottom-3 z-[190] mx-auto max-w-3xl rounded-2xl border border-amber-400/50 bg-slate-950 p-4 text-right text-white shadow-2xl" dir="rtl" aria-label="בחירת קוקיז">
    <div className="flex items-start gap-3"><Cookie className="mt-1 shrink-0 text-amber-300" /><div><strong className="block text-sm">העדפות פרטיות וקוקיז</strong><p className="mt-1 text-xs leading-5 text-slate-300">אנו משתמשים בעוגיית התחברות ובאחסון מקומי הכרחי. כרגע אין באתר אנליטיקה או פרסום. אפשר לבחור בהכרחיים בלבד.</p></div></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-3"><button type="button" onClick={() => save('necessary')} className="min-h-11 rounded-xl border border-slate-600 px-3 text-xs font-black">הכרחיים בלבד</button><button type="button" onClick={() => save('all')} className="min-h-11 rounded-xl bg-amber-300 px-3 text-xs font-black text-slate-950">אישור הכול</button><button type="button" onClick={() => setShowPolicy(true)} className="min-h-11 rounded-xl text-xs font-bold text-amber-200 underline">למדיניות המלאה</button></div>
  </aside><LegalDocumentModal documentId={showPolicy ? 'cookies' : null} onClose={() => setShowPolicy(false)} /></>;
};

export const ComplianceNotice: React.FC = () => <div className="flex items-center gap-2 text-xs text-slate-500"><ShieldCheck size={15} /> פרטיות, אבטחה ונגישות הן חלק מהשירות.</div>;
