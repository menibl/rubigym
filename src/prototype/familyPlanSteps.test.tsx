import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {chooseFamilyPlan,removeFamilyPlanFromDraft,validateFamilyStepDraft} from './familyPlanStepsModel';
import {StagingFamilyPlanSteps} from './StagingFamilyPlanSteps';
import {familyPurchaseAmount} from '../data/familyMembership';
import {stagingCheckoutQuote} from './stagingCheckout';
import {MembershipType as M,type User,type MembershipPlanConfig,type FamilyMemberPlanSelection} from '../types';

const catalog=[{id:M.OPEN_GYM,label:'Open',price:280,active:true,category:'PRIMARY',paymentMode:'ONE_TIME',billingPeriod:'MONTHLY'},
  {id:M.WORKOUT_COACHING,label:'Program',price:300,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'THREE_MONTHS'},
  {id:M.PERSONAL_TRAINING,label:'Personal',price:200,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'SESSION_PACK'},
  {id:M.DUO_TRAINING,label:'Duo',price:350,active:true,category:'ADD_ON',paymentMode:'ONE_TIME',billingPeriod:'SESSION_PACK'}] as MembershipPlanConfig[];
const members=['payer','child'].map(id=>({id,name:`Test ${id}`,role:'TRAINEE',familyId:'family',familyPayerId:'payer',birthDate:'1990-01-01',membershipType:M.OPEN_GYM,membershipExpiry:'2026-12-01'})) as User[];
const empty=(id='payer')=>({memberId:id,memberName:`Test ${id}`,membershipType:'' as M,participation:'NOT_STARTED',additionalPlans:[]}) as FamilyMemberPlanSelection;

test('tile choices preserve original selection shape, quantities and other family members',()=>{
  const original=structuredClone(members);
  let choice=chooseFamilyPlan(empty(),catalog[0],undefined,false);
  choice=chooseFamilyPlan(choice,catalog[2],4,true);
  choice=chooseFamilyPlan(choice,catalog[3],8,true);
  const selections=[choice,{...empty('child'),participation:'SKIP' as const}];
  assert.equal(validateFamilyStepDraft(selections,members,catalog),null);
  assert.equal(familyPurchaseAmount('CUSTOM_COMBINED',2,selections,catalog),3880);
  assert.deepEqual(choice.additionalPlans,[{membershipType:M.PERSONAL_TRAINING,trainingSessionsCount:4},{membershipType:M.DUO_TRAINING,trainingSessionsCount:8}]);
  assert.deepEqual(members,original);
});

test('personal and duo can be bought together without a primary gym plan; adding gym keeps both',()=>{
  let choice=chooseFamilyPlan(empty(),catalog[2],1,true);
  choice=chooseFamilyPlan(choice,catalog[3],12,true);
  assert.equal(choice.membershipType,M.PERSONAL_TRAINING);
  assert.equal(familyPurchaseAmount('CUSTOM_COMBINED',1,[choice],catalog),4400);
  choice=chooseFamilyPlan(choice,catalog[0],undefined,false);
  assert.equal(choice.membershipType,M.OPEN_GYM);
  assert.equal(choice.additionalPlans?.length,2);
  assert.equal(familyPurchaseAmount('CUSTOM_COMBINED',1,[choice],catalog),4680);
});

test('removing draft items promotes the next add-on and never modifies current memberships',()=>{
  const choice=chooseFamilyPlan(chooseFamilyPlan(empty(),catalog[0],undefined,false),catalog[2],4,true);
  const remaining=removeFamilyPlanFromDraft(choice,M.OPEN_GYM);
  assert.equal(remaining.membershipType,M.PERSONAL_TRAINING);
  assert.equal(remaining.trainingSessionsCount,4);
  assert.equal(choice.membershipType,M.OPEN_GYM);
  assert.equal(removeFamilyPlanFromDraft(remaining,M.PERSONAL_TRAINING).membershipType,'');
  assert.equal(members[0].membershipType,M.OPEN_GYM);
});

test('session quantities require a whole number from 1 through 50',()=>{
  for(const quantity of [1,4,8,12,17,50])assert.equal(chooseFamilyPlan(empty(),catalog[2],quantity,true).trainingSessionsCount,quantity);
  for(const quantity of [undefined,0,-1,51,1.5,NaN])assert.throws(()=>chooseFamilyPlan(empty(),catalog[2],quantity,true));
});

