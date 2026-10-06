import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { InvoiceDescriptionSettings } from './InvoiceDescriptionSettings';
import { SystemSettings } from '../types';

test('invoice settings show a Hebrew default and accessible fixed/plan-name choices', () => {
  const html = renderToStaticMarkup(<InvoiceDescriptionSettings settings={{} as SystemSettings} onChange={() => {}} />);
  assert.match(html, /תיאור לחשבונית/);
  assert.match(html, /value="ייעוץ ואימון"/);
  assert.match(html, /שם המסלול שנרכש/);
  assert.match(html, /maxLength="100"/i);
});
test('plan-name mode hides fixed text entry and previews the purchased plan name', () => {
  const html = renderToStaticMarkup(<InvoiceDescriptionSettings settings={{ invoiceDescriptionMode: 'PLAN_NAME' } as SystemSettings} onChange={() => {}} />);
  assert.doesNotMatch(html, /<input/);
  assert.match(html, /שם המסלול שנרכש/);
});
