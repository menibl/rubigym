import React,{useEffect,useState} from 'react';
import {ORIGINAL_CHAT_TEST_ENABLED,CONNECTED_CHAT_ENABLED} from './integration';
import {requestOriginalCheckoutQuote,originalQuoteLines,originalQuoteMatchesSelections,type CreatePaymentRequest,type OriginalCheckoutQuote} from '../data/rivhitPayments';
import {excludeFamilyRenewalPlans} from './familyAccountModel';
import {ChatInterfaceSwitch} from './ChatInterfaceSwitch';
import type {FamilyMemberPlanSelection} from '../types';
const money=(amount:number)=>amount.toLocaleString('he-IL',{minimumFractionDigits:2,maximumFractionDigits:2});

export function ConnectedCheckoutReview({request,busy=false,onContinue}:{request:CreatePaymentRequest;busy?:boolean;onContinue:(selections?:FamilyMemberPlanSelection[])=>Promise<unknown>}){
  const key=JSON.stringify(request);
  const [state,setState]=useState<{key:string;quote?:OriginalCheckoutQuote;error?:string}>({key:''});
  const [confirming,setConfirming]=useState(false);
  useEffect(()=>{
    if(!CONNECTED_CHAT_ENABLED)return;
    const controller=new AbortController();setState({key});
    void requestOriginalCheckoutQuote(JSON.parse(key),controller.signal).then(quote=>{if(!controller.signal.aborted)setState({key,quote});})
      .catch(error=>{if(!controller.signal.aborted)setState({key,error:error instanceof Error ? error.message:'לא ניתן לחשב את הבחירה.'});});
    return()=>controller.abort();
  },[key]);
  if(!CONNECTED_CHAT_ENABLED)return null;
  const current=state.key===key ? state:undefined;
  const lines=current?.quote ? originalQuoteLines(current.quote):[];
  const names=new Map<string,string>((request.familyMemberPlans || [{memberId:request.userId,memberName:request.userName}]).map(member=>[member.memberId || '',member.memberName] as const));
  lines.forEach(line=>names.set(line.memberId,line.memberName));
  const payable=lines.filter(line=>line.status==='READY');
  const total=payable.reduce((sum,line)=>sum+Math.round(line.amount*100),0)/100;
  const matches=Boolean(current?.quote && originalQuoteMatchesSelections(request,current.quote));
  return <section aria-label="סיכום מהשרת המקורי לפני אישור" className="family-summary">
    <h3>סיכום מהשרת המקורי לפני אישור</h3>
    {!current?.quote && !current?.error && <p role="status">מחשב מול {ORIGINAL_CHAT_TEST_ENABLED ? 'השרת המבודד':'השרת'}…</p>}
    {current?.error && <><p role="alert">{current.error}</p><ChatInterfaceSwitch/></>}
    {current?.quote && <>{[...names].map(([memberId,name])=>{
      const memberLines=lines.filter(line=>line.memberId===memberId);
      const due=memberLines.filter(line=>line.status==='READY');
      return <article key={memberId} className="family-summary"><strong>{name}</strong>{!memberLines.length && <p>אין צורך בתשלום עבור בן משפחה זה בבחירה הנוכחית.</p>}{memberLines.map(line=><p key={line.id}>{line.label}{line.includedSessions ? ` × ${line.includedSessions}`:''} — {line.status==='READY' ? `מחיר ₪${money(line.baseAmount)}, הנחה ₪${money(line.discountAmount || 0)}, לתשלום ₪${money(line.amount)}`:`${['ALREADY_PAID','PAID'].includes(line.status) ? 'מסלול זה כבר שולם':['EXISTING_RECURRING','SETUP'].includes(line.status) ? 'הוראת קבע קיימת — אינה אישור לחיוב בפועל':line.status==='CANCELLED' ? 'לא נכלל בבחירה':line.status} — לא נכלל בחיוב חדש`}</p>)}<p>סה״כ לבן המשפחה: ₪{money(due.reduce((sum,line)=>sum+Math.round(line.amount*100),0)/100)}</p></article>;
    })}<strong>סה״כ לתשלום: ₪{money(total)}</strong><p>לפי הבקשה הקיימת שהשרת החזיר. לא נוצר חיוב מחישוב הסיכום; המשך דרך מנגנון התשלום המקורי.{ORIGINAL_CHAT_TEST_ENABLED && ' ספק מדומה בלבד בסביבה זו.'}</p>
    {!matches && <p role="alert">קיימת בקשת תשלום קודמת שאינה תואמת לבחירה או לקוד ההנחה הנוכחיים. בקשה שכבר נשלחה לסליקה לא מוחלפת אוטומטית. יש להמשיך בבחירה המקורית או לפנות למנהל — לא נפתח חיוב נוסף.</p>}
    {!payable.length && <p role="status">אין מסלולים לתשלום בבחירה זו. מסלולים שכבר שולמו או הוראות קיימות אינם מחויבים שוב. ניתן לחזור ולבחור מסלול אחר או בן משפחה אחר.</p>}
    <button type="button" className="logic-primary logic-complete" disabled={busy || confirming || !payable.length || !matches} onClick={async()=>{
      if(!current.quote || busy || confirming || !matches)return;setConfirming(true);
      try{await onContinue(request.familyMemberPlans ? excludeFamilyRenewalPlans(request.familyMemberPlans,lines.filter(line=>line.status!=='READY').map(line=>line.id)):undefined);}
      catch(error){setState({key,error:error instanceof Error ? error.message:'לא ניתן להמשיך.'});}
      finally{setConfirming(false);}
    }}>{ORIGINAL_CHAT_TEST_ENABLED ? 'אישור הסיכום והמשך לתשלום המדומה':'אישור הסיכום והמשך לתשלום מאובטח'}</button></>}
  </section>;
}
