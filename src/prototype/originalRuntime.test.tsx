import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ChatInterfaceSwitch} from './ChatInterfaceSwitch';
import {ConnectedCheckoutReview} from './ConnectedCheckoutReview';
import {chatUiAvailable,chatUiEnabled,ORIGINAL_CHAT_TEST_ENABLED} from './integration';

test('normal builds do not enable connected test UI or show its switch/review',()=>{
  assert.equal(ORIGINAL_CHAT_TEST_ENABLED,false);assert.equal(chatUiAvailable(),false);assert.equal(chatUiEnabled(),false);
  assert.equal(renderToStaticMarkup(<ChatInterfaceSwitch/>),'');
  assert.equal(renderToStaticMarkup(<ConnectedCheckoutReview request={{} as never} onContinue={async()=>{}}/>),'');
});

test('test build is separate from Pages fences and requires loopback browser and API',()=>{
  const integration=readFileSync(new URL('integration.ts',import.meta.url),'utf8');
  assert.match(integration,/__CHAT_ORIGINAL_TEST__/);
  assert.match(integration,/url.origin!==window.location.origin/);
  assert.match(integration,/get\('ui'\)!=='legacy'/);
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
  assert.match(api,/if\(!ORIGINAL_CHAT_TEST_ENABLED\)throw/);
  assert.match(api,/if\(STAGING_CONVERSATION_ENABLED\) throw/);
  const dashboard=readFileSync(new URL('../components/TraineeDashboard.tsx',import.meta.url),'utf8');
  assert.match(dashboard,/connectedChat && !reviewed/);
  assert.match(dashboard,/const connectedChat=ORIGINAL_CHAT_TEST_ENABLED && stagingLogicEnabled\(\)/);
  const family=readFileSync(new URL('StagingFamilyAccount.tsx',import.meta.url),'utf8');
  assert.match(family,/ORIGINAL_CHAT_TEST_ENABLED \? <><p>יש להמשיך למנגנון הביטול המקורי/);
});
