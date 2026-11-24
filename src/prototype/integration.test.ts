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
  assert.match(entry,/storageKey=\{`\$\{STORAGE_KEY\}:embedded:\$\{scope\}`\}/);
});
