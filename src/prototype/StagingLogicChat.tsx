import React,{Children,isValidElement,useEffect,useRef,useState,type ReactNode} from 'react';
import {ORIGINAL_CHAT_TEST_ENABLED,chatUiEnabled} from './integration';
import {ChatInterfaceSwitch} from './ChatInterfaceSwitch';
import {completionStyle} from './completionStyle';
import {isPagesDemoMode} from '../data/appMode';
import {HealthDeclarationForm} from '../components/HealthDeclarationForm';

// The shell owns presentation only. Field values, validation, submit handlers,
// registration DTOs and membership mutations remain in the original components.
export const stagingLogicEnabled=()=>chatUiEnabled() && (ORIGINAL_CHAT_TEST_ENABLED || isPagesDemoMode());
const css=`
.staging-logic-chat{--chat-gold:#c9a867;--chat-bg:#101218;--chat-surface:#1b1e27;--chat-text:#eeeef3;color:var(--chat-text);background:var(--chat-bg);font-family:Heebo,Arial,sans-serif;overflow-wrap:anywhere;position:fixed;inset:0;z-index:45;height:100dvh;display:flex;flex-direction:column}
.staging-logic-chat .logic-header{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 16px;border-bottom:1px solid #45404e;flex-shrink:0;background:#171923}
.staging-logic-chat .logic-header strong{font-size:16px;line-height:1.4}.staging-logic-chat .logic-header small{display:block;font-size:12px;color:#b6b7c6}
.staging-logic-chat button{touch-action:manipulation}.staging-logic-chat .logic-back{min-height:44px;padding:8px 12px;border:1px solid #83745c;border-radius:10px;background:#242735;color:var(--chat-text);font-size:14px}
.staging-logic-chat .logic-notice{font-size:13px;padding:10px 16px;color:#ead298;border-bottom:1px solid #665735}
.staging-logic-chat .logic-notice summary{cursor:pointer;min-height:24px}.staging-logic-chat .logic-notice p{margin-top:8px}
.staging-logic-chat .logic-content{max-width:760px;width:100%;margin:0 auto;padding:20px 16px 24px;overflow-y:auto;overscroll-behavior:contain;flex:1;min-height:0}
.staging-logic-chat .logic-question{font-size:24px;line-height:1.4;margin:20px 0 12px;color:var(--chat-text);font-weight:600}
.staging-logic-chat .logic-answer{display:grid;gap:18px;padding:0;margin:18px 0}
.staging-logic-chat .logic-answer>label{display:block;font-size:16px;color:#b6b7c6;line-height:1.6}
.staging-logic-chat input:not([type=checkbox]):not([type=radio]),.staging-logic-chat select{width:100%;min-height:52px;padding:12px 16px;background:#141720;color:#fff;border:1px solid #454957;border-radius:12px;font-size:16px;margin-top:8px;min-width:0;max-width:100%}
.staging-logic-chat input[type=checkbox],.staging-logic-chat input[type=radio]{width:20px;height:20px;accent-color:var(--chat-gold);flex-shrink:0}
.staging-logic-chat .logic-primary,.staging-logic-chat .auth-primary{width:100%;min-height:52px;padding:12px 20px;border:0;border-radius:12px;background:var(--chat-gold);color:#171810;font-size:16px;font-weight:600;margin-top:12px}
.staging-logic-chat .logic-primary:disabled{opacity:.45}.staging-logic-chat .logic-secondary{min-height:48px;padding:10px;border:1px solid #525564;border-radius:12px;background:transparent;color:var(--chat-text);font-size:15px}
.staging-logic-chat .logic-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin:18px 0}
.staging-logic-chat .logic-actions button{font-size:15px;min-height:48px;padding:10px 8px;border:1px solid #525564;border-radius:12px;background:#151822;color:var(--chat-text)}
.staging-logic-chat .logic-actions button[aria-pressed=true]{border-color:var(--chat-gold);background:#302b21}
.staging-logic-chat .logic-error{font-size:15px;color:#ffb9be;padding:12px;background:#c23c4a12;border-radius:10px}
.staging-logic-chat button:focus-visible,.staging-logic-chat input:focus-visible{outline:3px solid var(--chat-gold);outline-offset:4px}
.staging-logic-chat .auth-gender button.active{background:var(--chat-gold);color:#171810}
.staging-logic-chat .auth-panel{width:100%;max-width:none;border:0;border-radius:0;background:transparent;box-shadow:none;padding:0}
.staging-logic-chat .auth-panel-logo,.staging-logic-chat .auth-progress{display:none}
.staging-logic-chat [class*="bg-indigo-"],.staging-logic-chat [class*="bg-purple-"]{background-color:#302b21!important;color:#ead298!important}
.staging-logic-chat [class*="text-indigo-"],.staging-logic-chat [class*="text-purple-"]{color:#ead298!important}
@media(max-width:600px){.staging-logic-chat .logic-content{margin:0;padding:18px 16px 24px}.staging-logic-chat .logic-header{padding-top:max(8px,env(safe-area-inset-top))}.staging-logic-chat{padding-bottom:env(safe-area-inset-bottom)}.staging-logic-chat .logic-content>section{min-width:0;max-width:100%}}
@media(max-width:600px){.staging-logic-chat .logic-family,.staging-logic-chat .logic-family>section{padding:0!important;border:0!important;background:transparent!important}.staging-logic-chat .logic-family article{padding:14px!important}.staging-logic-chat #membership-checkout{padding:0!important;border:0;background:transparent!important}.staging-logic-chat .auth-panel>h1{font-size:24px;line-height:1.4}}
.staging-logic-chat .logic-family-settings .user-settings-dialog{margin:0;max-height:none;max-width:none;overflow:visible;border:0;border-radius:0;background:transparent!important;box-shadow:none;animation:none}
.staging-logic-chat .logic-family-settings [data-chat-settings-header],.staging-logic-chat .logic-family-settings [data-chat-settings-tabs]{display:none}
.staging-logic-chat .logic-family-settings [data-chat-settings-body],.staging-logic-chat .logic-family-settings [data-chat-family-container]{padding:0;border:0;background:transparent!important}
.staging-logic-chat .logic-family-settings .logic-answer>label{font-size:16px;font-weight:400}
.staging-logic-chat .logic-family-settings .logic-answer>[data-chat-submit]{display:flex;gap:12px;flex-wrap:wrap}
.staging-logic-chat .logic-family-settings [data-chat-submit] button[type=submit]{min-height:52px;padding:12px 20px;background:#c9a867;color:#171810;border:0;border-radius:12px;font-size:16px}
.staging-logic-chat .logic-family-settings [data-chat-submit] button[type=button]{min-height:48px;padding:10px 16px;border:1px solid #525564;border-radius:12px;background:transparent;color:#eeeef3;font-size:15px}
${completionStyle}
`;
const scrollLock={count:0,body:'',html:''};

