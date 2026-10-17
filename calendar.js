'use strict';
/* Calendar habit tracker. Stamps live in localStorage under "workoutStamps"
   as { "YYYY-MM-DD": "weight" | "cardio" | "both" } using local dates. */

const STAMPS_KEY = 'workoutStamps';
const STAMP_TYPES = ['weight', 'cardio', 'both'];
const STAMP_LABELS = { weight: 'Weight Training', cardio: 'Cardio', both: 'Both' };
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December'];

/* ---------- Data layer ---------- */

function getStamps() {
  try {
    const data = JSON.parse(localStorage.getItem(STAMPS_KEY));
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (e) {
    return {};
  }
}

function saveStamps(stamps) {
  try { localStorage.setItem(STAMPS_KEY, JSON.stringify(stamps)); } catch (e) { /* quota/private mode */ }
}

function getStamp(dateStr) {
  const t = getStamps()[dateStr];
  return STAMP_TYPES.includes(t) ? t : null;
}

function setStamp(dateStr, type) {
  if (!STAMP_TYPES.includes(type)) return;
  const stamps = getStamps();
  stamps[dateStr] = type;
  saveStamps(stamps);
}

function removeStamp(dateStr) {
  const stamps = getStamps();
  delete stamps[dateStr];
  saveStamps(stamps);
}

function formatDate(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* Local (not UTC) date as YYYY-MM-DD */
function getTodayStr() {
  const n = new Date();
  return formatDate(n.getFullYear(), n.getMonth(), n.getDate());
}

/* ---------- Calendar view ---------- */

const calView = { year: new Date().getFullYear(), month: new Date().getMonth() };
let modalDate = null;
let lastFocus = null;

function renderCalendar(year, month) {
  calView.year = year;
  calView.month = month;
  const grid = document.getElementById('calGrid');
  const stamps = getStamps();
  const today = getTodayStr();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  document.getElementById('calTitle').textContent = `${MONTH_NAMES[month]} ${year}`;
  grid.textContent = '';

  for (let i = 0; i < firstDay; i++) {
    const empty = document.createElement('div');
    empty.className = 'cal-day empty';
    grid.appendChild(empty);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = formatDate(year, month, d);
    const type = STAMP_TYPES.includes(stamps[dateStr]) ? stamps[dateStr] : null;
    const cell = document.createElement('button');
    cell.type = 'button';
    cell.className = 'cal-day' + (type ? ` ${type}` : '') + (dateStr === today ? ' today' : '');
    cell.textContent = d;
    cell.setAttribute('aria-label',
      `${MONTH_NAMES[month]} ${d}, ${year}: ${type ? STAMP_LABELS[type] : 'no stamp'}`);
    if (dateStr === today) cell.setAttribute('aria-current', 'date');
    cell.addEventListener('click', () => openStampModal(dateStr));
    grid.appendChild(cell);
  }
}

function changeMonth(delta) {
  const d = new Date(calView.year, calView.month + delta, 1);
  const grid = document.getElementById('calGrid');
  grid.classList.add('fading');
  setTimeout(() => {
    renderCalendar(d.getFullYear(), d.getMonth());
    grid.classList.remove('fading');
  }, 120);
}

function showCalendar(show) {
  document.getElementById('config').hidden = show;
  document.getElementById('calendar').hidden = !show;
  if (show) {
    const n = new Date();
    renderCalendar(n.getFullYear(), n.getMonth());
    document.getElementById('calBack').focus();
  } else {
    document.getElementById('openCalendar').focus();
  }
}

/* ---------- Stamp modal ---------- */

function openStampModal(dateStr) {
  modalDate = dateStr;
  lastFocus = document.activeElement;
  const current = getStamp(dateStr);
  document.getElementById('stampTitle').textContent = dateStr;
  document.querySelectorAll('#stampModal .choice[data-type]').forEach((b) => {
    b.classList.toggle('current', b.dataset.type === current);
    b.setAttribute('aria-pressed', String(b.dataset.type === current));
  });
  document.getElementById('stampClear').hidden = !current;
  document.getElementById('stampModal').hidden = false;
  document.querySelector('#stampModal .choice[data-type]').focus();
}

function closeStampModal() {
  document.getElementById('stampModal').hidden = true;
  modalDate = null;
  if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
}

function chooseStamp(type) {
  if (!modalDate) return;
  if (type) setStamp(modalDate, type); else removeStamp(modalDate);
  closeStampModal();
  renderCalendar(calView.year, calView.month);
}

/* ---------- Auto-stamp + toast ---------- */

let toastTimer = null;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2500);
}

/* Called by the timer when a full workout finishes */
function onWorkoutComplete() {
  setStamp(getTodayStr(), 'weight');
  showToast('Workout logged!');
}

if (typeof document !== 'undefined' && document.getElementById('calGrid')) {
  document.getElementById('openCalendar').addEventListener('click', () => showCalendar(true));
  document.getElementById('calBack').addEventListener('click', () => showCalendar(false));
  document.getElementById('calPrev').addEventListener('click', () => changeMonth(-1));
  document.getElementById('calNext').addEventListener('click', () => changeMonth(1));
  document.querySelectorAll('#stampModal .choice[data-type]').forEach((b) =>
    b.addEventListener('click', () => chooseStamp(b.dataset.type)));
  document.getElementById('stampClear').addEventListener('click', () => chooseStamp(null));
  document.getElementById('stampCancel').addEventListener('click', closeStampModal);
  document.getElementById('stampModal').addEventListener('click', (e) => {
    if (e.target.id === 'stampModal') closeStampModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalDate) closeStampModal();
  });
}
