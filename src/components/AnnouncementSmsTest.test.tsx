import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { AnnouncementSmsTest } from './AnnouncementSmsTest';

test('SMS test stays closed and performs no send or status request on render', () => {
  const html = renderToStaticMarkup(<AnnouncementSmsTest announcementId="ann-test" />);
  assert.match(html, /בדיקת SMS למספר בודד/);
  assert.match(html, /aria-expanded="false"/);
  assert.equal(html.includes('type="tel"'), false);
});
test('single-recipient UI previews and confirms before sending, refresh never sends and existing jobs disable send', () => {
  const source = readFileSync(new URL('./AnnouncementSmsTest.tsx', import.meta.url), 'utf8');
  assert.match(source, /action: 'preview'/);
  assert.match(source, /send && !next.delivery/);
  assert.match(source, /window.confirm/);
  assert.match(source, /action: 'send', confirmed: true, fingerprint: next.fingerprint/);
  assert.match(source, /run\(false\)/);
  assert.match(source, /Boolean\(delivery\)/);
  assert.equal(source.includes('useEffect'), false);
  const api = readFileSync(new URL('../data/clubServer.ts', import.meta.url), 'utf8');
  const testApi = api.slice(api.indexOf('export async function announcementSmsTest'), api.indexOf('export type ClubStateEnvelope'));
  assert.match(testApi, /if \(isPagesDemoMode\(\)\) throw/);
});
