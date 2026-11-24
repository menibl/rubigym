import React, {useEffect, useRef, useState} from 'react';
import {blankMember, catalog, checkoutMembers, demoAccount, extras, hasSelection, initialDraft, profileSteps, readDraft, selection, STORAGE_KEY, totals, type Draft, type Flow, type Member} from './model';
import {createDemoVerifier,validDemoVerifier} from './demoAccount';

const money = (n: number) => `₪${n.toLocaleString('he-IL')}`;
const prompts: Record<string,string> = {
  welcome:'שלום, ברוכים הבאים ל־BALY WELLNESS. מה תרצו לעשות היום?',
  kind:'נרשמים לבד או יחד כמשפחה?',name:'מה השם הפרטי ושם המשפחה?',
  birth:'מה תאריך הלידה?',gender:'מה המין?',phone:'מה מספר הטלפון?',otp:'נדמה כעת אימות טלפון.',
  credentials:'נגדיר פרטי כניסה לחשבון הדמה.',health:'הצהרת בריאות — כל השדות, בנתוני דמה בלבד.',
  consent:'נשארו האישורים והעדפות ההתראות.',plans:'בואו נבחר את מה שמתאים לכם.',
  member:'הבחירה נשמרה. מי הבא בתור?',summary:'נעבור על הבחירה לפני התשלום?',
  payment:'הדמיית תשלום — ללא אשראי וללא חיוב.',done:'ההדמיה הושלמה. לא שונה חשבון אמיתי.',
  previous:'אלה המסלולים מהתקופה הקודמת בדוגמה. להשאיר אותם?',
  cancel:'בקשת ביטול — בוחרים מה לבטל ורואים את ההשפעה.',
  account:'החשבון שלכם. מה תרצו לעדכן?',freeze:'בקשת הקפאה לחודש — הדמיה בלבד.',
};
// Field inventory matching the existing health form; these are fictional presets,
// not a medical declaration. Answers, signature and ID never enter persisted state.
const healthQuestions = [
  'מחלת לב שאובחנה על ידי רופא','כאבים בחזה במנוחה','כאבים בחזה בפעילות שגרתית',
  'כאבים בחזה בפעילות גופנית','אובדן שיווי משקל עקב סחרחורת בשנה האחרונה',
  'אובדן הכרה בשנה האחרונה','אסתמה וטיפול תרופתי בשלושת החודשים האחרונים',
  'קוצר נשימה או צפצופים בשלושת החודשים האחרונים','פטירת קרוב מדרגה ראשונה ממחלת לב',
  'מוות פתאומי מוקדם של קרוב מדרגה ראשונה','הנחיית רופא לפעילות בהשגחה בלבד בחמש השנים האחרונות',
  'מחלה כרונית העלולה להגביל פעילות','היריון בסיכון — אם רלוונטי',
];
const currentYear = new Date().getFullYear();
const isMinor = (birth: string) => {
  if (!birth) return false;
  const today=new Date().toISOString().slice(0,10);
  return birth > `${Number(today.slice(0,4))-18}${today.slice(4)}`;
};

