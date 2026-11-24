import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {accountChatSnapshot,STAGING_CONVERSATION_ENABLED} from './integration';
import {MembershipStatus,MembershipType,type User} from '../types';
import {readDraft} from './model';

test('integrated account projection is family-scoped, read-only and excludes private account/provider data',()=>{
  const head={id:'one',name:'ראש לדוגמה',familyId:'family-one',membershipType:MembershipType.OPEN_GYM,membershipStatus:MembershipStatus.ACTIVE,membershipExpiry:'2027-01-01',phone:'private-phone',email:'private-mail',password:'private-password',healthDeclarationParentIdNumber:'private-identity',recurringMemberships:{}} as User;
  const child={...head,id:'two',name:'בן לדוגמה',secondaryMemberships:[MembershipType.WORKOUT_PLAN],membershipPlanExpiries:{[MembershipType.WORKOUT_PLAN]:'2027-02-01'}};
  const other={...head,id:'other',familyId:'elsewhere',name:'unrelated'};
  const before=JSON.stringify([head,child,other]);
  const snapshot=accountChatSnapshot(head,[head,child,other]);
  assert.equal(snapshot.step,'account');assert.equal(snapshot.members.length,2);
  const serialized=JSON.stringify(snapshot);
  assert.doesNotMatch(serialized,/private-|unrelated/);
  assert.match(serialized,/2027-02-01/);
  assert.match(serialized,/Open Gym/);
  assert.deepEqual(readDraft(serialized),snapshot);
  assert.equal(JSON.stringify([head,child,other]),before);
  assert.equal(STAGING_CONVERSATION_ENABLED,false);
});
test('registration and membership navigation intercept only staging flows, not login or the other tabs',()=>{
  const auth=readFileSync(new URL('../components/AuthGateway.tsx',import.meta.url),'utf8');
  assert.match(auth,/STAGING_CONVERSATION_ENABLED && screen === 'register'/);
  assert.match(auth,/mode="registration" onClose=\{\(\) => openScreen\('login'\)\}/);
  assert.match(auth,/await onPasswordLogin\(username.trim\(\), password\)/);
  const trainee=readFileSync(new URL('../components/TraineeDashboard.tsx',import.meta.url),'utf8');
  assert.match(trainee,/STAGING_CONVERSATION_ENABLED && tab==='membership'/);
  assert.match(trainee,/setActiveTabState\(tab\)/);
  assert.match(trainee,/mode="membership" activeUser=\{activeUser\} users=\{users\}/);
  for(const source of [auth,trainee]) assert.match(source,/if \(STAGING_CONVERSATION_ENABLED\) return;\s*const returnStatus/);
});
test('frame sandbox and CSP block payments, network requests and form submission in the new flow',()=>{
  const html=readFileSync(new URL('../../conversation-prototype.html',import.meta.url),'utf8');
  assert.match(html,/connect-src 'none'/);assert.match(html,/form-action 'none'/);
  const frame=readFileSync(new URL('../components/StagingConversationFrame.tsx',import.meta.url),'utf8');
  assert.match(frame,/sandbox="allow-scripts allow-same-origin allow-modals"/);
  assert.doesNotMatch(frame,/allow-top-navigation|allow-popups|allow-forms|onRegister|onUpdateUser|startRivhit|fetch\(/);
  const entry=readFileSync(new URL('entry.tsx',import.meta.url),'utf8');
  assert.match(entry,/event.source!==window.parent/);assert.match(entry,/event.origin!==location.origin/);
  assert.match(entry,/if\(initialized/);
  assert.match(entry,/const storageKey=`\$\{STORAGE_KEY\}:embedded:\$\{scope\}`/);
});

test('embedded questions and coupons advance with explicit buttons, never a sandbox-blocked form submit',()=>{
  const chat=readFileSync(new URL('Conversation.tsx',import.meta.url),'utf8');
  assert.doesNotMatch(chat,/<form\b|type="submit"|onSubmit=/);
  assert.match(chat,/type="button" onClick=\{nextProfile\}/);
  assert.match(chat,/e.key==='Enter'/);
  assert.match(chat,/type="button" onClick=\{\(\)=>setD\(v=>\(\{\.\.\.v,discount:coupon\}\)\)\}/);
});

test('unknown demo phone stays on login and exposes a seeded demo account without touching live login behavior',()=>{
  const auth=readFileSync(new URL('../components/AuthGateway.tsx',import.meta.url),'utf8');
  const branch=auth.slice(auth.indexOf("if ('registrationRequired' in result"),auth.indexOf('if (!result.ok) return;',auth.indexOf("if ('registrationRequired' in result")));
  assert.match(branch,/if \(STAGING_CONVERSATION_ENABLED\) \{[\s\S]*?setError\([\s\S]*?return;\s*\}/);
  assert.match(branch,/setScreen\('register'\)/);
  assert.match(auth,/מילוי חשבון מתאמן לדוגמה — ללא SMS אמיתי/);
});

test('embedded mobile uses readable full-width controls, safe areas and restores both page scroll locks',()=>{
  const css=readFileSync(new URL('mobile.css',import.meta.url),'utf8');
  assert.match(css,/@media\(max-width:600px\)/);
  assert.match(css,/\.lab\.embedded \.lab-layout\{margin:0;padding:0\}/);
  assert.match(css,/\.lab\.embedded \.primary,\.lab\.embedded \.secondary\{font-size:16px;min-height:52px\}/);
  assert.match(css,/safe-area-inset-bottom/);
  const frame=readFileSync(new URL('../components/StagingConversationFrame.tsx',import.meta.url),'utf8');
  assert.match(frame,/document.documentElement.style.overflow='hidden'/);
  assert.match(frame,/document.documentElement.style.overflow=pageOverflow/);
  assert.match(frame,/safe-area-inset-top/);
  assert.match(frame,/flexShrink:0/);
  const chat=readFileSync(new URL('Conversation.tsx',import.meta.url),'utf8');
  assert.match(chat,/<details className="demo-notice"><summary>נתוני דמה בלבד · ללא חיובים או SMS<\/summary>/);
});
