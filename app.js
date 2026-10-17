'use strict';

const $ = (id) => document.getElementById(id);
const STORAGE_KEY = 'workout-timer-settings';

const state = {
  status: 'idle',
  phase: 'exercise',
  currentExercise: 1,
  currentSet: 1,
  timeLeft: 0,
  totalTimeLeft: 0,
  exerciseTime: 45,
  restTime: 30,
  exercises: 3,
  sets: 3,
};

let intervalId = null;
let lastTick = 0;
let wakeLock = null;
let audioCtx = null;

function totalWorkoutTime(c) {
  const n = c.exercises * c.sets;
  return n * c.exerciseTime + (n - 1) * c.restTime;
}

function fmt(sec) {
  sec = Math.max(0, Math.ceil(sec));
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function beep() {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  } catch (e) {
    console.log('Beep failed', e);
  }
}

async function requestWakeLock() {
  try {
    if ('wakeLock' in navigator) {
      wakeLock = await navigator.wakeLock.request('screen');
      wakeLock.addEventListener('release', () => { wakeLock = null; });
    }
  } catch (err) {
    console.log('Wake Lock not supported or failed');
  }
}

function releaseWakeLock() {
  if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; }
}

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && state.status === 'running') requestWakeLock();
});

function render() {
  document.body.classList.toggle('rest', state.phase === 'rest' && state.status !== 'finished');
  document.body.classList.toggle('finished', state.status === 'finished');
  if (state.status === 'finished') {
    $('phase').textContent = 'Done!';
    $('countdown').textContent = '00:00';
    $('total').textContent = 'Total remaining: 00:00';
    $('barFill').style.width = '100%';
    $('toggle').hidden = true;
    return;
  }
  $('toggle').hidden = false;
  $('phase').textContent = state.phase === 'exercise'
    ? `Exercise ${state.currentExercise} / ${state.exercises}` : 'Rest';
  $('countdown').textContent = fmt(state.timeLeft);
  $('progressText').textContent =
    `Exercise ${state.currentExercise} / ${state.exercises} · Set ${state.currentSet} of ${state.sets}`;
  $('total').textContent = `Total remaining: ${fmt(state.totalTimeLeft)}`;
  const total = totalWorkoutTime(state);
  $('barFill').style.width = `${total ? ((total - state.totalTimeLeft) / total) * 100 : 0}%`;
  $('toggle').textContent = state.status === 'running' ? 'Pause' : 'Resume';
}

function isLastInterval() {
  return state.currentExercise === state.exercises && state.currentSet === state.sets;
}

function nextPhase() {
  if (state.phase === 'exercise') {
    if (isLastInterval()) return finish();
    if (state.restTime > 0) {
      state.phase = 'rest';
      state.timeLeft = state.restTime;
      return;
    }
  }
  state.phase = 'exercise';
  if (state.currentExercise < state.exercises) {
    state.currentExercise++;
  } else {
    state.currentExercise = 1;
    state.currentSet++;
  }
  state.timeLeft = state.exerciseTime;
}

function advance(elapsed) {
  while (elapsed > 0 && state.status === 'running') {
    const step = Math.min(elapsed, state.timeLeft);
    state.timeLeft -= step;
    state.totalTimeLeft = Math.max(0, state.totalTimeLeft - step);
    elapsed -= step;
    if (state.timeLeft <= 0.0001) {
      beep();
      nextPhase();
    }
  }
}

function tick() {
  const now = Date.now();
  const elapsed = (now - lastTick) / 1000;
  lastTick = now;
  advance(elapsed);
  render();
}

function startInterval() {
  lastTick = Date.now();
  clearInterval(intervalId);
  intervalId = setInterval(tick, 200);
}

function finish() {
  state.status = 'finished';
  state.timeLeft = 0;
  state.totalTimeLeft = 0;
  clearInterval(intervalId);
  releaseWakeLock();
  if (typeof onWorkoutComplete === 'function') onWorkoutComplete();
}

function readConfig() {
  const get = (id, min) => Math.max(min, Math.floor(Number($(id).value)) || min);
  return {
    exerciseTime: get('exerciseTime', 1),
    restTime: get('restTime', 0),
    exercises: get('exercises', 1),
    sets: get('sets', 1),
  };
}

function start() {
  const cfg = readConfig();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  Object.assign(state, cfg, {
    status: 'running',
    phase: 'exercise',
    currentExercise: 1,
    currentSet: 1,
    timeLeft: cfg.exerciseTime,
    totalTimeLeft: totalWorkoutTime(cfg),
  });
  $('config').hidden = true;
  $('workout').hidden = false;
  beep();
  requestWakeLock();
  startInterval();
  render();
}

function toggle() {
  if (state.status === 'running') {
    state.status = 'paused';
    clearInterval(intervalId);
    releaseWakeLock();
  } else if (state.status === 'paused') {
    state.status = 'running';
    requestWakeLock();
    startInterval();
  }
  render();
}

function reset() {
  clearInterval(intervalId);
  releaseWakeLock();
  state.status = 'idle';
  document.body.classList.remove('rest', 'finished');
  $('workout').hidden = true;
  $('config').hidden = false;
}

function loadSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) for (const k of ['exerciseTime', 'restTime', 'exercises', 'sets']) {
      if (saved[k] !== undefined) $(k).value = saved[k];
    }
  } catch (e) { /* ignore */ }
}

if (typeof document !== 'undefined' && $('start')) {
  loadSettings();
  $('start').addEventListener('click', start);
  $('toggle').addEventListener('click', toggle);
  $('reset').addEventListener('click', reset);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');
}
