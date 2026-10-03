const fail = message => { throw new Error(message); };
const balanceField = type => type === 'DUO' ? 'duoTrainingRemaining' : 'personalTrainingRemaining';
const bookingMessages = (payload, session, booking, action, now) => {
  const senderId = session.coachId || payload.users.find(u => u.role === 'MANAGER')?.id;
  if (!senderId) return payload.messages || [];
  const payer = payload.users.find(u => u.id === booking.payerId);
  const lowBalance = action === 'BOOK' && Number(payer?.[balanceField(booking.type)]) === 3 ? ' נותרו בכרטיסייה 2 אימונים.' : '';
  const recipients = [...new Set([...booking.participantIds, ...payload.users.filter(u => ['MANAGER', 'COACH'].includes(u.role)).map(u => u.id)])];
  return [...(payload.messages || []), ...recipients.filter(id => id !== senderId).map(receiverId => ({
    id: `personal-booking-${booking.id}-${action}-${receiverId}`, senderId, receiverId,
    content: `${action === 'BOOK' ? 'נקבע' : 'בוטל'} אימון ${booking.type === 'DUO' ? 'זוגי' : 'אישי'}: ${session.title}, ${session.date} ${session.time}. כרטיסיית המשלם: ${payer?.name || ''}. ${action === 'BOOK' ? 'נוכה קרדיט אחד בלבד.' : booking.refunded ? 'הקרדיט הוחזר לכרטיסייה המקורית.' : 'ביטול מאוחר — הקרדיט לא הוחזר.'}${lowBalance}`,
    timestamp: new Date(now).toISOString(), read: false, systemGenerated: true
  }))];
};

