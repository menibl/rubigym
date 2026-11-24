import React, { useEffect, useRef, useState } from 'react';
import { blankMember, catalog, extras, hasSelection, initialDraft, readDraft, selection, STORAGE_KEY, totals, type Draft, type Member } from './model';

const money = (n: number) => `₪${n.toLocaleString('he-IL')}`;
const prompts: Record<string,string> = {
  welcome: 'שלום, ברוכים הבאים ל־BALY WELLNESS. מה תרצו לעשות היום?',
  kind: 'נרשמים לבד או יחד כמשפחה?', name: 'איך קוראים לך? נשתמש כאן בפרטי דמה בלבד.',
  birth: 'מה תאריך הלידה?', phone: 'מה מספר הטלפון?', health: 'כך ייראה שלב הצהרת הבריאות.',
  plans: 'בואו נבחר את מה שמתאים לך.', member: 'הבחירה נשמרה. מי הבא בתור?',
  summary: 'הכול מוכן. נעבור יחד על הבחירה לפני התשלום?',
  payment: 'הדמיית מעבר לתשלום — לא נפתח דף סליקה אמיתי.',
  done: 'ההדמיה הושלמה. לא בוצע חיוב ולא שונה מנוי.',
  previous: 'אלה המסלולים מהתקופה הקודמת בדוגמה. להשאיר אותם?',
  cancel: 'איזה מסלול תרצו לבקש לבטל? זו תצוגה בלבד.',
};

