import test from 'node:test';
import {FamilyMemberAdded} from './FamilyMemberAdded';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {chatQuestionGroups,StagingChatForm,StagingMembershipSurface,StagingFamilySettingsSurface,StagingFamilySetup} from './StagingLogicChat';
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

test('phone and OTP retain their original submit on the same question, including the back action',()=>{
  const groups=chatQuestionGroups([<label key="phone">phone<input /></label>,<button key="submit" type="submit">verify</button>,<button key="back" type="button">back</button>]);
  assert.equal(groups.length,1);assert.equal(groups[0].length,3);
});

test('family field rows flatten to individual questions while wrapped health and final controls remain grouped',()=>{
  const groups=chatQuestionGroups(<>
    <p data-chat-context>intro</p>
    <div data-chat-fields><label>first<input required value="Test" readOnly /></label><label>last<input required value="Family" readOnly /></label></div>
    <div data-chat-fields><label>birth<input type="date" value="2000-01-01" readOnly /></label><label>gender<select defaultValue="male"><option>male</option></select></label></div>
    <button type="button" className="auth-health-launch">health</button>
    <div data-chat-health><HealthDeclarationForm fullName="Test Family" age={26} onComplete={()=>{}} /></div>
    <label><input type="checkbox" />terms</label>
    <div data-chat-submit><button type="button">cancel</button><button type="submit">save</button></div>
  </>);
  // A fragment is deliberately unwrapped by the caller, as React form children are.
  const children=(groups[0][0] as React.ReactElement<{children:React.ReactNode}>).props.children;
  const flat=chatQuestionGroups(children);
  assert.equal(flat.length,7);assert.equal(flat[4].length,2);
  assert.equal((flat[6][0] as React.ReactElement<Record<string,unknown>>).props['data-chat-submit'],true);
});

test('family chat wrappers preserve original production containers when disabled',()=>{
  assert.equal(renderToStaticMarkup(<StagingFamilySettingsSurface enabled={false} onExit={()=>{}} className="original-modal"><p>same</p></StagingFamilySettingsSurface>),'<div class="original-modal"><p>same</p></div>');
  assert.equal(renderToStaticMarkup(<StagingFamilySetup enabled={false} flowKey="setup" className="original-setup"><input readOnly value="same" /></StagingFamilySetup>),'<div class="original-setup"><input readOnly="" value="same"/></div>');
});

test('registered family addition is staging-only question presentation over the original save and health fields',()=>{
  const settings=readFileSync(new URL('../components/UserSettingsModal.tsx',import.meta.url),'utf8');
  assert.match(settings,/stagingLogicEnabled\(\) && activeTab==='family' && !isAdminMode/);
  assert.match(settings,/StagingChatForm flowKey=\{`family-add:\$\{currentUser.id\}:\$\{familyAddSequence\}`\} chatEnabled=\{stagingFamily\} noValidate onSubmit=\{handleAddFamilyMember\}/);
  for(const field of ['subFirstName','subLastName','subUsername','subEmail','subPassword','subPhone','subBirthDate','subGender','subHealthDeclaration','subAgreementApproved'])assert.ok(settings.includes(field));
  assert.match(settings,/<div data-chat-health/);
  assert.match(settings,/const handleAddFamilyMember = async/);
});

test('family addition ends with explicit next choices, not another form or automatic payment',()=>{
  let add=0,plans=0;
  const props={name:'יעל בדיקה',canAddMore:true,onAddAnother:()=>{add++;},onChoosePlans:()=>{plans++;}};
  const html=renderToStaticMarkup(<FamilyMemberAdded {...props}/>);
  for(const label of ['בן המשפחה התווסף בהצלחה','יעל בדיקה','הוספת בן משפחה נוסף','חזרה לבחירת מסלול','עדיין לא בוצע תשלום'])assert.ok(html.includes(label));
  assert.doesNotMatch(html,/<form\b|type="submit"|<style\b/);
  assert.deepEqual([add,plans],[0,0]);
  const actions:React.ReactElement<{onClick:()=>void;type:string}>[]=[];
  const visit=(nodes:React.ReactNode)=>React.Children.forEach(nodes,node=>{
    if(!React.isValidElement<{children?:React.ReactNode;onClick:()=>void;type:string}>(node))return;
    if(node.type==='button')actions.push(node);
    visit(node.props.children);
  });
  visit(FamilyMemberAdded(props));
  assert.equal(actions.length,2);assert.ok(actions.every(action=>action.props.type==='button'));
  actions[0].props.onClick();assert.deepEqual([add,plans],[1,0]);
  actions[1].props.onClick();assert.deepEqual([add,plans],[1,1]);
  assert.match(renderToStaticMarkup(<FamilyMemberAdded {...props} canAddMore={false}/>),/disabled=""/);
});

test('chat completion survives refreshed family props and resets only a deliberately started next form',()=>{
  const source=readFileSync(new URL('../components/UserSettingsModal.tsx',import.meta.url),'utf8');
  assert.match(source,/familyChatOpening.current!==openingKey/);
  assert.match(source,/familyChatOpening.current=''/);
  assert.match(source,/stagingFamily && addedFamilyMember \?/);
  assert.ok(source.indexOf('setAddedFamilyMember({id:newSubUser.id')>source.indexOf('await onCreateFamilyMember(newSubUser)'));
  assert.match(source,/setFamilyAddSequence\(value=>value\+1\)/);
  assert.match(source,/sessionStorage.removeItem\(`baly-staging-question:family-add:/);
  assert.match(source,/onChoosePlans=\{\(\)=>\{onClose\(\);onOpenFamilyPurchase\?\.\(\);\}\}/);
  const css=readFileSync(new URL('connected-chat.css',import.meta.url),'utf8');
  assert.match(css,/logic-header \*\{overflow-wrap:normal;word-break:normal\}/);
  assert.match(css,/logic-header-actions\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(css,/logic-header-actions button:only-child\{grid-column:1\/-1\}/);
  assert.doesNotMatch(readFileSync(new URL('FamilyMemberAdded.tsx',import.meta.url),'utf8'),/fetch\(|startRivhitPayment|registerFamilyMember|sendSms/);
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
  assert.match(membership,/<StagingFamilyAccount members=\{familyUsers\} payments=\{payments\} plans=\{membershipPlanConfigs\}/);
  assert.match(membership,/<HomeMembershipSummary user=\{activeUser\} payments=\{payments\} plans=\{membershipPlanConfigs\}/);
  const payments=readFileSync(new URL('../data/rivhitPayments.ts',import.meta.url),'utf8');
  assert.match(payments,/if\(STAGING_CONVERSATION_ENABLED\)\{await \(await import\('\.\.\/prototype\/stagingCheckout'\)\)\.previewStagingCheckout\(request\);return;\}/);
  assert.match(payments,/if\(STAGING_CONVERSATION_ENABLED\) throw[\s\S]*?return globalThis.fetch/);
  const service=readFileSync(new URL('../data/clubServer.ts',import.meta.url),'utf8');
  assert.match(service,/if\(STAGING_CONVERSATION_ENABLED\) throw[\s\S]*?const response = await fetch/);
  const preview=readFileSync(new URL('stagingCheckout.ts',import.meta.url),'utf8');
  assert.doesNotMatch(preview,/\bfetch\(|writeDemoState|saveClubState|status:\s*['"]PAID/);
});
