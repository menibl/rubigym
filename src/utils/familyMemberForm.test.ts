import test from 'node:test';
import assert from 'node:assert/strict';
import type { User } from '../types';
import { familyMemberSurname, missingFamilyMemberFields } from './familyMemberForm';

const complete = { firstName: 'איל', lastName: 'שילוני צובנר', username: 'eyal', email: 'member@example.test',
  password: 'test-password', birthDate: '2012-12-02', healthApproved: true, agreementApproved: true };

test('family surname uses payer real surname, including multiple words; no invented default', () => {
  const payer = { id: 'payer', name: 'דני שילוני צובנר', familyName: 'כינוי המשפחה' } as User;
  assert.equal(familyMemberSurname(payer, [payer]), 'שילוני צובנר');
  assert.equal(familyMemberSurname({ id: 'child', familyPayerId: 'payer', name: 'ילד' } as User, [payer]), 'שילוני צובנר');
  assert.equal(familyMemberSurname({ name: 'דני', familyName: 'משפחת לוי' } as User, []), 'לוי');
  assert.equal(familyMemberSurname({ name: 'דני' } as User, []), '');
});

test('complete family member with inherited surname has no missing fields', () => {
  assert.deepEqual(missingFamilyMemberFields(complete), []);
});

test('validation names only missing fields, not all required fields', () => {
  assert.deepEqual(missingFamilyMemberFields({ ...complete, lastName: '' }), ['שם משפחה']);
  assert.deepEqual(missingFamilyMemberFields({ ...complete, username: '  ', password: '' }), ['שם משתמש להתחברות', 'סיסמה']);
  assert.deepEqual(missingFamilyMemberFields({ ...complete, healthApproved: false, agreementApproved: false }),
    ['חתימה על הצהרת בריאות', 'אישור הסכם ההצטרפות והתקנון']);
  assert.deepEqual(missingFamilyMemberFields({ ...complete, firstName: '123', lastName: '...' }), ['שם פרטי', 'שם משפחה']);
});