export function Conversation() {
  const [d,setD] = useState<Draft>(() => { try { return readDraft(localStorage.getItem(STORAGE_KEY)); } catch { return initialDraft(); } });
  const [storageError,setStorageError] = useState(false);
  const [error,setError] = useState('');
  const [coupon,setCoupon] = useState(d.discount);
  const heading = useRef<HTMLHeadingElement>(null);
  const m = d.members[d.member];
  const total = totals(d);
  useEffect(() => { try { localStorage.setItem(STORAGE_KEY,JSON.stringify(d)); setStorageError(false); } catch { setStorageError(true); } },[d]);
  useEffect(() => { heading.current?.focus(); setError(''); },[d.step,d.member]);
  const go = (step: string) => setD(v => ({...v,step,accepted:false}));
  const update = (patch: Partial<Member>) => setD(v => ({...v,members:v.members.map((x,i) => i === v.member ? {...x,...patch} : x),accepted:false}));
  const start = (flow: Draft['flow']) => {
    setCoupon('');
    if (flow === 'register') setD({...initialDraft(),step:'kind'});
    else setD({...initialDraft(),flow,step:flow === 'renew' ? 'previous' : 'cancel',members:[{...blankMember(),name:'דנה לדוגמה',birth:'1995-05-12',phone:'0500000000',health:'demo',plan:'open',extras:['program']}]});
  };
  const nextProfile = () => {
    if (d.step === 'name' && m.name.trim().split(/\s+/).length < 2) return setError('יש להזין שם פרטי ושם משפחה לדוגמה.');
    if (d.step === 'birth' && (!/^\d{4}-\d{2}-\d{2}$/.test(m.birth) || m.birth > new Date().toISOString().slice(0,10) || m.birth < '1900-01-01')) return setError('בחרו תאריך לידה תקין שאינו בעתיד.');
    if (d.step === 'phone' && !/^05\d{8}$/.test(m.phone)) return setError('הזינו מספר דמה בן 10 ספרות שמתחיל ב־05. לא יישלח SMS.');
    if (d.step === 'health' && !m.health) return setError('בחרו תשובת דמה להמשך.');
    go(({name:'birth',birth:'phone',phone:'health',health:'plans'} as Record<string,string>)[d.step]);
  };
  const back = () => {
    const target: Record<string,string> = {kind:'welcome',name:d.member ? 'member':'kind',birth:'name',phone:'birth',health:'phone',plans:d.flow === 'renew' ? 'previous':'health',member:'plans',summary:d.family ? 'member':'plans',payment:'summary',previous:'welcome',cancel:'welcome'};
    go(target[d.step] || 'welcome');
  };
  const chooseDone = () => { if (!hasSelection(m)) return setError('בחרו מסלול או שירות נוסף אחד לפחות. אפשר גם שירותים בלבד.'); go(d.family ? 'member':'summary'); };
  const edit = (i: number) => setD(v => ({...v,member:i,step:'plans',accepted:false}));
  const addMember = () => setD(v => ({...v,members:[...v.members,blankMember()],member:v.members.length,step:'name',accepted:false}));

  return <div className="lab" dir="rtl">
    <header className="lab-header"><a href={`${import.meta.env.BASE_URL}index.html`}>← הממשק הקיים</a><span className="wordmark">BW <small>BALY WELLNESS</small></span><span className="lab-tag">מעבדת חוויית משתמש</span></header>
    <div className="demo-notice"><strong>אב־טיפוס · נתוני דמה בלבד</strong><span>אין חיובים, אין SMS ואין שינוי בחשבון אמיתי. המחירים להמחשה בלבד. אין להזין פרטים או מסמכים אמיתיים.</span></div>
    <main className="lab-layout">
      <aside className="journey"><span className="eyebrow">פשוט, צעד אחר צעד</span><h1>מתחילים<br/>להרגיש טוב.</h1><p>הרישום החדש של BALY.<br/>שאלה אחת בכל פעם, בקצב שלכם.</p>
        <ol>{['פרטים אישיים','בחירת מסלולים','סיכום ותשלום'].map((s,i) => <li key={s} className={(i===0 && ['kind','name','birth','phone','health'].includes(d.step)) || (i===1 && ['plans','member','previous'].includes(d.step)) || (i===2 && ['summary','payment','done'].includes(d.step)) ? 'active':''}><b>{i+1}</b>{s}</li>)}</ol>
        <div className="save-note">{storageError ? 'השמירה בדפדפן אינה זמינה. סגירת העמוד תאבד את ההתקדמות.' : 'טיוטת הדמה נשמרת במכשיר הזה. אפשר לצאת ולחזור לאותה שאלה.'}</div>
        <button className="text-button" onClick={() => { if (window.confirm('למחוק את טיוטת הדמה ולהתחיל מחדש?')) { setD(initialDraft()); setCoupon(''); } }}>מחיקת טיוטת הדמה והתחלה מחדש</button>
      </aside>
      <section className="conversation" aria-label="שאלון רישום מדומה">
        <div className="assistant-label"><span className="assistant-icon">✦</span><div><strong>העוזר של BALY</strong><small>שאלון מודרך · לא צ׳אט AI</small></div></div>
        <h2 ref={heading} tabIndex={-1}>{prompts[d.step]}</h2>
        {!['welcome','kind','previous','cancel'].includes(d.step) && <div className="context">{d.family ? `בן משפחה ${d.member+1} מתוך ${d.members.length}` : 'מנוי יחיד'}{m.name && ` · ${m.name}`}</div>}
        <div className="answer-panel" key={`${d.step}-${d.member}`}>
          {d.step === 'welcome' && <div className="choice-stack">{([['register','הרשמה חדשה','מתחילים בפרטים ובוחרים מסלול'],['renew','חידוש מנוי','משאירים את הבחירה הקודמת או מעדכנים'],['cancel','בקשת ביטול','מבינים מה יקרה לפני שמאשרים']] as const).map(([id,title,sub]) => <button className="choice" key={id} onClick={() => start(id)}><strong>{title}</strong><span>{sub}</span><i>←</i></button>)}</div>}
          {d.step === 'kind' && <div className="choice-stack">{[false,true].map(family => <button key={String(family)} className="choice" onClick={() => setD(v => ({...v,family,step:'name'}))}><strong>{family ? 'יחד כמשפחה':'רק אני'}</strong><span>{family ? 'ראש המשפחה מגדיר ומשלם עבור כולם':'בחירה אישית, כולל שירותים נוספים בלבד'}</span><i>←</i></button>)}</div>}
          {['name','birth','phone'].includes(d.step) && <form onSubmit={e => {e.preventDefault(); nextProfile();}}>
            <label className="field-label" htmlFor="answer">{d.step === 'name' ? 'שם מלא לדוגמה':d.step === 'birth' ? 'תאריך לידה לדוגמה':'טלפון לדוגמה'}</label>
            <input id="answer" type={d.step === 'birth' ? 'date':'text'} inputMode={d.step === 'phone' ? 'tel':undefined} autoComplete="off" maxLength={d.step === 'phone' ? 10:80} min={d.step === 'birth' ? '1900-01-01':undefined} max={d.step === 'birth' ? new Date().toISOString().slice(0,10):undefined} value={d.step === 'name' ? m.name:d.step === 'birth' ? m.birth:m.phone} onInput={e => update({[d.step]:e.currentTarget.value})} onChange={e => update({[d.step]:e.target.value})} placeholder={d.step === 'name' ? 'למשל: דנה לדוגמה':d.step === 'phone' ? '0500000000':undefined} />
            {d.step === 'phone' && <p className="muted">בהליך האמיתי יופיע אימות טלפון. כאן לא נשלח קוד ולא נוצר חשבון.</p>}
            <button className="primary" type="submit">ממשיכים ←</button>
          </form>}
          {d.step === 'health' && <><p className="muted">בהליך האמיתי יוצגו כל השאלות, התנאים והחתימה. כאן לא נאספים מידע רפואי, חתימה או קבצים.</p><div className="choice-stack">{[['demo','הדמיית הצהרה ללא צורך באישור'],['certificate','הדמיית הצהרה בהמתנה לאישור רופא']].map(([id,label]) => <button key={id} className={`choice ${m.health === id ? 'selected':''}`} aria-pressed={m.health === id} onClick={() => update({health:id})}>{label}</button>)}</div>{m.health === 'certificate' && <p className="info">בהדמיה אפשר להמשיך לבחירת מסלולים. העלאת אישור ופתיחת אימונים כפופות לאישור רפואי בתהליך האמיתי.</p>}<button className="primary" onClick={nextProfile}>המשך לבחירת מסלול ←</button></>}
          {d.step === 'plans' && <><h3>מה המסלול הראשי?</h3><div className="choice-stack">{catalog.map(p => <button key={p.id} className={`choice ${m.plan===p.id ? 'selected':''}`} aria-pressed={m.plan===p.id} onClick={() => update({plan:p.id})}><strong>{p.label}</strong><span>{p.price ? `${money(p.price)} לחודש · הוראת קבע מדומה`:'אפשר לרכוש שירותים נוספים בלבד'}</span></button>)}</div><h3>רוצים להוסיף משהו?</h3><p className="muted">אפשר לבחור כמה שירותים יחד, גם בלי מנוי ראשי.</p>{extras.map(e => <label className="extra" key={e.id}><input type="checkbox" checked={m.extras.includes(e.id)} onChange={ev => update({extras:ev.target.checked ? [...m.extras,e.id]:m.extras.filter(x => x!==e.id)})}/><span>{e.label}<small>חד־פעמי</small></span><b>{money(e.price)}</b></label>)}<button className="primary" onClick={chooseDone}>אישור הבחירה של {m.name || 'המתאמן'} ←</button></>}
          {d.step === 'member' && <><div className="member-list">{d.members.map((person,i) => <article key={i}><div><strong>{person.name || `בן משפחה ${i+1}`}</strong><p>{selection(person)}</p></div><button className="text-button" onClick={() => edit(i)}>עריכה</button></article>)}</div>{d.members.length < 6 && <button className="secondary" onClick={addMember}>＋ הוספת בן משפחה</button>}<button className="primary" onClick={() => { if (d.members.some(x => !hasSelection(x))) setError('יש להשלים בחירת מסלול או שירות לכל בן משפחה.'); else go('summary'); }}>כולם מוכנים, לסיכום ←</button></>}
          {d.step === 'previous' && <><div className="info"><strong>{m.name}</strong><p>{selection(m)}</p><span>נתוני מנוי קודמים לדוגמה בלבד</span></div><button className="primary" onClick={() => go('summary')}>להשאיר את המסלולים ולהמשיך</button><button className="secondary" onClick={() => go('plans')}>לעדכן את הבחירה</button></>}
          {d.step === 'summary' && <><div className="member-list">{d.members.map((person,i) => <article key={i}><div><strong>{person.name}</strong><p>{selection(person)}</p><small>{money(totals({...d,members:[person]}).monthly)} חודשי + {money(totals({...d,members:[person]}).once)} חד־פעמי</small></div><button className="text-button" onClick={() => edit(i)}>עריכה</button></article>)}</div><form className="coupon" onSubmit={e => {e.preventDefault(); setD(v => ({...v,discount:coupon}));}}><label htmlFor="coupon">קוד הנחה לדוגמה: DEMO10</label><div><input id="coupon" value={coupon} maxLength={30} onChange={e => setCoupon(e.target.value)} /><button className="secondary" type="submit">הפעלה</button></div></form>{d.discount && <p className="info">{total.discount ? 'הופעלה הנחת דמה של 10% על השירותים החד־פעמיים בלבד.':'קוד הדמה לא זוהה, או שאין שירות חד־פעמי להנחה.'}</p>}<dl className="totals"><div><dt>חיוב חודשי מאוחד לדוגמה</dt><dd>{money(total.monthly)}</dd></div><div><dt>שירותים חד־פעמיים</dt><dd>{money(total.once)}</dd></div>{total.discount>0 && <div><dt>הנחת דמה</dt><dd>−{money(total.discount)}</dd></div>}<div className="grand"><dt>סך התשלום הראשון בהדמיה</dt><dd>{money(total.due)}</dd></div></dl><p className="muted">{total.monthly>0 && total.once>0 ? 'יוצגו שני שלבים: הוראת קבע אחת למסלולים החודשיים, ואז תשלום אחד לשירותים החד־פעמיים.':'יוצג שלב תשלום מדומה אחד.'} האיחוד כאן מניח תקופה ותנאי חיוב זהים. אין שינוי בהוראות קיימות.</p><label className="extra"><input type="checkbox" checked={d.accepted} onChange={e => setD(v => ({...v,accepted:e.target.checked}))}/><span>עברתי על סיכום הדמה. ברור לי שלא מתבצע תשלום.</span></label><button className="primary" disabled={!d.accepted || !total.due} onClick={() => go('payment')}>להדמיית התשלום ←</button></>}
          {d.step === 'payment' && <><div className="payment-visual"><span>▣</span><h3>{total.monthly>0 ? `שלב 1 · הוראת קבע ${money(total.monthly)} לחודש`:`תשלום חד־פעמי ${money(total.once-total.discount)}`}</h3>{total.monthly>0 && total.once>0 && <p>שלב 2 · שירותים חד־פעמיים {money(total.once-total.discount)}</p>}<p>אין להזין אשראי. הכפתור מדמה הצלחה בשני השלבים.</p></div><button className="primary" onClick={() => go('done')}>הדמיית סיום מוצלח — ללא חיוב</button><button className="secondary" onClick={() => go('summary')}>יציאה וחזרה לבחירה — ללא חסימה</button></>}
          {d.step === 'cancel' && <><div className="info"><strong>{m.name} · Open Gym</strong><p>בקשת ביטול מדומה בלבד. בתהליך אמיתי יש להציג תאריך סיום גישה, תקופת הודעה מוקדמת והשפעה על הגבייה בהתאם לתנאים החלים.</p><p>אין ביטול של הוראת קבע ואין שינוי אצל בני משפחה אחרים.</p></div><label className="extra"><input type="checkbox" checked={d.accepted} onChange={e => setD(v => ({...v,accepted:e.target.checked}))}/><span>הבנתי שזו הדמיה בלבד.</span></label><button disabled={!d.accepted} className="primary" onClick={() => go('done')}>הדמיית שליחת בקשת ביטול</button></>}
          {d.step === 'done' && <><div className="success-mark">✓</div><p className="muted">כך ייראה מסך הסיום. לא נוצרו חשבון, מנוי, בקשה, חשבונית או הודעה.</p><button className="primary" onClick={() => {setD(initialDraft());setCoupon('');}}>בדיקת תרחיש נוסף</button></>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {!['welcome','done'].includes(d.step) && <button className="text-button back" onClick={back}>→ חזרה לשלב הקודם</button>}
        <footer>סביבת בדיקות בלבד · הבחירה אינה נשלחת למועדון</footer>
      </section>
    </main>
  </div>;
}
