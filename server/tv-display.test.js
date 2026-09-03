import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import worker, { findScheduledLiveDisplayProgram, shouldPromoteScheduledDisplay } from './index.js';

const createEnv = () => {
  const requestedPaths = [];
  return {
    requestedPaths,
    env: {
      ASSETS: {
        async fetch(request) {
          requestedPaths.push(new URL(request.url).pathname);
          return new Response('asset', {status: 200});
        }
      }
    }
  };
};

test('serves the lightweight display from the permanent TV route', async () => {
  const fixture = createEnv();
  const response = await worker.fetch(new Request('https://balywellness.test/tv'), fixture.env);
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.requestedPaths, ['/tv.html']);
});

test('keeps the legacy hash address working in the LG television browser', async () => {
  const fixture = createEnv();
  const response = await worker.fetch(new Request('https://balywellness.test/', {
    headers: {'User-Agent': 'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 Chrome/68.0 Safari/537.36 WebAppManager LG Browser'}
  }), fixture.env);
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.requestedPaths, ['/tv.html']);
});

test('continues serving the full application to regular browsers', async () => {
  const fixture = createEnv();
  const response = await worker.fetch(new Request('https://balywellness.test/', {
    headers: {'User-Agent': 'Mozilla/5.0 Chrome/120.0 Safari/537.36'}
  }), fixture.env);
  assert.equal(response.status, 200);
  assert.deepEqual(fixture.requestedPaths, ['/index.html']);
});

test('selects a published scheduled workout exactly from its start time', () => {
  const scheduled = {
    id: 'scheduled-1', sessionId: 'session-1', title: 'אימון ערב', status: 'PUBLISHED', updatedAt: '2026-08-25T10:00:00.000Z'
  };
  const payload = {
    sessions: [{ id: 'session-1', date: '2026-08-25', time: '19:00', durationMinutes: 60 }],
    groupWorkoutPrograms: [
      scheduled,
      { ...scheduled, id: 'draft', status: 'DRAFT' }
    ]
  };
  assert.equal(findScheduledLiveDisplayProgram(payload, new Date('2026-08-25T15:59:59.000Z')), undefined);
  assert.equal(findScheduledLiveDisplayProgram(payload, new Date('2026-08-25T16:00:00.000Z'))?.id, 'scheduled-1');
  assert.equal(findScheduledLiveDisplayProgram(payload, new Date('2026-08-25T16:59:00.000Z'))?.id, 'scheduled-1');
  assert.equal(findScheduledLiveDisplayProgram(payload, new Date('2026-08-25T17:00:00.000Z')), undefined);
});

test('converts a scheduled personal demo plan for the fixed club display', () => {
  const payload = {
    sessions: [{
      id: 'demo-session-1', title: 'אימון הדגמה', demoTraineeName: 'מתאמן אורח',
      date: '2026-08-25', time: '19:00', durationMinutes: 45, isPersonalTraining: true
    }],
    workoutPlans: [{
      id: 'demo-plan-1', sessionId: 'demo-session-1', title: 'הדגמת כוח', coachId: 'coach-1', coachName: 'רובי',
      lastUpdated: '2026-08-25', exercises: [{ id: 'exercise-1', name: 'סקוואט', sets: 3, workDuration: '40', restDuration: '20' }]
    }]
  };
  const program = findScheduledLiveDisplayProgram(payload, new Date('2026-08-25T16:00:00.000Z'));
  assert.equal(program?.id, 'personal-display-demo-plan-1');
  assert.equal(program?.groupName, 'מתאמן אורח');
  assert.equal(program?.exercises[0].workSeconds, 40);
  assert.equal(program?.exercises[0].rounds, 3);
});

test('keeps a repetition-based personal plan out of the automatic 45-second timer', () => {
  const payload = {
    sessions: [{
      id: 'reps-session-1', title: 'אימון אישי לפי חזרות', date: '2026-08-25', time: '19:00',
      durationMinutes: 45, isPersonalTraining: true, assignedWorkoutPlanId: 'reps-plan-1'
    }],
    workoutPlans: [{
      id: 'reps-plan-1', sessionId: 'reps-session-1', title: 'כוח לפי חזרות', coachId: 'coach-1', coachName: 'רובי',
      lastUpdated: '2026-08-25', effortMetric: 'REPS', defaultRepetitions: '12',
      exercises: [{ id: 'exercise-1', name: 'לחיצת רגליים', sets: 3, reps: '10' }]
    }]
  };
  const program = findScheduledLiveDisplayProgram(payload, new Date('2026-08-25T16:00:00.000Z'));
  assert.equal(program?.effortMetric, 'REPS');
  assert.equal(program?.defaultWorkSeconds, 0);
  assert.equal(program?.defaultRestSeconds, 0);
  assert.equal(program?.exercises[0].reps, '10');
  assert.equal(program?.exercises[0].workSeconds, 0);
});