// Calendar times belong to the club, not to the device's timezone.
export const personalStart = session => {
  const guess = Date.parse(`${session.date}T${session.time}:00Z`);
  if (!Number.isFinite(guess)) return NaN;
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date(guess)).map(p => [p.type, p.value]));
  return guess - (Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00Z`) - guess);
};

export const changePersonalBooking = (payload, actorId, input, now = Date.now()) => {
  const users = payload.users || [];
  const actor = users.find(u => u.id === actorId);
  const staff = ['MANAGER', 'COACH'].includes(actor?.role);
  if (!actor) fail('יש להתחבר מחדש.');
  let sessions = payload.sessions || [];
  if (input.newSession) {
    if (!staff || input.action !== 'BOOK') fail('אין הרשאה ליצור אימון.');
    const existing = sessions.find(s => s.id === input.newSession.id);
    if (existing && existing.personalBooking?.id !== input.bookingId) fail('האימון כבר קיים.');
    if (!existing) sessions = [...sessions, { ...input.newSession, personalBooking: undefined, registeredUsers: [], waitlistUsers: [] }];
  }
  const session = sessions.find(s => s.id === input.sessionId);
  if (!session?.isPersonalTraining || session.isDemoSession) fail('האימון אינו זמין להרשמה אישית.');
  const previous = session.personalBooking;
  const start = personalStart(session);
  if (!Number.isFinite(start)) fail('מועד האימון אינו תקין.');

  if (input.action === 'CANCEL') {
    if (!previous || (!staff && !previous.participantIds.includes(actorId))) fail('אין הרשאה לבטל הרשמה זו.');
    if (input.bookingId !== previous.id) fail('ההרשמה השתנתה. יש לרענן את היומן.');
    if (previous.status === 'CANCELLED') return payload;
    if (start <= now) fail('האימון כבר התחיל. יש לפנות למאמן לבירור הביטול.');
    const windowHours = Number(payload.settings?.cancellationWindowHours ?? 2);
    const late = start - now < (Number.isFinite(windowHours) ? windowHours : 2) * 3600000;
    if (late && input.acknowledgeLate !== true) fail('LATE_PERSONAL_CANCELLATION');
    const field = balanceField(previous.type);
    return { ...payload,
      messages: bookingMessages(payload, session, { ...previous, refunded: !late }, 'CANCEL', now),
      users: users.map(u => u.id === previous.payerId && !late ? { ...u, [field]: Number(u[field] || 0) + 1 } : u),
      sessions: sessions.map(s => s.id !== session.id ? s : {
        ...s, registeredUsers: s.registeredUsers.filter(id => !previous.participantIds.includes(id)),
        coTrainees: [], targetTraineeId: previous.originalTargetTraineeId,
        maxParticipants: previous.originalCapacity,
        personalBooking: { ...previous, status: 'CANCELLED', refunded: !late, cancelledAt: new Date(now).toISOString() }
      })
    };
  }
  if (input.action !== 'BOOK' || !['SOLO', 'DUO'].includes(input.type)) fail('יש לבחור אימון אישי או זוגי.');
  const payerId = staff ? input.payerId : actorId;
  if (previous?.status === 'BOOKED' && previous.id === input.bookingId && previous.payerId === payerId) return payload;
  if (previous?.id === input.bookingId) fail('בקשת הרשמה זו כבר בוטלה. יש לפתוח הרשמה חדשה.');
  if (!input.bookingId || typeof input.bookingId !== 'string' || input.bookingId.length > 100) fail('מזהה הרשמה חסר.');
  if (start <= now || session.coachApprovalStatus === 'DECLINED') fail('האימון אינו זמין להרשמה.');
  if (session.registeredUsers?.length || previous?.status === 'BOOKED') fail('האימון כבר תפוס. אימון אישי אינו הופך לזוגי אוטומטית.');
  if (session.targetTraineeId && session.targetTraineeId !== payerId) fail('האימון משויך למתאמן אחר.');
  const payer = users.find(u => u.id === payerId && u.role === 'TRAINEE');
  if (!payer) fail('המתאמן המשלם לא נמצא.');
  const partner = input.type === 'DUO' ? users.find(u => u.id === input.partnerId && u.role === 'TRAINEE') : null;
  if (input.type === 'DUO' && (!partner || partner.id === payer.id)) fail('יש לבחור בן או בת זוג לאימון.');
  if (partner && !staff && !(payer.familyId && payer.familyId === partner.familyId)) fail('ניתן לבחור בן משפחה משויך בלבד. לצירוף מתאמן אחר יש לפנות למאמן.');
  const field = balanceField(input.type);
  const membership = input.type === 'DUO' ? 'DUO_TRAINING' : 'PERSONAL_TRAINING';
  if (![payer.membershipType, ...(payer.secondaryMemberships || [])].includes(membership) || !(Number(payer[field]) >= 1)) fail('אין יתרה בכרטיסייה שנבחרה.');
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem' }).format(new Date(now));
  const participants = partner ? [payer, partner] : [payer];
  for (const user of participants) {
    if (user.registrationIncomplete || user.registrationPaymentPending || user.familyPaymentPending) fail(`${user.name}: יש להשלים את הרישום והתשלום.`);
    if (user.isMembershipFrozen && (!user.membershipFrozenUntil || user.membershipFrozenUntil >= today)) fail(`${user.name}: המנוי מוקפא.`);
    if (user.cancellationEffectiveDate && user.cancellationEffectiveDate <= today) fail(`${user.name}: המנוי בוטל.`);
    const signed = Date.parse(user.healthDeclarationDate || '');
    const expires = new Date(signed); expires.setUTCFullYear(expires.getUTCFullYear() + 1);
    if (!user.healthDeclarationSigned || !Number.isFinite(signed) || now > expires.getTime() ||
      (user.healthDeclarationRequiresMedicalCertificate && !user.healthDeclarationMedicalCertificateApproved)) fail(`${user.name}: נדרשת הצהרת בריאות בתוקף.`);
    if (session.genderRestriction && session.genderRestriction !== 'ALL' && session.genderRestriction !== user.gender) fail(`${user.name}: האימון אינו מתאים להגבלת המין.`);
    if ((session.ageMin || session.ageMax) && (!(user.age > 0) || (session.ageMin && user.age < session.ageMin) || (session.ageMax && user.age > session.ageMax))) fail(`${user.name}: האימון אינו מתאים להגבלת הגיל.`);
    const bookings = [...sessions.filter(s => s.id !== session.id), ...(payload.openGymSessions || []).map(s => {
      const [from, to] = String(s.timeSlot || '').split('-').map(v => v.trim());
      const minutes = time => time?.split(':').reduce((hours, value) => hours * 60 + Number(value), 0);
      return { ...s, time: from, durationMinutes: minutes(to) - minutes(from) };
    })];
    if (bookings.some(s => s.registeredUsers?.includes(user.id) && personalStart(s) < start + session.durationMinutes * 60000 && personalStart(s) + s.durationMinutes * 60000 > start)) fail(`${user.name}: קיים אימון חופף ביומן.`);
  }
  // The partner attends using the payer's duo card; never require/debit a second card.
  const familyPayer = users.find(u => u.id === payer.familyPayerId);
  if (!(payer.membershipStatus === 'ACTIVE' || payer.offlinePaymentApproved || familyPayer?.membershipStatus === 'ACTIVE') ||
    !(String(familyPayer?.membershipExpiry || payer.membershipExpiry || '') >= today)) fail('יש לחדש את המנוי לפני ההרשמה.');
  const participantIds = participants.map(u => u.id);
  const booking = { id: input.bookingId, type: input.type, payerId: payer.id, participantIds,
    status: 'BOOKED', originalTargetTraineeId: session.targetTraineeId, originalCapacity: session.maxParticipants };
  return { ...payload,
    messages: bookingMessages(payload, session, booking, 'BOOK', now),
    users: users.map(u => u.id === payer.id ? { ...u, [field]: Number(u[field]) - 1,
      personalSessionsCountThisMonth: Number(u.personalSessionsCountThisMonth || 0) + 1,
      ...(input.newSession ? { personalTrainingRate: session.pricePerSession } : {})
    } : u),
    sessions: sessions.map(s => s.id !== session.id ? s : { ...s,
      registeredUsers: participantIds, waitlistUsers: (s.waitlistUsers || []).filter(id => !participantIds.includes(id)), targetTraineeId: payer.id,
      coTrainees: partner ? [partner.id] : [], maxParticipants: participantIds.length,
      personalBooking: booking
    })
  };
};
