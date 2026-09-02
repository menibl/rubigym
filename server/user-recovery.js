const localPhone = value => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits.startsWith('972') ? `0${digits.slice(3)}` : digits;
};

const fallbackName = (account, payment) => {
  if (payment?.traineeName) return String(payment.traineeName);
  const identity = account.username_normalized || account.email_normalized || localPhone(account.phone_normalized);
  return String(identity || 'מתאמן ששוחזר');
};

/**
 * Restores users whose durable login account survived an older stale club-state
 * overwrite. New accounts carry a complete safe profile; legacy rows fall back
 * to their latest payment and login identity so they remain manageable.
 */
export const recoverUsersFromAccounts = (payload = {}, accounts = []) => {
  const users = Array.isArray(payload.users) ? payload.users : [];
  const payments = Array.isArray(payload.payments) ? payload.payments : [];
  const existingIds = new Set(users.map(user => user.id));
  const recoveredUsers = accounts
    .filter(account => account?.user_id && account.role === 'TRAINEE' && !existingIds.has(account.user_id))
    .map(account => {
      const latestPayment = payments
        .filter(payment => payment.traineeId === account.user_id)
        .sort((left, right) => String(right.timestamp || right.date || '').localeCompare(String(left.timestamp || left.date || '')))[0];
      const storedProfile = account.profile && typeof account.profile === 'object' ? account.profile : {};
      const { password: _password, passwordHash: _passwordHash, ...profile } = storedProfile;
      return {
        ...profile,
        id: account.user_id,
        name: profile.name || fallbackName(account, latestPayment),
        username: profile.username || account.username_normalized || '',
        email: profile.email || account.email_normalized || '',
        phone: profile.phone || localPhone(account.phone_normalized),
        role: 'TRAINEE',
        gender: profile.gender || 'ALL',
        age: Number(profile.age) || 0,
        priorityScore: Number.isFinite(Number(profile.priorityScore)) ? Number(profile.priorityScore) : 100,
        membershipType: profile.membershipType || latestPayment?.membershipTypePurchased,
        membershipStatus: profile.membershipStatus || (latestPayment?.status === 'PAID' ? 'ACTIVE' : 'DEBT'),
        role: 'TRAINEE'
      };
    });

  return {
    payload: recoveredUsers.length ? { ...payload, users: [...recoveredUsers, ...users] } : payload,
    recoveredUsers
  };
};
