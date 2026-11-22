export function validateUsernameChange(users, userId, value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 80 || /[\p{Cc}\p{Cf}]/u.test(value)) throw new Error('יש להזין שם משתמש תקין באורך של עד 80 תווים.');
  const username = value.trim();
  const normalized = username.toLowerCase();
  if (!users.some(user => user.id === userId && user.role === 'TRAINEE')) throw new Error('המתאמן לא נמצא.');
  if (users.some(user => user.id !== userId && [user.username, user.email, user.phone]
    .some(identity => identity && String(identity).trim().toLowerCase() === normalized))) throw new Error('שם המשתמש שייך לפרטי הכניסה של משתמש אחר.');
  return username;
}
