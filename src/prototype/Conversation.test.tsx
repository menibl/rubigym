import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {Conversation} from './Conversation';
import {demoAccount,initialDraft,profileSteps,readDraft,totals} from './model';

const page=(step: string)=>renderToStaticMarkup(<Conversation initialState={{...demoAccount(),step,member:1}}/>);
test('all registration field groups and existing-account actions are represented',()=>{
  assert.deepEqual(profileSteps,['name','birth','gender','phone','otp','credentials','health','consent']);
  for(const [step,labels] of Object.entries({name:['שם פרטי','שם משפחה'],birth:['תאריך לידה','type="date"'],gender:['מין','זכר','נקבה'],phone:['טלפון אישי','לא חובה'],otp:['קוד אימות','111111'],credentials:['שם משתמש','EMAIL','סיסמת דמה','אימות סיסמת דמה','type="password"'],health:['שם מלא לחתימת','שם ההורה','מספר זהות הורה','אישור הורה','אישור רופא'],consent:['הצטרפות','פרטיות','PUSH','תזכורות'],account:['הוספת בן משפחה לאחר הרישום','עדכון מסלול','רכישת שירות נוסף','חידוש','בקשת ביטול','בקשת הקפאה','עריכת פרטים']})) {
    for(const label of labels) assert.ok(page(step).includes(label),`${step}: ${label}`);
  }
  assert.equal((page('health').match(/לא — דמה/g)||[]).length,13);
});
test('draft whitelist never serializes password, medical answers, signatures, identity or file data',()=>{
  const draft=demoAccount();
  const raw={...draft,password:'do-not-save',members:draft.members.map(m=>({...m,password:'do-not-save',answers:{heart:'YES'},parentId:'private',signature:'private',file:'private'}))};
  const saved=JSON.stringify(readDraft(JSON.stringify(raw)));
  assert.doesNotMatch(saved,/do-not-save|private|"password"|"answers"|"signature"|"file"/);
});
test('adding a member and buying extras never includes another family member in demo checkout',()=>{
  const d=demoAccount();
  d.flow='extras';d.member=1;d.purchaseExtras=['personal','pair'];
  const previous=JSON.stringify(d.members);
  assert.deepEqual(totals(d),{monthly:0,once:1400,discount:0,due:1400});
  assert.equal(JSON.stringify(d.members),previous);
  d.flow='add';
  assert.equal(totals(d).due,580);
  d.flow='renew';
  assert.equal(totals(d).due,580);
  d.fromAccount=false;
  assert.equal(totals(d).due,1160);
  assert.equal(totals(initialDraft()).due,0);
});
test('cancellation chooses a target and freezing and profile editing stay visibly simulated',()=>{
  assert.ok(page('cancel').includes('המסלול לביטול'));
  assert.ok(page('cancel').includes('לא חושב תאריך מחייב'));
  assert.ok(page('freeze').includes('מועד תחילת הקפאה'));
  assert.ok(page('freeze').includes('אין עדכון של הוראה או תוקף'));
});
