import React,{useEffect,useState} from 'react';
import {ChevronLeft,Check,Users,ArrowRight} from 'lucide-react';
import {STAGING_CONVERSATION_ENABLED} from './integration';
import {isPagesDemoMode} from '../data/appMode';
import {familyPlanCatalog,familyMemberPlanPrice,familyPurchaseAmount} from '../data/familyMembership';
import {billingPeriodLabel} from '../data/membershipBilling';
import {isMembershipFreezeActive} from '../data/membershipPolicy';
import {canPurchasePlan} from '../../shared/youth-plan.js';
import {chooseFamilyPlan,needsSessionQuantity,validateFamilyStepDraft,removeFamilyPlanFromDraft} from './familyPlanStepsModel';
import {TRAINING_CARD_SIZES,MembershipType,type User,type FamilyMemberPlanSelection,type MembershipPlanConfig} from '../types';

type Step='members'|'participation'|'primary'|'extras'|'addon'|'selected-plans'|'quantity'|'custom'|'member-summary'|'family-summary';
interface Props {
  members:User[];plans:FamilyMemberPlanSelection[];catalog:MembershipPlanConfig[];
  onChange:(plans:FamilyMemberPlanSelection[])=>void;onEditingChange:(editing:boolean)=>void;onSummaryReady:(ready:boolean)=>void;
  initialMemberId?:string;extrasOnly?:boolean;
}
const css=`.staging-family-steps .step-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.staging-family-steps .step-tile{display:flex;flex-direction:column;align-items:flex-start;gap:10px;text-align:right;min-height:140px;min-width:0;padding:18px;border-radius:20px;border:1px solid #454957;background:#1b1e27;color:#eeeef3}.staging-family-steps .step-tile strong{font-size:17px}.staging-family-steps .step-tile small{font-size:13px;line-height:1.6;color:#b6b7c6}.staging-family-steps .step-tile svg{color:#c9a867}.staging-family-steps .step-tile[aria-pressed=true]{border-color:#c9a867;background:#302b21}.staging-family-steps .step-tile:disabled{opacity:.4}.staging-family-steps .step-summary{padding:16px;border:1px solid #454957;border-radius:18px;background:#1b1e27;margin:12px 0}.staging-family-steps .step-summary p{margin:8px 0;line-height:1.7}.staging-family-steps h3{font-size:20px;margin:16px 0;line-height:1.5}@media(max-width:360px){.staging-family-steps .step-grid{grid-template-columns:1fr}.staging-family-steps .step-tile{min-height:110px}}`;

