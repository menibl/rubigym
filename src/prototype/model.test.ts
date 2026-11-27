import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {blankMember,hasSelection,initialDraft,readDraft,totals} from './model';

test('new families start without automatically assigned plans or extras', () => {
  assert.equal(hasSelection(blankMember()),false);
  assert.equal(totals(initialDraft()).due,0);
});
test('family totals aggregate once and monthly separately, including standalone extras', () => {
  const draft = initialDraft();
  draft.family = true;
  draft.members = [{...blankMember(),plan:'open',extras:['program']},{...blankMember(),plan:'open',extras:['program']}];
  assert.deepEqual(totals(draft),{monthly:560,once:600,discount:0,due:1160});
  draft.discount = 'demo10';
  assert.deepEqual(totals(draft),{monthly:560,once:600,discount:60,due:1100});
  draft.members = [{...blankMember(),extras:['personal','pair']}];
  assert.equal(hasSelection(draft.members[0]),true);
  assert.equal(totals(draft).monthly,0);
  assert.equal(totals(draft).due,1260);
});
test('reload resumes exact question and family member; corrupt drafts safely reset', () => {
  const draft = {...initialDraft(),step:'birth',member:1,members:[blankMember(),blankMember()]};
  assert.deepEqual(readDraft(JSON.stringify(draft)),draft);
  for (const bad of ['{','null',JSON.stringify({...draft,member:7}),JSON.stringify({...draft,step:'charge'}),JSON.stringify({...draft,members:[{...blankMember(),plan:'real'}]}),JSON.stringify({...draft,members:[{...blankMember(),extras:['program','program']}],member:0})]) assert.deepEqual(readDraft(bad),initialDraft());
});
test('prototype has no API, payment, SMS, account, or shared store integration', () => {
  for (const file of ['Conversation.tsx','model.ts','entry.tsx']) {
    const code=readFileSync(new URL(file,import.meta.url),'utf8');
    assert.doesNotMatch(code,/\bfetch\s*\(|XMLHttpRequest|sendBeacon|\/api\/|clubServer|rivhitPayments|clubStore|window\.open|<iframe/i);
  }
  const entry=readFileSync(new URL('entry.tsx',import.meta.url),'utf8');
  assert.match(entry,/__CONVERSATION_PROTOTYPE__ &&/);
  assert.match(entry,/menibl\.github\.io/);
  const config=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
  assert.match(config,/npm_lifecycle_event === 'build:pages'/);
  assert.match(config,/build: conversationPrototype \?/);
});