test('converts a structured personal plan into balanced rotating stations', () => {
  const payload = {
    sessions: [{ id: 'structured-session', title: 'אימון אישי מובנה', date: '2026-08-25', time: '19:00', durationMinutes: 60, isPersonalTraining: true }],
    workoutPlans: [{
      id: 'structured-plan', sessionId: 'structured-session', coachId: 'coach-1', coachName: 'רובי', lastUpdated: '2026-08-25',
      mode: 'ROTATING_GROUPS', subgroupCount: 2, roundsPerStation: 3, transitionSeconds: 25,
      effortMetric: 'TIME', defaultWorkSeconds: 40, defaultRestSeconds: 20,
      exercises: Array.from({ length: 4 }, (_, index) => ({ id: `exercise-${index}`, name: `תרגיל ${index + 1}`, sets: 3, reps: 'לפי זמן' }))
    }]
  };
  const program = findScheduledLiveDisplayProgram(payload, new Date('2026-08-25T16:00:00.000Z'));
  assert.equal(program?.mode, 'ROTATING_GROUPS');
  assert.equal(program?.stations.length, 2);
  assert.deepEqual(program?.stations.map(station => station.exercises.length), [2, 2]);
  assert.equal(program?.roundsPerStation, 3);
  assert.equal(program?.transitionSeconds, 25);
});

test('keeps the Pages display channel isolated and available without a production login', async () => {
  const program = { id: `pages-${Date.now()}`, title: 'אימון דמו', status: 'PUBLISHED' };
  const origin = 'https://menibl.github.io';
  const putResponse = await worker.fetch(new Request('https://balywellness.test/api/demo/live-display/active', {
    method: 'PUT',
    headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ program })
  }), {});
  assert.equal(putResponse.status, 200);
  assert.equal(putResponse.headers.get('Access-Control-Allow-Origin'), origin);
  assert.equal(putResponse.headers.get('Access-Control-Allow-Credentials'), 'true');
  const putResult = await putResponse.json();
  assert.match(putResult.displayRevision, /^manual-/);

  const getResponse = await worker.fetch(new Request('https://balywellness.test/api/demo/live-display/active', {
    headers: { Origin: origin }
  }), {});
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).program.id, program.id);
  assert.equal(getResponse.headers.get('Cache-Control'), 'no-store, no-cache, must-revalidate');
});

test('manual club broadcast wins over the currently running scheduled workout', () => {
  const active = { id: 'manual', displayActivation: 'MANUAL', displayActivatedMinute: 200 };
  assert.equal(shouldPromoteScheduledDisplay({ program: { id: 'current' }, startMinute: 100 }, active), false);
  assert.equal(shouldPromoteScheduledDisplay({ program: { id: 'next' }, startMinute: 201 }, active), true);
});

test('production display promotes the current scheduled workout over a previous manual selection', async () => {
  const clock = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const date = `${clock.year}-${clock.month}-${clock.day}`;
  const time = `${clock.hour}:${clock.minute}`;
  const scheduled = { id: 'scheduled-now', sessionId: 'session-now', title: 'האימון הנוכחי', status: 'PUBLISHED', updatedAt: new Date().toISOString() };
  let active = { id: 'manual-old', title: 'אימון קודם', status: 'PUBLISHED' };
  const store = {
    async getClubState() {
      return { payload: { sessions: [{ id: 'session-now', date, time, durationMinutes: 60 }], groupWorkoutPrograms: [scheduled] } };
    },
    async getActiveProgram() { return active; },
    async setActiveProgram(_clubId, program) { active = program; }
  };
  const response = await worker.fetch(new Request('https://balywellness.test/api/live-display/active'), { STATE_STORE: store });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).program.id, 'scheduled-now');
  assert.equal(active.id, 'scheduled-now');
});

