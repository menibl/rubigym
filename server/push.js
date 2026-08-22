import webpush from 'web-push';

const reminderWindowMs = 10 * 60 * 1000;
const israelTimeZone = 'Asia/Jerusalem';

const cleanText = (value, fallback, maxLength = 180) => {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, maxLength);
};

export const isPushConfigured = env => Boolean(
  env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY && env.VAPID_SUBJECT
);

export const validatePushSubscription = subscription => {
  if (!subscription || typeof subscription !== 'object') return null;
  const endpoint = String(subscription.endpoint || '').slice(0, 2048);
  const p256dh = String(subscription.keys?.p256dh || '').slice(0, 512);
  const auth = String(subscription.keys?.auth || '').slice(0, 512);
  try {
    const endpointUrl = new URL(endpoint);
    const hostname = endpointUrl.hostname.toLowerCase();
    const privateIpv4 = /^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/;
    if (
      endpointUrl.protocol !== 'https:' || !p256dh || !auth ||
      hostname === 'localhost' || hostname === '::1' || hostname.endsWith('.local') ||
      hostname.endsWith('.internal') || privateIpv4.test(hostname)
    ) return null;
  } catch {
    return null;
  }
  return {endpoint, keys: {p256dh, auth}};
};

const sendToSubscription = async (subscription, payload, env) => {
  await webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 60 * 60,
    urgency: 'high',
    timeout: 5_000,
    vapidDetails: {
      subject: env.VAPID_SUBJECT,
      publicKey: env.VAPID_PUBLIC_KEY,
      privateKey: env.VAPID_PRIVATE_KEY,
    },
  });
};

export const sendPushToUsers = async (store, env, clubId, userIds, payload) => {
  if (!store || !isPushConfigured(env) || !userIds.length) return {sent: 0};
  const subscriptions = await store.getPushSubscriptions(clubId, [...new Set(userIds)]);
  let sent = 0;
  await Promise.all(subscriptions.map(async row => {
    try {
      await sendToSubscription({
        endpoint: row.endpoint,
        keys: {p256dh: row.p256dh, auth: row.auth},
      }, payload, env);
      sent += 1;
    } catch (error) {
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await store.deletePushSubscription(clubId, row.user_id, row.endpoint);
        return;
      }
      console.warn('Web push delivery failed', error?.statusCode || error?.message || error);
    }
  }));
  return {sent};
};

const pushEnabled = user => Boolean(user?.pushNotificationsEnabled);
const staffRecipients = users => users
  .filter(user => ['MANAGER', 'COACH'].includes(user.role))
  .filter(user => pushEnabled(user) && (user.role !== 'MANAGER' || user.managerPushNotificationsEnabled))
  .map(user => user.id);

const newItems = (before, after) => {
  const existingIds = new Set((before || []).map(item => item.id));
  return (after || []).filter(item => item?.id && !existingIds.has(item.id));
};