test('adding a primary preserves a previously selected nutrition add-on',()=>{
  const choice={...empty(),membershipType:M.NUTRITION_COACHING,participation:'INCLUDED' as const};
  assert.equal(chooseFamilyPlan(choice,catalog[0],undefined,false).additionalPlans?.[0].membershipType,M.NUTRITION_COACHING);
});

test('youth eligibility uses each beneficiary age before enabling family confirmation',()=>{
  const youth={...catalog[0],id:M.YOUTH_TWICE_WEEKLY,label:'נוער'};
  const chosen=chooseFamilyPlan(empty(),youth,undefined,false);
  const skipped={...empty('child'),participation:'SKIP' as const};
  assert.ok(validateFamilyStepDraft([chosen,skipped],members,[youth]));
  assert.equal(validateFamilyStepDraft([chosen,skipped],[{...members[0],birthDate:'2012-01-01'},members[1]],[youth]),null);
});

test('summary rejects unknown or duplicate beneficiaries, inactive plans and malformed additions',()=>{
  const chosen=chooseFamilyPlan(empty(),catalog[0],undefined,false);
  const skipped={...empty('child'),participation:'SKIP' as const};
  assert.ok(validateFamilyStepDraft([chosen,chosen],members,catalog));
  assert.ok(validateFamilyStepDraft([{...chosen,memberId:'stranger'},skipped],members,catalog));
  assert.ok(validateFamilyStepDraft([chosen],members,catalog));
  assert.ok(validateFamilyStepDraft([chosen,skipped],members,catalog.map(item=>({...item,active:false}))));
  assert.ok(validateFamilyStepDraft([{...chosen,additionalPlans:[{membershipType:M.OPEN_GYM}]},skipped],members,catalog));
  assert.ok(validateFamilyStepDraft([{...chosen,membershipType:M.PERSONAL_TRAINING,trainingSessionsCount:0},skipped],members,catalog));
  assert.ok(validateFamilyStepDraft([{...empty(),participation:'SKIP'},skipped],members,catalog));
  assert.ok(validateFamilyStepDraft([chosen,skipped],[{...members[0],isMembershipFrozen:true},members[1]],catalog));
});

test('family final quote equals original pricing and includes only selected beneficiaries',()=>{
  const selections=[chooseFamilyPlan(empty(),catalog[0],undefined,false),chooseFamilyPlan(chooseFamilyPlan(empty('child'),catalog[2],4,true),catalog[3],1,true)];
  const quote=stagingCheckoutQuote({userId:'payer',userName:'Test payer',email:'test@example.com',phone:'0500000000',membershipType:M.FAMILY_MEMBERSHIP,mode:'PRIMARY',familyMemberPlans:selections,familyMembersCount:2,familyBillingMode:'CUSTOM_COMBINED'},
    {users:members,payments:[],settings:{membershipPlans:catalog}},new Date('2026-11-26T10:00:00Z'));
  assert.equal(quote.total,familyPurchaseAmount('CUSTOM_COMBINED',2,selections,catalog));
  assert.equal(quote.lines.length,3);
  assert.equal(quote.lines.filter(line=>line.memberId==='child').length,2);
});

test('production renders no wizard and tile navigation has no payment, persistence or SMS side effects',()=>{
  assert.equal(renderToStaticMarkup(<StagingFamilyPlanSteps {...{} as React.ComponentProps<typeof StagingFamilyPlanSteps>}/>),'');
  const source=readFileSync(new URL('StagingFamilyPlanSteps.tsx',import.meta.url),'utf8');
  assert.match(source,/STAGING_CONVERSATION_ENABLED && isPagesDemoMode\(\)/);
  assert.match(source,/step==='family-summary' && !validation/);
  for(const step of ['primary','extras','addon','quantity','member-summary','family-summary'])assert.ok(source.includes(`go('${step}')`) || source.includes(`reviewMember('${step}')`));
  assert.doesNotMatch(source,/\bfetch\(|startRivhitPayment|saveClubState|sendSms/);
  const dashboard=readFileSync(new URL('../components/TraineeDashboard.tsx',import.meta.url),'utf8');
  assert.match(dashboard,/hidden=\{stagingLogicEnabled\(\) && !chatFamilySummaryReady\}/);
  assert.match(dashboard,/: <FamilyPlanConfigurator/);
});