export function StagingLogicScreen({title,onClose,children}:{title:string;onClose?:()=>void;children:ReactNode}){
  useEffect(()=>{if(scrollLock.count++===0){scrollLock.body=document.body.style.overflow;scrollLock.html=document.documentElement.style.overflow;document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';}return()=>{if(--scrollLock.count===0){document.body.style.overflow=scrollLock.body;document.documentElement.style.overflow=scrollLock.html;}};},[]);
  return <section role="dialog" aria-modal="true" aria-label={title} className="staging-logic-chat" dir="rtl"><style>{css}</style><header className="logic-header"><div><strong>{title}</strong><small>staging · הלוגיקה המקורית</small></div><ChatInterfaceSwitch/>{onClose && <button type="button" className="logic-back" onClick={onClose}>חזרה לאפליקציה</button>}</header><details className="logic-notice"><summary>{ORIGINAL_CHAT_TEST_ENABLED ? 'DB מבודד · תשלום ו־SMS מדומים':'נתוני בדיקה בלבד · ללא חיובים או SMS'}</summary><p>סביבת בדיקות בלבד. השתמשו בנתוני בדיקה, לא במידע אישי אמיתי.</p></details><div className="logic-content">{children}</div></section>;
}

export function StagingRegistrationSurface({children,...rest}:React.HTMLAttributes<HTMLElement>){
  return stagingLogicEnabled() ? <StagingLogicScreen title="הרשמה בצ׳אט">{children}</StagingLogicScreen>:<main {...rest}>{children}</main>;
}

export function StagingFamilySettingsSurface({enabled,onExit,children,className}:{enabled:boolean;onExit:()=>void;children:ReactNode;className:string}){
  return stagingLogicEnabled() && enabled ? <StagingLogicScreen title="הוספת בני משפחה בצ׳אט" onClose={onExit}><div className="logic-family-settings">{children}</div></StagingLogicScreen>:<div className={className}>{children}</div>;
}

export function StagingFamilySetup({enabled,children,onSubmit,className,flowKey}:React.FormHTMLAttributes<HTMLFormElement>&{enabled:boolean;flowKey:string}){
  return enabled ? <StagingChatForm flowKey={flowKey} onSubmit={onSubmit}>{children}</StagingChatForm>:<div className={className}>{children}</div>;
}

export function StagingMembershipSurface({children,selected,choice,onChoice,onClose,family}:{children:ReactNode;selected:boolean;choice:string;onChoice:(choice:string)=>void;onClose:()=>void;family:boolean}){
  if(!stagingLogicEnabled()) return <div className="space-y-6"><ChatInterfaceSwitch/>{children}</div>;
  return <StagingLogicScreen title="המנוי והתשלומים שלי" onClose={onClose}>
    <h2 className="logic-question">מה תרצו לעדכן?</h2>
    {!selected && <nav className="logic-actions" aria-label="ניהול מנוי בצ׳אט">{[['overview','החשבון שלי'],['plans','עדכון או חידוש מסלול'],['extras','רכישת שירות נוסף'],...(family ? [['family','תשלום משפחתי']]:[]),['policy','ביטול או הקפאה']].map(([value,label])=><button key={value} type="button" aria-pressed={choice===value} onClick={()=>onChoice(value)}>{label}</button>)}</nav>}
    <div className="space-y-6">{children}</div>
    <StagingCheckoutResult />
  </StagingLogicScreen>;
}

function StagingCheckoutResult(){
  const [result,setResult]=useState<{lines:{id:string;label:string;memberName:string;amount:number;status:string;recurring:boolean}[];total:number}|null>(null);
  useEffect(()=>{const listener=(event:Event)=>setResult((event as CustomEvent).detail);window.addEventListener('baly:staging-checkout-preview',listener);return()=>window.removeEventListener('baly:staging-checkout-preview',listener);},[]);
  return result && <section role="status" aria-label="תוצאת בדיקת חישוב ללא חיוב" className="logic-answer"><h3>תצוגת בדיקה — לא נוצר תשלום</h3>{result.lines.map(line=><p key={line.id}>{line.memberName} · {line.label}: ₪{line.amount} · {line.status==='READY' ? line.recurring ? 'מחזורי':'חד־פעמי':'כבר קיים — ללא חיוב נוסף'}</p>)}<strong>סה״כ בחירה לתשלום: ₪{result.total}</strong><p>אין קבלה, הוראת קבע או פתיחת מנוי מבדיקת החישוב. אין אישור מרווחית.</p></section>;
}

export function StagingChatForm({children,onSubmit,className,flowKey,chatEnabled=true,...rest}:React.FormHTMLAttributes<HTMLFormElement>&{flowKey?:string;chatEnabled?:boolean}){
  const enabled=stagingLogicEnabled() && chatEnabled;
  const groups=chatQuestionGroups(children);
  const key=`${flowKey || 'form'}`;
  const readQuestion=()=>{if(!enabled)return 0;try{const saved=Math.max(0,Number(sessionStorage.getItem(`baly-staging-question:${key}`)) || 0);return Math.min(saved,firstMissingPassword(groups));}catch{return 0;}};
  const [step,setStep]=useState(readQuestion);
  const [error,setError]=useState('');
  const answer=useRef<HTMLDivElement>(null);
  useEffect(()=>{setStep(readQuestion());setError('');},[key,enabled]);
  useEffect(()=>{if(enabled){try{sessionStorage.setItem(`baly-staging-question:${key}`,String(step));}catch{/* no credentials are persisted */}}},[key,step,enabled]);
  const at=Math.min(step,Math.max(0,groups.length-1));
  const advance=()=>{
    const controls=answer.current?.querySelectorAll<HTMLInputElement>('input,select,textarea');
    for(const input of controls || []){if(!input.checkValidity()){input.reportValidity();return;}}
    const health=answer.current?.querySelector('.auth-health-launch');
    if(health && !health.classList.contains('complete')) return setError('יש להשלים את טופס הצהרת הבריאות המקורי לפני ההמשך.');
    setError('');setStep(at+1);
  };
  if(!enabled) return <form {...rest} className={className} onSubmit={onSubmit}>{children}</form>;
  return <form {...rest} className="logic-form" data-chat-final-step={at===groups.length-1 && !['phone','otp'].includes(flowKey || '')} onSubmit={event=>{if(at<groups.length-1){event.preventDefault();advance();}else onSubmit?.(event);}}>
    {Children.toArray(children).filter(node=>isValidElement<Record<string,unknown>>(node) && node.props['data-chat-context'])}
    <p className="text-sm text-zinc-400">שלב {at+1} מתוך {groups.length}</p>
    <div ref={answer} className="logic-answer">{groups[at]}</div>
    {error && <p role="alert" className="logic-error">{error}</p>}
    {at<groups.length-1 && <button type="button" className="logic-primary" onClick={advance}>ממשיכים ←</button>}
    {at>0 && <button type="button" className="logic-secondary" onClick={()=>{setError('');setStep(at-1);}}>→ חזרה לשאלה הקודמת</button>}
  </form>;
}

export function chatQuestionGroups(children:ReactNode){
  const groups:ReactNode[][]=[];
  let foundSubmit=false;
  const flatten=(nodes:ReactNode):ReactNode[]=>Children.toArray(nodes).flatMap(node=>isValidElement<Record<string,unknown>>(node) && node.props['data-chat-fields'] ? flatten(node.props.children as ReactNode):[node]);
  for(const node of flatten(children)){
    if(isValidElement<Record<string,unknown>>(node) && node.props['data-chat-context'])continue;
    if(foundSubmit) groups[groups.length-1].push(node);
    else if(isValidElement<Record<string,unknown>>(node) && (node.type===HealthDeclarationForm || node.props['data-chat-health']) && groups.length) groups[groups.length-1].push(node);
    else groups.push([node]);
    if(isValidElement<Record<string,unknown>>(node) && (node.type==='button' && node.props.type==='submit' || node.props['data-chat-submit'])) foundSubmit=true;
  }
  // Phone and OTP are single-question forms: keep their original submit beside
  // the input instead of introducing a redundant extra confirmation question.
  return groups.length===2 && isValidElement<{type?:string}>(groups[1][0]) && groups[1][0].type==='button' && groups[1][0].props.type==='submit'
    ? [[...groups[0],...groups[1]]]:groups;
}

function firstMissingPassword(groups:ReactNode[][]){
  const missing=(node:ReactNode):boolean=>Children.toArray(node).some(child=>isValidElement<{type?:string;value?:unknown;checked?:boolean;required?:boolean;children?:ReactNode}>(child) && (child.type==='input' && (child.props.type==='password' && !child.props.value || child.props.required && (child.props.type==='checkbox' ? !child.props.checked:!String(child.props.value ?? '').trim())) || missing(child.props.children)));
  const index=groups.findIndex(group=>missing(group));return index<0 ? groups.length-1:index;
}
