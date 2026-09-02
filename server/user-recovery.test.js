import assert from 'node:assert/strict';
import test from 'node:test';
import { recoverUsersFromAccounts } from './user-recovery.js';

test('restores a missing trainee from the safe profile kept with the login account', () => {
  const profile = {
    id: 'trainee-2', name: 'מני בללי', username: 'meni', email: 'meni@example.com', phone: '0547332390',
    role: 'TRAINEE', gender: 'MALE', age: 35, priorityScore: 100, membershipType: 'NUTRITION_COACHING', membershipStatus: 'ACTIVE'
  };
  const result = recoverUsersFromAccounts({ users: [{ id: 'manager-1', role: 'MANAGER' }], payments: [] }, [{
    user_id: profile.id, role: 'TRAINEE', username_normalized: 'meni', email_normalized: profile.email,
    phone_normalized: '0547332390', profile
  }]);

  assert.equal(result.recoveredUsers.length, 1);
  assert.deepEqual(result.recoveredUsers[0], profile);
  assert.equal(result.payload.users.some(user => user.id === profile.id), true);
});

test('legacy login accounts recover a manageable trainee name and membership from payment history', () => {
  const payload = {
    users: [],
    payments: [{
      id: 'payment-1', traineeId: 'legacy-1', traineeName: 'לירז כהן', status: 'PAID',
      membershipTypePurchased: 'OPEN_GYM', date: '2026-09-01'
    }]
  };
  const result = recoverUsersFromAccounts(payload, [{
    user_id: 'legacy-1', role: 'TRAINEE', username_normalized: 'liraz',
    email_normalized: 'liraz@example.com', phone_normalized: '972501234567', profile: null
  }]);

  assert.deepEqual(result.recoveredUsers[0], {
    id: 'legacy-1', name: 'לירז כהן', username: 'liraz', email: 'liraz@example.com', phone: '0501234567',
    role: 'TRAINEE', gender: 'ALL', age: 0, priorityScore: 100,
    membershipType: 'OPEN_GYM', membershipStatus: 'ACTIVE'
  });
});

test('does not duplicate trainees that are already present in the club state', () => {
  const existing = { id: 'trainee-1', name: 'קיים', role: 'TRAINEE' };
  const result = recoverUsersFromAccounts({ users: [existing] }, [{ user_id: existing.id, role: 'TRAINEE', profile: existing }]);
  assert.equal(result.recoveredUsers.length, 0);
  assert.equal(result.payload.users.length, 1);
});
