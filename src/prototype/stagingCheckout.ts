import {DEFAULT_MEMBERSHIP_PLAN_CONFIGS,MembershipType,type DiscountCode,type MembershipPlanConfig,type Payment,type User} from '../types';
import {familySplitLines,groupFamilyRecurringLines} from '../../server/family-split.js';
import {canPurchasePlan} from '../../shared/youth-plan.js';
import {STAGING_CONVERSATION_ENABLED} from './integration';
import {isPagesDemoMode} from '../data/appMode';
import type {CreatePaymentRequest} from '../data/rivhitPayments';

// Same pure line/discount/grouping engine as the server, without a provider,
// journal reservation, payment row, receipt, mutation or entitlement grant.
export function stagingCheckoutQuote(request:CreatePaymentRequest,payload:{users?:User[];payments?:Payment[];settings?:{membershipPlans?:MembershipPlanConfig[]};discountCodes?:DiscountCode[]},now=new Date()){
  const user=payload.users?.find(u=>u.id===request.userId);
  if(!user) throw new Error('לא נמצא חשבון בדיקה לתשלום.');
  const catalog=(payload.settings?.membershipPlans?.length ? payload.settings.membershipPlans:DEFAULT_MEMBERSHIP_PLAN_CONFIGS).filter(p=>p.active);
  const selected=request.individualSelections?.length ? request.individualSelections:[{membershipType:request.membershipType,trainingSessionsCount:request.purchaseVariant ? Number(request.purchaseVariant.split('_').pop()) || undefined:undefined}];
  const members=request.membershipType===MembershipType.FAMILY_MEMBERSHIP ? request.familyMemberPlans || []:[{memberId:user.id,memberName:user.name,participation:'INCLUDED',...selected[0],additionalPlans:selected.slice(1)}];
  if(!members.length || new Set(members.map(m=>m.memberId)).size!==members.length) throw new Error('יש לבחור בני משפחה משויכים ושונים.');
  for(const member of members){
    const target=payload.users?.find(u=>u.id===member.memberId);
    if(!target || target.id!==user.id && (!user.familyId || target.familyId!==user.familyId)) throw new Error('בן המשפחה אינו משויך למשלם.');
    if(target.id!==user.id && user.familyPayerId && user.familyPayerId!==user.id) throw new Error('רק המשלם המשפחתי רשאי לבחור תשלום משפחתי.');
    if(member.participation && member.participation!=='INCLUDED') continue;
    for(const plan of [member,...(member.additionalPlans || [])]){
      const config=catalog.find(p=>p.id===plan.membershipType);
      if(!config || !canPurchasePlan(config,target)) throw new Error('נבחר מסלול לא פעיל או שאינו מתאים לגיל.');
      if(plan.trainingSessionsCount!==undefined && (!Number.isInteger(plan.trainingSessionsCount) || plan.trainingSessionsCount<1 || plan.trainingSessionsCount>50)) throw new Error('כמות האימונים אינה תקינה.');
    }
  }
  const discount=request.discountCode ? payload.discountCodes?.find(d=>d.code.toUpperCase()===request.discountCode?.toUpperCase() && (!d.isSingleUse || !d.isUsed)):undefined;
  if(request.discountCode && !discount) throw new Error('קוד ההנחה אינו תקין בנתוני הבדיקה.');
  const lines=familySplitLines(members.map(m=>({...m,participation:m.participation || 'INCLUDED'})),catalog,payload.payments || [],discount,false,now);
  const groups=groupFamilyRecurringLines(lines,request.familyPaymentGrouping || 'COMBINED');
  const total=lines.filter(line=>line.status==='READY').reduce((sum,line)=>sum+Math.round(line.amount*100),0)/100;
  return {lines,groups,total};
}

export async function previewStagingCheckout(request:CreatePaymentRequest){
  if(!STAGING_CONVERSATION_ENABLED || !isPagesDemoMode()) throw new Error('בדיקת תשלום זו זמינה ב־staging במצב דמה בלבד.');
  const {getClubState}=await import('../data/clubServer');
  const state=await getClubState();
  const result=stagingCheckoutQuote(request,state.payload);
  window.dispatchEvent(new CustomEvent('baly:staging-checkout-preview',{detail:result}));
  return result;
}
