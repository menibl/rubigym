const fields = {
  PERSONAL_TRAINING: ['personalTrainingRemaining', 'personalTrainingCardSize'],
  DUO_TRAINING: ['duoTrainingRemaining', 'duoTrainingCardSize'],
  OPEN_PUNCH_CARD: ['punchCardRemaining', null]
};

// Administrative balance correction/loading, not a purchase or payment approval.
export function updateTrainingCard(user, type, quantity, mode = 'ADD') {
  if (!fields[type] || !['ADD', 'SET'].includes(mode)) throw new Error('יש לבחור סוג כרטיסייה ופעולה תקינים.');
  const count = Number(quantity);
  if (!String(quantity).trim() || !Number.isSafeInteger(count) || count < (mode === 'ADD' ? 1 : 0) || count > 1000) throw new Error('יש להזין כמות שלמה בטווח המותר (עד 1,000).');
  const [remainingField, sizeField] = fields[type];
  const remaining = Number(user[remainingField] || 0);
  const newRemaining = mode === 'ADD' ? remaining + count : count;
  if (!Number.isSafeInteger(newRemaining) || newRemaining > 1000) throw new Error('היתרה המרבית היא 1,000 אימונים.');
  const next = { ...user, [remainingField]: newRemaining };
  if (sizeField) next[sizeField] = mode === 'ADD' ? Math.max(Number(user[sizeField] || 0), remaining) + count : Math.max(Number(user[sizeField] || 0), count);
  if (!user.membershipType) next.membershipType = type;
  else if (user.membershipType !== type) next.secondaryMemberships = [...new Set([...(user.secondaryMemberships || []), type])];
  return next;
}
