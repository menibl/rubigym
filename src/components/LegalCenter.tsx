import React, { useEffect, useRef, useState } from 'react';
import { Cookie, ExternalLink, ShieldCheck, X } from 'lucide-react';
import { SystemSettings } from '../types';

export type LegalDocumentId = 'privacy' | 'terms' | 'cookies' | 'refunds' | 'accessibility' | 'business';

const updatedAt = '02.11.2026';

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
      <h3>שימוש בטוח וסביר במתקני המועדון</h3>
      <p>כל מתאמן אחראי להתנהגותו ולשימוש זהיר וסביר בציוד, בהתאם לייעודו, להוראות היצרן ולהנחיות הצוות. אין לבצע שימוש מסוכן או לא מורשה, להסיר אמצעי בטיחות, לשנות ציוד או לסכן מתאמנים אחרים. לפני שימוש בציוד שאינו מוכר יש לבקש הדרכה; יש לבחור עומס המתאים ליכולת ולהפסיק שימוש בציוד שנראה פגום ולדווח לצוות מיד.</p>
      <p>יש למסור הצהרת בריאות נכונה ולעדכן בשינוי מהותי במצב הבריאותי. אין להתאמן תחת השפעת אלכוהול או חומר הפוגע בערנות ובשליטה. פעילות קטינים כפופה להסכמת הורה או אפוטרופוס ולהדרכה ולהשגחה הנדרשות לפי דין.</p>
      <p>נזק הנובע ממעשה מכוון, שימוש בלתי סביר או הפרת הנחיות בטיחות ייבחן בהתאם לנסיבות ולאחריות הקבועה בדין, ולא יקים חיוב אוטומטי. אין בתנאים אלה ויתור על זכויות בשל נזק גוף או פטור למועדון או לצוות מאחריות לרשלנות, לתחזוקה, לבטיחות או לכל חובה שלא ניתן להתנות עליה לפי דין.</p>
      <h3>הרשמה וביטול</h3><p>מקומות נשמרים לפי זמינות וכללי המועדון. ביטול מאוחר עשוי לחייב אימון או להירשם כאי־הגעה בהתאם לחלון הביטול המוצג במערכת ובהסכם המסלול.</p>
      <p>הוראות ביטול מנוי שנתי, חודש ההודעה המוקדמת והקפאה מפורטות במדיניות הביטולים וההחזרים הזמינה בתחתית האפליקציה גם לאחר התחברות.</p>
      <h3>קניין ושימוש הוגן</h3><p>התוכניות, התוכן והמדיה מיועדים לשימוש אישי של החבר ואין להפיץ אותם ללא אישור. המועדון רשאי לעדכן את השירות, ויעשה מאמץ סביר לשמור על זמינותו.</p>
      <h3>תנאים קיימים וזכויות לפי דין</h3><p>הצגת נוסח מעודכן אינה מהווה הסכמה בשם המשתמש לתנאי תשלום חדשים ואינה משנה בדיעבד עסקה קיימת. שינוי מהותי בתנאי התקשרות יימסר כנדרש, ותתקבל הסכמה ככל שנדרשת בדין. במקרה של סתירה להוראת דין שלא ניתן להתנות עליה, הוראת הדין גוברת.</p>
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
      <h3>איך מגישים בקשה</h3><p>ניתן להגיש בקשת ביטול דרך המנוי באפליקציה, לפנות לרובי באלי בטלפון 054-6995885 או ב־WhatsApp, או בכל דרך נוספת שהדין מחייב לאפשר, לרבות פנייה בכתב לכתובת העסק המופיעה בפרטי העסק. יש לציין שם, פרטי קשר והמסלול המבוטל; אין חובה לנמק ביטול מכוח זכות שבדין. המועדון יתעד את מועד קבלת ההודעה וישלח אישור בכתב; זכות ביטול כדין אינה מותנית באישור מנהל. החזר יבוצע במועד ובאופן הקבועים בדין.</p>
      <h3>ביטול מנוי שנתי — חודש הודעה מוקדמת</h3><p><strong>במסלול שנתי הביטול נכנס לתוקף בתום חודש ממסירת הודעת הביטול. במהלך חודש ההודעה המוקדמת המנוי נשאר זמין ונדרש תשלום עבור תקופה זו, בהתאם לתנאי המסלול ולהוראות הדין.</strong> זהו תשלום עבור תקופת ההודעה, ולא קנס נוסף או חודש נוסף מעבר לה. סכומים שכבר שולמו עבור אותה תקופה יובאו בחשבון ולא ייגבו פעמיים. חיוב או החזר יחסי ייבדקו לפי הדין; אין באמור דרישה לשלם את כל יתרת השנה.</p>
      <p>זכויות ביטול בעסקת מכר מרחוק ובתקופות הביטול שבדין, לרבות זכות לתנאים מיטיבים, נשמרות. דמי ביטול, ככל שמותרים, ייגבו רק לפי התנאים, הגילוי מראש והתקרות שבדין — ולא אוטומטית מכוח נוסח זה.</p>
      <h3>הקפאת מנוי</h3><p><strong>הטבת ההקפאה הרגילה היא חודש אחד רצוף בלבד, פעם אחת בכל 12 חודשים, בבקשה מראש ובאישור המנהל.</strong> בזמן ההקפאה לא ניתן להירשם לאימונים. עצם הגשת בקשה אינה מקפיאה את המנוי. ההקפאה אינה מקנה במערכת החזר או הארכת תוקף אוטומטיים; יש לברר מראש את ההשלכות עם המנהל, בלי לגרוע מזכות אחרת לפי דין או מתנאי מסלול מיטיבים.</p>
      <p>הקפאה באפליקציה אינה עוצרת או מפחיתה אוטומטית חיוב ברווחית. שינוי בהוראת קבע מחייב טיפול ותיעוד מול רווחית בידי המועדון. בהוראה משפחתית מאוחדת יש להסדיר את חלקו של בן המשפחה בלי לבטל בטעות את ההוראה של האחרים.</p>
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
  const dialogRef = useRef<HTMLElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!documentId) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const controls = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], [tabindex="0"]')];
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', close);
    return () => {
      window.removeEventListener('keydown', close);
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected) opener.focus();
    };
  }, [documentId]);
  if (!documentId) return null;
  const legalDocument = documentId === 'business' && businessDetails ? {
    title: documents.business.title,
    content: <><p><strong>שם העסק:</strong> {businessDetails.legalName || 'BALY WELLNESS'}</p>{businessDetails.registrationNumber && <p><strong>מספר עוסק / ח.פ.:</strong> {businessDetails.registrationNumber}</p>}<p><strong>איש קשר:</strong> {businessDetails.managerName || 'רובי באלי'}</p><p><strong>טלפון:</strong> {businessDetails.phone || '054-6995885'}</p>{businessDetails.email && <p><strong>דוא״ל:</strong> {businessDetails.email}</p>}<p><strong>כתובת:</strong> {businessDetails.address || 'מושב שילת'}</p></>
  } : documents[documentId];
  return <div className="fixed inset-0 z-[200] grid place-items-center bg-black/75 p-4" role="presentation" onMouseDown={event => event.target === event.currentTarget && onClose()}>
    <section ref={dialogRef} className="legal-document-modal max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-amber-400/30 p-5 text-right shadow-2xl" role="dialog" aria-modal="true" aria-labelledby="legal-title" dir="rtl">
      <div className="legal-document-header sticky top-0 mb-4 flex items-center justify-between gap-3 border-b pb-3">
        <div><h2 id="legal-title" className="text-xl font-black">{legalDocument.title}</h2><small className="text-slate-600">עודכן לאחרונה: {updatedAt}</small></div>
        <button ref={closeButtonRef} type="button" onClick={onClose} className="grid min-h-11 min-w-11 place-items-center rounded-xl border border-slate-300 bg-white" aria-label="סגירת החלון"><X /></button>
      </div>
      <div className="legal-document space-y-3 text-sm leading-7 [&_h3]:pt-2 [&_h3]:text-base [&_h3]:font-black [&_a]:font-bold [&_a]:text-blue-800">{legalDocument.content}</div>
    </section>
  </div>;
};

export const LegalLinks: React.FC<{ className?: string; businessDetails?: SystemSettings['businessDetails'] }> = ({ className = '', businessDetails }) => {
  const [open, setOpen] = useState<LegalDocumentId | null>(null);
  const links: Array<[LegalDocumentId, string]> = [['privacy', 'פרטיות'], ['terms', 'תנאי שימוש'], ['cookies', 'קוקיז'], ['refunds', 'ביטולים והחזרים'], ['accessibility', 'נגישות'], ['business', 'פרטי העסק']];
  return <><nav className={className} aria-label="מידע משפטי">{links.map(([id, label]) => <button className="min-h-11 rounded-lg px-2 py-2 text-sm underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300" type="button" key={id} aria-haspopup="dialog" onClick={() => setOpen(id)}>{label}</button>)}</nav><LegalDocumentModal documentId={open} onClose={() => setOpen(null)} businessDetails={businessDetails} /></>;
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
