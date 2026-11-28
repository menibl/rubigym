import React,{Children,isValidElement,useEffect,useRef,useState,type ReactNode} from 'react';
import {ORIGINAL_CHAT_TEST_ENABLED,CONNECTED_CHAT_ENABLED,PRODUCTION_CHAT_ENABLED,chatUiEnabled} from './integration';
import {ChatInterfaceSwitch} from './ChatInterfaceSwitch';
import {isPagesDemoMode} from '../data/appMode';
import {HealthDeclarationForm} from '../components/HealthDeclarationForm';

// The shell owns presentation only. Field values, validation, submit handlers,
// registration DTOs and membership mutations remain in the original components.
export const stagingLogicEnabled=()=>chatUiEnabled() && (CONNECTED_CHAT_ENABLED || isPagesDemoMode());
const scrollLock={count:0,body:'',html:''};

export function StagingLogicScreen({title,onClose,children}:{title:string;onClose?:()=>void;children:ReactNode}){
  useEffect(()=>{if(scrollLock.count++===0){scrollLock.body=document.body.style.overflow;scrollLock.html=document.documentElement.style.overflow;document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';}return()=>{if(--scrollLock.count===0){document.body.style.overflow=scrollLock.body;document.documentElement.style.overflow=scrollLock.html;}};},[]);
  return <section role="dialog" aria-modal="true" aria-label={title} className="staging-logic-chat" dir="rtl"><header className="logic-header"><div><strong>{title}</strong><small>{PRODUCTION_CHAT_ENABLED ? 'BALY WELLNESS':'staging · הלוגיקה המקורית'}</small></div><ChatInterfaceSwitch/>{onClose && <button type="button" className="logic-back" onClick={onClose}>חזרה לאפליקציה</button>}</header>{!PRODUCTION_CHAT_ENABLED && <details className="logic-notice"><summary>{ORIGINAL_CHAT_TEST_ENABLED ? 'DB מבודד · תשלום ו־SMS מדומים':'נתוני בדיקה בלבד · ללא חיובים או SMS'}</summary><p>סביבת בדיקות בלבד. השתמשו בנתוני בדיקה, לא במידע אישי אמיתי.</p></details>}<div className="logic-content">{children}</div></section>;
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
