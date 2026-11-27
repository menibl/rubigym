import {selectFamilyAdditionalPlan} from '../data/familyMembership';
import {isMembershipFreezeActive} from '../data/membershipPolicy';
import {canPurchasePlan} from '../../shared/youth-plan.js';
import {CURRENT_MEMBERSHIP_ADD_ONS,MembershipType,type FamilyMemberPlanSelection,type MembershipPlanConfig,type User} from '../types';

export const needsSessionQuantity=(type:string)=>[MembershipType.PERSONAL_TRAINING,MembershipType.DUO_TRAINING].includes(type as MembershipType);

export function removeFamilyPlanFromDraft(plan:FamilyMemberPlanSelection,type:string):FamilyMemberPlanSelection{
  const kept=[plan,...(plan.additionalPlans || [])].filter(item=>item.membershipType && item.membershipType!==type);
  return {...plan,membershipType:kept[0]?.membershipType || '' as MembershipType,trainingSessionsCount:kept[0]?.trainingSessionsCount,
    additionalPlans:kept.slice(1).map(({membershipType,trainingSessionsCount})=>({membershipType,trainingSessionsCount}))};
}

export function chooseFamilyPlan(plan:FamilyMemberPlanSelection,config:MembershipPlanConfig,quantity:number|undefined,additional:boolean):FamilyMemberPlanSelection{
  if(needsSessionQuantity(config.id) && (!Number.isInteger(quantity) || quantity!<1 || quantity!>50))throw new Error('יש לבחור בין 1 ל־50 אימונים במספר שלם.');
  const selection={membershipType:config.id as MembershipType,trainingSessionsCount:needsSessionQuantity(config.id) ? quantity:undefined};
  const preserved=CURRENT_MEMBERSHIP_ADD_ONS.includes(plan.membershipType)
    ? [{membershipType:plan.membershipType,trainingSessionsCount:plan.trainingSessionsCount},...(plan.additionalPlans || [])]
    : plan.additionalPlans || [];
  return additional ? selectFamilyAdditionalPlan({...plan,participation:'INCLUDED'},selection,true)
    : {...plan,...selection,participation:'INCLUDED',additionalPlans:preserved.filter(item=>item.membershipType!==config.id)};
}

export function validateFamilyStepDraft(selections:FamilyMemberPlanSelection[],members:User[],catalog:MembershipPlanConfig[]):string|null{
  if(selections.length!==members.length || selections.some(plan=>!members.some(member=>member.id===plan.memberId)) || new Set(selections.map(plan=>plan.memberId)).size!==selections.length)return 'יש לבחור בני משפחה משויכים ושונים בלבד.';
  if(!selections.some(plan=>plan.participation==='INCLUDED'))return 'יש לבחור לפחות בן משפחה אחד לתשלום.';
  for(const plan of selections){
    if(plan.participation!=='INCLUDED')continue;
    const member=members.find(user=>user.id===plan.memberId)!;
    if(isMembershipFreezeActive(member))return `${member.name}: המנוי מוקפא. יש לבחור ללא חיוב.`;
    const choices=[plan,...(plan.additionalPlans || [])];
    if(new Set(choices.map(item=>item.membershipType)).size!==choices.length)return `${member.name}: מסלול נבחר יותר מפעם אחת.`;
    for(const [index,selection] of choices.entries()){
      const config=catalog.find(item=>item.id===selection.membershipType && item.active);
      if(!config || !canPurchasePlan(config,member) || index>0 && config.category!=='ADD_ON')return `${member.name}: יש לבחור מסלול פעיל ותוספות המתאימים לגיל.`;
      if(needsSessionQuantity(selection.membershipType) && (!Number.isInteger(selection.trainingSessionsCount) || selection.trainingSessionsCount!<1 || selection.trainingSessionsCount!>50))return `${member.name}: יש לבחור כמות אימונים תקינה.`;
    }
  }
  return null;
}
