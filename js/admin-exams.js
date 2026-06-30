import { db } from './firebase-config.js';
import {
  doc, getDoc, updateDoc, setDoc,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// Exams live in `examTimetables/{department}` as a single doc with an
// `entries[]` array — this is what js/pages/Learn.js reads directly by
// department, not a flat collection. Field names (course, date, startTime,
// endTime, venue) must match what Learn.js expects.
const DEFAULT_DEPT = 'Electronic & Computer Engineering';
let _cache = [], _filter = 'upcoming', _department = DEFAULT_DEPT;

window.onAdminReady = function () {
  const deptSel = document.getElementById('exam-dept-filter');
  if (deptSel) deptSel.value = _department;
  load(_department);
};

async function load(department) {
  _department = department;
  const el = document.getElementById('exam-list');
  el.innerHTML = '<div style="color:var(--text3);font-size:13px;padding:20px 0">Loading…</div>';
  try {
    const snap = await getDoc(doc(db, 'examTimetables', department));
    const entries = snap.exists() ? (snap.data().entries || []) : [];
    entries.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    _cache = entries.map((e, i) => ({ ...e, _idx: i }));
    render();
  } catch { el.innerHTML = emptyState('Could not load exam schedule', 'Check Firestore rules'); }
}

function render() {
  const el = document.getElementById('exam-list');
  if (!el) return;
  const now  = new Date();
  let items  = _cache;
  if (_filter === 'upcoming') items = items.filter(e => new Date(e.date) >= now);
  else if (_filter === 'past') items = items.filter(e => new Date(e.date) < now);
  if (!items.length) { el.innerHTML = emptyState(_filter === 'upcoming' ? 'No upcoming exams' : 'No exams found', ''); return; }

  const esc = window.escHtml;
  el.innerHTML = items.map(e => {
    const d = e.date ? new Date(e.date) : null;
    const month = d ? d.toLocaleString('en-US', { month: 'short' }) : '—';
    const day   = d ? d.getDate() : '—';
    return `<div class="exam-item">
      <div class="exam-date-col">
        <div class="exam-month">${month}</div>
        <div class="exam-day">${day}</div>
      </div>
      <div class="exam-body">
        <div class="exam-code">${esc(e.course || '—')}</div>
        <div class="exam-meta">${esc(e.startTime||'')}${e.duration ? ` · ${e.duration}h` : ''}${e.venue ? ` · ${esc(e.venue)}` : ''}</div>
      </div>
      <div class="row-actions">
        <button class="btn-sm danger" onclick="delExam(${e._idx})">Remove</button>
      </div>
    </div>`;
  }).join('');
}

window.filterExams = (f, btn) => {
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  btn?.classList.add('active');
  _filter = f; render();
};

window.filterExamsDept = (department) => {
  load(department);
};

function addHours(time, hours) {
  const [h, m] = time.split(':').map(Number);
  const total = h + (Number(hours) || 0);
  return `${String(total % 24).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

window.submitExam = async () => {
  const course     = document.getElementById('exam-course').value.trim().toUpperCase();
  const department = document.getElementById('exam-dept').value;
  const date       = document.getElementById('exam-date').value;
  const startTime  = document.getElementById('exam-time').value;
  const duration   = Number(document.getElementById('exam-duration').value) || 2;
  const venue      = document.getElementById('exam-venue').value.trim();
  if (!course || !date) { window.showToast('Course and date required'); return; }
  const endTime = startTime ? addHours(startTime, duration) : '';
  try {
    const ref = doc(db, 'examTimetables', department);
    const snap = await getDoc(ref);
    const entries = snap.exists() ? (snap.data().entries || []) : [];
    entries.push({ course, date, startTime, endTime, duration, venue });
    await setDoc(ref, { entries }, { merge: true });
    window.closeModal('exam-modal');
    document.getElementById('exam-course').value = '';
    document.getElementById('exam-date').value   = '';
    document.getElementById('exam-venue').value  = '';
    window.showToast('Exam published');
    load(_department);
  } catch { window.showToast('Failed to publish'); }
};

window.delExam = async (idx) => {
  if (!confirm('Remove this exam?')) return;
  try {
    const ref = doc(db, 'examTimetables', _department);
    const snap = await getDoc(ref);
    const entries = snap.exists() ? (snap.data().entries || []) : [];
    entries.splice(idx, 1);
    await updateDoc(ref, { entries });
    load(_department);
  } catch { window.showToast('Remove failed'); }
};

function emptyState(title, sub) {
  return `<div class="empty-state"><svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z"/></svg><p>${window.escHtml(title)}</p>${sub ? `<span>${window.escHtml(sub)}</span>` : ''}</div>`;
}
