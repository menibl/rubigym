import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {chatQuestionGroups,StagingChatForm,StagingMembershipSurface} from './StagingLogicChat';
import {HealthDeclarationForm} from '../components/HealthDeclarationForm';
import {stagingCheckoutQuote} from './stagingCheckout';
import {familySplitLines,groupFamilyRecurringLines} from '../../server/family-split.js';
import {MembershipType,type User,type MembershipPlanConfig,type DiscountCode,type Payment} from '../types';

const users=[{id:'payer',name:'Test Payer',familyId:'test-family',familyPayerId:'payer',birthDate:'1990-01-01'},{id:'child',name:'Test Child',familyId:'test-family',familyPayerId:'payer',birthDate:'2012-01-01'}] as User[];
const catalog=[{id:MembershipType.OPEN_GYM,label:'Open Test',price:281,active:true,paymentMode:'RECURRING',billingPeriod:'MONTHLY_ANNUAL_COMMITMENT'},
  {id:MembershipType.PERSONAL_TRAINING,label:'Personal Test',price:173,active:true,paymentMode:'ONE_TIME',billingPeriod:'SESSION_PACK',supportsTrainingCard:true},
  {id:MembershipType.DUO_TRAINING,label:'Pair Test',price:141,active:true,paymentMode:'ONE_TIME',billingPeriod:'SESSION_PACK',supportsTrainingCard:true}] as MembershipPlanConfig[];
const request={userId:'payer',userName:'Test Payer',email:'test@example.com',phone:'0500000000',mode:'PRIMARY' as const,membershipType:MembershipType.OPEN_GYM};
const now=new Date('2026-11-24T12:00:00Z');

test('question shell preserves original field elements and binds original health form to its launcher',()=>{
  const submit=()=>{};
  const form=<><label>name<input value="Test Name" readOnly /></label><button type="button" className="auth-health-launch">health</button><HealthDeclarationForm fullName="Test Name" age={30} onComplete={()=>{}}/><button type="submit">save</button><button type="button">back</button></>;
  const groups=chatQuestionGroups((form.props as {children:React.ReactNode}).children);
  assert.equal(groups.length,3);assert.equal(groups[1].length,2);assert.equal(groups[2].length,2);
  const original=renderToStaticMarkup(<form onSubmit={submit} className="original">{form}</form>);
  assert.equal(renderToStaticMarkup(<StagingChatForm onSubmit={submit} className="original">{form}</StagingChatForm>),original);
  assert.equal(renderToStaticMarkup(<StagingMembershipSurface selected={false} choice="overview" onChoice={()=>{}} onClose={()=>{}} family={false}><p>original</p></StagingMembershipSurface>),'<div class="space-y-6"><p>original</p></div>');
});

for(const discount of [undefined,{code:'PERCENT',discountPercent:13},{code:'FIXED',discountAmount:99}] as (DiscountCode|undefined)[]){
  test(`individual and family preview reuse identical server line allocation/grouping (${discount?.code || 'no discount'})`,()=>{
    const members=[{memberId:'payer',memberName:'Test Payer',participation:'INCLUDED',membershipType:MembershipType.OPEN_GYM,additionalPlans:[{membershipType:MembershipType.PERSONAL_TRAINING,trainingSessionsCount:3}]},{memberId:'child',memberName:'Test Child',participation:'INCLUDED',membershipType:MembershipType.OPEN_GYM,additionalPlans:[{membershipType:MembershipType.DUO_TRAINING,trainingSessionsCount:2}]}];
    const payload={users,settings:{membershipPlans:catalog},payments:[],discountCodes:discount ? [discount]:[]};
    const before=JSON.stringify(payload);
    const result=stagingCheckoutQuote({...request,membershipType:MembershipType.FAMILY_MEMBERSHIP,familyMemberPlans:members as never,discountCode:discount?.code},payload,now);
    const reference=familySplitLines(members,catalog,[],discount,false,now);
    assert.deepEqual(result.lines,reference);assert.deepEqual(result.groups,groupFamilyRecurringLines(reference,'COMBINED'));
    const individual=stagingCheckoutQuote({...request,individualSelections:[{membershipType:MembershipType.OPEN_GYM},{membershipType:MembershipType.PERSONAL_TRAINING,trainingSessionsCount:3}],discountCode:discount?.code},payload,now);
    assert.deepEqual(individual.lines,familySplitLines([members[0]],catalog,[],discount,false,now));
    assert.equal(JSON.stringify(payload),before);
  });
}

