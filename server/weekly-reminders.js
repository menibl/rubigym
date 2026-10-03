const groups = new Set(['CORE_GROUPS', 'GROUP_MONTHLY', 'GROUP_ANNUAL', 'DEDICATED_GROUP_HALF_YEAR', 'YOUTH_ONCE_WEEKLY', 'YOUTH_TWICE_WEEKLY']);
const openGym = new Set(['OPEN_GYM', 'OPEN_GYM_WITH_PLAN']);
const shiftDate = (date, days) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);

export function weeklyReminderSlot(now) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(now)).map(p => [p.type, p.value]));
  const date = `${parts.year}-${parts.month}-${parts.day}`;
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  // One-hour bounded catch-up window, never an early or next-day delivery.
  const kind = day === 6 && parts.hour === '20' ? 'saturday' : day === 0 && parts.hour === '09' ? 'sunday' : null;
  return kind ? { kind, date, week: shiftDate(date, kind === 'saturday' ? 1 : 0) } : null;
}

export function weeklyMessages(payload, now) {
  const slot = weeklyReminderSlot(now);
  if (!slot) return [];
  const manager = (payload.users || []).filter(u => u.role === 'MANAGER').sort((a, b) => a.id.localeCompare(b.id))[0];
  if (!manager) return [];
  const existing = new Set((payload.messages || []).map(m => m.id));
  return (payload.users || []).flatMap(user => {
    if (user.role !== 'TRAINEE' || user.membershipStatus !== 'ACTIVE' || user.registrationIncomplete || user.registrationPaymentPending || user.familyPaymentPending
      || !Number.isFinite(Date.parse(user.membershipExpiry || '')) || user.membershipExpiry.slice(0, 10) < slot.date
      || (user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= slot.date))) return [];
    const plans = [user.membershipType, ...(user.secondaryMemberships || [])];
    const hasGroups = plans.some(p => groups.has(p));
    const lines = [];
    if (slot.kind === 'sunday') {
      if (!hasGroups || (payload.sessions || []).some(s => !s.isPersonalTraining && s.date >= slot.week && s.date < shiftDate(slot.week, 7) && s.registeredUsers?.includes(user.id))) return [];
      lines.push('בוקר טוב ושבוע טוב 💪 עדיין לא נרשמת לאימוני הקבוצות השבוע. זה הזמן לבחור את האימונים שמתאימים לך — מחכים לך במועדון!');
    } else {
      if (hasGroups) lines.push('שבוע חדש מתחיל 💪 זה הזמן להירשם לאימוני הקבוצות של השבוע הקרוב. בחרו את האימונים שלכם ונתראה במועדון!');
      const personal = Number(user.personalTrainingRemaining || 0);
      const duo = Number(user.duoTrainingRemaining || 0);
      if (plans.includes('PERSONAL_TRAINING') && Number.isFinite(personal) && personal > 0) lines.push(`נותרו לך ${personal} אימונים אישיים. זה הזמן לקבוע אותם ביומן לשבוע הקרוב!`);
      if (plans.includes('DUO_TRAINING') && Number.isFinite(duo) && duo > 0) lines.push(`נותרו לך ${duo} אימונים זוגיים. זה הזמן לקבוע אותם ביומן לשבוע הקרוב!`);
      if (plans.some(p => openGym.has(p))) lines.push('השבוע שלך, בקצב שלך 💛 המועדון מחכה לך! זה הזמן לתכנן ולהירשם לאימוני ה־Open Gym של השבוע הקרוב.');
    }
    const id = `weekly-${slot.kind}-${slot.week}-${user.id}`;
    if (!lines.length || existing.has(id)) return [];
    return [{ id, senderId: manager.id, senderName: manager.name, senderRole: 'MANAGER', receiverId: user.id,
      content: `תזכורת אוטומטית מהמועדון\n${lines.join('\n\n')}`, timestamp: new Date(now).toISOString(), read: false, systemGenerated: true,
      actionUrl: '?workspace=booking', actionLabel: 'הרשמה לאימונים' }];
  });
}

export async function sendWeeklyReminders(store, env, dispatch, now = Date.now()) {
  if (!store || !weeklyReminderSlot(now)) return;
  for (const club of await store.getAllClubStates()) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const state = await store.getClubState(club.club_id);
      if (!state) break;
      const messages = weeklyMessages(state.payload, now);
      if (!messages.length) break;
      const after = { ...state.payload, messages: [...(state.payload.messages || []), ...messages] };
      const saved = await store.putClubState(club.club_id, after, state.revision);
      if (saved.conflict) continue;
      await dispatch(store, env, club.club_id, state.payload, after);
      break;
    }
  }
}
