import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildDemoChatAccounts,createDemoVerifier,checkDemoVerifier,validDemoVerifier} from './demoAccount';
import {blankMember,initialDraft} from './model';
import {MembershipStatus,UserRole,type User} from '../types';
const registrationId='11111111-1111-4111-8111-111111111111';
const draft=()=>({...initialDraft(),step:'done',family:true,members:['Head','Child'].map((firstName,i)=>({...blankMember(),firstName,lastName:'Demo',name:`${firstName} Demo`,username:`demo-test-${i}`,email:`test${i}@example.com`,phone:i ? '':'0500000000',birth:i ? '2012-01-01':'1990-01-01',gender:i ? 'male':'female',agreement:true,plan:'open',extras:['program']}))});
test('demo password verifiers are salted and support chosen-password login without plaintext storage',async()=>{
  const verifier=await createDemoVerifier('FakeOnlyPassword123!');
  assert.ok(validDemoVerifier(verifier));assert.ok(!verifier.includes('FakeOnlyPassword123!'));
  assert.equal(await checkDemoVerifier('FakeOnlyPassword123!',verifier),true);
  assert.equal(await checkDemoVerifier('different',verifier),false);
  assert.notEqual(await createDemoVerifier('FakeOnlyPassword123!'),verifier);
});
test('completed family demo registration creates login identities but no payment, mandate or signature',async()=>{
  const verifier=await createDemoVerifier('FakeOnlyPassword123!');
  const result=buildDemoChatAccounts(draft(),[verifier,verifier],registrationId,[],new Date('2026-11-24T12:00:00Z'));
  assert.equal(result.users.length,2);assert.equal(result.users[0].isFamilyPayer,true);
  assert.equal(result.users[1].familyPayerId,result.users[0].id);
  for(const user of result.users){
    assert.equal(user.role,UserRole.TRAINEE);assert.equal(user.membershipStatus,MembershipStatus.DEBT);
    assert.equal(user.registrationIncomplete,false);assert.equal(user.registrationPaymentPending,true);
    assert.equal(user.healthDeclarationSigned,false);assert.equal(user.clubAgreementSigned,false);
    assert.equal(user.password,undefined);assert.equal(user.membershipExpiry,undefined);
  }
  assert.doesNotMatch(JSON.stringify(result),/FakeOnlyPassword|recurringMemberships|paymentReference/);
  const again=buildDemoChatAccounts(draft(),[verifier,verifier],registrationId,result.users);
  assert.equal(again.alreadySaved,true);assert.deepEqual(again.users,result.users);
});
test('duplicates and incomplete registrations fail without modifying existing demo accounts',async()=>{
  const verifier=await createDemoVerifier('FakeOnlyPassword123!');
  const existing=[{id:'existing',name:'Keep User',username:'demo-test-0'} as User];
  const before=JSON.stringify(existing);
  assert.throws(()=>buildDemoChatAccounts(draft(),[verifier,verifier],registrationId,existing),/כבר שמורים/);
  assert.throws(()=>buildDemoChatAccounts({...draft(),step:'name'},[verifier,verifier],registrationId,[]),/להשלים/);
  assert.throws(()=>buildDemoChatAccounts(draft(),['plaintext',verifier],registrationId,[]),/סיסמת דמה/);
  assert.equal(JSON.stringify(existing),before);
});
test('account creation is strictly local/Pages gated and routing returns to the old login and home',()=>{
  const service=readFileSync(new URL('../data/clubServer.ts',import.meta.url),'utf8');
  const create=service.slice(service.indexOf('export async function createChatDemoAccount'),service.indexOf('export const registerFamilyMember'));
  assert.match(create,/__CONVERSATION_PROTOTYPE__ && isPagesDemoMode\(\)/);
  assert.doesNotMatch(create,/request\(|fetch\(|payments:/);
  assert.match(create,/localStorage.setItem\(DEMO_SESSION_KEY/);
  const app=readFileSync(new URL('../App.tsx',import.meta.url),'utf8');
  assert.match(app,/onDemoRegistered=\{STAGING_CONVERSATION_ENABLED/);
  assert.match(app,/\['screen','plan','workspace','contact'\]/);
  assert.match(app,/registrationPaymentPending && !STAGING_CONVERSATION_ENABLED/);
  assert.match(app,/setShowTraineeAccessAlert\(!\(STAGING_CONVERSATION_ENABLED && user.id.startsWith\('demo-chat-'\)\)\)/);
  const landing=readFileSync(new URL('../data/publicLanding.ts',import.meta.url),'utf8');
  assert.doesNotMatch(landing.slice(landing.indexOf('const surface ='),landing.indexOf('const appUrl =')),/isPagesDemoMode/);
});
