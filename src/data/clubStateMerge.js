const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

const valuesEqual = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/**
 * Rebase an entity collection after an optimistic-lock conflict.
 *
 * Fields changed locally since the last synchronized snapshot are retained.
 * Fields that were not changed locally take their newest server value. This
 * prevents an old manager/browser snapshot from erasing profile photos and
 * demographic data that a trainee updated on another device.
 */
export const mergeEntityCollectionById = (baseValue, localValue, remoteValue) => {
  const base = Array.isArray(baseValue) ? baseValue : [];
  const local = Array.isArray(localValue) ? localValue : [];
  const remote = Array.isArray(remoteValue) ? remoteValue : [];
  const baseById = new Map(base.map(item => [String(item?.id || ''), item]));
  const remoteById = new Map(remote.map(item => [String(item?.id || ''), item]));

  const merged = local.flatMap(localItem => {
    const id = String(localItem?.id || '');
    if (!id) return [localItem];

    const baseItem = baseById.get(id);
    const remoteItem = remoteById.get(id);
    remoteById.delete(id);

    if (!baseItem) return [localItem];
    if (!remoteItem) return valuesEqual(localItem, baseItem) ? [] : [localItem];

    const result = {};
    const keys = new Set([
      ...Object.keys(baseItem),
      ...Object.keys(localItem),
      ...Object.keys(remoteItem)
    ]);

    for (const key of keys) {
      const changedLocally = !hasOwn(baseItem, key)
        ? hasOwn(localItem, key)
        : !hasOwn(localItem, key) || !valuesEqual(localItem[key], baseItem[key]);

      if (changedLocally) {
        if (hasOwn(localItem, key)) result[key] = localItem[key];
      } else if (hasOwn(remoteItem, key)) {
        result[key] = remoteItem[key];
      }
    }

    return [result];
  });

  // Remote-only entities (for example a newly registered trainee) must not be
  // lost when an already-open browser retries its own save.
  return [
    ...merged,
    ...[...remoteById.entries()]
      .filter(([id]) => !id || !baseById.has(id))
      .map(([, item]) => item)
  ];
};

const array = value => Array.isArray(value) ? value : [];
const participation = (item, id) => array(item?.registeredUsers).includes(id) ? 'registeredUsers'
  : array(item?.waitlistUsers).includes(id) ? 'waitlistUsers' : null;

/** Three-way merge of booking intent, never whole-list replacement on retry. */
export const mergeBookingCollectionById = (baseValue, localValue, remoteValue) => {
  const base = array(baseValue), local = array(localValue), remote = array(remoteValue);
  const baseById = new Map(base.map(item => [item.id, item]));
  const remoteById = new Map(remote.map(item => [item.id, item]));
  // A remotely deleted occurrence must not be recreated by a stale reservation.
  const survivingLocal = local.filter(item => !baseById.has(item.id) || remoteById.has(item.id));
  return mergeEntityCollectionById(base, survivingLocal, remote).map(item => {
    const before = baseById.get(item.id);
    const here = survivingLocal.find(entry => entry.id === item.id);
    const there = remoteById.get(item.id);
    if (!here || !there) return item;
    const members = new Set([before, there, here].flatMap(entry => [
      ...array(entry?.registeredUsers), ...array(entry?.waitlistUsers)
    ]));
    if (before && [...members].some(id => participation(here, id) !== participation(before, id))
      && ['date', 'time', 'timeSlot'].some(key => there[key] !== before[key])) {
      throw new Error('BOOKING_OCCURRENCE_CONFLICT');
    }
    const registeredUsers = [], waitlistUsers = [];
    for (const id of members) {
      const was = participation(before, id), ours = participation(here, id), theirs = participation(there, id);
      // Conflicting transitions of the SAME trainee keep the server decision.
      // Different trainees' registrations/cancellations are independent.
      const next = ours === was || (theirs !== was && ours !== theirs) ? theirs : ours;
      if (next === 'registeredUsers') registeredUsers.push(id);
      if (next === 'waitlistUsers') waitlistUsers.push(id);
    }
    // Preserve authoritative queue order; append local-only additions afterwards.
    const ordered = (list, key) => [...new Set([...array(there[key]), ...array(here[key])])].filter(id => list.includes(id));
    const registrations = ordered(registeredUsers, 'registeredUsers');
    if (Number.isFinite(Number(item.maxParticipants)) && Number(item.maxParticipants) >= 0 && registrations.length > Number(item.maxParticipants)
      && registrations.some(id => !array(there.registeredUsers).includes(id))) {
      throw new Error('BOOKING_CAPACITY_CONFLICT');
    }
    const excludedDates = [...new Set([...array(there.excludedDates), ...array(here.excludedDates)])]
      .filter(date => !(array(before?.excludedDates).includes(date) && !array(here.excludedDates).includes(date)));
    return { ...item, registeredUsers: registrations, waitlistUsers: ordered(waitlistUsers, 'waitlistUsers'),
      ...(before?.excludedDates || here.excludedDates || there.excludedDates ? { excludedDates } : {}) };
  });
};

export const rebaseClubStateAfterConflict = (base, local, remote) => ({
  ...local,
  users: mergeEntityCollectionById(base.users, local.users, remote.users),
  payments: mergeEntityCollectionById(base.payments, local.payments, remote.payments),
  messages: mergeEntityCollectionById(base.messages, local.messages, remote.messages),
  sessions: mergeBookingCollectionById(base.sessions, local.sessions, remote.sessions),
  openGymSessions: mergeBookingCollectionById(base.openGymSessions, local.openGymSessions, remote.openGymSessions)
});
