(function () {
  'use strict';

  var app = document.getElementById('tv-app');
  var isPages = window.location.hostname.indexOf('github.io') !== -1;
  var apiBase = isPages ? 'https://balywellness.com' : window.location.origin;
  var apiPath = isPages ? '/api/demo/live-display' : '/api/live-display';
  var program = null;
  var programVersion = '';
  var phase = 'PREPARE';
  var secondsLeft = 10;
  var running = false;
  var exerciseIndex = 0;
  var round = 1;
  var rotationIndex = 0;
  var chainRound = 1;
  var exerciseSlot = 0;
  var lastCommandId = '';
  var offline = false;
  var audioContext = null;

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function pad(value) { return value < 10 ? '0' + value : String(value); }
  function formatTime(value) {
    var safe = Math.max(0, Number(value) || 0);
    return pad(Math.floor(safe / 60)) + ':' + pad(safe % 60);
  }
  function nowTime() { var date = new Date(); return pad(date.getHours()) + ':' + pad(date.getMinutes()); }
  function isRepetitionBased() { return program && program.effortMetric === 'REPS'; }

  function request(method, path, body, callback) {
    var xhr = new XMLHttpRequest();
    var target = apiBase + path;
    if (method === 'GET') {
      target += (target.indexOf('?') === -1 ? '?' : '&') + '_tv=' + new Date().getTime();
    }
    xhr.open(method, target, true);
    xhr.timeout = 8000;
    if (body != null) xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.onreadystatechange = function () {
      if (xhr.readyState !== 4) return;
      if (xhr.status >= 200 && xhr.status < 300) {
        var result = null;
        if (xhr.responseText) {
          try { result = JSON.parse(xhr.responseText); } catch (ignore) { result = null; }
        }
        callback(null, result, xhr.status);
      } else callback(new Error('HTTP ' + xhr.status), null, xhr.status);
    };
    xhr.onerror = function () { callback(new Error('NETWORK'), null, 0); };
    xhr.ontimeout = function () { callback(new Error('TIMEOUT'), null, 0); };
    xhr.send(body == null ? null : JSON.stringify(body));
  }

  function beep(frequency, duration) {
    try {
      var AudioClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioClass) return;
      if (!audioContext) audioContext = new AudioClass();
      if (audioContext.state === 'suspended' && audioContext.resume) audioContext.resume();
      var oscillator = audioContext.createOscillator();
      var gain = audioContext.createGain();
      oscillator.frequency.value = frequency || 880;
      gain.gain.value = 0.18;
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(0); oscillator.stop(audioContext.currentTime + (duration || .12));
    } catch (ignore) { /* Sound is optional on TV browsers. */ }
  }

  function phaseLabel() {
    if (phase === 'WORK') return isRepetitionBased() ? 'לפי חזרות' : 'עבודה';
    if (phase === 'REST') return 'מנוחה';
    if (phase === 'TRANSITION') return 'החלפת תחנות';
    if (phase === 'COMPLETE') return 'האימון הושלם!';
    return 'מתכוננים';
  }

  function phaseClass() {
    if (phase === 'REST') return 'rest';
    if (phase === 'TRANSITION') return 'transition';
    if (phase === 'COMPLETE') return 'complete';
    if (phase === 'PREPARE') return 'prepare';
    return '';
  }

  function totalLinearRounds() {
    var total = 0, i;
    for (i = 0; program && i < program.exercises.length; i += 1) total += Number(program.exercises[i].rounds) || 1;
    return Math.max(1, total);
  }

  function linearProgress() {
    var completed = 0, i;
    if (!program) return 0;
    if (phase === 'COMPLETE') return 100;
    for (i = 0; i < exerciseIndex; i += 1) completed += Number(program.exercises[i].rounds) || 1;
    completed += Math.max(0, round - 1);
    return Math.min(100, Math.round(completed * 100 / totalLinearRounds()));
  }

  function maxStationExercises() {
    var max = 1, stations = program && program.stations ? program.stations : [], i;
    for (i = 0; i < stations.length; i += 1) max = Math.max(max, (stations[i].exercises || []).length);
    return max;
  }

  function rotatingProgress() {
    var stations = program && program.stations ? program.stations : [];
    var rounds = Number(program && program.roundsPerStation) || 1;
    var max = maxStationExercises();
    var total = Math.max(1, stations.length * rounds * max);
    var done = rotationIndex * rounds * max + (chainRound - 1) * max + exerciseSlot;
    return phase === 'COMPLETE' ? 100 : Math.min(100, Math.round(done * 100 / total));
  }

  function stationSecondsRemaining() {
    if (!program || isRepetitionBased()) return null;
    if (phase === 'COMPLETE') return 0;
    if (program.mode === 'ROTATING_GROUPS') {
      if (phase === 'TRANSITION') return secondsLeft;
      var rotatingWork = Number(program.defaultWorkSeconds) || 0;
      var rotatingRest = Number(program.defaultRestSeconds) || 0;
      var rotatingSteps = (Number(program.roundsPerStation) || 1) * maxStationExercises();
      var currentStep = (chainRound - 1) * maxStationExercises() + exerciseSlot;
      if (phase === 'PREPARE') return rotatingSteps * (rotatingWork + rotatingRest);
      var rotatingFuture = Math.max(0, rotatingSteps - currentStep - 1) * (rotatingWork + rotatingRest);
      return phase === 'REST'
        ? secondsLeft + rotatingFuture
        : secondsLeft + rotatingRest + rotatingFuture;
    }
    var current = program.exercises && program.exercises[exerciseIndex];
    if (!current) return 0;
    var work = Number(current.workSeconds) || 0;
    var rest = Number(current.restSeconds) || 0;
    var rounds = Number(current.rounds) || 1;
    if (phase === 'PREPARE') return rounds * (work + rest);
    var futureRounds = Math.max(0, rounds - round) * (work + rest);
    return phase === 'REST' ? secondsLeft + futureRounds : secondsLeft + rest + futureRounds;
  }

  function mediaHtml(exercise, active, mediaMode) {
    var url = exercise && (exercise.mediaUrl || exercise.mediaStorageId);
    if (!url || (mediaMode === 'active-only' && !active)) return '';
    var safe = escapeHtml(url);
    if (exercise.mediaType === 'VIDEO' || /\.(mp4|webm|mov)(\?|$)/i.test(url)) {
      if (!active) return '';
      return '<span class="tv-exercise-media"><video src="' + safe + '" autoplay muted loop playsinline></video></span>';
    }
    return '<span class="tv-exercise-media"><img src="' + safe + '" alt="הדגמת תרגיל"></span>';
  }

  function headerHtml(progress) {
    var participantCount = program.participants ? program.participants.length : (program.participantCount || 0);
    return '<div class="tv-shell">' +
      '<header class="tv-header"><div class="tv-brand"><img class="tv-logo" src="./logo.png" alt="BALY WELLNESS">' +
      '<div class="tv-title-wrap"><div class="tv-group">' + escapeHtml(program.groupName || 'BALY WELLNESS') +
      (participantCount ? ' · <span class="num">' + participantCount + '</span> משתתפים' : '') + '</div><h1 class="tv-title">' + escapeHtml(program.title || 'אימון') +
      '</h1></div></div><div class="tv-header-info"><span class="tv-status-dot' + (offline ? ' offline' : '') + '" title="' +
      (offline ? 'מנסה להתחבר מחדש' : 'מחובר') + '"></span><span id="tv-clock" class="tv-clock num">' + nowTime() + '</span></div></header>' +
      '<div class="tv-progress"><div class="tv-progress-bar" style="width:' + progress + '%"></div></div>';
  }

  function controlsHtml() {
    return '<div class="tv-controls"><button id="tv-prev" class="tv-button">‹</button>' +
      '<button id="tv-toggle" class="tv-button primary ' + (running ? 'pause' : '') + '">' + (isRepetitionBased() ? 'הבא' : running ? 'עצירה' : 'הפעלה') + '</button>' +
      '<button id="tv-next" class="tv-button">›</button><button id="tv-reset" class="tv-button">איפוס</button>' +
      '<button id="tv-fullscreen" class="tv-button">מסך מלא</button></div>';
  }

  function layoutFor(stationCount, perStation) {
    var stationColumns = stationCount <= 3 ? stationCount : 3;
    var stationRows = Math.ceil(stationCount / stationColumns);
    var stationRowPercent = 100 / stationRows;
    var stationRowGapShare = 1.25 * (stationRows - 1) / stationRows;
    var exerciseColumns = 1;
    if (stationCount === 1) exerciseColumns = perStation <= 5 ? 1 : (perStation <= 8 ? 2 : 3);
    else if (stationCount === 2) exerciseColumns = perStation <= 5 ? 1 : 2;
    var exerciseRows = Math.max(1, Math.ceil(perStation / exerciseColumns));
    return {
      stationColumns: stationColumns,
      stationRows: stationRows,
      stationRowSize: 'calc(' + stationRowPercent.toFixed(6) + '% - ' + stationRowGapShare.toFixed(6) + 'vh)',
      exerciseColumns: exerciseColumns,
      exerciseRows: exerciseRows,
      dense: exerciseRows > 4 || stationRows > 1,
      mediaMode: stationRows > 1 || exerciseRows > 5 ? 'active-only' : (exerciseRows > 3 ? 'square' : 'wide')
    };
  }

  function layoutStyle(layout) {
    return '--station-columns:' + layout.stationColumns + ';--station-rows:' + layout.stationRows +
      ';grid-template-rows:repeat(' + layout.stationRows + ',minmax(0,' + layout.stationRowSize + '))' +
      ';--exercise-columns:' + layout.exerciseColumns + ';--exercise-rows:' + layout.exerciseRows;
  }

  function exerciseModeText(exercise) {
    if (isRepetitionBased()) return escapeHtml(exercise.reps || program.defaultRepetitions || 'לפי התרגיל') + ' חזרות';
    return 'לפי זמן · <span class="num">' + (Number(exercise.workSeconds) || Number(program.defaultWorkSeconds) || 0) + '</span> שניות';
  }

  function exerciseRowHtml(exercise, index, state, activeLabel, layout) {
    var isActive = state === ' active';
    var media = mediaHtml(exercise, isActive, layout.mediaMode);
    return '<article class="tv-exercise' + state + (media ? ' has-media' : '') + '"><span class="tv-exercise-number num">' +
      (state === ' done' ? '✓' : index + 1) + '</span>' + media + '<span class="tv-exercise-copy"><span class="tv-exercise-name" dir="auto">' +
      escapeHtml(exercise.name) + '</span><span class="tv-exercise-mode">' + exerciseModeText(exercise) + '</span></span>' +
      (isActive ? '<span class="tv-exercise-state">' + escapeHtml(activeLabel || 'עכשיו') + '</span>' : '') + '</article>';
  }

  function metricsHtml(firstValue, firstLabel, secondValue, secondLabel) {
    var remaining = stationSecondsRemaining();
    return '<div class="tv-metrics"><span class="tv-metric"><strong class="num">' + escapeHtml(firstValue) + '</strong><small>' + firstLabel +
      '</small></span><span class="tv-metric"><strong class="num">' + escapeHtml(secondValue) + '</strong><small>' + secondLabel +
      '</small></span><span class="tv-metric"><strong class="num">' + (remaining == null ? '—' : formatTime(remaining)) +
      '</strong><small>זמן לתחנה</small></span></div>';
  }

  function heroHtml(timerValue, firstValue, firstLabel, secondValue, secondLabel) {
    var phaseState = phaseClass();
    return '<section class="tv-hero"><span class="tv-phase ' + phaseState + '">' + phaseLabel() + '</span><span class="tv-timer num ' +
      phaseState + (secondsLeft <= 3 && phase !== 'COMPLETE' && !isRepetitionBased() ? ' urgent' : '') + '">' + timerValue + '</span>' +
      metricsHtml(firstValue, firstLabel, secondValue, secondLabel) + '</section>';
  }

  function renderLinear() {
    var exercises = program.exercises || [], rowsHtml = '', i, item, state;
    if (!exercises.length) { renderEmpty('לא הוגדרו תרגילים בתוכנית'); return; }
    if (exerciseIndex >= exercises.length) exerciseIndex = 0;
    var progress = linearProgress();
    var layout = layoutFor(1, exercises.length);
    var stage = phase === 'COMPLETE'
      ? '<div class="tv-finished"><h2>כל הכבוד!</h2></div>'
      : '';
    if (phase !== 'COMPLETE') {
      for (i = 0; i < exercises.length; i += 1) {
        item = exercises[i];
        state = i === exerciseIndex ? ' active' : (i < exerciseIndex ? ' done' : '');
        rowsHtml += exerciseRowHtml(item, i, state, 'עכשיו', layout);
      }
      stage = '<section class="tv-stations" style="' + layoutStyle(layout) + '"><article class="tv-station"><header class="tv-station-head"><h2>רצף האימון</h2><span><span class="num">' +
        exercises.length + '</span> תרגילים</span></header><div class="tv-exercise-list' + (layout.dense ? ' dense' : '') +
        (layout.mediaMode === 'square' ? ' media-square' : '') + (layout.mediaMode === 'active-only' ? ' media-square media-active-only' : '') +
        '" style="--exercise-columns:' + layout.exerciseColumns + ';--exercise-rows:' + layout.exerciseRows + '">' + rowsHtml + '</div></article></section>';
    }
    app.className = '';
    app.innerHTML = headerHtml(progress) + heroHtml(
      isRepetitionBased() ? escapeHtml(exercises[exerciseIndex].reps || program.defaultRepetitions || '—') : formatTime(secondsLeft),
      round + '/' + (Number(exercises[exerciseIndex].rounds) || 1), 'סבב',
      (exerciseIndex + 1) + '/' + exercises.length, 'תרגיל'
    ) + stage + controlsHtml() + '</div>';
    bindControls();
  }

  function participantAssignments() {
    var stations = program.stations || [];
    var participants = program.participants ? program.participants.slice(0) : [];
    var groups = program.participantGroupNames || [];
    var assignments = [], i, j, memberOffset, groupIndex, stationIndex, station, activeIndex;
    if (!participants.length) {
      for (i = 0; i < stations.length; i += 1) participants.push({id: 'group-' + i, name: groups[i] || 'קבוצה ' + (i + 1), groupIndex: i});
    }
    for (i = 0; i < participants.length; i += 1) {
      groupIndex = Math.max(0, Math.min(Number(participants[i].groupIndex) || 0, stations.length - 1));
      memberOffset = 0;
      for (j = 0; j < i; j += 1) if ((Number(participants[j].groupIndex) || 0) === groupIndex) memberOffset += 1;
      stationIndex = stations.length ? (groupIndex + rotationIndex) % stations.length : 0;
      station = stations[stationIndex];
      activeIndex = station && station.exercises.length ? (exerciseSlot + memberOffset) % station.exercises.length : 0;
      assignments.push({participant: participants[i], groupIndex: groupIndex, groupName: groups[groupIndex] || 'קבוצה ' + (groupIndex + 1), station: station, stationIndex: stationIndex, activeIndex: activeIndex});
    }
    return assignments;
  }

  function renderRotating() {
    var stations = program.stations || [], assignments = participantAssignments(), progress = rotatingProgress(), stationsHtml = '', i, j, station, exercise, active, names;
    if (!stations.length) { renderEmpty('לא הוגדרו תחנות בתוכנית'); return; }
    var layout = layoutFor(stations.length, maxStationExercises());
    for (i = 0; i < stations.length; i += 1) {
      station = stations[i]; names = [];
      var stationLayout = layoutFor(stations.length, Math.max(1, station.exercises.length));
      for (j = 0; j < assignments.length; j += 1) if (assignments[j].station && assignments[j].station.id === station.id && names.indexOf(assignments[j].groupName) < 0) names.push(assignments[j].groupName);
      var rowsHtml = '';
      for (j = 0; j < station.exercises.length; j += 1) {
        exercise = station.exercises[j]; active = [];
        for (var k = 0; k < assignments.length; k += 1) if (assignments[k].station && assignments[k].station.id === station.id && assignments[k].activeIndex === j && active.indexOf(assignments[k].groupName) < 0) active.push(assignments[k].groupName);
        var state = active.length ? ' active' : (j < exerciseSlot || phase === 'COMPLETE' ? ' done' : '');
        rowsHtml += exerciseRowHtml(exercise, j, state, active.join(', ') || 'עכשיו', stationLayout);
      }
      stationsHtml += '<article class="tv-station"><header class="tv-station-head"><h2>' + escapeHtml(station.name || 'תחנה ' + (i + 1)) +
        '</h2><span>' + escapeHtml((names.join(', ') || 'ללא קבוצה') + ' · בלוק ' + (i + 1)) + '</span></header><div class="tv-exercise-list' +
        (stationLayout.dense ? ' dense' : '') + (stationLayout.mediaMode === 'square' ? ' media-square' : '') +
        (stationLayout.mediaMode === 'active-only' ? ' media-square media-active-only' : '') + '" style="--exercise-columns:' + stationLayout.exerciseColumns +
        ';--exercise-rows:' + stationLayout.exerciseRows + '">' + rowsHtml + '</div></article>';
    }
    var stage = phase === 'COMPLETE' ? '<div class="tv-finished"><h2>כל הכבוד לכולם!</h2></div>' : '<section class="tv-stations" style="' + layoutStyle(layout) + '">' + stationsHtml + '</section>';
    app.className = '';
    app.innerHTML = headerHtml(progress) + heroHtml(
      isRepetitionBased() ? escapeHtml(program.defaultRepetitions || '—') : formatTime(secondsLeft),
      chainRound + '/' + (program.roundsPerStation || 1), 'סבב',
      (rotationIndex + 1) + '/' + stations.length, 'החלפה'
    ) + stage + controlsHtml() + '</div>';
    bindControls();
  }

  function renderEmpty(message) {
    app.className = 'tv-empty';
    app.innerHTML = '<div class="tv-ready-card"><img class="tv-ready-logo" src="./logo.png" alt="BALY WELLNESS"><h1>' +
      escapeHtml(message || 'מסך האימון מוכן') + '</h1><p>כאשר המאמן יפעיל אימון, הוא יופיע כאן אוטומטית.</p>' +
      (offline ? '<p class="tv-error-note">ממתין לחיבור לשרת התצוגה…</p>' : '') + '</div>';
  }

  function render() {
    if (!program) { renderEmpty('מסך האימון מוכן'); return; }
    if (program.mode === 'ROTATING_GROUPS') renderRotating(); else renderLinear();
  }

  function resetWorkout() {
    phase = 'PREPARE'; running = false; exerciseIndex = 0; round = 1; rotationIndex = 0; chainRound = 1; exerciseSlot = 0;
    secondsLeft = Number(program && program.preparationSeconds) || 10; render(); publishStatus();
  }

  function startWork() {
    phase = 'WORK';
    if (isRepetitionBased()) secondsLeft = 0;
    else if (program.mode === 'ROTATING_GROUPS') secondsLeft = Number(program.defaultWorkSeconds) || 0;
    else secondsLeft = Number(program.exercises[exerciseIndex].workSeconds) || 0;
    beep(1100, .3); render();
  }

  function completeWorkout() { phase = 'COMPLETE'; secondsLeft = 0; running = false; beep(1320, .6); render(); }

  function advanceRotatingStep() {
    var max = maxStationExercises(), rounds = Number(program.roundsPerStation) || 1, stations = program.stations || [];
    if (exerciseSlot < max - 1) { exerciseSlot += 1; startWork(); }
    else if (chainRound < rounds) { exerciseSlot = 0; chainRound += 1; startWork(); }
    else if (rotationIndex < stations.length - 1) {
      phase = 'TRANSITION'; secondsLeft = Number(program.transitionSeconds) || 0;
      if (secondsLeft === 0) { rotationIndex += 1; chainRound = 1; exerciseSlot = 0; startWork(); }
      else { beep(540, .5); render(); }
    } else completeWorkout();
  }

  function advanceLinearAfterRest() {
    var current = program.exercises[exerciseIndex];
    if (round < (Number(current.rounds) || 1)) { round += 1; startWork(); }
    else if (exerciseIndex < program.exercises.length - 1) { exerciseIndex += 1; round = 1; startWork(); }
    else completeWorkout();
  }

  function advancePhase() {
    if (!program || phase === 'COMPLETE') return;
    if (phase === 'PREPARE') startWork();
    else if (program.mode === 'ROTATING_GROUPS') {
      if (phase === 'WORK' && Number(program.defaultRestSeconds) > 0) { phase = 'REST'; secondsLeft = Number(program.defaultRestSeconds); beep(650, .3); render(); }
      else if (phase === 'TRANSITION') { rotationIndex += 1; chainRound = 1; exerciseSlot = 0; startWork(); }
      else advanceRotatingStep();
    } else {
      var current = program.exercises[exerciseIndex];
      if (phase === 'WORK' && Number(current.restSeconds) > 0) { phase = 'REST'; secondsLeft = Number(current.restSeconds); beep(650, .3); render(); }
      else advanceLinearAfterRest();
    }
    publishStatus();
  }

  function previousStep() {
    if (!program) return;
    if (program.mode === 'ROTATING_GROUPS') {
      if (exerciseSlot > 0) exerciseSlot -= 1;
      else if (chainRound > 1) { chainRound -= 1; exerciseSlot = maxStationExercises() - 1; }
      else if (rotationIndex > 0) { rotationIndex -= 1; chainRound = Number(program.roundsPerStation) || 1; exerciseSlot = maxStationExercises() - 1; }
      else { resetWorkout(); return; }
    } else if (exerciseIndex > 0) { exerciseIndex -= 1; round = 1; }
    else { resetWorkout(); return; }
    startWork(); publishStatus();
  }

  function nextStep() {
    if (!program) return;
    if (program.mode === 'ROTATING_GROUPS') advanceRotatingStep();
    else if (exerciseIndex < program.exercises.length - 1) { exerciseIndex += 1; round = 1; startWork(); }
    else completeWorkout();
    publishStatus();
  }

  function toggleRunning() { if (phase !== 'COMPLETE') { if (isRepetitionBased()) advancePhase(); else { running = !running; if (running) beep(880, .1); render(); publishStatus(); } } }

  function fullscreen() {
    var element = document.documentElement;
    var enter = element.requestFullscreen || element.webkitRequestFullscreen || element.msRequestFullscreen;
    if (enter) try { enter.call(element); } catch (ignore) { /* Fullscreen is optional. */ }
  }

  function bindControls() {
    var toggle = document.getElementById('tv-toggle'), prev = document.getElementById('tv-prev'), next = document.getElementById('tv-next');
    var reset = document.getElementById('tv-reset'), full = document.getElementById('tv-fullscreen');
    if (toggle) toggle.onclick = toggleRunning;
    if (prev) prev.onclick = previousStep;
    if (next) next.onclick = nextStep;
    if (reset) reset.onclick = resetWorkout;
    if (full) full.onclick = fullscreen;
  }

  function publishStatus() {
    if (!program) return;
    request('PUT', apiPath + '/' + encodeURIComponent(program.id) + '/status', {
      programId: program.id, phase: phase, isRunning: running, secondsLeft: secondsLeft,
      rotationIndex: rotationIndex, chainRound: chainRound, exerciseSlot: exerciseSlot,
      updatedAt: new Date().toISOString()
    }, function () {});
  }

  function applyCommand(command) {
    if (!command || !command.id || command.id === lastCommandId) return;
    lastCommandId = command.id;
    if (command.action === 'PAUSE') running = false;
    else if (command.action === 'RESUME' && phase !== 'COMPLETE') running = true;
    else if (command.action === 'ADD_REST' && (phase === 'REST' || phase === 'TRANSITION')) secondsLeft += Number(command.seconds) || 10;
    else if (command.action === 'NEXT_STEP') advancePhase();
    else if (command.action === 'RESET') resetWorkout();
    render(); publishStatus();
  }

  function pollProgram() {
    request('GET', apiPath + '/active', null, function (error, result, status) {
      if (error && status !== 204) { offline = true; render(); return; }
      offline = false;
      var next = result && result.program ? result.program : null;
      var nextVersion = next ? String(next.id) + ':' + String(next.updatedAt || '') + ':' + String(next.displayRevision || '') : '';
      if (nextVersion !== programVersion) { program = next; programVersion = nextVersion; lastCommandId = ''; resetWorkout(); }
      else if (!program) render();
    });
  }

  function pollCommand() {
    if (!program) return;
    request('GET', apiPath + '/' + encodeURIComponent(program.id) + '/commands', null, function (error, command) {
      if (!error) applyCommand(command);
    });
  }

  window.setInterval(function () {
    if ((!running && !(isRepetitionBased() && phase === 'TRANSITION')) || phase === 'COMPLETE' || (isRepetitionBased() && phase !== 'TRANSITION')) return;
    if (secondsLeft <= 1) { secondsLeft = 0; advancePhase(); }
    else { secondsLeft -= 1; if (secondsLeft <= 3) beep(secondsLeft === 1 ? 1050 : 850, .1); render(); publishStatus(); }
  }, 1000);
  window.setInterval(pollProgram, 1000);
  window.setInterval(pollCommand, 700);
  window.setInterval(function () { var clock = document.getElementById('tv-clock'); if (clock) clock.innerHTML = nowTime(); }, 10000);
  document.onkeydown = function (event) {
    event = event || window.event;
    if (event.keyCode === 32 || event.keyCode === 13) { if (event.preventDefault) event.preventDefault(); toggleRunning(); }
    else if (event.keyCode === 37) nextStep();
    else if (event.keyCode === 39) previousStep();
    else if (event.keyCode === 82) resetWorkout();
  };

  pollProgram();
}());
