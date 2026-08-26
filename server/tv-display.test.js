import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import worker, { findScheduledLiveDisplayProgram } from './index.js';

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

  const getResponse = await worker.fetch(new Request('https://balywellness.test/api/demo/live-display/active', {
    headers: { Origin: origin }
  }), {});
  assert.equal(getResponse.status, 200);
  assert.equal((await getResponse.json()).program.id, program.id);
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
  const scheduleResponse = await worker.fetch(new Request('https://balywellness.test/api/demo/live-display/schedule', {
    method: 'PUT', headers, body: JSON.stringify({ programs: [program] })
  }), {});
  assert.equal(scheduleResponse.status, 200);

  const displayResponse = await worker.fetch(new Request('https://balywellness.test/api/demo/live-display/active', { headers }), {});
  assert.equal(displayResponse.status, 200);
  assert.equal((await displayResponse.json()).program.id, program.id);
});

test('Pages TV polls the demo display channel instead of the production channel', async () => {
  const script = await readFile(new URL('../public/tv-display.js', import.meta.url), 'utf8');
  assert.match(script, /isPages \? '\/api\/demo\/live-display' : '\/api\/live-display'/);
});

test('linear TV workouts render every exercise in the full-screen card grid', async () => {
  const script = await readFile(new URL('../public/tv-display.js', import.meta.url), 'utf8');
  assert.match(script, /tv-linear-grid/);
  assert.match(script, /for \(i = 0; i < exercises\.length; i \+= 1\)/);
  assert.doesNotMatch(script, /stage \+ controlsHtml\(\) \+ '<\/main>' \+ linearSidebarHtml\(\)/);
});

test('rotating TV stations use a legacy-compatible table instead of overlapping absolute slots', async () => {
  const script = await readFile(new URL('../public/tv-display.js', import.meta.url), 'utf8');
  assert.match(script, /<table class="tv-stations-table">/);
  assert.match(script, /<td class="tv-station-cell" colspan="2">/);
  assert.doesNotMatch(script, /<div class="tv-station-slot" style=/);
  assert.doesNotMatch(script, /rotatingSidebarHtml/);
});
