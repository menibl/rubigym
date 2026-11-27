import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {familyAccountRows,familyRenewalDraft,familyMemberEditDraft,excludeFamilyRenewalPlans,detachFamilyMemberDemo} from './familyAccountModel';
import {StagingFamilyAccount} from './StagingFamilyAccount';
import {stagingCheckoutQuote} from './stagingCheckout';
import {familyRenewalSummary} from './familyRenewalSummary';
import {FamilyRenewalPriceSummary} from './FamilyRenewalPriceSummary';
import {familySplitLines} from '../../server/family-split.js';
import {MembershipType as M,type User,type MembershipPlanConfig,type Payment,type DiscountCode} from '../types';
const now=new Date('2026-11-26T10:00:00Z');
const plans=[{id:M.OPEN_GYM,label:'Open',price:280,active:true,category:'PRIMARY',paymentMode:'ONE_TIME',billingPeriod:'MONTHLY'},
  {id:M.WORKOUT_COACHING,label:'Program',price:300,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'THREE_MONTHS'},
  {id:M.PERSONAL_TRAINING,label:'Personal',price:200,active:true,category:'ADD_ON',billingPeriod:'SESSION_PACK'},
  {id:M.DUO_TRAINING,label:'Duo',price:350,active:true,category:'ADD_ON',billingPeriod:'SESSION_PACK'}] as MembershipPlanConfig[];
