import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChatInterfaceSwitch} from './ChatInterfaceSwitch';
import {ConnectedCheckoutReview} from './ConnectedCheckoutReview';
import {chatUiAvailable,chatUiEnabled,ORIGINAL_CHAT_TEST_ENABLED} from './integration';
import {originalQuoteMatchesSelections,originalQuoteLines,type CreatePaymentRequest,type OriginalCheckoutQuote} from '../data/rivhitPayments';
const completionStyle=readFileSync(new URL('connected-chat.css',import.meta.url),'utf8').split('/* Completion actions:')[1].split('/* Family account cards. */')[0];

const reviewRequest={mode:'PRIMARY',userId:'payer',membershipType:'FAMILY_MEMBERSHIP',familyMemberPlans:[
  {memberId:'payer',participation:'SKIP',membershipType:'OPEN_GYM'},
  {memberId:'child',participation:'INCLUDED',membershipType:'OPEN_GYM'}
]} as CreatePaymentRequest;
const reviewQuote={split:true,batchId:'batch',discountCode:null,grouping:'COMBINED',items:[
  {id:'child:OPEN_GYM',memberId:'child',membershipType:'OPEN_GYM',status:'READY',amount:280}
]} as OriginalCheckoutQuote;

test('review permits a skipped payer while charging only the selected family member',()=>{
  assert.equal(originalQuoteMatchesSelections(reviewRequest,reviewQuote),true);
  assert.equal(originalQuoteMatchesSelections(reviewRequest,{...reviewQuote,items:[...reviewQuote.items,
    {...reviewQuote.items[0],id:'payer:OPEN_GYM',memberId:'payer'}]}),false);
});

test('review rejects stale coupon and grouping quotes before confirmation',()=>{
  assert.equal(originalQuoteMatchesSelections({...reviewRequest,discountCode:'SAVE10'},reviewQuote),false);
  assert.equal(originalQuoteMatchesSelections({...reviewRequest,discountCode:' save10 '},{...reviewQuote,discountCode:'SAVE10'}),true);
  assert.equal(originalQuoteMatchesSelections({...reviewRequest,familyPaymentGrouping:'SEPARATE'},reviewQuote),false);
});

test('completed grouped payments cannot leave chargeable child lines, but pending pages remain resumable',()=>{
  for(const status of ['PAID','SETUP','ALREADY_PAID','EXISTING_RECURRING','CANCELLED']){
    const quote={...reviewQuote,items:[{...reviewQuote.items[0],status,groupLines:reviewQuote.items}]} as OriginalCheckoutQuote;
    assert.equal(originalQuoteLines(quote)[0].status,status);
    assert.equal(originalQuoteMatchesSelections(reviewRequest,quote),true);
    assert.equal(originalQuoteLines(quote).filter(line=>line.status==='READY').length,0);
  }
  assert.equal(originalQuoteLines({...reviewQuote,items:[{...reviewQuote.items[0],status:'PENDING',groupLines:reviewQuote.items}]} as OriginalCheckoutQuote)[0].status,'READY');
});

test('normal builds do not enable connected test UI or show its switch/review',()=>{
  assert.equal(ORIGINAL_CHAT_TEST_ENABLED,false);assert.equal(chatUiAvailable(),false);assert.equal(chatUiEnabled(),false);
  assert.equal(renderToStaticMarkup(<ChatInterfaceSwitch/>),'');
  assert.equal(renderToStaticMarkup(<ConnectedCheckoutReview request={{} as never} onContinue={async()=>{}}/>),'');
});

test('test build is separate from Pages fences and requires loopback browser and API',()=>{
  const integration=readFileSync(new URL('integration.ts',import.meta.url),'utf8');
  assert.match(integration,/__CHAT_ORIGINAL_TEST__/);
  assert.match(integration,/url.origin!==window.location.origin/);
  assert.match(integration,/requested==='legacy' \|\| requested==='chat'/);
  assert.match(integration,/sessionStorage.getItem\(PREFERENCE_KEY\)!=='legacy'/);
  const config=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
  assert.match(config,/npm_lifecycle_event === 'build:chat-test'/);
  assert.match(config,/requires a loopback API and non-demo mode/);
});

test('connected review uses server quote-only, blocks stale results and prevents duplicate confirmation',()=>{
  const review=readFileSync(new URL('ConnectedCheckoutReview.tsx',import.meta.url),'utf8');
  assert.match(review,/AbortController/);assert.match(review,/state.key===key/);
  assert.match(review,/disabled=\{busy \|\| confirming \|\| !payable.length \|\| !matches\}/);
  assert.match(review,/excludeFamilyRenewalPlans/);
  assert.doesNotMatch(review,/familyPurchaseAmount|discountPercent|Math.round\([^)]*discount/);
  const api=readFileSync(new URL('../data/rivhitPayments.ts',import.meta.url),'utf8');
  assert.match(api,/quoteOnly:true,unifiedCheckout:true/);
  assert.match(api,/if\(!CONNECTED_CHAT_ENABLED\)throw/);
  assert.match(api,/if\(STAGING_CONVERSATION_ENABLED\) throw/);
  const dashboard=readFileSync(new URL('../components/TraineeDashboard.tsx',import.meta.url),'utf8');
  assert.match(dashboard,/connectedChat && !reviewed/);
  assert.match(dashboard,/const connectedChat=CONNECTED_CHAT_ENABLED && stagingLogicEnabled\(\)/);
  const family=readFileSync(new URL('StagingFamilyAccount.tsx',import.meta.url),'utf8');
  assert.match(family,/CONNECTED_CHAT_ENABLED \? <><p>יש להמשיך למנגנון הביטול המקורי/);
});

test('completion controls use a distinct accessible green without changing handlers or control sizes',()=>{
  const channel=(value:number)=>{const c=value/255;return c<=.04045 ? c/12.92:((c+.055)/1.055)**2.4;};
  const luminance=.2126*channel(23)+.7152*channel(107)+.0722*channel(80);
  assert.ok(1.05/(luminance+.05)>=4.5,'White labels on completion green meet WCAG AA normal-text contrast');
  assert.match(completionStyle,/#176b50/);assert.match(completionStyle,/focus-visible/);assert.match(completionStyle,/:disabled/);
  assert.doesNotMatch(completionStyle,/font-size|padding|height|width|onClick/);
  const steps=readFileSync(new URL('StagingFamilyPlanSteps.tsx',import.meta.url),'utf8');
  for(const label of ['סיימתי את הבחירה','אישור ובחירת בן משפחה הבא','אישור והצגת סיכום המשפחה'])assert.ok(steps.includes(`completionTile('${label}'`));
  assert.match(steps,/className="logic-primary logic-complete" onClick=\{\(\)=>go\('member-summary'\)\}/);
  const shell=readFileSync(new URL('StagingLogicChat.tsx',import.meta.url),'utf8');
  assert.match(shell,/data-chat-final-step=\{at===groups.length-1 && !\['phone','otp'\].includes/);
});