test('preview rejects unrelated beneficiaries and excludes existing confirmed monthly payments',()=>{
  const payload={users,settings:{membershipPlans:catalog},payments:[{id:'receipt',traineeId:'payer',membershipTypePurchased:MembershipType.OPEN_GYM,status:'PAID',amount:281,date:'2026-11-23',isMock:true}] as Payment[]};
  assert.equal(stagingCheckoutQuote(request,payload,now).total,0);
  assert.throws(()=>stagingCheckoutQuote({...request,membershipType:MembershipType.FAMILY_MEMBERSHIP,familyMemberPlans:[{memberId:'outsider',membershipType:MembershipType.OPEN_GYM,participation:'INCLUDED'}] as never},payload,now),/משויך/);
});

test('registered field/health DTO and checkout callbacks remain the original paths, with staging provider fences',()=>{
  const auth=readFileSync(new URL('../components/AuthGateway.tsx',import.meta.url),'utf8');
  for(const name of ['handleRegistrationPhone','handleRegistrationOtp','handleRegistrationDetails','handleRegistrationPayment'])assert.match(auth,new RegExp(`onSubmit=\\{${name}\\}`));
  for(const field of ['name: registerName.trim()','username: registerUsername.trim()','birthDate: registerBirthDate','healthDeclarationAnswers: healthDeclaration?.answers','healthDeclarationHistory: [healthRecord]','healthDeclarationParentIdNumber: healthDeclaration?.parentIdNumber','healthDeclarationMedicalCertificateDataUrl: healthDeclaration?.medicalCertificateDataUrl','workoutRemindersEnabled: pushApproved && pushWorkoutReminders'])assert.ok(auth.includes(field),field);
  assert.match(auth,/await onRegister\(unpaidRegistration\(newUser\)/);
  assert.match(auth,/onInput=\{event => setRegisterBirthDate\(event.currentTarget.value\)\}/);
  const dashboard=readFileSync(new URL('../components/TraineeDashboard.tsx',import.meta.url),'utf8');
  const membership=dashboard.slice(dashboard.indexOf("{activeTab === 'membership' && ("),dashboard.indexOf('{/* PROFILE, MEMBERSHIP & PAYMENT */}'));
  assert.match(membership,/<HomeMembershipSummary user=\{member\} payments=\{payments\} plans=\{membershipPlanConfigs\}/);
  const payments=readFileSync(new URL('../data/rivhitPayments.ts',import.meta.url),'utf8');
  assert.match(payments,/if\(STAGING_CONVERSATION_ENABLED\)\{await \(await import\('\.\.\/prototype\/stagingCheckout'\)\)\.previewStagingCheckout\(request\);return;\}/);
  assert.match(payments,/if\(STAGING_CONVERSATION_ENABLED\) throw[\s\S]*?return globalThis.fetch/);
  const service=readFileSync(new URL('../data/clubServer.ts',import.meta.url),'utf8');
  assert.match(service,/if\(STAGING_CONVERSATION_ENABLED\) throw[\s\S]*?const response = await fetch/);
  const preview=readFileSync(new URL('stagingCheckout.ts',import.meta.url),'utf8');
  assert.doesNotMatch(preview,/\bfetch\(|writeDemoState|saveClubState|status:\s*['"]PAID/);
});
