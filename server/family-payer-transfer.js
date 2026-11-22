import { createHash } from 'node:crypto';
import { clubDate } from '../shared/membership-calendar.js';
import { prepareFamilyPayerTransfer, applyFamilyPayerTransfer } from '../shared/family-payer-transfer.js';
import { recurringCustomerTarget, readRecurringCustomerDetails } from './recurring-customer-sync.js';

export const transferFingerprint = plan => createHash('sha256').update(plan.fingerprintInput).digest('hex');
// Only a digest is persisted. Never store/log provider tokens or card details.
export const recurringBillingProof = details => createHash('sha256').update(JSON.stringify([
  'Amount', 'Currency', 'Discount', 'AutoCharge', 'IsActive', 'RecurringCycle', 'RecurringDay',
  'RecurringStep', 'RecurringSaleCount', 'RecurringOffset', 'StartDate', 'EndDate', 'Token'
].map(key => [key, details[key] ?? null]))).digest('hex');

export async function inspectFamilyPayerTransfer(payload, plan, post) {
  if (plan.instructions.length > 6) throw new Error('למשפחה יותר משש הוראות פעילות. נדרשת בדיקה פרטנית לפני העברה.');
  const providerNames = {}, providerProofs = {}, instructions = [];
  for (const item of plan.instructions) {
    const target = recurringCustomerTarget(payload, item.seriesId);
    const details = readRecurringCustomerDetails(await post('/RecurringSaleDetails', { RecurringSaleId: item.seriesId }));
    const phone = String(details.PhoneNumber || '').replace(/\D/g, '').replace(/^00972/, '0').replace(/^972/, '0');
    if (!details.IsActive || phone !== target.ownerPhone || !Number.isFinite(Number(details.Amount)) || !(Number(details.Amount) > 0)
      || Number(details.Currency) !== 1 || details.AutoCharge !== true) throw new Error('לא ניתן לאמת את בעלות ההוראה ונתוני הגבייה ברווחית. לא בוצעה העברה.');
    providerNames[item.seriesId] = `${details.CustomerFirstName} ${details.CustomerLastName}`.trim();
    providerProofs[item.seriesId] = recurringBillingProof(details);
    instructions.push({ seriesId: item.seriesId, amount: Number(details.Amount), currentInvoiceName: providerNames[item.seriesId] });
  }
  return { providerNames, providerProofs, instructions };
}

export async function persistFamilyPayerTransfer(pool, clubId, command, now = new Date()) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT payload FROM club_state WHERE club_id=$1 FOR UPDATE', [clubId]);
    const payload = current.rows[0]?.payload;
    if (!payload) throw new Error('המועדון לא נמצא.');
    const durable = await client.query('SELECT record FROM family_payer_transfer_audit WHERE club_id=$1 AND transfer_id=$2', [clubId, command.id]);
    const existing = durable.rows?.[0]?.record || payload.familyPayerTransfers?.find(record => record.id === command.id);
    if (existing) {
      if (existing.approvedBy !== command.managerId || existing.fromId !== command.fromId || existing.toId !== command.toId) throw new Error('פרטי האישור אינם תואמים.');
      await client.query('COMMIT');
      return { record: existing, repeated: true };
    }
    const plan = prepareFamilyPayerTransfer(payload, command.fromId, command.toId, clubDate(now));
    if (transferFingerprint(plan) !== command.planHash) throw new Error('פרטי המשפחה השתנו. יש לפתוח תצוגה מקדימה מחדש.');
    const record = { id: command.id, familyId: plan.familyId, fromId: plan.fromId, toId: plan.toId,
      fromName: plan.fromName, toName: plan.toName, approvedBy: command.managerId, approvedAt: now.toISOString(),
      memberIds: plan.memberIds, instructions: plan.instructions, seriesIds: plan.instructions.map(item => item.seriesId),
      providerNames: command.providerNames, providerProofs: command.providerProofs };
    const updated = applyFamilyPayerTransfer(payload, plan, record);
    const accounts = await client.query('SELECT user_id FROM auth_accounts WHERE club_id=$1 AND user_id=ANY($2::text[]) FOR UPDATE', [clubId, plan.memberIds]);
    if (accounts.rowCount !== plan.memberIds.length) throw new Error('חסר חשבון כניסה של בן משפחה. לא בוצעה העברה.');
    await client.query('UPDATE club_state SET payload=$2,revision=revision+1,updated_at=now() WHERE club_id=$1', [clubId, updated]);
    for (const user of updated.users.filter(member => plan.memberIds.includes(member.id))) {
      const { password: _password, passwordHash: _hash, ...profile } = user;
      await client.query('UPDATE auth_accounts SET profile=$3,updated_at=now() WHERE club_id=$1 AND user_id=$2', [clubId, user.id, profile]);
    }
    await client.query('INSERT INTO family_payer_transfer_audit (club_id,transfer_id,record) VALUES ($1,$2,$3)', [clubId, record.id, record]);
    await client.query('COMMIT');
    return { record, repeated: false };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
