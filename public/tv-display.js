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

  function mediaHtml(exercise) {
    var url = exercise && (exercise.mediaUrl || exercise.mediaStorageId);
    if (!url) return '';
    var safe = escapeHtml(url);
    if (exercise.mediaType === 'VIDEO' || /\.(mp4|webm|mov)(\?|$)/i.test(url)) {
      return '<video class="tv-exercise-media" src="' + safe + '" autoplay muted loop playsinline></video>';
    }
    return '<img class="tv-exercise-media" src="' + safe + '" alt="הדגמת תרגיל">';
  }

  function headerHtml(progress) {
    var participantCount = program.participants ? program.participants.length : (program.participantCount || 0);
    return '<div class="tv-shell">' +
      '<header class="tv-header"><div class="tv-brand"><img class="tv-logo" src="./logo.png" alt="BALY WELLNESS">' +
      '<div class="tv-title-wrap"><div class="tv-group">' + escapeHtml(program.groupName || 'BALY WELLNESS') +
      (participantCount ? ' · ' + participantCount + ' משתתפים' : '') + '</div><h1 class="tv-title">' + escapeHtml(program.title || 'אימון') +
      '</h1></div></div><div class="tv-header-info"><span class="tv-meta">' + (offline ? 'מנסה להתחבר מחדש…' : 'מחובר למסך המועדון') +
      '</span><span id="tv-clock" class="tv-clock">' + nowTime() + '</span></div></header>' +
      '<div class="tv-progress"><div class="tv-progress-bar" style="width:' + progress + '%"></div></div>';
  }

  function controlsHtml() {
    return '<div class="tv-controls"><button id="tv-prev" class="tv-button">‹</button>' +
      '<button id="tv-toggle" class="tv-button primary ' + (running ? 'pause' : '') + '">' + (isRepetitionBased() ? 'הבא' : running ? 'עצירה' : 'הפעלה') + '</button>' +
      '<button id="tv-next" class="tv-button">›</button><button id="tv-reset" class="tv-button">איפוס</button>' +
      '<button id="tv-fullscreen" class="tv-button">מסך מלא</button></div>';
  }

  function linearSidebarHtml() {
    var html = '<aside class="tv-sidebar"><h2 class="tv-sidebar-title">מהלך האימון</h2><div class="tv-list">';
    var exercises = program.exercises || [], i, item, state;
    for (i = 0; i < exercises.length; i += 1) {
      item = exercises[i]; state = i === exerciseIndex && phase !== 'COMPLETE' ? ' active' : (i < exerciseIndex || phase === 'COMPLETE' ? ' done' : '');
      html += '<div class="tv-list-item' + state + '"><span class="tv-index">' + (state === ' done' ? '✓' : i + 1) + '</span>' +
        '<span class="tv-list-copy"><strong>' + escapeHtml(item.name) + '</strong><small>' + (item.workSeconds || 0) + ' שנ׳ עבודה · ' +
        (item.restSeconds || 0) + ' שנ׳ מנוחה · ' + (item.rounds || 1) + ' סבבים</small></span></div>';
    }
    return html + '</div></aside>';
  }

  function renderLinear() {
    var exercises = program.exercises || [], gridHtml = '', columns, rows, i, item, state, badge, details;
    if (!exercises.length) { renderEmpty('לא הוגדרו תרגילים בתוכנית'); return; }
    if (exerciseIndex >= exercises.length) exerciseIndex = 0;
    var progress = linearProgress();
    var stage = phase === 'COMPLETE'
      ? '<div class="tv-finished"><div class="tv-finished-icon">🏆</div><h2>כל הכבוד!</h2></div>'
      : '';
    if (phase !== 'COMPLETE') {
      if (exercises.length <= 4) columns = exercises.length;
      else if (exercises.length <= 12) columns = 4;
      else if (exercises.length <= 15) columns = 5;
      else columns = 6;
      rows = Math.ceil(exercises.length / columns);
      for (i = 0; i < exercises.length; i += 1) {
        item = exercises[i];
        state = i === exerciseIndex ? ' active' : (i < exerciseIndex ? ' done' : '');
        badge = i < exerciseIndex ? '✓' : String(i + 1);
        details = [];
        if (item.reps && item.reps !== 'לפי זמן') details.push(escapeHtml(item.reps) + ' חזרות');
        if (item.weight) details.push(escapeHtml(item.weight));
        if (item.equipment) details.push('ציוד: ' + escapeHtml(item.equipment));
        if (!isRepetitionBased()) details.push((Number(item.workSeconds) || 0) + ' שנ׳ עבודה');
        if (!isRepetitionBased() && Number(item.restSeconds)) details.push((Number(item.restSeconds) || 0) + ' שנ׳ מנוחה');
        details.push((Number(item.rounds) || 1) + ' סבבים');
        gridHtml += '<div class="tv-linear-exercise-slot" style="width:' + (100 / columns) + '%;height:' + (100 / rows) + '%">' +
          '<article class="tv-linear-card' + state + '"><div class="tv-linear-card-head"><span class="tv-linear-number">' + badge + '</span>' +
          '<div class="tv-linear-copy"><h2 dir="auto">' + escapeHtml(item.name) + '</h2><p>' + details.join(' · ') + '</p></div></div>' +
          (item.notes ? '<div class="tv-linear-note">דגש: ' + escapeHtml(item.notes) + '</div>' : '') +
          (i === exerciseIndex ? '<div class="tv-linear-current">עכשיו · סבב ' + round + '/' + (Number(item.rounds) || 1) + '</div>' : '') +
          '</article></div>';
      }
      stage = '<div class="tv-linear-grid' + (exercises.length <= 6 ? ' few' : '') + '">' + gridHtml + '</div>';
    }
    app.className = '';
    app.innerHTML = headerHtml(progress) + '<div class="tv-content"><main class="tv-main"><div class="tv-phase-line"><span class="tv-phase ' +
      phaseClass() + '">' + phaseLabel() + '</span><span class="tv-timer ' + (secondsLeft <= 3 && phase !== 'COMPLETE' ? 'urgent' : '') + '">' +
      (isRepetitionBased() ? escapeHtml(exercises[exerciseIndex].reps || program.defaultRepetitions || 'לפי התרגיל') + ' חזרות' : formatTime(secondsLeft)) + '</span><span class="tv-meta">תחנה ' + (exerciseIndex + 1) + '/' + exercises.length + '</span></div>' +
      stage + controlsHtml() + '</main></div></div>';
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
    var stationColumns, displayRows, rowIndex, rowStart, rowItemCount, columnIndex, missingSlots;
    if (!stations.length) { renderEmpty('לא הוגדרו תחנות בתוכנית'); return; }
    if (stations.length <= 3) stationColumns = stations.length;
    else if (stations.length === 4) stationColumns = 2;
    else if (stations.length <= 6 || stations.length === 9) stationColumns = 3;
    else stationColumns = 4;
    displayRows = Math.ceil(stations.length / stationColumns);
    stationsHtml = '<table class="tv-stations-table"><tbody>';
    for (rowIndex = 0; rowIndex < displayRows; rowIndex += 1) {
      rowStart = rowIndex * stationColumns;
      rowItemCount = Math.min(stationColumns, stations.length - rowStart);
      missingSlots = stationColumns - rowItemCount;
      stationsHtml += '<tr class="tv-station-row" style="height:' + (100 / displayRows) + '%">';
      if (missingSlots) stationsHtml += '<td class="tv-station-spacer" colspan="' + missingSlots + '"></td>';
      for (columnIndex = 0; columnIndex < rowItemCount; columnIndex += 1) {
        i = rowStart + columnIndex;
        station = stations[i]; names = [];
        for (j = 0; j < assignments.length; j += 1) if (assignments[j].station && assignments[j].station.id === station.id && names.indexOf(assignments[j].groupName) < 0) names.push(assignments[j].groupName);
        var stationRows = Math.max(1, Math.ceil(station.exercises.length / 2));
        stationsHtml += '<td class="tv-station-cell" colspan="2"><article class="tv-station"><div class="tv-station-head"><div><h2>' + escapeHtml(station.name) + '</h2><span>' + escapeHtml(names.join(', ') || 'ללא קבוצה') + '</span></div><b>בלוק ' + (i + 1) + '</b></div><div class="tv-station-exercises">';
        for (j = 0; j < station.exercises.length; j += 1) {
          exercise = station.exercises[j]; active = [];
          for (var k = 0; k < assignments.length; k += 1) if (assignments[k].station && assignments[k].station.id === station.id && assignments[k].activeIndex === j) active.push(assignments[k].participant.name);
          stationsHtml += '<div class="tv-station-exercise" style="height:' + (100 / stationRows) + '%"><div class="tv-exercise-card' + (active.length ? ' active' : '') + '">' +
            '<div class="tv-exercise-card-head"><span class="tv-exercise-number">' + (j + 1) + '</span><div class="tv-exercise-copy"><h3 dir="auto">' + escapeHtml(exercise.name) +
            '</h3>' + (exercise.weight || exercise.reps || exercise.equipment ? '<p dir="auto">' + escapeHtml(exercise.weight || exercise.reps || '') + (exercise.equipment ? ' · ציוד: ' + escapeHtml(exercise.equipment) : '') + '</p>' : '') + '</div></div>' +
            (exercise.notes ? '<div class="tv-exercise-note">דגש: ' + escapeHtml(exercise.notes) + '</div>' : '') + '<div class="tv-participant-tags">';
          for (k = 0; k < active.length; k += 1) stationsHtml += '<span class="tv-person-tag">' + escapeHtml(active[k]) + '</span>';
          stationsHtml += '</div></div></div>';
        }
        stationsHtml += '</div></article></td>';
      }
      if (missingSlots) stationsHtml += '<td class="tv-station-spacer" colspan="' + missingSlots + '"></td>';
      stationsHtml += '</tr>';
    }
    stationsHtml += '</tbody></table>';
    var stage = phase === 'COMPLETE' ? '<div class="tv-finished"><div class="tv-finished-icon">🏆</div><h2>כל הכבוד לכולם!</h2></div>' : '<div class="tv-stations">' + stationsHtml + '</div>';
    app.className = '';
    app.innerHTML = headerHtml(progress) + '<div class="tv-content"><main class="tv-main"><div class="tv-phase-line"><span class="tv-phase ' + phaseClass() + '">' +
      phaseLabel() + '</span><span class="tv-timer ' + (!isRepetitionBased() && secondsLeft <= 3 && phase !== 'COMPLETE' ? 'urgent' : '') + '">' + (isRepetitionBased() ? escapeHtml(program.defaultRepetitions || 'לפי התרגיל') + ' חזרות' : formatTime(secondsLeft)) +
      '</span><span class="tv-meta">סבב ' + chainRound + '/' + (program.roundsPerStation || 1) + ' · החלפה ' + (rotationIndex + 1) + '/' + stations.length +
      '</span></div>' + stage + controlsHtml() + '</main></div></div>';
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
