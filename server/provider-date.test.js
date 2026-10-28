import test from 'node:test';
import assert from 'node:assert/strict';
import { providerTimestamp, providerDateFormat } from './provider-date.js';

test('ISO offsets and WCF UTC milliseconds identify the same instant without applying the offset twice', () => {
  const expected = '2026-10-28T09:32:47.000Z';
  const epoch = Date.parse(expected);
  for (const value of ['2026-10-28T12:32:47+03:00', expected, `/Date(${epoch})/`, `/Date(${epoch}+0300)/`, `/Date(${epoch}-0500)/`,
    { DateTime: `/Date(${epoch})/`, OffsetMinutes: 180 }]) {
    assert.equal(providerTimestamp(value)?.toISOString(), expected);
  }
  const parsedJson = JSON.parse(`{"time":"\\/Date(${epoch}+0300)\\/"}`);
  assert.equal(providerTimestamp(parsedJson.time)?.toISOString(), expected);
});

test('valid UTC offset formats preserve Jerusalem calendar boundaries across winter and summer', () => {
  assert.equal(providerTimestamp('2027-10-01T00:00:00+03:00')?.toISOString(), '2027-09-30T21:00:00.000Z');
  assert.equal(providerTimestamp('2026-11-01T00:00:00+02:00')?.toISOString(), '2026-10-31T22:00:00.000Z');
  assert.equal(providerTimestamp('2026-10-28T12:32:47.1234567+03:00')?.toISOString(), '2026-10-28T09:32:47.123Z');
  assert.equal(providerTimestamp('2024-02-29T12:00:00Z')?.toISOString(), '2024-02-29T12:00:00.000Z');
});

test('invalid calendars and ambiguous dates are rejected rather than guessed or rolled into another month', () => {
  for (const value of [null, undefined, '', 1793180000, {}, [], new Date(),
    '2026-10-28T12:32:47', '2026-10-28', '28/10/2026', '10/28/2026', 'yesterday',
    '2026-02-29T00:00:00Z', '2026-02-31T00:00:00Z', '2026-13-01T00:00:00Z', '2026-10-00T00:00:00Z',
    '2026-10-28T24:00:00Z', '2026-10-28T12:60:00Z', '2026-10-28T12:00:60Z', '2026-10-28T12:00:00+14:30',
    '/Date(NaN)/', '/Date(1793180000000+9999)/', '/Date(9999999999999999)/', '/Date(1793180000x)/',
    { DateTime: '/Date(1793180000000)/', OffsetMinutes: 9999 }, { DateTime: '2026-10-28T12:32:47' }]) {
    assert.equal(providerTimestamp(value), null, `must not infer: ${JSON.stringify(value)}`);
  }
});

test('diagnostic labels expose only structural date format, never provider/customer data', () => {
  assert.equal(providerDateFormat('/Date(1793180000000+0300)/'), 'WCF_DATE');
  assert.equal(providerDateFormat('2026-10-28T12:00:00'), 'ISO_WITHOUT_ZONE');
  assert.equal(providerDateFormat(null), 'MISSING');
  assert.equal(providerDateFormat('do-not-log-personal-information'), 'UNSUPPORTED_STRING');
  assert.equal(providerDateFormat({ DateTime: '/Date(1793180000000)/', OffsetMinutes: 0 }), 'WCF_OFFSET_OBJECT');
});
