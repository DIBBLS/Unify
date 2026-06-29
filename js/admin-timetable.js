import { db } from './firebase-config.js';
import {
  collection, query, where, getDocs, addDoc, deleteDoc, doc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const TIMES = ['8:00','9:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00'];
const DAYS  = ['Mon','Tue','Wed','Thu','Fri'];
let _cache  = [], _level = '300';

window.onAdminReady = function () { load('300'); };

async function load(level) {
  _level = level;
  try {
    const snap = await getDocs(query(collection(db, 'timetable'), where('level', '==', level)));
    _cache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    render();
  } catch { render(); }
}

function render() {
  const grid = document.getElementById('tt-grid');
  if (!grid) return;
  const hdrs = Array.from(grid.querySelectorAll('.tt-hdr-cell'));
  grid.innerHTML = '';
  if (!hdrs.length) {
    const emptyHdr = document.createElement('div'); emptyHdr.className = 'tt-cell hdr'; grid.appendChild(emptyHdr);
    DAYS.forEach(d => { const c = document.createElement('div'); c.className='tt-cell hdr'; c.textContent=d; grid.appendChild(c); });
  } else { hdrs.forEach(h => grid.appendChild(h)); }

  const esc = window.escHtml;
  TIMES.forEach(t => {
    const tc = document.createElement('div'); tc.className = 'tt-cell ttime'; tc.textContent = t; grid.appendChild(tc);
    DAYS.forEach(day => {
      const cell = document.createElement('div'); cell.className = 'tt-cell';
      const slot = _cache.find(s => s.day === day && s.time === t);
      if (slot) {
        cell.innerHTML = `<div class="tt-slot">${esc(slot.course)}<br><span style="font-weight:400">${esc(slot.venue||'')}</span></div>
          <button class="btn-sm danger" style="margin-top:4px;font-size:9px;padding:2px 6px" onclick="delSlot('${slot.id}')">✕</button>`;
      }
      grid.appendChild(cell);
    });
  });
}

window.filterTT = (level, btn) => {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  load(level);
};

window.submitClass = async () => {
  const course = document.getElementById('tt-course').value.trim().toUpperCase();
  const level  = document.getElementById('tt-level').value;
  const day    = document.getElementById('tt-day').value;
  const time   = document.getElementById('tt-time').value;
  const venue  = document.getElementById('tt-venue').value.trim();
  if (!course || !time) { window.showToast('Course and time required'); return; }
  const hhmm = time.replace(/^0(\d):/, '$1:');
  try {
    const ref = await addDoc(collection(db, 'timetable'), { course, level, day, time: hhmm, venue });
    _cache.push({ id: ref.id, course, level, day, time: hhmm, venue });
    window.closeModal('tt-modal');
    document.getElementById('tt-course').value = '';
    document.getElementById('tt-venue').value  = '';
    if (level === _level) render();
    window.showToast('Class added');
  } catch { window.showToast('Failed to add'); }
};

window.delSlot = async (id) => {
  try {
    await deleteDoc(doc(db, 'timetable', id));
    _cache = _cache.filter(s => s.id !== id);
    render();
    window.showToast('Removed');
  } catch { window.showToast('Remove failed'); }
};
