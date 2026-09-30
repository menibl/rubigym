const fail = message => { throw new Error(message); };

// Kept as ID-only tombstones so stale clients cannot restore deleted accounts.
export function removeDeletedUserData(payload, deletedIds) {
  const ids = new Set(deletedIds);
  const ownedFields = ['traineeId', 'userId', 'senderId', 'receiverId'];
  const scrub = value => {
    if (Array.isArray(value)) return value.filter(item => {
      if (typeof item === 'string') return !ids.has(item);
      return !item || !ids.has(item.id) && !ownedFields.some(key => ids.has(item[key])) && !ids.has(item.memberId);
    }).map(scrub);
    if (!value || typeof value !== 'object') return value;
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (['coachId', 'createdBy', 'approvedBy', 'usedBy', 'targetTraineeId', 'familyPayerId'].includes(key) && ids.has(item)) continue;
      if (key === 'coachName' && ids.has(value.coachId)) { result[key] = 'צוות המועדון'; continue; }
      result[key] = scrub(item);
    }
    return result;
  };
  const next = scrub(payload);
  const planIds = new Set((next.workoutPlans || []).map(plan => plan.id));
  next.sessions = (next.sessions || []).map(session => {
    if (session.assignedWorkoutPlanId && !planIds.has(session.assignedWorkoutPlanId)) {
      const { assignedWorkoutPlanId, ...remaining } = session;
      return remaining;
    }
    return session;
  });
  next.deletedUserIds = [...ids];
  return next;
}

export function deleteClubUser(payload, targetId, managerId, successorId) {
  const target = (payload.users || []).find(user => user.id === targetId);
  if (!target) fail('המשתמש לא נמצא. יש לרענן את הדף.');
  if (target.id === managerId || target.role === 'MANAGER') fail('לא ניתן למחוק חשבון מנהל.');
  const dependents = payload.users.filter(user => user.id !== targetId &&
    (user.familyPayerId === targetId || (target.isFamilyPayer && target.familyId && user.familyId === target.familyId)));
  let users = payload.users;
  if (dependents.length) {
    const successor = dependents.find(user => user.id === successorId && user.role === 'TRAINEE' && user.age >= 18 && !user.registrationIncomplete);
    if (!successor) fail('יש לבחור ראש משפחה חלופי בגיר מתוך בני המשפחה, שהשלים הרשמה, לפני המחיקה.');
    users = users.map(user => {
      if (!dependents.some(member => member.id === user.id)) return user;
      return {
        ...user, familyId: target.familyId || successor.familyId, familyName: target.familyName || successor.familyName,
        isFamilyPayer: user.id === successorId, familyPayerId: successorId,
        ...(user.id === successorId ? {
          familyBillingMode: target.familyBillingMode, familyMembersCount: target.familyMembersCount,
          familyTrackName: target.familyTrackName, familyCombinedAmount: target.familyCombinedAmount,
          familyMemberPlans: target.familyMemberPlans,
          membershipStatus: target.membershipStatus, membershipExpiry: target.membershipExpiry,
        } : {})
      };
    });
  }
  return removeDeletedUserData({ ...payload, users }, [...(payload.deletedUserIds || []), targetId]);
}