test('Pages schedule switches the fixed demo screen at the scheduled start', async () => {
  const clock = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(new Date()).filter(part => part.type !== 'literal').map(part => [part.type, part.value]));
  const program = {
    id: 'pages-scheduled-now', title: 'אימון Pages מתוזמן', status: 'PUBLISHED',
    sessionDate: `${clock.year}-${clock.month}-${clock.day}`, sessionTime: `${clock.hour}:${clock.minute}`,
    updatedAt: new Date().toISOString()
  };
  const headers = { Origin: 'https://menibl.github.io', 'Content-Type': 'application/json' };
  const activePrograms = new Map();
  const store = {
    async getActiveProgram(id) { return activePrograms.get(id); },
    async setActiveProgram(id, value) { activePrograms.set(id, value); }
  };
  const scheduleResponse = await worker.fetch(new Request('https://balywellness.test/api/demo/live-display/schedule', {
    method: 'PUT', headers, body: JSON.stringify({ programs: [program] })
  }), { STATE_STORE: store });
  assert.equal(scheduleResponse.status, 200);

  const displayResponse = await worker.fetch(new Request('https://balywellness.test/api/demo/live-display/active', { headers }), { STATE_STORE: store });
  assert.equal(displayResponse.status, 200);
  assert.equal((await displayResponse.json()).program.id, program.id);
});

test('Pages TV polls the demo display channel instead of the production channel', async () => {
  const script = await readFile(new URL('../public/tv-display.js', import.meta.url), 'utf8');
  assert.match(script, /isPages \? '\/api\/demo\/live-display' : '\/api\/live-display'/);
});

test('linear TV workouts render every exercise as an equal-height row', async () => {
  const script = await readFile(new URL('../public/tv-display.js', import.meta.url), 'utf8');
  assert.match(script, /function exerciseRowHtml/);
  assert.match(script, /tv-exercise-list/);
  assert.match(script, /for \(i = 0; i < exercises\.length; i \+= 1\)/);
  assert.doesNotMatch(script, /linearSidebarHtml/);
});

test('rotating TV stations use the responsive station layout without a participant sidebar', async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL('../public/tv-display.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/tv-display.css', import.meta.url), 'utf8')
  ]);
  assert.match(script, /function layoutFor\(stationCount, perStation\)/);
  assert.match(script, /stationCount <= 3 \? stationCount : 3/);
  assert.match(script, /stationColumnPercent = 100 \/ stationColumns/);
  assert.match(script, /stationRowPercent = 100 \/ stationRows/);
  assert.match(script, /--station-width:/);
  assert.match(script, /--station-height:/);
  assert.doesNotMatch(script, /grid-template-rows:repeat\('/);
  assert.match(styles, /\.tv-stations[^}]*display:\s*flex[^}]*flex-wrap:\s*wrap/s);
  assert.match(styles, /\.tv-station[^}]*width:\s*var\(--station-width[^}]*height:\s*var\(--station-height/s);
  assert.match(script, /<section class="tv-stations"/);
  assert.doesNotMatch(script, /tv-stations-table/);
  assert.doesNotMatch(script, /rotatingSidebarHtml/);
});

test('TV display advances repetition-based workouts manually', async () => {
  const script = await readFile(new URL('../public/tv-display.js', import.meta.url), 'utf8');
  assert.match(script, /function isRepetitionBased\(\)/);
  assert.match(script, /isRepetitionBased\(\) \? 'הבא'/);
  assert.match(script, /isRepetitionBased\(\)\) advancePhase\(\)/);
});

test('TV display uses the approved high-contrast hero, Heebo type and hidden controls', async () => {
  const [script, styles] = await Promise.all([
    readFile(new URL('../public/tv-display.js', import.meta.url), 'utf8'),
    readFile(new URL('../public/tv-display.css', import.meta.url), 'utf8')
  ]);
  assert.match(script, /function stationSecondsRemaining\(\)/);
  assert.match(script, /<small>זמן לתחנה<\/small>/);
  assert.match(styles, /font-family:\s*"Heebo"/);
  assert.match(styles, /\.tv-timer[^}]*font-size:\s*17\.4vh/s);
  assert.match(styles, /\.tv-exercise-list[^}]*grid-template-rows:\s*repeat\(var\(--exercise-rows, 3\), minmax\(0, 1fr\)\)/s);
  assert.match(styles, /\.tv-controls[^}]*opacity:\s*0/s);
  assert.match(styles, /radial-gradient\(circle at 50% -20%/);
});
