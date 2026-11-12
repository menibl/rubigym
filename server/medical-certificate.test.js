import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewMedicalCertificate, validateMedicalFile } from './medical-certificate.js';
import { medicalDocument, medicalRecords, pendingMedicalReview } from '../shared/medical-certificate.js';
import { mergePayloadForUser } from './auth.js';
import { validateArrivalUser } from '../shared/club-check-in.js';
import worker from './index.js';

const now = new Date('2026-11-12T10:00:00Z');
const file = { fileName: 'doctor.pdf', dataUrl: `data:application/pdf;base64,${Buffer.from('%PDF-1.7\n test document').toString('base64')}` };
const record = { id: 'h1', signedAt: '2026-11-01T10:00:00Z', validUntil: '2027-11-01', signed: true,
  signatureName: 'Test Trainee', signatureUrl: 'original-signature', answers: { heart: 'YES' }, requiresMedicalCertificate: true };
const user = () => ({ id: 't1', role: 'TRAINEE', membershipStatus: 'ACTIVE', membershipExpiry: '2026-12-01',
  healthDeclarationSigned: true, healthDeclarationDate: '2026-11-01', healthDeclarationAnswers: record.answers,
  healthDeclarationRequiresMedicalCertificate: true, healthDeclarationHistory: [structuredClone(record)] });
const review = (value, body) => reviewMedicalCertificate(value, { recordId: 'h1', expectedDocumentId: medicalDocument(medicalRecords(value)[0])?.id || '', ...body }, { id: 'manager' }, now);

test('manager upload and separate approval preserve original signed evidence and expiry', () => {
  const original = user();
  const uploaded = review(original, { action: 'upload', document: file });
  assert.equal(uploaded.healthDeclarationMedicalCertificateApproved, false);
  assert.throws(() => validateArrivalUser({ users: [uploaded] }, 't1', now.getTime()), /הצהרת בריאות/);
  const approved = review(uploaded, { action: 'approve' });
  for (const key of Object.keys(record)) assert.deepEqual(approved.healthDeclarationHistory[0][key], record[key]);
  assert.equal(approved.healthDeclarationDate, original.healthDeclarationDate);
  assert.equal(approved.healthDeclarationMedicalCertificateApprovedBy, 'manager');
  assert.deepEqual(approved.healthDeclarationHistory[0].medicalCertificateAudit.map(event => event.action), ['UPLOAD', 'APPROVE']);
  assert.equal(validateArrivalUser({ users: [approved] }, 't1', now.getTime()).id, 't1');
  assert.equal(review(approved, { action: 'approve' }), approved);
});

test('replacement revokes approval and stale-document approvals fail', () => {
  const approved = review(review(user(), { action: 'upload', document: file }), { action: 'approve' });
  const oldId = medicalDocument(approved.healthDeclarationHistory[0]).id;
  const replaced = review(approved, { action: 'upload', document: { ...file, fileName: 'new.pdf' } });
  assert.equal(replaced.healthDeclarationMedicalCertificateApproved, false);
  assert.equal(replaced.healthDeclarationHistory[0].medicalCertificateUploads.length, 2);
  assert.throws(() => review(replaced, { action: 'approve', expectedDocumentId: oldId }), error => error.status === 409);
});

test('missing, invalid, oversized and expired documents cannot grant eligibility', () => {
  assert.throws(() => review(user(), { action: 'approve' }), /להעלות/);
  for (const invalid of [{ ...file, dataUrl: 'data:text/html;base64,PHNjcmlwdD4=' },
    { ...file, dataUrl: 'data:application/pdf;base64,YmFk' }, { ...file, dataUrl: 'x'.repeat(7_000_001) }]) assert.throws(() => validateMedicalFile(invalid));
  const uploaded = review(user(), { action: 'upload', document: file });
  assert.throws(() => reviewMedicalCertificate(uploaded, { action: 'approve', recordId: 'h1', expectedDocumentId: medicalDocument(uploaded.healthDeclarationHistory[0]).id }, { id: 'manager' }, new Date('2028-01-01')), /פגה/);
});

test('legacy pending declarations are approved without rewriting the original historical signed flag', () => {
  const legacy = { ...user(), healthDeclarationHistory: undefined, healthDeclarationSigned: false, healthDeclarationSignatureName: 'Test Trainee',
    healthDeclarationMedicalCertificateDataUrl: file.dataUrl, healthDeclarationMedicalCertificateFileName: file.fileName };
  const original = medicalRecords(legacy)[0];
  const approved = reviewMedicalCertificate(legacy, { action: 'approve', recordId: original.id, expectedDocumentId: `original-${original.id}` }, { id: 'manager' }, now);
  assert.equal(approved.healthDeclarationHistory[0].signed, false);
  assert.equal(approved.healthDeclarationSigned, true);
  assert.equal(approved.healthDeclarationDate, legacy.healthDeclarationDate);
  const saved = mergePayloadForUser({ users: [approved] }, { users: [legacy] }, 't1', 'TRAINEE').users[0];
  assert.equal(saved.healthDeclarationSigned, true);
  assert.equal(saved.healthDeclarationMedicalCertificateApproved, true);
});

