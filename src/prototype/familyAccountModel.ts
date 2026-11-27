import {homeMembershipSummary} from '../../shared/home-membership-summary.js';
import {clubDate} from '../../shared/membership-calendar.js';
import {canPurchasePlan} from '../../shared/youth-plan.js';
import {activePlanExpiry,emptyFamilyPurchase} from '../data/membershipRenewal';
import {isMembershipFreezeActive} from '../data/membershipPolicy';
import {MembershipType,type User,type Payment,type MembershipPlanConfig,type FamilyMemberPlanSelection} from '../types';

const validDate=(value:unknown):value is string=>typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(`${value}T12:00:00Z`)) && new Date(`${value}T12:00:00Z`).toISOString().slice(0,10)===value;
const training=(type:string)=>['PERSONAL_TRAINING','DUO_TRAINING','OPEN_PUNCH_CARD'].includes(type);
const paymentIncludes=(payment:Payment,member:User,type:string)=>payment.familyMemberPlans?.length
  ? payment.familyMemberPlans.some(plan=>plan.memberId===member.id && (!plan.participation || plan.participation==='INCLUDED')
    && [plan,...(plan.additionalPlans || [])].some(selection=>selection.membershipType===type))
  : payment.traineeId===member.id && payment.membershipTypePurchased===type;

export function familyAccountRows(member:User,payments:Payment[],now=new Date()){
  const today=clubDate(now);
  return homeMembershipSummary(member,payments,now).map(row=>{
    const type=row.type as MembershipType;
    const contract=member.recurringMemberships?.[type];
    const expiry=contract && ['ACTIVE','PENDING_FIRST_CHARGE'].includes(contract.status) && contract.endsAt>today ? contract.endsAt
      : type===member.membershipType ? member.membershipExpiry || member.membershipPlanExpiries?.[type] || row.expiry
      : member.membershipPlanExpiries?.[type] || (type===MembershipType.WORKOUT_COACHING ? member.workoutPlanPurchaseAccessUntil:undefined) || row.expiry;
    const exclusive=type===member.membershipType ? Boolean(member.membershipExpiryExclusive):true;
    const expired=validDate(expiry) && (exclusive ? expiry<=today:expiry<today);
    const status=expired ? 'פג תוקף':validDate(expiry) && (type!==member.membershipType || member.membershipStatus!=='EXPIRED')
      ? row.status.replace(' · פג תוקף',''):row.status;
    return {...row,type,expiry:validDate(expiry) ? expiry:null,expired,status};
  });
}

// Read-only draft builder: never changes a user, receipt, term or recurring order.
export function familyRenewalDraft(members:User[],payments:Payment[],catalog:MembershipPlanConfig[],now=new Date()){
  const today=clubDate(now), warnings:string[]=[];
  const selections=emptyFamilyPurchase(members).map((empty,index)=>{
    const member=members[index];
    if(member.registrationIncomplete || member.registrationPaymentPending || member.familyPaymentPending || isMembershipFreezeActive(member,now) || member.membershipFreezeRequestedAt || member.cancellationRequestedAt || member.cancellationEffectiveDate){
      warnings.push(`${member.name}: לא נכלל — פרטים חסרים, הקפאה או בקשת ביטול.`);return {...empty,participation:'SKIP' as const};
    }
    const selected:Array<{membershipType:MembershipType;trainingSessionsCount?:number}>=[];
    for(const row of familyAccountRows(member,payments,now)){
      const contract=member.recurringMemberships?.[row.type];
      if(!row.expired || activePlanExpiry(member,row.type,today))continue;
      const config=catalog.find(plan=>plan.id===row.type && plan.active);
      const pending=payments.some(payment=>payment.status==='PENDING' && paymentIncludes(payment,member,row.type));
      if(pending || contract && (contract.status==='PAYMENT_FAILED' || contract.status==='PENDING_FIRST_CHARGE'
        || !contract.cancelledAt && contract.endsAt>today)){
        warnings.push(`${member.name}: ${config?.label || row.type} — נדרשת בדיקה של תשלום או הוראת קבע קיימים.`);continue;
      }
      if(!config || !canPurchasePlan(config,member)){
        warnings.push(`${member.name}: ${config?.label || row.type} — נדרשת בחירה ידנית של מסלול פעיל ומתאים לגיל.`);continue;
      }
      // Session quantities are deliberate purchases, never infer a new pack from a balance.
      if(training(row.type)) {warnings.push(`${member.name}: ${config.label} — יש לבחור מחדש כמות אימונים.`);continue;}
      if(config.category==='PRIMARY' && selected.some(plan=>catalog.find(p=>p.id===plan.membershipType)?.category==='PRIMARY')){
        warnings.push(`${member.name}: ${config.label} — יותר ממסלול ראשי אחד; יש לערוך ידנית.`);continue;
      }
      selected.push({membershipType:row.type});
    }
    selected.sort((a,b)=>Number(catalog.find(p=>p.id===b.membershipType)?.category==='PRIMARY')-Number(catalog.find(p=>p.id===a.membershipType)?.category==='PRIMARY'));
    return selected.length ? {...empty,participation:'INCLUDED' as const,...selected[0],additionalPlans:selected.slice(1)}
      : {...empty,participation:'SKIP' as const};
  });
  return {selections,warnings};
}

