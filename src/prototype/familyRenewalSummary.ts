import {stagingCheckoutQuote} from './stagingCheckout';
import {excludeFamilyRenewalPlans} from './familyAccountModel';
import {MembershipType,type FamilyMemberPlanSelection,type User,type Payment,type MembershipPlanConfig,type DiscountCode} from '../types';

// Read-only projection of the existing checkout engine, not a second pricing algorithm.
export function familyRenewalSummary(selections:FamilyMemberPlanSelection[],members:User[],payments:Payment[],catalog:MembershipPlanConfig[],discountCodes:DiscountCode[],discount:DiscountCode|null,now=new Date()){
  const payer=members.find(member=>member.isFamilyPayer) || members[0];
  if(!payer)throw new Error('לא נמצא משלם משפחתי בנתוני הבדיקה.');
  const quote=stagingCheckoutQuote({userId:payer.id,userName:payer.name,email:payer.email,phone:payer.phone,
    membershipType:MembershipType.FAMILY_MEMBERSHIP,mode:'PRIMARY',familyMembersCount:members.length,
    familyBillingMode:'CUSTOM_COMBINED',familyMemberPlans:selections,discountCode:discount?.code},
  {users:members,payments,settings:{membershipPlans:catalog},discountCodes},now);
  const excluded=quote.lines.filter(line=>line.status!=='READY');
  const payableSelections=excludeFamilyRenewalPlans(selections,excluded.map(line=>line.id));
  const cents=(value:number)=>Math.round(value*100);
  const rows=members.map(member=>{
    const lines=quote.lines.filter(line=>line.memberId===member.id && line.status==='READY');
    return {memberId:member.id,memberName:member.name,lines,
      excluded:excluded.filter(line=>line.memberId===member.id),
      base:lines.reduce((sum,line)=>sum+cents(line.baseAmount),0)/100,
      discount:lines.reduce((sum,line)=>sum+cents(line.discountAmount || 0),0)/100,
      total:lines.reduce((sum,line)=>sum+cents(line.amount),0)/100};
  });
  return {rows,selections:payableSelections,total:quote.total,
    base:rows.reduce((sum,row)=>sum+cents(row.base),0)/100,
    discount:rows.reduce((sum,row)=>sum+cents(row.discount),0)/100,
    payable:quote.lines.some(line=>line.status==='READY')};
}

export type FamilyRenewalSummary=ReturnType<typeof familyRenewalSummary>;