const user=(id:string,extra:Partial<User>={})=>({id,name:`Test ${id}`,role:'TRAINEE',familyId:'family',familyPayerId:'payer',membershipType:M.OPEN_GYM,membershipStatus:'ACTIVE',membershipExpiry:'2026-11-01',membershipExpiryExclusive:true,birthDate:'1990-01-01',...extra}) as User;
const payer=user('payer',{isFamilyPayer:true,familyName:'Test family'});
test('family renewal chooses expired primary and additions, not active members; no mutation',()=>{
  const members=[payer,user('child',{secondaryMemberships:[M.WORKOUT_COACHING],membershipPlanExpiries:{[M.WORKOUT_COACHING]:'2026-10-01'}}),user('active',{membershipExpiry:'2026-12-01'})];
  const before=structuredClone(members);
  const draft=familyRenewalDraft(members,[],plans,now);
  assert.equal(draft.selections[0].participation,'INCLUDED');
  assert.equal(draft.selections[1].additionalPlans?.[0].membershipType,M.WORKOUT_COACHING);
  assert.equal(draft.selections[2].participation,'SKIP');
  assert.deepEqual(members,before);
});
test('expiry semantics respect exclusive calendar boundaries and unknown expiry is never renewed',()=>{
  assert.equal(familyAccountRows(user('x',{membershipExpiry:'2026-11-26',membershipExpiryExclusive:false}),[],now)[0].expired,false);
  assert.equal(familyAccountRows(user('x',{membershipExpiry:'2026-11-26'}),[],now)[0].expired,true);
  for(const membershipExpiry of [undefined,'2026-02-30','bad'])assert.equal(familyRenewalDraft([user('x',{membershipExpiry})],[],plans,now).selections[0].participation,'SKIP');
});
test('documented future add-on term is displayed instead of stale receipt-derived expiry',()=>{
  const member=user('x',{secondaryMemberships:[M.WORKOUT_COACHING],membershipPlanExpiries:{[M.WORKOUT_COACHING]:'2027-02-01'}});
  const payment={id:'old',traineeId:'x',status:'PAID',membershipTypePurchased:M.WORKOUT_COACHING,date:'2026-01-01',billingTermMonths:3} as Payment;
  const row=familyAccountRows(member,[payment],now).find(item=>item.type===M.WORKOUT_COACHING)!;
  assert.equal(row.expiry,'2027-02-01');assert.equal(row.expired,false);assert.doesNotMatch(row.status,/פג תוקף/);
  assert.equal(familyRenewalDraft([member],[payment],plans,now).selections[0].additionalPlans?.length,0);
});
test('pending, failed and existing recurring orders, frozen, cancellations and incomplete accounts are skipped',()=>{
  for(const patch of [{registrationIncomplete:true},{registrationPaymentPending:true},{familyPaymentPending:true},{isMembershipFrozen:true},{membershipFreezeRequestedAt:'2026-11-20'},{cancellationRequestedAt:'2026-11-20'},
    {recurringMemberships:{[M.OPEN_GYM]:{status:'ACTIVE',endsAt:'2027-01-01'}}},{recurringMemberships:{[M.OPEN_GYM]:{status:'PENDING_FIRST_CHARGE',endsAt:'2027-01-01'}}},{recurringMemberships:{[M.OPEN_GYM]:{status:'PAYMENT_FAILED',endsAt:'2026-11-01'}}}]) {
    assert.equal(familyRenewalDraft([user('x',patch as Partial<User>)],[],plans,now).selections[0].participation,'SKIP');
  }
  const pending=[{id:'pending',traineeId:'x',status:'PENDING',membershipTypePurchased:M.OPEN_GYM}] as Payment[];
  assert.equal(familyRenewalDraft([user('x')],pending,plans,now).selections[0].participation,'SKIP');
});
test('unavailable catalog and session counts need deliberate manual choice',()=>{
  assert.equal(familyRenewalDraft([payer],[],[],now).selections[0].participation,'SKIP');
  const personal=user('x',{membershipType:M.PERSONAL_TRAINING});
  const result=familyRenewalDraft([personal],[],plans,now);
  assert.equal(result.selections[0].participation,'SKIP');assert.ok(result.warnings.some(text=>text.includes('כמות')));
});
test('removing from renewal does not remove current membership; addon can be the only renewed item',()=>{
  const member=user('x',{secondaryMemberships:[M.WORKOUT_COACHING],membershipPlanExpiries:{[M.WORKOUT_COACHING]:'2026-10-01'}});
  const original=familyRenewalDraft([member],[],plans,now).selections;
  const excluded=excludeFamilyRenewalPlans(original,[`x:${M.OPEN_GYM}`]);
  assert.equal(excluded[0].membershipType,M.WORKOUT_COACHING);assert.equal(member.membershipType,M.OPEN_GYM);
  assert.equal(excludeFamilyRenewalPlans(original,[`x:${M.OPEN_GYM}`,`x:${M.WORKOUT_COACHING}`])[0].participation,'SKIP');
});
test('edit and extras scopes contain only target member; extras never preselect active gym',()=>{
  const members=[payer,user('child')];
  assert.equal(familyMemberEditDraft(members,'child',plans,[])[0].participation,'SKIP');
  const extra=familyMemberEditDraft(members,'child',plans,[],true)[1];
  assert.equal(extra.membershipType,'');assert.deepEqual(extra.additionalPlans,[]);
});
test('renewal draft quote uses existing engine and exact catalog total without receipts or paid grants',()=>{
  const members=[payer,user('child')];
  const selections=familyRenewalDraft(members,[],plans,now).selections;
  const quote=stagingCheckoutQuote({userId:'payer',userName:payer.name,email:'test@example.com',phone:'0500000000',membershipType:M.FAMILY_MEMBERSHIP,mode:'PRIMARY',familyMemberPlans:selections,familyMembersCount:2,familyBillingMode:'CUSTOM_COMBINED'},
    {users:members,payments:[],settings:{membershipPlans:plans}},now);
  assert.equal(quote.total,560);assert.equal(quote.lines.length,2);
});
test('personal and duo add-ons use original quote for target only, without a gym purchase',()=>{
  const members=[payer,user('child')];
  const selections=familyMemberEditDraft(members,'child',plans,[],true);
  selections[1]={...selections[1],membershipType:M.PERSONAL_TRAINING,trainingSessionsCount:1,additionalPlans:[{membershipType:M.DUO_TRAINING,trainingSessionsCount:1}]};
  const quote=stagingCheckoutQuote({userId:'payer',userName:payer.name,email:'test@example.com',phone:'0500000000',membershipType:M.FAMILY_MEMBERSHIP,mode:'PRIMARY',familyMemberPlans:selections,familyMembersCount:2,familyBillingMode:'CUSTOM_COMBINED'},
    {users:members,payments:[],settings:{membershipPlans:plans}},now);
  assert.equal(quote.total,550);assert.equal(quote.lines.length,2);
  assert.ok(quote.lines.every(line=>line.memberId==='child'));
  assert.deepEqual(members[1].membershipType,M.OPEN_GYM);
});
test('demo detach keeps account, medical/payment/access data and siblings; shared orders block detach',()=>{
  const child=user('child',{healthDeclarationDate:'2026-10-01',secondaryMemberships:[M.WORKOUT_COACHING]});
  const other=user('other');const users=[payer,child,other];const original=structuredClone(users);
  const detached=detachFamilyMemberDemo(users,'payer','child');
  assert.equal(detached.length,3);assert.equal(detached[1].familyId,undefined);
  for(const field of ['membershipType','membershipExpiry','healthDeclarationDate','secondaryMemberships'])assert.deepEqual(detached[1][field],child[field]);
  assert.equal(detached[2],other);assert.deepEqual(users,original);
  assert.throws(()=>detachFamilyMemberDemo(users,'payer','payer'));
  assert.throws(()=>detachFamilyMemberDemo([{...payer,recurringMemberships:{[M.OPEN_GYM]:{groupSize:2}} as never},child],'payer','child'),/משותפת/);
});
test('production has no family cards; renewal requires confirmation and uses original handler behind staging',()=>{
  assert.equal(renderToStaticMarkup(<StagingFamilyAccount {...{} as React.ComponentProps<typeof StagingFamilyAccount>}/>),'');
  const component=readFileSync(new URL('StagingFamilyAccount.tsx',import.meta.url),'utf8');
  assert.match(component,/אישור הסיכום והמשך לבדיקה ללא חיוב/);
  assert.doesNotMatch(component,/\bfetch\(|startRivhitPayment|saveClubState/);
  for(const action of ['עריכת מסלולים','רכישת מסלול נוסף','הקפאה','ביטול מסלול','הסרת מסלול מחידוש','הסרת בן משפחה'])assert.ok(component.includes(action));
  const dashboard=readFileSync(new URL('../components/TraineeDashboard.tsx',import.meta.url),'utf8');
  assert.match(dashboard,/const staged = stagingLogicEnabled\(\) && stagingSelections/);
  assert.match(dashboard,/onDetach=\{memberId=>\{if\(!stagingLogicEnabled\(\) \|\| CONNECTED_CHAT_ENABLED\)return/);
});

test('renewal prices use server-engine cents and distribute percent discount per beneficiary before confirmation',()=>{
  const catalog=plans.map(plan=>({...plan,price:plan.id===M.OPEN_GYM ? 281:plan.price}));
  const members=[payer,user('child'),user('active',{membershipExpiry:'2026-12-01'})];
  const selections=familyRenewalDraft(members,[],catalog,now).selections;
  const discount={code:'P13',discountPercent:13} as DiscountCode;
  const before=JSON.stringify({members,selections,discount,catalog});
  const summary=familyRenewalSummary(selections,members,[],catalog,[discount],discount,now);
  const reference=familySplitLines(selections,catalog,[],discount,false,now);
  assert.deepEqual(summary.rows.flatMap(row=>row.lines),reference);
  assert.equal(summary.total,488.94);assert.equal(summary.discount,73.06);
  assert.equal(summary.rows[0].total,244.47);assert.equal(summary.rows[1].total,244.47);
  assert.equal(summary.rows[2].total,0);assert.equal(summary.selections[2].participation,'SKIP');
  assert.equal(JSON.stringify({members,selections,discount,catalog}),before);
  const html=renderToStaticMarkup(<FamilyRenewalPriceSummary summary={summary} onEdit={()=>{}}/>);
  for(const text of ['244.47','36.53','488.94','הנחה לבן המשפחה','סה״כ לבן המשפחה'])assert.ok(html.includes(text));
});

test('already-paid monthly receipt with stale member expiry is excluded from summary amounts and forwarded selection',()=>{
  const members=[payer,user('child')];
  const payments=[{id:'paid',traineeId:'payer',status:'PAID',membershipTypePurchased:M.OPEN_GYM,date:'2026-11-20',isMock:true}] as Payment[];
  const selections=familyRenewalDraft(members,payments,plans,now).selections;
  assert.equal(selections[0].participation,'INCLUDED'); // stale date alone is not evidence of debt
  const summary=familyRenewalSummary(selections,members,payments,plans,[],null,now);
  assert.equal(summary.rows[0].total,0);assert.equal(summary.rows[0].base,0);
  assert.equal(summary.rows[0].excluded[0].status,'ALREADY_PAID');
  assert.equal(summary.selections[0].participation,'SKIP');
  assert.equal(summary.rows[1].total,280);assert.equal(summary.total,280);
  assert.match(renderToStaticMarkup(<FamilyRenewalPriceSummary summary={summary} onEdit={()=>{}}/>),/כבר שולם/);
});

test('existing recurring receipt is excluded without discarding an expired payable add-on',()=>{
  const members=[{...payer,secondaryMemberships:[M.WORKOUT_COACHING],membershipPlanExpiries:{[M.WORKOUT_COACHING]:'2026-10-01'}}];
  const payments=[{id:'series',traineeId:'payer',status:'PAID',membershipTypePurchased:M.OPEN_GYM,date:'2026-10-01',isMock:true,providerRecurringSaleId:'fixture-series'}] as Payment[];
  const selections=familyRenewalDraft(members,payments,plans,now).selections;
  const summary=familyRenewalSummary(selections,members,payments,plans,[],null,now);
  assert.equal(summary.rows[0].excluded[0].status,'EXISTING_RECURRING');
  assert.equal(summary.selections[0].membershipType,M.WORKOUT_COACHING);
  assert.deepEqual(summary.selections[0].additionalPlans,[]);
  assert.equal(summary.total,300);
});

test('fixed discount is allocated exactly once only to payable lines, including multiple plans',()=>{
  const members=[payer,user('child',{secondaryMemberships:[M.WORKOUT_COACHING],membershipPlanExpiries:{[M.WORKOUT_COACHING]:'2026-10-01'}})];
  const discount={code:'FIXED',discountAmount:99.99} as DiscountCode;
  const selections=familyRenewalDraft(members,[],plans,now).selections;
  const summary=familyRenewalSummary(selections,members,[],plans,[discount],discount,now);
  const reference=familySplitLines(selections,plans,[],discount,false,now);
  assert.deepEqual(summary.rows.flatMap(row=>row.lines),reference);
  assert.equal(summary.base,860);assert.equal(summary.discount,99.99);assert.equal(summary.total,760.01);
  assert.equal(summary.rows.reduce((sum,row)=>sum+Math.round(row.total*100),0),76001);
});

test('all active or already-paid members have zero payable renewal; invalid/used discounts fail closed',()=>{
  const members=[payer];
  const paid=[{id:'paid',traineeId:'payer',status:'PAID',membershipTypePurchased:M.OPEN_GYM,date:'2026-11-20',isMock:true}] as Payment[];
  const selected=familyRenewalDraft(members,paid,plans,now).selections;
  const summary=familyRenewalSummary(selected,members,paid,plans,[],null,now);
  assert.equal(summary.payable,false);assert.equal(summary.total,0);assert.equal(summary.selections[0].participation,'SKIP');
  const discount={code:'USED',discountAmount:10,isSingleUse:true,isUsed:true} as DiscountCode;
  assert.throws(()=>familyRenewalSummary(selected,members,[],plans,[discount],discount,now),/קוד ההנחה/);
  assert.throws(()=>familyRenewalSummary(selected,members,[],plans,[],{...discount,isUsed:false},now),/קוד ההנחה/);
});

test('renewal presenter and calculation have no persistence, payment or SMS side effects; confirm uses payable selections',()=>{
  for(const file of ['familyRenewalSummary.ts','FamilyRenewalPriceSummary.tsx']){
    const source=readFileSync(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(source,/\bfetch\(|startRivhitPayment|saveClubState|writeDemoState|sendSms/);
  }
  const component=readFileSync(new URL('StagingFamilyAccount.tsx',import.meta.url),'utf8');
  assert.match(component,/props.onContinue\(summary.selections\)/);
  assert.match(component,/disabled=\{!canManage \|\| !summary\?\.payable \|\| props.busy\}/);
  assert.doesNotMatch(component,/Math.round|afterDiscount|familyPurchaseAmount/);
});