test('generic profile saves cannot forge review or erase manager evidence', () => {
  const approved = review(review(user(), { action: 'upload', document: file }), { action: 'approve' });
  const current = { users: [approved], sessions: [], openGymSessions: [] };
  const stale = { ...approved, healthDeclarationHistory: [], healthDeclarationDate: '2099-01-01', healthDeclarationAnswers: { heart: 'NO' }, healthDeclarationMedicalCertificateApproved: false };
  const managerSave = mergePayloadForUser(current, { ...current, users: [stale] }, 'manager', 'MANAGER').users[0];
  assert.deepEqual(managerSave.healthDeclarationHistory, approved.healthDeclarationHistory);
  assert.equal(managerSave.healthDeclarationDate, approved.healthDeclarationDate);
  assert.deepEqual(managerSave.healthDeclarationAnswers, approved.healthDeclarationAnswers);
  const pending = user();
  const forged = { ...pending, healthDeclarationMedicalCertificateApproved: true,
    healthDeclarationHistory: [{ ...record, medicalCertificateApproved: true, medicalCertificateAudit: [{ action: 'APPROVE' }] }] };
  const saved = mergePayloadForUser({ ...current, users: [pending] }, { ...current, users: [forged] }, 't1', 'TRAINEE').users[0];
  assert.notEqual(saved.healthDeclarationMedicalCertificateApproved, true);
  assert.deepEqual(saved.healthDeclarationHistory, pending.healthDeclarationHistory);
});

test('medical pending blocks group/Open bookings and attendance even with a paid membership', () => {
  const pending = user();
  const current = { users: [pending], sessions: [{ id: 's', registeredUsers: [] }], openGymSessions: [{ id: 'o', registeredUsers: [] }] };
  const incoming = { ...current, sessions: [{ id: 's', registeredUsers: ['t1'] }], openGymSessions: [{ id: 'o', registeredUsers: ['t1'] }], attendanceLogs: [{ id: 'a', traineeId: 't1' }] };
  const saved = mergePayloadForUser(current, incoming, 't1', 'TRAINEE');
  assert.deepEqual(saved.sessions, current.sessions);
  assert.deepEqual(saved.openGymSessions, current.openGymSessions);
  assert.equal(saved.attendanceLogs.length, 0);
});

test('registration sanitizes forged approvals and keeps completed signed YES declaration', () => {
  const saved = pendingMedicalReview({ ...user(), healthDeclarationRequiresMedicalCertificate: false, healthDeclarationMedicalCertificateApproved: true,
    healthDeclarationHistory: [{ ...record, medicalCertificateApproved: true, medicalCertificateUploads: [file] }] });
  assert.equal(saved.healthDeclarationSigned, true);
  assert.equal(saved.healthDeclarationRequiresMedicalCertificate, true);
  assert.equal(saved.healthDeclarationMedicalCertificateApproved, false);
  assert.equal(saved.healthDeclarationHistory[0].medicalCertificateUploads, undefined);
});

function apiFixture(role = 'MANAGER', conflict = false) {
  let state = { revision: 1, payload: { users: [{ id: 'manager', role: 'MANAGER' }, user()], payments: [] } };
  let writes = 0;
  const store = {
    getSession: async () => ({ club_id: 'test', user_id: 'manager' }),
    getAccount: async () => ({ user_id: 'manager', role }),
    getClubState: async () => state,
    putClubState: async (_club, payload, revision) => {
      writes++; assert.equal(revision, state.revision);
      if (conflict) return { conflict: true };
      state = { revision: revision + 1, payload }; return { revision: state.revision };
    }
  };
  return { state: () => state, writes: () => writes, post: body => worker.fetch(new Request('https://club.test/api/admin/medical-certificate', {
    method: 'POST', headers: { Cookie: 'baly_session=test', 'Content-Type': 'application/json' }, body: JSON.stringify(body)
  }), { STATE_STORE: store, CLUB_ID: 'test' }) };
}

test('medical review API is manager only and persists an audited upload then approval', async () => {
  for (const role of ['TRAINEE', 'COACH']) {
    const api = apiFixture(role);
    assert.equal((await api.post({ userId: 't1', recordId: 'h1', action: 'upload', document: file })).status, 403);
    assert.equal(api.writes(), 0);
  }
  const api = apiFixture();
  const response = await api.post({ userId: 't1', recordId: 'h1', action: 'upload', document: file });
  assert.equal(response.status, 200);
  const uploaded = (await response.json()).user;
  const approved = await api.post({ userId: 't1', recordId: 'h1', action: 'approve', expectedDocumentId: medicalDocument(uploaded.healthDeclarationHistory[0]).id });
  assert.equal(approved.status, 200);
  assert.equal(api.state().payload.users[1].healthDeclarationMedicalCertificateApproved, true);
  assert.equal(api.state().payload.payments.length, 0);
});

test('medical API does not silently accept a concurrent or invalid request', async () => {
  const api = apiFixture();
  assert.equal((await api.post({ userId: 't1', recordId: 'missing', action: 'approve' })).status, 409);
  assert.equal((await api.post({ userId: 't1', recordId: 'h1', action: 'upload', document: {} })).status, 400);
  assert.equal(api.writes(), 0);
  const racing = apiFixture('MANAGER', true);
  assert.equal((await racing.post({ userId: 't1', recordId: 'h1', action: 'upload', document: file })).status, 409);
  assert.equal(racing.writes(), 4);
  assert.equal(racing.state().payload.users[1].healthDeclarationHistory[0].medicalCertificateUploads, undefined);
});
