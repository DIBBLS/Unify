import { db } from './firebase-config.js';
import {
  collection, query, where, getDocs, addDoc, deleteDoc, doc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Field shapes here must match what js/pages/timetable.js reads from
// `timetableEntries` (department + level as stored on user profiles,
// full day names, startTime/endTime) — this collection is shared with
// the student-facing timetable, not admin-only.
const TIMES = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
const DAY_LABELS = { Monday: 'Mon', Tuesday: 'Tue', Wednesday: 'Wed', Thursday: 'Thu', Friday: 'Fri' };
const DAYS = Object.keys(DAY_LABELS);
const DEFAULT_DEPT = 'Electronic & Computer Engineering';

let _cache = [], _level = '300 Level', _department = DEFAULT_DEPT;

window.onAdminReady = function () {
  const deptSel = document.getElementById('tt-dept-filter');
  if (deptSel) deptSel.value = _department;
  load(_level, _department);
};

async function load(level, department) {
  _level = level;
  _department = department;
  try {
    const snap = await getDocs(query(
      collection(db, 'timetableEntries'),
      where('department', '==', department),
      where('level', '==', level),
    ));
    _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch { render(); }
}

function nextHour(time) {
  const idx = TIMES.indexOf(time);
  if (idx >= 0 && idx < TIMES.length - 1) return TIMES[idx + 1];
  const h = parseInt(time, 10) || 0;
  return `${h + 1}:00`;
}

function render() {
  const grid = document.getElementById('tt-grid');
  if (!grid) return;
  const hdrs = Array.from(grid.querySelectorAll('.tt-hdr-cell'));
  grid.innerHTML = '';
  if (!hdrs.length) {
    const emptyHdr = document.createElement('div'); emptyHdr.className = 'tt-cell hdr'; grid.appendChild(emptyHdr);
    DAYS.forEach(d => { const c = document.createElement('div'); c.className='tt-cell hdr'; c.textContent=DAY_LABELS[d]; grid.appendChild(c); });
  } else { hdrs.forEach(h => grid.appendChild(h)); }

  const esc = window.escHtml;
  TIMES.forEach(t => {
    const tc = document.createElement('div'); tc.className = 'tt-cell ttime'; tc.textContent = t; grid.appendChild(tc);
    DAYS.forEach(day => {
      const cell = document.createElement('div'); cell.className = 'tt-cell';
      const slot = _cache.find(s => s.day === day && s.startTime === t);
      if (slot) {
        cell.innerHTML = `<div class="tt-slot">${esc(slot.courseCode)}<br><span style="font-weight:400">${esc(slot.venue||'')}</span></div>
          <button class="btn-sm danger" style="margin-top:4px;font-size:9px;padding:2px 6px" onclick="delSlot('${slot.id}')">✕</button>`;
      }
      grid.appendChild(cell);
    });
  });
}

window.filterTT = (level, btn) => {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  load(level, _department);
};

window.filterTTDept = (department) => {
  load(_level, department);
};

window.submitClass = async () => {
  const courseCode = document.getElementById('tt-course').value.trim().toUpperCase();
  const department  = document.getElementById('tt-dept').value;
  const level   = document.getElementById('tt-level').value;
  const day     = document.getElementById('tt-day').value;
  const startTime = document.getElementById('tt-time').value;
  const venue   = document.getElementById('tt-venue').value.trim();
  if (!courseCode || !startTime) { window.showToast('Course and time required'); return; }
  const endTime = nextHour(startTime);
  try {
    const entry = { department, level, day, courseCode, startTime, endTime, venue, lecturer: '' };
    const ref = await addDoc(collection(db, 'timetableEntries'), entry);
    if (department === _department && level === _level) {
      _cache.push({ id: ref.id, ...entry });
      render();
    }
    window.closeModal('tt-modal');
    document.getElementById('tt-course').value = '';
    document.getElementById('tt-venue').value  = '';
    window.showToast('Class added');
  } catch { window.showToast('Failed to add'); }
};

window.delSlot = async (id) => {
  try {
    await deleteDoc(doc(db, 'timetableEntries', id));
    _cache = _cache.filter(s => s.id !== id);
    render();
    window.showToast('Removed');
  } catch { window.showToast('Remove failed'); }
};
