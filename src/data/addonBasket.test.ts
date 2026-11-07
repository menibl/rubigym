import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('additional-service UI submits a basket in ADDON mode, not a synthetic primary purchase', () => {
  const dashboard = readFileSync(new URL('../components/TraineeDashboard.tsx', import.meta.url), 'utf8');
  const handler = dashboard.slice(dashboard.indexOf('const handleMembershipCheckout'), dashboard.indexOf('const handleFamilyCheckout'));
  assert.match(handler, /mode: membershipPurchaseMode/);
  assert.match(handler, /individualSelections: checkoutAdditions.length \? \[/);
  assert.match(handler, /trainingSessionsCount: selectedMembershipUsesTrainingCard \? trainingCardSize : undefined/);
  assert.match(handler, /\.\.\.checkoutAdditions/);
  const checkout = dashboard.slice(dashboard.indexOf('<form onSubmit={handleMembershipCheckout}'), dashboard.indexOf('{selectedMembershipUsesTrainingCard && ('));
  assert.doesNotMatch(checkout, /membershipPurchaseMode === 'PRIMARY' && <fieldset/);
  assert.match(checkout, /membershipAddOns.filter\(plan => plan.id !== selectedMembershipPurchase\)/);
  assert.match(checkout, /trainingSessionsCount: Math.max\(1, Math.min\(50/);
  const client = readFileSync(new URL('./rivhitPayments.ts', import.meta.url), 'utf8');
  assert.match(client, /request.individualSelections\?\.length && \['PRIMARY', 'ADDON'\].includes\(request.mode\)/);
  assert.match(client, /await continueFamilySplitPayment\(quote.batchId, request.userId\)/);
});