export function Conversation({initialState,embedded=false,storageKey=STORAGE_KEY,resume=false,onCreateDemoAccount}: {initialState?: Draft;embedded?:boolean;storageKey?:string;resume?:boolean;onCreateDemoAccount?:(draft:Draft,verifiers:string[])=>Promise<void>} = {}) {
  const [d,setD] = useState<Draft>(() => {
    if(resume) {try {const saved=localStorage.getItem(storageKey);if(saved) return readDraft(saved);} catch { /* fall through to supplied view-only snapshot */ }}
    if(initialState) return readDraft(JSON.stringify(initialState));
    try {return readDraft(localStorage.getItem(storageKey));} catch {return initialDraft();}
  });
  const baseline=initialState || initialDraft();
  const accountState=initialState?.step==='account' ? initialState:demoAccount();
  const restart=()=>{for(const suffix of [':credentials',':registrationId']){try{localStorage.removeItem(`${storageKey}${suffix}`);}catch{ /* storage warning is shown by draft persistence */ }}setD(readDraft(JSON.stringify(embedded ? baseline:initialDraft())));setCoupon('');};
  const [storageError,setStorageError] = useState(false);
  const [error,setError] = useState('');
  const [coupon,setCoupon] = useState(d.discount);
  // Intentionally ephemeral. Never serialized or sent anywhere.
  const [password,setPassword] = useState('');
  const [confirmPassword,setConfirmPassword] = useState('');
  const [otp,setOtp] = useState('');
  const [busy,setBusy]=useState(false);
  const savedVerifiers=():Record<string,string>=>{try{return JSON.parse(localStorage.getItem(`${storageKey}:credentials`) || '{}');}catch{return {};}};
  const [certificate,setCertificate] = useState(false);
  const [healthSigned,setHealthSigned] = useState(false);
  const [parentApproved,setParentApproved] = useState(false);
  const [cancelTarget,setCancelTarget] = useState('main');
  const heading = useRef<HTMLHeadingElement>(null);
  const m=d.members[d.member];
  const total=totals(d);
  const minor=isMinor(m.birth);
  useEffect(() => {try {localStorage.setItem(storageKey,JSON.stringify(readDraft(JSON.stringify(d))));setStorageError(false);} catch {setStorageError(true);}},[d,storageKey]);
  useEffect(() => {
    heading.current?.focus();setError('');setPassword('');setConfirmPassword('');setOtp('');
    setHealthSigned(false);setParentApproved(false);setCertificate(false);setCancelTarget('main');
  },[d.step,d.member]);
  const go = (step: string) => setD(v=>({...v,step,accepted:false}));
  const update = (patch: Partial<Member>) => setD(v=>({...v,members:v.members.map((x,i)=>{
    if (i!==v.member) return x;
    const next={...x,...patch};
    if ('firstName' in patch || 'lastName' in patch) next.name=`${next.firstName.trim()} ${next.lastName.trim()}`.trim();
    return next;
  }),accepted:false}));
  const start = (flow: Flow) => {
    setCoupon('');
    if (flow==='register') setD({...initialDraft(),step:'kind'});
    else setD({...demoAccount(),flow,fromAccount:false,step:flow==='renew' ? 'previous':'cancel'});
  };
  const action = (flow: Flow,index: number) => setD(v=>({...v,flow,member:index,fromAccount:true,discount:'',accepted:false,purchaseExtras:[],
    step:({renew:'previous',update:'plans',extras:'plans',cancel:'cancel',freeze:'freeze',profile:'name'} as Record<string,string>)[flow] || 'account'}));
  const addMember = () => setD(v=>({...v,family:true,flow:v.fromAccount ? 'add':v.flow,
    members:[...v.members,{...blankMember(),lastName:v.members[0].lastName,email:v.members[0].email}],
    member:v.members.length,step:'name',accepted:false}));
  const nextProfile = async () => {
    if(busy) return;
    if (d.step==='name' && (!m.firstName.trim() || !m.lastName.trim())) return setError('יש למלא שם פרטי ושם משפחה לדוגמה.');
    if (d.step==='birth' && (!/^\d{4}-\d{2}-\d{2}$/.test(m.birth) || m.birth>new Date().toISOString().slice(0,10) || m.birth<'1900-01-01')) return setError('בחרו תאריך לידה תקין שאינו בעתיד.');
    if (d.step==='gender' && !m.gender) return setError('בחרו מין להמשך.');
    if (d.step==='phone' && ((!d.member && !/^05\d{8}$/.test(m.phone)) || (m.phone && !/^05\d{8}$/.test(m.phone)))) return setError('יש להזין טלפון דמה בן 10 ספרות שמתחיל ב־05. לבן משפחה נוסף הטלפון אינו חובה.');
    if (d.step==='otp' && otp!=='111111') return setError('קוד הדמה הוא 111111. לא נשלח SMS.');
    if (d.step==='credentials') {
      if (!m.username.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m.email)) return setError('בחרו שם משתמש וכתובת אימייל תקינה להדגמה.');
      if ((!m.credentialsReady || onCreateDemoAccount && !validDemoVerifier(savedVerifiers()[d.member]) || password || confirmPassword) && (password.length<8 || password!==confirmPassword)) return setError('סיסמת הדמה צריכה להכיל לפחות 8 תווים ולהתאים לאימות הסיסמה.');
      if(onCreateDemoAccount && password) {
        setBusy(true);
        try {const verifier=await createDemoVerifier(password);localStorage.setItem(`${storageKey}:credentials`,JSON.stringify({...savedVerifiers(),[d.member]:verifier}));}
        catch {setError('לא ניתן לשמור אימות סיסמת דמה במכשיר הזה. יש לאפשר אחסון מקומי ולנסות שוב.');return;}
        finally {setBusy(false);}
      }
      update({credentialsReady:true});
    }
    if (d.step==='health' && (!m.health || !healthSigned || (minor && !parentApproved))) return setError('בחרו תרחיש דמה ואשרו חתימת דמה; לקטין נדרש גם אישור הורה מדומה.');
    if (d.step==='consent' && !m.agreement) return setError('נדרש לסמן הדמיית אישור תנאים להמשך.');
    const index=profileSteps.indexOf(d.step);
    go(index===profileSteps.length-1 ? (d.flow==='profile' ? 'done':'plans') : profileSteps[index+1]);
  };
  const back = () => {
    const i=profileSteps.indexOf(d.step);
    if (i>0) return go(profileSteps[i-1]);
    const target: Record<string,string>={kind:'welcome',name:d.fromAccount ? 'account':d.member ? 'member':'kind',plans:d.fromAccount ? 'account':d.flow==='renew' ? 'previous':'consent',member:'plans',summary:d.fromAccount ? 'account':d.family ? 'member':'plans',payment:'summary',previous:d.fromAccount ? 'account':'welcome',cancel:'account',freeze:'account',account:'welcome'};
    go(target[d.step] || 'welcome');
  };
  const chooseDone = () => {
    if (!(d.flow==='extras' ? d.purchaseExtras.length : hasSelection(m))) return setError('בחרו לפחות מסלול או שירות נוסף. אפשר שירותים בלבד, ללא מנוי ראשי.');
    go(d.family && !d.fromAccount ? 'member':'summary');
  };
  const createAccount=async()=>{
    if(busy || !onCreateDemoAccount) return;
    const verifiers=d.members.map((_,i)=>savedVerifiers()[i]);
    const missing=verifiers.findIndex(v=>!validDemoVerifier(v));
    if(missing>=0){setD(v=>({...v,member:missing,step:'credentials'}));return;}
    setBusy(true);setError('');
    try{await onCreateDemoAccount(d,verifiers);}catch(e){setError(e instanceof Error ? e.message:'שמירת חשבון הדמה נכשלה. אפשר לנסות שוב ללא חיוב.');}finally{setBusy(false);}
  };
  const memberCard = (person: Member,i: number,edit=true) => <article key={i}>
    <div><strong>{person.name || `בן משפחה ${i+1}`}</strong><p>{d.flow==='extras' && d.step==='summary' ? extras.filter(e=>d.purchaseExtras.includes(e.id)).map(e=>e.label).join(' · '):selection(person)}</p>
      <small>{money(d.flow==='extras' && d.step==='summary' ? 0:totals({...initialDraft(),members:[person]}).monthly)} חודשי + {money(d.flow==='extras' && d.step==='summary' ? total.once:totals({...initialDraft(),members:[person]}).once)} חד־פעמי</small></div>
    {edit && <button className="text-button" onClick={()=>setD(v=>({...v,member:i,step:'plans',accepted:false}))}>עריכת מסלולים</button>}
  </article>;
  const textField = (key: 'firstName'|'lastName'|'username'|'email'|'birth'|'phone',label: string,type='text') => <label className="field-label">{label}
    <input type={type} value={m[key]} autoComplete="off" maxLength={key==='phone' ? 10:['firstName','lastName'].includes(key) ? 60:120}
      min={type==='date' ? '1900-01-01':undefined} max={type==='date' ? new Date().toISOString().slice(0,10):undefined}
      inputMode={key==='phone' ? 'tel':key==='email' ? 'email':undefined}
      onInput={e=>update({[key]:e.currentTarget.value})} onChange={e=>update({[key]:e.target.value})}/>
  </label>;

  return <div className={`lab ${embedded ? 'embedded':''}`} dir="rtl">
    {!embedded && <header className="lab-header"><a href={`${import.meta.env?.BASE_URL || '/rubigym/'}index.html`}>← הממשק הקיים</a><span className="wordmark">BW <small>BALY WELLNESS</small></span><span className="lab-tag">מעבדת חוויית משתמש</span></header>}
    <div className="demo-notice"><strong>אב־טיפוס · נתוני דמה בלבד</strong><span>אין חיובים, SMS או שינוי בחשבון אמיתי. {onCreateDemoAccount ? 'בסיום אפשר לשמור חשבון דמה בדפדפן הזה ולהיכנס אליו.':'הבחירות הן הדמיה בלבד.'} אין להשתמש בסיסמה אמיתית. כל המחירים להמחשה.</span></div>
    <main className="lab-layout">
      {!embedded && <aside className="journey"><span className="eyebrow">פשוט, צעד אחר צעד</span><h1>מתחילים<br/>להרגיש טוב.</h1><p>הרישום החדש של BALY.<br/>שאלה אחת בכל פעם, בקצב שלכם.</p>
        <ol>{['פרטים ואישורים','בחירת מסלולים','סיכום ותשלום'].map((s,i)=><li key={s} className={(i===0 && profileSteps.includes(d.step)) || (i===1 && ['plans','member','previous'].includes(d.step)) || (i===2 && ['summary','payment','done'].includes(d.step)) ? 'active':''}><b>{i+1}</b>{s}</li>)}</ol>
        <div className="save-note">{storageError ? 'השמירה אינה זמינה בדפדפן זה.' : 'טיוטת הדמה נשמרת במכשיר הזה. סיסמאות, קוד אימות, תשובות רפואיות וחתימות אינם נשמרים ויידרשו שוב לפי הצורך.'}</div>
        <button className="text-button" onClick={()=>{if(window.confirm('למחוק את טיוטת הדמה ולהתחיל מחדש?')) restart();}}>מחיקת טיוטת הדמה והתחלה מחדש</button>
      </aside>}
      <section className="conversation" aria-label="שאלון רישום מדומה">
        <div className="assistant-label"><span className="assistant-icon">✦</span><div><strong>העוזר של BALY</strong><small>שאלון מודרך · לא צ׳אט AI</small></div></div>
        <h2 ref={heading} tabIndex={-1}>{prompts[d.step]}</h2>
        {!['welcome','kind','account'].includes(d.step) && <div className="context">{d.family ? `בן משפחה ${d.member+1} מתוך ${d.members.length}`:'מנוי יחיד'}{m.name && ` · ${m.name}`}</div>}
        <div className="answer-panel" key={`${d.step}-${d.member}`}>
          {d.step==='welcome' && <div className="choice-stack">
            <button className="choice" onClick={()=>start('register')}><strong>הרשמה חדשה</strong><span>כל הפרטים, האישורים והמסלולים</span></button>
            <button className="choice" onClick={()=>setD(demoAccount())}><strong>כבר רשומים? ניהול חשבון לדוגמה</strong><span>משפחה, עדכון מסלול, שירות נוסף, חידוש, ביטול והקפאה</span></button>
            <button className="choice" onClick={()=>start('renew')}>חידוש מנוי לדוגמה</button>
          </div>}
          {d.step==='kind' && <>
            <div className="choice-stack">{[false,true].map(family=><button key={String(family)} className="choice" aria-pressed={d.family===family} onClick={()=>setD(v=>({...v,family}))}>{family ? 'יחד כמשפחה':'רק אני'}</button>)}</div>
            {d.family && <label className="field-label">שם המשפחה / שם החשבון המשפחתי<input maxLength={80} value={d.familyName} onChange={e=>setD(v=>({...v,familyName:e.target.value}))} placeholder="משפחת לדוגמה"/></label>}
            <button className="primary" onClick={()=>go('name')}>המשך לפרטים ←</button>
          </>}
          {profileSteps.includes(d.step) && <div role="group" aria-label="תשובה לשאלה" onKeyDown={e=>{if(e.key==='Enter' && e.target instanceof HTMLInputElement){e.preventDefault();nextProfile();}}}>
            {d.step==='name' && <>{textField('firstName','שם פרטי לדוגמה')}{textField('lastName','שם משפחה לדוגמה')}{d.member>0 && <p className="muted">שם המשפחה הושלם מראש; אפשר לשנות אותו.</p>}</>}
            {d.step==='birth' && textField('birth','תאריך לידה לדוגמה','date')}
            {d.step==='gender' && <label className="field-label">מין<select value={m.gender} onChange={e=>update({gender:e.target.value})}><option value="">בחירה</option><option value="male">זכר</option><option value="female">נקבה</option></select></label>}
            {d.step==='phone' && <>{textField('phone',d.member>0 ? 'טלפון אישי לדוגמה — לא חובה':'מספר טלפון לדוגמה','tel')}<p className="muted">למשל 0500000000. לא יישלח SMS.</p></>}
            {d.step==='otp' && <><p className="info">זה שלב מדומה בלבד. קוד הדמה הוא <b>111111</b>, גם אם לבן משפחה נוסף לא הוזן טלפון; בחשבון אמיתי האימות יפעל בהתאם לתהליך הקיים.</p><label className="field-label">קוד אימות מדומה<input inputMode="numeric" maxLength={6} value={otp} onChange={e=>setOtp(e.target.value)}/></label></>}
            {d.step==='credentials' && <>
              {textField('username','שם משתמש לדוגמה')}{textField('email','EMAIL לדוגמה','email')}
              <p className="muted">מומלץ להשתמש בכתובת דמה כגון dana@example.com. סיסמה גלויה אינה נשמרת; לחשבון דמה נשמר רק ערך אימות מקומי שנגזר מהסיסמה.</p>
              {m.credentialsReady && (!onCreateDemoAccount || validDemoVerifier(savedVerifiers()[d.member])) && <p className="info">פרטי הכניסה המדומים כבר הושלמו. אפשר להמשיך בלי להזין סיסמה מחדש או להדגים החלפה.</p>}
              <label className="field-label">סיסמת דמה — לפחות 8 תווים<input type="password" autoComplete="off" value={password} maxLength={80} onChange={e=>setPassword(e.target.value)}/></label>
              <label className="field-label">אימות סיסמת דמה<input type="password" autoComplete="off" value={confirmPassword} maxLength={80} onChange={e=>setConfirmPassword(e.target.value)}/></label>
            </>}
            {d.step==='health' && <>
              <p className="info">כל נושאי השאלון הקיים מוצגים להמחשה, בניסוח מקוצר. בחרו תרחיש דמה; אין למלא כאן מידע רפואי או לחתום הצהרה אמיתית.</p>
              <label className="field-label">תרחיש רפואי מדומה<select value={m.health} onChange={e=>update({health:e.target.value})}><option value="">בחירת תרחיש</option><option value="demo">כל תשובות הדמה הן לא</option><option value="certificate">תשובת דמה אחת כן — ממתין לאישור רופא</option></select></label>
              <ol className="health-demo">{healthQuestions.map((q,i)=><li key={q}><span>{q}</span><b>{m.health ? (m.health==='certificate' && i===0 ? 'כן — דמה':'לא — דמה'):'טרם נבחר תרחיש'}</b></li>)}</ol>
              {m.health==='certificate' && <><button className="secondary" type="button" onClick={()=>setCertificate(v=>!v)}>{certificate ? '✓ אישור-רופא-לדוגמה.pdf — לא הועלה קובץ':'הדמיית הוספת אישור רופא — ללא בחירת קובץ'}</button><p className="muted">אפשר להמשיך לתשלום מדומה גם בהמתנה לאישור רפואי. אין בכך פתיחת אימונים אמיתית.</p></>}
              <label className="field-label">שם מלא לחתימת דמה<input readOnly value={m.name}/></label>
              <label className="extra"><input type="checkbox" checked={healthSigned} onChange={e=>setHealthSigned(e.target.checked)}/><span>הדמיית אישור ההצהרה והחתימה — לא חתימה מחייבת</span></label>
              {minor && <div className="info"><strong>אישור הורה למתאמן מתחת לגיל 18</strong><label className="field-label">שם ההורה — דמה<input readOnly value="הורה לדוגמה"/></label><label className="field-label">מספר זהות הורה — דמה בלבד<input readOnly value="000000000"/></label><label className="extra"><input type="checkbox" checked={parentApproved} onChange={e=>setParentApproved(e.target.checked)}/><span>הדמיית אישור הורה</span></label></div>}
            </>}
            {d.step==='consent' && <>
              <details className="info"><summary>תנאי הצטרפות, שימוש, פרטיות וביטול — תצוגה</summary><p>בממשק האמיתי יוצגו המסמכים המחייבים הקיימים, ולא תנאים חדשים. כאן זו הדמיית מיקום בלבד; אין הסכמה משפטית או שינוי בתנאים.</p><p>לצפייה במסמכים הקיימים אפשר לחזור לממשק הקיים דרך הקישור בראש העמוד.</p></details>
              <label className="extra"><input type="checkbox" checked={m.agreement} onChange={e=>update({agreement:e.target.checked})}/><span>הדמיית אישור הסכם ההצטרפות, התקנון, ביטולים ופרטיות</span></label>
              <label className="extra"><input type="checkbox" checked={m.push} onChange={e=>update({push:e.target.checked,reminders:e.target.checked ? m.reminders:false})}/><span>הדמיית בחירה בקבלת התראות PUSH</span></label>
              <label className="extra"><input type="checkbox" disabled={!m.push} checked={m.reminders} onChange={e=>update({reminders:e.target.checked})}/><span>תזכורות לפני אימון — ללא התראות אמיתיות</span></label>
            </>}
            <button className="primary" type="button" onClick={nextProfile} disabled={busy}>{busy ? 'שומר אימות מקומי…':d.step==='consent' ? (d.flow==='profile' ? 'סיום עדכון הפרטים המדומה':'המשך לבחירת מסלול ←'):'ממשיכים ←'}</button>
          </div>}
          {d.step==='account' && <>
            <p className="info">{embedded ? 'אלה המשתמש ובני המשפחה מתוך החשבון בסביבת הבדיקות. הנתונים מוצגים לקריאה בלבד.':'חשבון משפחתי לדוגמה לאחר רישום.'} כל הפעולות כאן מדומות ואינן משנות מנויים או הוראות קבע.</p>
            <div className="account-members">{d.members.map((person,i)=><article key={i}><h3>{person.name}</h3><p>{person.currentPlans || selection(person)}</p><p className="muted">{person.currentExpiry ? `תוקף כפי שמופיע בחשבון: ${person.currentExpiry} · סטטוס: ${person.currentStatus}`:`מנוי דמה בתוקף עד 01/12/${currentYear}`}</p><div className="action-grid">
              {([['update','עדכון מסלול'],['extras','רכישת שירות נוסף'],['renew','חידוש'],['cancel','בקשת ביטול'],['freeze','בקשת הקפאה'],['profile','עריכת פרטים']] as const).map(([flow,label])=><button key={flow} className="secondary" onClick={()=>action(flow,i)} aria-label={`${label} — ${person.name}`}>{label}</button>)}
            </div></article>)}</div>
            {d.members.length<6 && <button className="primary" onClick={addMember}>＋ הוספת בן משפחה לאחר הרישום</button>}
          </>}
          {d.step==='plans' && <>
            {d.flow==='extras' ? <p className="info">המנוי הקיים נשאר ללא שינוי. כאן בוחרים רק שירותים נוספים; אין צורך לרכוש מנוי ראשי.</p>:<><h3>מה המסלול הראשי?</h3><div className="choice-stack">{catalog.map(p=><button key={p.id} className={`choice ${m.plan===p.id ? 'selected':''}`} aria-pressed={m.plan===p.id} onClick={()=>update({plan:p.id})}><strong>{p.label}</strong><span>{p.price ? `${money(p.price)} לחודש · הוראת קבע מדומה`:'אפשר לרכוש שירותים נוספים בלבד'}</span></button>)}</div></>}
            <h3>שירותים ותוכניות נוספות</h3><p className="muted">אפשר לבחור אישי וזוגי יחד, גם ללא מסלול ראשי. הכמויות כאן הן חבילות דמה קבועות.</p>
            {extras.map(e=><label className="extra" key={e.id}><input type="checkbox" checked={(d.flow==='extras' ? d.purchaseExtras:m.extras).includes(e.id)} onChange={ev=>d.flow==='extras' ? setD(v=>({...v,purchaseExtras:ev.target.checked ? [...v.purchaseExtras,e.id]:v.purchaseExtras.filter(x=>x!==e.id)})):update({extras:ev.target.checked ? [...m.extras,e.id]:m.extras.filter(x=>x!==e.id)})}/><span>{e.label}<small>חד־פעמי</small></span><b>{money(e.price)}</b></label>)}
            <button className="primary" onClick={chooseDone}>אישור הבחירה של {m.name || 'המתאמן'} ←</button>
          </>}
          {d.step==='member' && <><div className="member-list">{d.members.map((p,i)=>memberCard(p,i))}</div>{d.members.length<6 && <button className="secondary" onClick={addMember}>＋ הוספת בן משפחה</button>}<button className="primary" onClick={()=>d.members.some(x=>!hasSelection(x)) ? setError('השלימו מסלול או שירות לכל בן משפחה.'):go('summary')}>כולם מוכנים, לסיכום ←</button></>}
          {d.step==='previous' && <><div className="member-list">{checkoutMembers(d).map((p,i)=>p.currentPlans ? <article key={i}><div><strong>{p.name}</strong><p>{p.currentPlans}</p><small>תוקף בחשבון: {p.currentExpiry}. אין חישוב חיוב אמיתי בהדמיה.</small></div></article>:memberCard(p,d.fromAccount ? d.member:i,false))}</div><button className="primary" onClick={()=>go(embedded && m.currentPlans ? 'done':'summary')}>להשאיר את המסלולים ולהמשיך</button><button className="secondary" onClick={()=>go('plans')}>לעדכן את הבחירה</button></>}
          {d.step==='summary' && <>
            <div className="member-list">{checkoutMembers(d).map((person,i)=>memberCard(person,d.flow==='register' || (d.flow==='renew' && !d.fromAccount) ? i:d.member))}</div>
            {d.flow==='add' && <p className="info">משלמים רק עבור בן המשפחה החדש. המסלולים וההוראות של בני המשפחה שכבר רשומים נשארים ללא שינוי.</p>}
            {d.flow==='extras' && <p className="info">התשלום המדומה הוא על התוספות שבחרתם בלבד, ולא על המנוי הקיים.</p>}
            {d.family && d.flow==='register' && <fieldset className="info"><legend>אופן התשלום — ראש המשפחה משלם</legend><label className="extra"><input type="radio" name="billing" checked={d.billing==='combined'} onChange={()=>setD(v=>({...v,billing:'combined'}))}/><span>איחוד מסלולים חדשים באותה תקופה ותנאי חיוב</span></label><label className="extra"><input type="radio" name="billing" checked={d.billing==='separate'} onChange={()=>setD(v=>({...v,billing:'separate'}))}/><span>בנפרד לכל בן משפחה / מסלול</span></label></fieldset>}
            <div className="coupon" role="group" aria-label="קוד הנחה" onKeyDown={e=>{if(e.key==='Enter' && e.target instanceof HTMLInputElement){e.preventDefault();setD(v=>({...v,discount:coupon}));}}}><label htmlFor="coupon">קוד הנחה לדוגמה: DEMO10</label><div><input id="coupon" value={coupon} maxLength={30} onChange={e=>setCoupon(e.target.value)}/><button className="secondary" type="button" onClick={()=>setD(v=>({...v,discount:coupon}))}>הפעלה</button></div></div>
            {d.discount && <p className="info">{total.discount ? 'הופעלה הנחת דמה של 10% על השירותים החד־פעמיים בלבד.':'קוד הדמה לא זוהה או שאין שירות חד־פעמי להנחה.'}</p>}
            <dl className="totals"><div><dt>חיוב חודשי לדוגמה</dt><dd>{money(total.monthly)}</dd></div><div><dt>שירותים חד־פעמיים</dt><dd>{money(total.once)}</dd></div>{total.discount>0 && <div><dt>הנחת דמה</dt><dd>−{money(total.discount)}</dd></div>}<div className="grand"><dt>סך התשלום הראשון בהדמיה</dt><dd>{money(total.due)}</dd></div></dl>
            <p className="muted">{d.billing==='separate' && d.family ? 'הדמיית תשלום נפרד לכל בחירה.':total.monthly>0 && total.once>0 ? 'יוצגו שני שלבים: הוראת קבע למסלולים החודשיים, ואז תשלום חד־פעמי לתוספות.':'יוצג שלב תשלום מדומה אחד.'} אין חיוב, זיכוי או החלפה של הוראות קיימות.</p>
            <label className="extra"><input type="checkbox" checked={d.accepted} onChange={e=>setD(v=>({...v,accepted:e.target.checked}))}/><span>עברתי על סיכום הדמה. ברור לי שלא מתבצע תשלום.</span></label><button className="primary" disabled={!d.accepted || !total.due} onClick={()=>go('payment')}>להדמיית התשלום ←</button>
          </>}
          {d.step==='payment' && <><div className="payment-visual"><span>▣</span><h3>{total.monthly>0 ? `הוראת קבע מדומה · ${money(total.monthly)} לחודש`:`תשלום חד־פעמי · ${money(total.once-total.discount)}`}</h3>{total.monthly>0 && total.once>0 && <p>תשלום נוסף מדומה · {money(total.once-total.discount)}</p>}<p>אין להזין אשראי. הכפתור מדמה הצלחה בלבד.</p></div><button className="primary" onClick={()=>go('done')}>הדמיית סיום מוצלח — ללא חיוב</button><button className="secondary" onClick={()=>go('summary')}>יציאה וחזרה לבחירה — ללא חסימה</button></>}
          {d.step==='cancel' && <>
            <label className="field-label">המסלול לביטול<select value={cancelTarget} onChange={e=>setCancelTarget(e.target.value)}><option value="main">{m.currentPlans || catalog.find(p=>p.id===m.plan)?.label || 'מסלול ראשי'}</option>{m.extras.map(id=><option key={id} value={id}>{extras.find(e=>e.id===id)?.label}</option>)}</select></label>
            <label className="field-label">סיבת ביטול — שדה הדגמה לא נשמר<input readOnly value="בקשת מתאמן לדוגמה"/></label>
            <div className="info"><p>הבקשה תתייחס רק למסלול הנבחר של {m.name}, ולא לבני המשפחה האחרים.</p><p>בהליך אמיתי יוצגו מועד סיום הגישה, תקופת ההודעה המוקדמת, תשלום שנותר והשפעה על הגבייה בהתאם למסלול ולתנאים החלים. כאן לא חושב תאריך מחייב.</p></div>
            <label className="extra"><input type="checkbox" checked={d.accepted} onChange={e=>setD(v=>({...v,accepted:e.target.checked}))}/><span>הבנתי שזו הדמיית בקשה בלבד.</span></label><button disabled={!d.accepted} className="primary" onClick={()=>go('done')}>הדמיית בקשת ביטול</button>
          </>}
          {d.step==='freeze' && <>
            <label className="field-label">מועד תחילת הקפאה לדוגמה<input type="date" defaultValue={`${currentYear}-12-01`}/></label>
            <p className="info">הדמיית הקפאה לחודש אחד, פעם בשנה. בממשק אמיתי יוצגו גם מועד החזרה, דחיית התשלום והארכת התקופה, בלי לשנות את הגבייה של בני המשפחה האחרים. כאן אין עדכון של הוראה או תוקף.</p>
            <label className="extra"><input type="checkbox" checked={d.accepted} onChange={e=>setD(v=>({...v,accepted:e.target.checked}))}/><span>הבנתי שזו בקשה מדומה בלבד.</span></label><button className="primary" disabled={!d.accepted} onClick={()=>go('done')}>הדמיית בקשת הקפאה</button>
          </>}
          {d.step==='done' && <><div className="success-mark">✓</div><p className="muted">לא בוצעו חיוב, הוראת קבע או SMS. {onCreateDemoAccount && d.flow==='register' ? 'כדי להיכנס עם הפרטים שבחרתם, שמרו כעת חשבון דמה מקומי. הוא יישמר רק בדפדפן ובמכשיר האלה; מנוי יישאר ללא תשלום אמיתי.':'לא שונה חשבון אמיתי.'}</p>{onCreateDemoAccount && d.flow==='register' && <button className="primary" disabled={busy} onClick={createAccount}>{busy ? 'שומר חשבון דמה…':'שמירת חשבון דמה וכניסה לאפליקציה'}</button>}{(!embedded || initialState?.step==='account') && <button className="primary" onClick={()=>setD(readDraft(JSON.stringify(accountState)))}>לניהול החשבון לדוגמה</button>}<button className="secondary" onClick={restart}>התחלת ההדמיה מחדש</button></>}
        </div>
        {error && <p className="error" role="alert">{error}</p>}
        {!['welcome','done'].includes(d.step) && !(embedded && ['account','kind'].includes(d.step)) && <button className="text-button back" onClick={back}>→ חזרה לשלב הקודם</button>}
        <footer>סביבת בדיקות בלבד · אין עדכון באתר הפעיל{embedded && d.step!=='done' && <button className="text-button" onClick={()=>{if(window.confirm('למחוק את טיוטת ההדמיה ולהתחיל מחדש?')) restart();}}>התחלת ההדמיה מחדש</button>}</footer>
      </section>
    </main>
  </div>;
}
