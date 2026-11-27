import React,{useState} from 'react';
import {Users,RefreshCw,UserPlus,Settings,PauseCircle,XCircle,Trash2,ChevronLeft} from 'lucide-react';
import {CONNECTED_CHAT_ENABLED} from './integration';
import {stagingLogicEnabled} from './StagingLogicChat';
import {ChatInterfaceSwitch} from './ChatInterfaceSwitch';
import {ConnectedCheckoutReview} from './ConnectedCheckoutReview';
import {familyAccountRows,familyRenewalDraft,excludeFamilyRenewalPlans} from './familyAccountModel';
import {familyRenewalSummary,type FamilyRenewalSummary} from './familyRenewalSummary';
import {FamilyRenewalPriceSummary} from './FamilyRenewalPriceSummary';
import {DiscountCodeField} from '../components/DiscountCodeField';
import {MEMBERSHIP_TYPE_LABELS,MembershipType,type User,type Payment,type MembershipPlanConfig,type FamilyMemberPlanSelection,type DiscountCode} from '../types';

const style=`
.staging-family-account .family-tiles{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:18px 0}
.staging-family-account .family-tile{display:flex;flex-direction:column;align-items:flex-start;gap:10px;min-width:0;min-height:150px;padding:18px;text-align:right;border:1px solid #383c48;border-radius:22px;background:#1b1e27;color:#eeeef3;cursor:pointer}
.staging-family-account .family-tile strong{font-size:17px;line-height:1.5}.staging-family-account .family-tile small{display:block;font-size:13px;color:#b6b7c6;line-height:1.6}
.staging-family-account .family-icon{padding:12px;border-radius:15px;background:#c9a86718;color:#c9a867}.staging-family-account .family-tile .family-arrow{margin-top:auto;color:#c9a867}
.staging-family-account .family-summary{padding:16px;border:1px solid #454957;border-radius:18px;margin:12px 0;background:#1b1e27}.staging-family-account .family-summary p{font-size:14px;line-height:1.7;margin:8px 0}
.staging-family-account h3{font-size:20px;line-height:1.5;margin:16px 0}.staging-family-account .family-tile:disabled{opacity:.45;cursor:not-allowed}
@media(max-width:360px){.staging-family-account .family-tiles{grid-template-columns:1fr}.staging-family-account .family-tile{min-height:120px}}
`;
interface Props {
  members:User[];payments:Payment[];plans:MembershipPlanConfig[];canManage:boolean;busy:boolean;
  onEdit:(memberId:string,extrasOnly?:boolean,draft?:FamilyMemberPlanSelection[])=>void;onAdd:()=>void;onFreeze:(memberId:string)=>void;
  onDetach:(memberId:string)=>boolean;
  onContinue:(selections:FamilyMemberPlanSelection[])=>Promise<boolean|void>;
  discountCodes:DiscountCode[];discountInput:string;onDiscountInput:(value:string)=>void;
  appliedDiscount:DiscountCode|null;onDiscount:(discount:DiscountCode|null)=>void;
  onMessage:(message:string,isError?:boolean)=>void;
}