export function familyMemberEditDraft(members:User[],targetId:string,catalog:MembershipPlanConfig[],payments:Payment[],extrasOnly=false):FamilyMemberPlanSelection[]{
  return emptyFamilyPurchase(members).map(empty=>{
    if(empty.memberId!==targetId)return {...empty,participation:'SKIP'};
    if(extrasOnly)return {...empty,participation:'INCLUDED'};
    const member=members.find(user=>user.id===targetId)!;
    const types=familyAccountRows(member,payments).map(row=>row.type).filter(type=>catalog.some(plan=>plan.id===type && plan.active && canPurchasePlan(plan,member)));
    const primary=types.find(type=>catalog.find(plan=>plan.id===type)?.category==='PRIMARY') || types[0];
    return {...empty,participation:'INCLUDED',membershipType:primary || '' as MembershipType,
      trainingSessionsCount:primary && training(primary) ? 1:undefined,
      additionalPlans:types.filter(type=>type!==primary && catalog.find(plan=>plan.id===type)?.category==='ADD_ON').map(membershipType=>({membershipType,trainingSessionsCount:training(membershipType) ? 1:undefined}))};
  });
}

export function excludeFamilyRenewalPlans(selections:FamilyMemberPlanSelection[],excluded:string[]){
  return selections.map(plan=>{
    if(plan.participation!=='INCLUDED')return plan;
    const kept=[plan,...(plan.additionalPlans || [])].filter(selection=>!excluded.includes(`${plan.memberId}:${selection.membershipType}`));
    return kept.length ? {...plan,membershipType:kept[0].membershipType,trainingSessionsCount:kept[0].trainingSessionsCount,additionalPlans:kept.slice(1).map(({membershipType,trainingSessionsCount})=>({membershipType,trainingSessionsCount}))}
      : {...plan,membershipType:'' as MembershipType,participation:'SKIP' as const,additionalPlans:[]};
  });
}

// Fictional Pages state only. Caller must enforce the staging gate before saving.
// Never delete the user, receipts, health history or entitlements.
export function detachFamilyMemberDemo(users:User[],payerId:string,memberId:string):User[]{
  const payer=users.find(user=>user.id===payerId),member=users.find(user=>user.id===memberId);
  if(!payer?.isFamilyPayer || !payer.familyId || !member || member.id===payerId || member.familyId!==payer.familyId)throw new Error('יש לבחור בן משפחה משויך שאינו המשלם הראשי.');
  if([payer,member].some(user=>Object.values(user.recurringMemberships || {}).some(contract=>contract && contract.groupSize>1 && !contract.cancelledAt)))throw new Error('קיימת הוראת קבע משפחתית משותפת. נדרשת התאמת מנהל לפני הסרה; לא בוצע שינוי.');
  return users.map(user=>user.id===memberId ? {...user,familyId:undefined,familyName:undefined,familyPayerId:undefined,isFamilyPayer:false,familyMembersCount:undefined,familyMemberPlans:undefined,familyBillingMode:undefined}
    : user.id===payerId ? {...user,familyMembersCount:users.filter(item=>item.familyId===payer.familyId && item.id!==memberId).length,familyMemberPlans:user.familyMemberPlans?.filter(plan=>plan.memberId!==memberId)}:user);
}