export const dispatchStateChangePushes = async (store, env, clubId, before, after) => {
  if (!isPushConfigured(env)) return;
  const users = after.users || [];
  const userById = new Map(users.map(user => [user.id, user]));

  for (const message of newItems(before.messages, after.messages)) {
    const receiver = userById.get(message.receiverId);
    if (!pushEnabled(receiver) || (receiver.role === 'MANAGER' && !receiver.managerPushNotificationsEnabled)) continue;
    await sendPushToUsers(store, env, clubId, [receiver.id], {
      title: cleanText(`הודעה חדשה מאת ${message.senderName}`, 'הודעה חדשה'),
      body: cleanText(message.content, 'ממתינה לך הודעה חדשה במערכת.'),
      tag: `message-${message.id}`,
      url: '/',
    });
  }

  const staffIds = staffRecipients(users);
  for (const user of newItems(before.users, users).filter(user => user.role === 'TRAINEE')) {
    await sendPushToUsers(store, env, clubId, staffIds, {
      title: 'מתאמן חדש הצטרף למועדון',
      body: cleanText(`${user.name} הצטרף למועדון.`, 'מתאמן חדש הצטרף למועדון.'),
      tag: `new-user-${user.id}`,
      url: '/',
    });
  }

  for (const payment of newItems(before.payments, after.payments)) {
    await sendPushToUsers(store, env, clubId, staffIds, {
      title: 'רכישה חדשה במועדון',
      body: cleanText(`${payment.traineeName || 'מתאמן'} רכש/ה ${payment.membershipTypePurchased || 'מסלול חדש'}.`, 'בוצעה רכישה חדשה.'),
      tag: `payment-${payment.id}`,
      url: '/',
    });
  }

  for (const announcement of newItems(before.announcements, after.announcements)) {
    const recipients = users.filter(user => {
      if (!pushEnabled(user)) return false;
      if (user.role !== 'TRAINEE') return true;
      if (announcement.targetGender && announcement.targetGender !== 'ALL' && user.gender !== announcement.targetGender) return false;
      if (Number.isFinite(announcement.targetAgeMin) && Number(user.age || 0) < announcement.targetAgeMin) return false;
      if (Number.isFinite(announcement.targetAgeMax) && Number(user.age || 0) > announcement.targetAgeMax) return false;
      if (announcement.targetMembershipTypes?.length) {
        const memberships = new Set([user.membershipType, ...(user.secondaryMemberships || [])]);
        if (!announcement.targetMembershipTypes.some(type => memberships.has(type))) return false;
      }
      return true;
    }).map(user => user.id);
    await sendPushToUsers(store, env, clubId, recipients, {
      title: cleanText(announcement.title, 'הודעה חדשה מהמועדון', 100),
      body: cleanText(announcement.content || announcement.message, 'פורסמה הודעה חדשה בלוח המודעות.'),
      tag: `announcement-${announcement.id}`,
      url: '/',
    });
  }

  const previousWorkoutPlans = new Map((before.workoutPlans || []).map(plan => [plan.id, plan]));
  for (const plan of after.workoutPlans || []) {
    const previous = previousWorkoutPlans.get(plan.id);
    const wasPublished = previous?.status === 'APPROVED_ASSIGNED';
    if (plan.status !== 'APPROVED_ASSIGNED' || wasPublished) continue;
    if (!pushEnabled(userById.get(plan.traineeId))) continue;
    await sendPushToUsers(store, env, clubId, [plan.traineeId], {
      title: 'תוכנית אימון חדשה פורסמה עבורך',
      body: cleanText(plan.title, 'המאמן פרסם עבורך תוכנית אימון חדשה.'),
      tag: `workout-plan-${plan.id}`,
      url: '/',
    });
  }

  const previousNutritionPlans = new Map((before.nutritionPlans || []).map(plan => [plan.id, plan]));
  for (const plan of after.nutritionPlans || []) {
    const previous = previousNutritionPlans.get(plan.id);
    if (!plan.active || previous?.active) continue;
    if (!pushEnabled(userById.get(plan.traineeId))) continue;
    await sendPushToUsers(store, env, clubId, [plan.traineeId], {
      title: 'תוכנית תזונה חדשה פורסמה עבורך',
      body: 'המאמן פרסם עבורך תוכנית תזונה חדשה לצפייה באפליקציה.',
      tag: `nutrition-plan-${plan.id}`,
      url: '/',
    });
  }

  const beforeBookableSessions = [...(before.sessions || []), ...(before.openGymSessions || [])];
  const afterBookableSessions = [...(after.sessions || []), ...(after.openGymSessions || [])];
  const previousSessions = new Map(beforeBookableSessions.map(session => [session.id, session]));
  for (const session of afterBookableSessions) {
    const previousRegistrations = new Set(previousSessions.get(session.id)?.registeredUsers || []);
    const newRegistrations = (session.registeredUsers || []).filter(userId => !previousRegistrations.has(userId));
    const recipients = newRegistrations.filter(userId => pushEnabled(userById.get(userId)));
    if (recipients.length) {
      await sendPushToUsers(store, env, clubId, recipients, {
        title: 'ההרשמה לאימון אושרה',
        body: cleanText(`${session.title} בתאריך ${session.date} בשעה ${session.time}.`, 'ההרשמה לאימון אושרה.'),
        tag: `registration-${session.id}`,
        url: '/',
      });
    }
  }
};

export const israelDateTimeToTimestamp = (date, time) => {
  const match = `${date || ''}T${time || ''}`.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return Number.NaN;
  const [, year, month, day, hour, minute] = match.map(Number);
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: israelTimeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date(guess));
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  const represented = Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  return guess - (represented - guess);
};

export const sendUpcomingWorkoutReminders = async (store, env, now = Date.now()) => {
  if (!store || !isPushConfigured(env)) return;
  const clubs = await store.getAllClubStates();
  for (const club of clubs) {
    const users = club.payload.users || [];
    const userById = new Map(users.map(user => [user.id, user]));
    const bookableSessions = [...(club.payload.sessions || []), ...(club.payload.openGymSessions || [])];
    for (const session of bookableSessions) {
      const startsAt = israelDateTimeToTimestamp(session.date, session.time);
      const untilStart = startsAt - now;
      if (!Number.isFinite(startsAt) || untilStart < 24 * 60 * 60 * 1000 - reminderWindowMs || untilStart > 24 * 60 * 60 * 1000 + reminderWindowMs) continue;

      for (const userId of session.registeredUsers || []) {
        const user = userById.get(userId);
        if (!pushEnabled(user) || !user.workoutRemindersEnabled) continue;
        const deliveryKey = `workout-24h:${session.id}:${userId}`;
        if (!await store.claimPushDelivery(club.club_id, deliveryKey)) continue;
        const result = await sendPushToUsers(store, env, club.club_id, [userId], {
          title: `תזכורת לאימון: ${cleanText(session.title, 'האימון הבא שלך', 80)}`,
          body: cleanText(`האימון מחר בשעה ${session.time} עם ${session.coachName || 'צוות המועדון'}.`, 'האימון הבא שלך יתחיל בעוד כ־24 שעות.'),
          tag: deliveryKey,
          url: '/',
        });
        if (result.sent === 0) await store.releasePushDelivery(club.club_id, deliveryKey);
      }
    }
  }
};

export const startPushReminderScheduler = (store, env) => {
  if (!store || !isPushConfigured(env)) {
    console.log('Web push reminders disabled: VAPID configuration is missing');
    return null;
  }
  const run = () => sendUpcomingWorkoutReminders(store, env).catch(error => {
    console.error('Push reminder scheduler failed', error?.message || error);
  });
  void run();
  const timer = setInterval(run, 5 * 60 * 1000);
  timer.unref?.();
  console.log('Web push reminder scheduler active');
  return timer;
};