export function StagingFamilyAccount(props:Props){
  const [selected,setSelected]=useState<string|null>(null);
  const [screen,setScreen]=useState<'cards'|'renew'|'freeze'|'cancel'|'remove-plan'|'remove-member'>('cards');
  const [excluded,setExcluded]=useState<string[]>([]);
  const [notice,setNotice]=useState('');
  if(!stagingLogicEnabled())return null;
  const {members,payments,plans,canManage}=props;
  const member=members.find(item=>item.id===selected);
  const initial=familyRenewalDraft(members,payments,plans);
  const draft={...initial,selections:excludeFamilyRenewalPlans(initial.selections,excluded)};
  let summary:FamilyRenewalSummary|undefined;
  let summaryError='';
  if(screen==='renew' && !CONNECTED_CHAT_ENABLED)try{summary=familyRenewalSummary(draft.selections,members,payments,plans,props.discountCodes,props.appliedDiscount);}catch(error){summaryError=error instanceof Error ? error.message:'לא ניתן לחשב את סיכום החידוש.';}
  const label=(type:string)=>plans.find(plan=>plan.id===type)?.label || MEMBERSHIP_TYPE_LABELS[type]?.label || type;
  const tile=(title:string,description:string,icon:React.ReactNode,action:()=>void,disabled=false)=><button type="button" className="family-tile" onClick={action} disabled={disabled}><span className="family-icon">{icon}</span><strong>{title}</strong><small>{description}</small><ChevronLeft size={19} className="family-arrow"/></button>;
  const choose=(next:typeof screen)=>{setScreen(next);setNotice('');};
  return <section className="staging-family-account" aria-label="החשבון המשפחתי בקוביות"><style>{style}</style>
    {(member || screen!=='cards') && <button type="button" className="logic-secondary" onClick={()=>{setSelected(null);choose('cards');}}>חזרה לחשבון המשפחתי</button>}
    {notice && <p role="status" className="family-summary">{notice}</p>}
    {screen==='cards' && !member && <>
      <h3>החשבון המשפחתי</h3><p>בחרו בן משפחה לניהול המסלולים שלו. כל קובייה פותחת את השלב הבא.</p>
      <div className="family-tiles">{members.map(item=><button type="button" key={item.id} className="family-tile" aria-label={`ניהול המסלולים של ${item.name}`} onClick={()=>{setSelected(item.id);setNotice('');}}>
        <span className="family-icon"><Users size={25}/></span><strong>{item.name}</strong>
        {familyAccountRows(item,payments).map(row=><small key={row.type}>{label(row.type)}<br/>{row.status} · {row.expiry ? `עד ${row.expiry}`:'תוקף לא תועד'}</small>)}
        {!familyAccountRows(item,payments).length && <small>ללא מסלול — בחירת מסלול בשלב הבא</small>}<ChevronLeft size={19} className="family-arrow"/>
      </button>)}</div>
      {canManage && <div className="family-tiles">{tile('חידוש לכל המשפחה','הכנת המסלולים שפג תוקפם, סיכום ואישור לפני המשך',<RefreshCw size={25}/>,()=>choose('renew'))}{tile('הוספת בן משפחה','הוספת פרטים והצהרת בריאות בצ׳אט',<UserPlus size={25}/>,props.onAdd)}</div>}
    </>}
    {screen==='cards' && member && <><h3>המסלולים של {member.name}</h3>
      <div className="family-tiles">{familyAccountRows(member,payments).map(row=><button type="button" className="family-tile" key={row.type} onClick={()=>props.onEdit(member.id)} disabled={!canManage}>
        <span className="family-icon"><Settings size={25}/></span><strong>{label(row.type)}</strong><small>{row.status}<br/>{row.expiry ? `תוקף: ${row.expiry}`:'תוקף לא תועד'}{row.remaining!==null && <><br/>יתרה: {row.remaining} אימונים / כניסות</>}</small><small>עריכת המסלול והתוספות</small><ChevronLeft size={19} className="family-arrow"/>
      </button>)}</div>
      {canManage && <div className="family-tiles">{tile('עריכת מסלולים','בחירת מסלול ותוספות ללא שינוי במנוי לפני אישור',<Settings size={25}/>,()=>props.onEdit(member.id))}{tile('רכישת מסלול נוסף','סל חדש לתוספת — המנוי הקיים לא משתנה',<UserPlus size={25}/>,()=>props.onEdit(member.id,true))}{tile('הקפאה','בקשת הקפאה בהתאם לתנאי המנוי',<PauseCircle size={25}/>,()=>choose('freeze'))}{tile('ביטול מסלול','תצוגת תנאים ובקשה למנהל',<XCircle size={25}/>,()=>choose('cancel'))}{tile('הסרת מסלול מחידוש','לא לכלול מסלול בחידוש הקרוב — ללא ביטול זכויות קיימות',<Trash2 size={25}/>,()=>choose('remove-plan'))}{tile('הסרת בן משפחה','הפרדת השיוך המשפחתי, ללא מחיקת החשבון או היסטוריה',<Users size={25}/>,()=>choose('remove-member'),member.isFamilyPayer)}</div>}
    </>}
    {screen==='renew' && <><h3>סיכום חידוש לכל המשפחה</h3><p>רק מסלולים עם תוקף מתועד שפג נבחרו. מנויים פעילים והוראות קבע פעילות לא מתחדשים שוב.</p>
      {summary && <FamilyRenewalPriceSummary summary={summary} onEdit={memberId=>props.onEdit(memberId,false,summary!.selections)}/>}
      {summaryError && <p role="alert">לא ניתן לאשר חידוש: {summaryError}</p>}
      {draft.warnings.map((warning,index)=><p role="note" key={index}>{warning}</p>)}
      {summary && !summary.payable && <p role="status">אין מסלולים שניתן לחדש אוטומטית. ניתן להיכנס לקוביית בן המשפחה ולבחור מסלול ידנית.</p>}
      {excluded.length>0 && <button type="button" className="logic-secondary" onClick={()=>setExcluded([])}>שחזור בחירת המסלולים שפגו</button>}
      <DiscountCodeField discountCodes={props.discountCodes} value={props.discountInput} onChange={props.onDiscountInput} applied={props.appliedDiscount} onApplied={props.onDiscount} onMessage={props.onMessage}/>
      {CONNECTED_CHAT_ENABLED ? <ConnectedCheckoutReview request={{userId:members[0].id,userName:members[0].name,email:members[0].email,phone:members[0].phone,membershipType:MembershipType.FAMILY_MEMBERSHIP,mode:'PRIMARY',familyMembersCount:members.length,familyName:members[0].familyName,familyBillingMode:'CUSTOM_COMBINED',familyMemberPlans:draft.selections,discountCode:props.appliedDiscount?.code}} busy={!canManage || props.busy} onContinue={async selections=>props.onContinue(selections || draft.selections)}/>:<button type="button" className="logic-primary logic-complete" disabled={!canManage || !summary?.payable || props.busy} onClick={async()=>{if(!summary?.payable)return;setNotice('');const ok=await props.onContinue(summary.selections);if(ok)setNotice('החישוב הושלם — הפירוט מופיע בהמשך המסך. לא בוצע חיוב ולא חודש מנוי.');}}>אישור הסיכום והמשך לבדיקה ללא חיוב</button>}
    </>}
    {member && screen==='freeze' && <div className="family-summary"><h3>הקפאת המנוי של {member.name}</h3><p>חודש אחד רצוף, פעם בשנה, בכפוף לאישור המנהל ולתנאי המנוי. הוראה משפחתית משותפת דורשת התאמת גבייה בידי המנהל.</p><button type="button" className="logic-primary" onClick={()=>props.onFreeze(member.id)}>המשך לבקשת ההקפאה הקיימת</button></div>}
    {member && screen==='remove-plan' && <><h3>הסרת מסלול מחידוש — {member.name}</h3><p>הפעולה משנה רק את בחירת החידוש הבאה. אין ביטול מנוי קיים או הוראת קבע.</p><div className="family-tiles">{familyAccountRows(member,payments).map(row=>tile(label(row.type),excluded.includes(`${member.id}:${row.type}`) ? 'לא ייכלל בחידוש':'לחצו כדי לא לכלול בחידוש הבא',<Trash2 size={25}/>,()=>{setExcluded(previous=>[...new Set([...previous,`${member.id}:${row.type}`])]);setNotice(`${label(row.type)} הוסר מבחירת החידוש בלבד.`);},excluded.includes(`${member.id}:${row.type}`)))}</div><button type="button" className="logic-primary" onClick={()=>choose('renew')}>המשך לסיכום החידוש</button></>}
    {member && screen==='remove-member' && <div className="family-summary"><h3>הסרת {member.name} מהמשפחה</h3>{CONNECTED_CHAT_ENABLED ? <><p>הפרדת בן משפחה עם תשלומים קיימים אינה מבוצעת מהצ׳אט. יש להשתמש במנגנון המקורי ובבדיקת מנהל, ללא שינוי אוטומטי בגבייה.</p><ChatInterfaceSwitch/></>:<><p>בסביבת הבדיקות תופרד הזיקה המשפחתית בלבד. החשבון, הצהרת הבריאות, תשלומים, תוקף ומסלולים לא יימחקו. זו אינה הפסקת גבייה.</p><p>כאשר קיימת הוראת קבע משותפת, נדרשת התאמת מנהל וההסרה לא תבוצע כאן.</p><button type="button" className="logic-primary" onClick={()=>{if(props.onDetach(member.id)){setSelected(null);choose('cards');}else setNotice('ההסרה לא בוצעה. נדרשת בדיקת מנהל של השיוך והגבייה המשפחתית.');}}>אישור הסרה מנתוני הדמה בלבד</button></>}</div>}
    {member && screen==='cancel' && <div className="family-summary"><h3>ביטול מסלול — {member.name}</h3><p>במנוי שנתי נדרשת הודעה מוקדמת וחודש קדימה לפי תנאי המועדון. אין ביטול של הוראת קבע או פגיעה במנויים של שאר בני המשפחה מהמסך הזה.</p>{CONNECTED_CHAT_ENABLED ? <><p>יש להמשיך למנגנון הביטול המקורי. לא נשלחה בקשה מהצ׳אט.</p><ChatInterfaceSwitch/></>:<><p role="status">תצוגת בדיקה בלבד — הבקשה עדיין לא נשלחה ולא בוצע שינוי.</p><button type="button" className="logic-primary" onClick={()=>setNotice('בקשת הביטול הודגמה בלבד. לא נשלחה הודעה למנהל או SMS ולא השתנה מנוי.')}>הדגמת אישור בקשת ביטול ללא שינוי</button></>}</div>}
  </section>;
}