// Navigation only: existing controlled selection DTOs and pricing remain authoritative.
export function StagingFamilyPlanSteps(props:Props){
  const [memberId,setMemberId]=useState(props.initialMemberId || props.members?.[0]?.id || '');
  const [step,setStep]=useState<Step>(props.initialMemberId ? props.extrasOnly ? 'extras':'participation':'members');
  const [history,setHistory]=useState<Step[]>([]);
  const [pending,setPending]=useState<{config:MembershipPlanConfig;additional:boolean}|null>(null);
  const [quantity,setQuantity]=useState('');
  const [error,setError]=useState('');
  const enabled=STAGING_CONVERSATION_ENABLED && isPagesDemoMode();
  const catalog=enabled ? familyPlanCatalog(props.catalog):[];
  const member=props.members?.find(user=>user.id===memberId);
  const plan=props.plans?.find(item=>item.memberId===memberId);
  const validation=enabled ? validateFamilyStepDraft(props.plans,props.members,catalog):null;
  const ready=step==='family-summary' && !validation;
  useEffect(()=>{if(enabled){props.onEditingChange(!['members','family-summary'].includes(step));props.onSummaryReady(ready);}},[enabled,step,ready]);
  useEffect(()=>()=>{if(enabled){props.onEditingChange(false);props.onSummaryReady(false);}},[enabled]);
  if(!enabled)return null;
  const go=(next:Step)=>{setHistory(previous=>[...previous,step]);setStep(next);setError('');};
  const update=(next:FamilyMemberPlanSelection)=>props.onChange(props.plans.map(item=>item.memberId===memberId ? next:item));
  const available=catalog.filter(config=>canPurchasePlan(config,member));
  const selected=[plan,...(plan?.additionalPlans || [])].filter(Boolean).map(item=>item!.membershipType);
  const tile=(title:string,detail:string,onClick:()=>void,pressed=false,disabled=false)=><button key={title} type="button" className="step-tile" aria-pressed={pressed} onClick={onClick} disabled={disabled}><strong>{title}</strong><small>{detail}</small><ChevronLeft size={20}/></button>;
  const pick=(config:MembershipPlanConfig,additional:boolean)=>{
    if(!plan)return;
    if(needsSessionQuantity(config.id)){setPending({config,additional});go('quantity');return;}
    update(chooseFamilyPlan(plan,config,undefined,additional));go('extras');
  };
  const pickQuantity=(count:number)=>{
    if(!plan || !pending)return;
    try{update(chooseFamilyPlan(plan,pending.config,count,pending.additional));go('extras');}catch(cause){setError((cause as Error).message);}
  };
  const details=(selection:FamilyMemberPlanSelection)=>selection.participation==='INCLUDED'
    ? [selection,...(selection.additionalPlans || [])].filter(item=>item.membershipType).map(item=>`${catalog.find(config=>config.id===item.membershipType)?.label || item.membershipType}${needsSessionQuantity(item.membershipType) ? ` × ${item.trainingSessionsCount || '?'}`:''}`).join(' + ') || 'טרם נבחר מסלול'
    : 'ללא חיוב ברכישה זו — המנוי הקיים לא משתנה';
  const priceLines=(selection:FamilyMemberPlanSelection)=>selection.participation==='INCLUDED' && <ul>{[selection,...(selection.additionalPlans || [])].filter(item=>item.membershipType).map(item=><li key={item.membershipType}>{catalog.find(config=>config.id===item.membershipType)?.label || item.membershipType}{needsSessionQuantity(item.membershipType) ? ` × ${item.trainingSessionsCount || '?'}`:''} — ₪{familyMemberPlanPrice({...selection,...item,additionalPlans:[]},catalog)}</li>)}</ul>;
  const reviewMember=(next:Step)=>{
    if(plan?.participation==='INCLUDED'){
      const check=validateFamilyStepDraft([plan],member ? [member]:[],catalog);if(check){setError(check);return;}
    }
    go(next);
  };
  return <section className="staging-family-steps" aria-label="בחירת מסלולים למשפחה בקוביות"><style>{css}</style>
    <button type="button" className="logic-secondary" onClick={()=>{setStep(history.at(-1) || 'members');setHistory(previous=>previous.slice(0,-1));setError('');}}><ArrowRight size={16}/> חזרה לשלב הקודם</button>
    {step!=='members' && step!=='family-summary' && <p>בחירת מסלולים עבור <strong>{member?.name}</strong></p>}
    {error && <p role="alert" className="logic-error">{error}</p>}
    {step==='members' && <><h3>למי בוחרים מסלול?</h3><div className="step-grid">{props.members.map(user=>tile(user.name,details(props.plans.find(item=>item.memberId===user.id) || {memberName:user.name,membershipType:'' as MembershipType,participation:'NOT_STARTED'}),()=>{setMemberId(user.id);setHistory(['members']);setStep('participation');}))}</div><button type="button" className="logic-primary" onClick={()=>go('family-summary')}>הצגת סיכום לכל המשפחה</button></>}
    {step==='participation' && plan && <><h3>מה תרצו לעשות?</h3><div className="step-grid">{tile('בחירת מסלול ותוספות','השלב הבא: המסלול הראשי',()=>{update({...plan,participation:'INCLUDED'});go('primary');},plan.participation==='INCLUDED',!!member && isMembershipFreezeActive(member))}{tile('לא לחדש כעת / כבר שולם','המנוי הקיים נשאר ללא שינוי',()=>{update({...plan,participation:'SKIP'});go('member-summary');},plan.participation==='SKIP')}{tile('טרם מתחיל להתאמן','ללא מסלול וללא חיוב ברכישה זו',()=>{update({...plan,participation:'NOT_STARTED'});go('member-summary');},plan.participation==='NOT_STARTED')}</div>{member && isMembershipFreezeActive(member) && <p role="note">המנוי מוקפא — ניתן לבחור רק ללא חיוב.</p>}</>}
    {step==='primary' && plan && <><h3>בחירת המסלול הראשי</h3><div className="step-grid">{available.filter(config=>config.category==='PRIMARY').map(config=>tile(config.label,`₪${config.price} · ${billingPeriodLabel(config)}`,()=>pick(config,false),plan.membershipType===config.id))}{tile('רק מסלולים נוספים','אישי, זוגי או תוכנית אימון — ללא חובה לרכוש Open Gym',()=>{update(catalog.find(item=>item.id===plan.membershipType)?.category==='PRIMARY' ? removeFamilyPlanFromDraft(plan,plan.membershipType):{...plan,participation:'INCLUDED'});go('extras');},!plan.membershipType)}</div></>}
    {step==='extras' && <><h3>להוסיף שירות נוסף?</h3><p>{plan && details(plan)}</p><div className="step-grid">{tile('הוספת מסלול נוסף','לכל תוספת ניתן לבחור כמות בנפרד',()=>go('addon'))}{tile('עריכה או הסרה מהבחירה','הסרה מהרכישה בלבד, ללא ביטול מנוי קיים',()=>go('selected-plans'))}{tile('סיימתי את הבחירה','מעבר לסיכום של בן המשפחה',()=>go('member-summary'))}</div></>}
    {step==='selected-plans' && plan && <><h3>הסרת מסלול מהבחירה</h3><p>לא נמחק מנוי ולא מבוטלת הוראת קבע — רק מסירים מהרכישה הזו.</p><div className="step-grid">{[plan,...(plan.additionalPlans || [])].filter(item=>item.membershipType).map(item=>tile(catalog.find(config=>config.id===item.membershipType)?.label || item.membershipType,'לחצו להסרה מהבחירה והמשך',()=>{update(removeFamilyPlanFromDraft(plan,item.membershipType));go('extras');}))}</div><button type="button" className="logic-secondary" onClick={()=>go('extras')}>המשך ללא הסרה</button></>}
    {step==='addon' && <><h3>בחירת תוספת</h3><div className="step-grid">{available.filter(config=>config.category==='ADD_ON' && !selected.includes(config.id as MembershipType)).map(config=>tile(config.label,`₪${config.price} · ${billingPeriodLabel(config)}`,()=>pick(config,true)))}</div>{!available.some(config=>config.category==='ADD_ON' && !selected.includes(config.id as MembershipType)) && <p>כל התוספות הזמינות כבר נבחרו.</p>}<button type="button" className="logic-secondary" onClick={()=>go('member-summary')}>סיום בחירת התוספות</button></>}
    {step==='quantity' && pending && <><h3>כמה אימונים — {pending.config.label}?</h3><div className="step-grid">{TRAINING_CARD_SIZES.map(count=>tile(`${count} אימונים`,`₪${pending.config.price*count}`,()=>pickQuantity(count)))}{tile('כמות אחרת','בחירה בין 1 ל־50 אימונים',()=>{setQuantity('');go('custom');})}</div></>}
    {step==='custom' && <><h3>כמות האימונים</h3><label>מספר אימונים<input type="number" min={1} max={50} step={1} value={quantity} onChange={event=>setQuantity(event.target.value)}/></label><button type="button" className="logic-primary" onClick={()=>pickQuantity(Number(quantity))}>אישור הכמות והמשך</button></>}
    {step==='member-summary' && plan && <><h3>סיכום הבחירה — {member?.name}</h3><article className="step-summary"><p>{details(plan)}</p>{priceLines(plan)}<strong>₪{familyMemberPlanPrice(plan,catalog)}</strong></article><div className="step-grid">{tile('אישור ובחירת בן משפחה הבא','חזרה לקוביות בני המשפחה',()=>reviewMember('members'))}{tile('אישור והצגת סיכום המשפחה','כל בני המשפחה לפני אישור סופי',()=>reviewMember('family-summary'))}{tile('עריכת הבחירה','חזרה למסלול הראשי והתוספות',()=>go('primary'))}</div></>}
    {step==='family-summary' && <><h3><Users size={22}/> סיכום לכל המשפחה לפני אישור</h3>{props.plans.map(selection=><article className="step-summary" key={selection.memberId}><strong>{selection.memberName}</strong><p>{details(selection)}</p>{priceLines(selection)}<p>₪{familyMemberPlanPrice(selection,catalog)}</p><button type="button" className="logic-secondary" onClick={()=>{setMemberId(selection.memberId!);go('participation');}}>עריכה — {selection.memberName}</button></article>)}<p className="step-summary"><strong>סה״כ בחירה לפי הקטלוג: ₪{familyPurchaseAmount('CUSTOM_COMBINED',props.members.length,props.plans,catalog)}</strong><br/>הנחה, אופן התשלום ופירוט החישוב יופיעו לפני האישור. אין חיוב ואין שינוי במנויים מבדיקת החישוב.</p>{validation && <p role="alert" className="logic-error">{validation}</p>}{ready && <p role="status"><Check size={18}/> הסיכום מוכן — ניתן לאשר ולהמשיך לבדיקה ללא חיוב.</p>}</>}
  </section>;
}
