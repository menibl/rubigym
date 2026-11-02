import test from 'node:test';
import assert from 'node:assert/strict';
import { checkNoActiveContinuation, verifiedUnrelatedSeries } from './checkout-continuation.js';

const seriesId = '11111111-1111-4111-8111-111111111111';
function fixture() {
  const order = { o: 'current', u: 'payer', m: 'OPEN_GYM', rc: 1 };
  const snapshot = { o: 'other', u: 'payer', bu: 'child', m: 'GROUP_ANNUAL', rc: 1, re: '2099-01-01' };
  const payload = { users: [{ id: 'payer', phone: '0541234567' }, { id: 'child', recurringMemberships: {
    GROUP_ANNUAL: { seriesId, orderId: 'other', status: 'PENDING_FIRST_CHARGE', endsAt: '2099-01-01',
      approvedAt: '2026-11-01T12:00:00Z', events: ['SETUP:verified:0'] }
  } }], recurringCheckouts: [{ orderId: 'other', userId: 'child', membershipType: 'GROUP_ANNUAL',
    recurringSaleId: seriesId, endsAt: '2099-01-01', orderSnapshot: snapshot }] };
  return { order, payload };
}

test('a verified disjoint family instruction does not block the original unpaid page', async () => {
  const f = fixture();
  assert.equal(verifiedUnrelatedSeries(f.payload, f.order, seriesId), true);
  await checkNoActiveContinuation({ ...f, groupToken: 'fixture', post: async () => ({ RecurringSales: [{ RecurringSaleId: seriesId, IsActive: true }] }) });
});

test('unknown, conflicting or unverified instructions still block continuation', async () => {
  for (const variant of ['unknown', 'same-order', 'same-owner-group', 'different-payer', 'missing-approval', 'missing-event', 'cancelled', 'duplicate-binding']) {
    const f = fixture(); const other = f.payload.recurringCheckouts[0], contract = f.payload.users[1].recurringMemberships.GROUP_ANNUAL;
    if (variant === 'unknown') other.recurringSaleId = '22222222-2222-4222-8222-222222222222';
    if (variant === 'same-order') f.order.o = 'other';
    if (variant === 'same-owner-group') { f.order.bu = 'child'; f.order.m = 'OPEN_GYM'; }
    if (variant === 'different-payer') other.orderSnapshot.u = 'someone-else';
    if (variant === 'missing-approval') delete contract.approvedAt;
    if (variant === 'missing-event') contract.events = [];
    if (variant === 'cancelled') other.cancelledAt = '2026-11-01';
    if (variant === 'duplicate-binding') f.payload.recurringCheckouts.push(structuredClone(other));
    assert.equal(verifiedUnrelatedSeries(f.payload, f.order, seriesId), false, variant);
    await assert.rejects(checkNoActiveContinuation({ ...f, groupToken: 'fixture', post: async () => ({ RecurringSales: [{ RecurringSaleId: seriesId, IsActive: true }] }) }), /CONTINUATION_ACTIVE_SERIES/, variant);
  }
});

test('malformed, partial or duplicate provider results never count as a clear search', async () => {
  for (const result of [{ Status: false, RecurringSales: [] }, { Status: null, RecurringSales: [] }, {},
    { RecurringSales: [{ RecurringSaleId: seriesId, IsActive: 'false' }] },
    { RecurringSales: [{ RecurringSaleId: seriesId, IsActive: false }, { RecurringSaleId: seriesId, IsActive: true }] }]) {
    await assert.rejects(checkNoActiveContinuation({ ...fixture(), groupToken: 'fixture', post: async () => result }), /CONTINUATION_LIST_/);
  }
});
