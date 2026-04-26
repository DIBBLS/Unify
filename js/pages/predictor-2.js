import { auth, db } from './js/firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
let currentUser = null;

// Listen for system dark-mode changes within the module
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
  if (!localStorage.getItem('unify-theme')) {
    const t = e.matches ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', t);
    const btn = document.getElementById('themeToggle');
    if (btn) btn.textContent = t === 'dark' ? '☀️ Light' : '🌙 Dark';
  }
});

document.getElementById('signOutBtn').addEventListener('click', async () => {
  await signOut(auth);
  window.location.href = 'auth.html';
});

/* ════════════════════════════════════════
    COURSE DATABASE
════════════════════════════════════════ */
const ALL_SEMS = [
  '100L Sem 1','100L Sem 2',
  '200L Sem 1','200L Sem 2',
  '300L Sem 1','300L Sem 2',
  '400L Sem 1','400L Sem 2',
  '500L Sem 1','500L Sem 2',
];

const COURSES = {
  ECE: {
    '100L Sem 1': ['MAT 101','MAT 161','ECE 101','PHY 101','CHM 101','PHY 107','ECE 105','CSC 101','GNS 101'],
    '100L Sem 2': ['MAT 102','MAT 108','ECE 102','ECE 104','CHM 102','CHM 108','PHY 102','PHY 108','GNS 104','GNS 112'],
    '200L Sem 1': ['ECE 201','ECE 203','ECE 207','ECE 211','MEE 203','MEE 205','MEE 207','MEE 209','ENT 211'],
    '200L Sem 2': ['ECE 202','ECE 206','ECE 208','ECE 210','ECE 220','MEE 202','MEE 204','CHE 206','GNS 212'],
    '300L Sem 1': ['ECE 301','ECE 303','ECE 305','ECE 307','ECE 309','ECE 319','ECE 321','ECE 351','MEE 301'],
    '300L Sem 2': ['ECE 302','ECE 306','ECE 308','ECE 310','ECE 312','ECE 314','ECE 316','ECE 320','ECE 352','CHE 352','MEE 352','ENT 312','GNS 312'],
    '400L Sem 1': ['ECE 401','ECE 403','ECE 405','ECE 407','ECE 409','ECE 411','ECE 413'],
    '400L Sem 2': ['ECE 402','ECE 404','ECE 406','ECE 408','ECE 410','ECE 412','ECE 414'],
    '500L Sem 1': ['ECE 501','ECE 503','ECE 505','ECE 507','ECE 509','ECE 511'],
    '500L Sem 2': ['ECE 502','ECE 504','ECE 506','ECE 508','ECE 510','ECE 512'],
  },
  MEE: {
    '100L Sem 1': ['MAT 101','MAT 161','MEE 101','PHY 101','CHM 101','PHY 107','MEE 105','CSC 101','GNS 101'],
    '100L Sem 2': ['MAT 102','MAT 108','MEE 102','MEE 104','CHM 102','CHM 108','PHY 102','PHY 108','GNS 104','GNS 112'],
    '200L Sem 1': ['MEE 201','MEE 203','MEE 205','MEE 207','MEE 209','MEE 211','ENT 211'],
    '200L Sem 2': ['MEE 202','MEE 204','MEE 206','MEE 208','MEE 210','MEE 212','CHE 206','GNS 212'],
    '300L Sem 1': ['ECE 351','MEE 301','MEE 305','MEE 351','MEE 353','MEE 355','MEE 357'],
    '300L Sem 2': ['MEE 304','MEE 306','MEE 308','MEE 310','MEE 322','MEE 352','MEE 354','ECE 302','ECE 316','ECE 352','CHE 352','ENT 312','GNS 312'],
    '400L Sem 1': ['MEE 401','MEE 403','MEE 405','MEE 407','MEE 409','MEE 411','MEE 413'],
    '400L Sem 2': ['MEE 402','MEE 404','MEE 406','MEE 408','MEE 410','MEE 412','MEE 414'],
    '500L Sem 1': ['MEE 501','MEE 503','MEE 505','MEE 507','MEE 509','MEE 511'],
    '500L Sem 2': ['MEE 502','MEE 504','MEE 506','MEE 508','MEE 510','MEE 512'],
  },
  CPE: {
    '100L Sem 1': ['MAT 101','MAT 161','CPE 101','PHY 101','CHM 101','PHY 107','CPE 105','CSC 101','GNS 101'],
    '100L Sem 2': ['MAT 102','MAT 108','CPE 102','CPE 104','CHM 102','CHM 108','PHY 102','PHY 108','GNS 104','GNS 112'],
    '200L Sem 1': ['CHE 201','CHE 203','ECE 203','ECE 211','MEE 203','MEE 205','MEE 209','ENT 211'],
    '200L Sem 2': ['CHE 202','CHE 204','CHE 206','CHE 208','MEE 202','MEE 204','GNS 212'],
    '300L Sem 1': ['CHE 301','CHE 303','CHE 305','CHE 307','CHE 309','CHE 311','CHE 313','CHE 315','ECE 351'],
    '300L Sem 2': ['CPE 302','CPE 304','CPE 306','CPE 308','CPE 310','CPE 312','CPE 314','CPE 316','CHE 304','CHE 308','CHE 312','CHE 314','CHE 352','ECE 352','ENT 312','GNS 312'],
    '400L Sem 1': ['CPE 401','CPE 403','CPE 405','CPE 407','CPE 409','CPE 411','CPE 413'],
    '400L Sem 2': ['CPE 402','CPE 404','CPE 406','CPE 408','CPE 410','CPE 412','CPE 414'],
  },
  CVE: {
    '100L Sem 1': ['MAT 101','MAT 161','CVE 101','PHY 101','CHM 101','PHY 107','CVE 105','CSC 101','GNS 101'],
    '100L Sem 2': ['MAT 102','MAT 108','CVE 102','CVE 104','CHM 102','CHM 108','PHY 102','PHY 108','GNS 104','GNS 112'],
    '200L Sem 1': ['CVE 201','CVE 203','CVE 205','CVE 207','MEE 203','MEE 205','MEE 209','ENT 211'],
    '200L Sem 2': ['CVE 202','CVE 204','CVE 206','CVE 208','MEE 202','MEE 204','CHE 206','GNS 212'],
    '300L Sem 1': ['CVE 301','CVE 303','CVE 305','CVE 307','CVE 309','ECE 351','MEE 301','MEE 351'],
    '300L Sem 2': ['CVE 302','CVE 304','CVE 306','CVE 308','CVE 310','CVE 322','CVE 352','ECE 302','ECE 312','ECE 316','ECE 352','CHE 352','ENT 312','GNS 312'],
    '400L Sem 1': ['CVE 401','CVE 403','CVE 405','CVE 407','CVE 409','CVE 411','CVE 413'],
    '400L Sem 2': ['CVE 402','CVE 404','CVE 406','CVE 408','CVE 410','CVE 412','CVE 414'],
    '500L Sem 1': ['CVE 501','CVE 503','CVE 505','CVE 507','CVE 509','CVE 511'],
    '500L Sem 2': ['CVE 502','CVE 504','CVE 506','CVE 508','CVE 510','CVE 512'],
  },
  ASE: {
    '100L Sem 1': ['MAT 101','MAT 161','PHY 101','CHM 101','PHY 107','PHY 103','CSC 101','GNS 111','MEE 101'],
    '100L Sem 2': ['MAT 102','MAT 108','AAE 102','CHM 102','CHM 108','PHY 102','PHY 108','GNS 104','GNS 112'],
    '200L Sem 1': ['ASE 201','ECE 203','ECE 211','ASE 207','MEE 203','MEE 205','MEE 207','MEE 209','ENT 211'],
    '200L Sem 2': ['ASE 202','ASE 204','MEE 202','MEE 204','MEE 208','ECE 202','ECE 210','CHE 206','GNS 212'],
    '300L Sem 1': ['ASE 351','ASE 353','ASE 355','ASE 357','MEE 301','MEE 351','ECE 351'],
    '300L Sem 2': ['ASE 312','ASE 344','ASE 352','ASE 360','ASE 362','ASE 364','ASE 366','ASE 378','ASE 380','ECE 302','CHE 352','ECE 352','GNS 312','ENT 302'],
    '400L Sem 1': ['ASE 401','ASE 403','ASE 405','ASE 407','ASE 409','ASE 411','ASE 413'],
    '400L Sem 2': ['ASE 402','ASE 404','ASE 406','ASE 408','ASE 410','ASE 412','ASE 414'],
    '500L Sem 1': ['ASE 501','ASE 503','ASE 505','ASE 507','ASE 509','ASE 511'],
    '500L Sem 2': ['ASE 502','ASE 504','ASE 506','ASE 508','ASE 510','ASE 512'],
  },
  IPE: {
    '100L Sem 1': ['MAT 101','MAT 161','IPE 101','PHY 101','CHM 101','PHY 107','IPE 105','CSC 101','GNS 101'],
    '100L Sem 2': ['MAT 102','MAT 108','IPE 102','IPE 104','CHM 102','CHM 108','PHY 102','PHY 108','GNS 104','GNS 112'],
    '200L Sem 1': ['IPE 201','IPE 203','IPE 205','IPE 207','IPE 209','MEE 203','MEE 205','ENT 211'],
    '200L Sem 2': ['IPE 202','IPE 204','IPE 206','IPE 208','MEE 202','CHE 206','GNS 212'],
    '300L Sem 1': ['IPE 301','IPE 303','IPE 309','IPE 311','IPE 315','ECE 351','MEE 301','MEE 351'],
    '300L Sem 2': ['IPE 302','IPE 304','IPE 306','IPE 308','IPE 310','IPE 316','IPE 322','IPE 352','ECE 302','ECE 312','ECE 316','ECE 352','CHE 352','ENT 312','GNS 312'],
    '400L Sem 1': ['IPE 401','IPE 403','IPE 405','IPE 407','IPE 409','IPE 411','IPE 413'],
    '400L Sem 2': ['IPE 402','IPE 404','IPE 406','IPE 408','IPE 410','IPE 412','IPE 414'],
    '500L Sem 1': ['IPE 501','IPE 503','IPE 505','IPE 507','IPE 509','IPE 511'],
    '500L Sem 2': ['IPE 502','IPE 504','IPE 506','IPE 508','IPE 510','IPE 512'],
  },
};

// Unit assignments — GNS/ENT = 2, labs (x07/x08/MAT 108/161) = 1, 300L 2-unit courses, rest = 3
const UNIT_OVERRIDE = {
  'GNS 101':2,'GNS 104':2,'GNS 111':2,'GNS 112':2,'GNS 212':2,'GNS 312':2,
  'ENT 211':2,'ENT 312':2,'ENT 302':2,
  'MAT 161':1,'MAT 108':1,
  'PHY 107':1,'PHY 108':1,'CHM 108':1,
  // 300L 2-unit courses confirmed from timetable
  'ECE 302':2,'ECE 306':1,'ECE 308':2,'ECE 310':2,'ECE 312':2,
  'ECE 314':2,'ECE 316':2,'ECE 320':2,
  'MEE 354':2,
  'ASE 362':2,'ASE 366':2,
  'CHE 304':2,'CHE 308':2,'CHE 312':2,'CHE 314':1,
  'IPE 306':2,'IPE 316':2,
};
const unitOf = code => UNIT_OVERRIDE[code] ?? 3;

/* ════════════════════════════════════════
    STATE
════════════════════════════════════════ */
let S = {
  dept: '', lastIdx: -1,
  states: {},         // { 'semKey': { code: 'graded'|'pending'|'missing' } }
  removedCourses: {}, // { 'semKey': { code: true } }
  cgpa: null, targetCgpa: null, targetCls: '',
  why: '', mode: '', neededAvg: null,
};

function ensureStates(dept, maxIdx, defaultState) {
  defaultState = defaultState || 'pending';
  for (let i = 0; i <= maxIdx; i++) {
    const sem = ALL_SEMS[i];
    if (!S.states[sem]) S.states[sem] = {};
    const removed = S.removedCourses[sem] || {};
    for (const code of ((COURSES[dept] || {})[sem] || [])) {
      if (removed[code]) continue;
      if (!S.states[sem][code]) S.states[sem][code] = defaultState;
    }
  }
}

/* ════════════════════════════════════════
    UNIT CALCULATION
════════════════════════════════════════ */
function calcUnits() {
  let g = 0, p = 0, m = 0, t = 0;
  for (let i = 0; i <= S.lastIdx; i++) {
    const sem = ALL_SEMS[i];
    const removed = S.removedCourses[sem] || {};
    for (const code of ((COURSES[S.dept] || {})[sem] || [])) {
      if (removed[code]) continue;
      const u  = unitOf(code);
      const st = (S.states[sem] || {})[code] || 'pending';
      t += u;
      if (st === 'graded')  g += u;
      else if (st === 'pending') p += u;
      else m += u;
    }
  }
  return { g, p, m, t };
}

function refreshUnitBar() {
  const { g, p, m, t } = calcUnits();
  document.getElementById('uGraded').textContent  = g;
  document.getElementById('uPending').textContent = p;
  document.getElementById('uMissing').textContent = m;
  document.getElementById('uTotal').textContent   = t;
  document.getElementById('unitsDisplay').value   = g;
}

/* ════════════════════════════════════════
    STEP 1 — DEPT CARDS & SEMESTER CHIPS
════════════════════════════════════════ */
window.pickDept = function(btn) {
  document.querySelectorAll('.dept-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  const dept = btn.dataset.dept;
  S.dept = dept; S.states = {}; S.removedCourses = {}; S.lastIdx = -1;
  document.getElementById('unitBar').style.display = 'none';
  document.getElementById('accordions').innerHTML = '';
  document.getElementById('bottomSection').style.display = 'none';
  checkPlanReady();

  const chips = document.getElementById('semChips');
  chips.innerHTML = '';
  ALL_SEMS.forEach((sem, i) => {
    if ((COURSES[dept] || {})[sem]) {
      const c = document.createElement('button');
      c.className = 'sem-chip';
      c.dataset.idx = i;
      c.textContent = sem;
      c.onclick = function() { pickSem(this); };
      chips.appendChild(c);
    }
  });
  document.getElementById('semSection').style.display = 'block';
};

window.pickSem = function(btn) {
  document.querySelectorAll('.sem-chip').forEach(c => c.classList.remove('on'));
  btn.classList.add('on');
  const idx = parseInt(btn.dataset.idx);
  S.lastIdx = idx;
  S.states = {};
  S.removedCourses = {};
  ensureStates(S.dept, idx, 'graded'); // default all to graded — results are out
  document.getElementById('unitBar').style.display = 'flex';
  refreshUnitBar();
  buildAccordions();
  document.getElementById('bottomSection').style.display = 'block';
  checkPlanReady();
};

/* ════════════════════════════════════════
    ACCORDIONS
════════════════════════════════════════ */
function buildAccordions() {
  const wrap = document.getElementById('accordions');
  wrap.innerHTML = '';
  for (let i = 0; i <= S.lastIdx; i++) {
    const sem     = ALL_SEMS[i];
    const allCourses = (COURSES[S.dept] || {})[sem] || [];
    if (!allCourses.length) continue;

    const removed  = S.removedCourses[sem] || {};
    const active   = allCourses.filter(c => !removed[c]);
    const inactive = allCourses.filter(c => removed[c]);
    const semUnits = active.reduce((s, c) => s + unitOf(c), 0);

    const section = document.createElement('div');
    section.className = 'acc-section';

    const hd = document.createElement('div');
    hd.className = 'acc-hd' + (i === S.lastIdx ? ' open' : '');
    hd.innerHTML = `
      <span class="acc-hd-title">${sem}</span>
      <div class="acc-meta">
        <span class="acc-badge">${semUnits} units</span>
        <span class="acc-chevron">▾</span>
      </div>`;

    const body = document.createElement('div');
    body.className = 'acc-body' + (i === S.lastIdx ? ' open' : '');

    for (const code of active) {
      const u  = unitOf(code);
      const st = (S.states[sem] || {})[code] || 'graded';
      const row = document.createElement('div');
      row.className = 'course-row';
      row.innerHTML = `
        <span class="course-code">${code}</span>
        <span class="course-u">${u}u</span>
        <div class="state-btns">
          <button class="st-btn ${st==='graded'?'on':''}"  data-sem="${sem}" data-code="${code}" data-st="graded"  onclick="setCS(this)">✓ <span class="st-text">Graded</span></button>
          <button class="st-btn ${st==='pending'?'on':''}" data-sem="${sem}" data-code="${code}" data-st="pending" onclick="setCS(this)">⏳ <span class="st-text">Pending</span></button>
          <button class="st-btn ${st==='missing'?'on':''}" data-sem="${sem}" data-code="${code}" data-st="missing" onclick="setCS(this)">✗ <span class="st-text">Missing</span></button>
        </div>
        <button class="rm-course-btn" title="I didn't take this" onclick="removeCS('${sem}','${code}')">×</button>`;
      body.appendChild(row);
    }

    if (inactive.length > 0) {
      const restoreSection = document.createElement('div');
      restoreSection.className = 'restore-section';
      restoreSection.innerHTML = '<span class="restore-label">Not taking</span><div class="restore-chips"></div>';
      const chipsWrap = restoreSection.querySelector('.restore-chips');
      inactive.forEach(code => {
        const chip = document.createElement('button');
        chip.className = 'restore-chip';
        chip.textContent = '+ ' + code;
        chip.onclick = function() { restoreCS(sem, code); };
        chipsWrap.appendChild(chip);
      });
      body.appendChild(restoreSection);
    }

    hd.addEventListener('click', () => {
      const open = hd.classList.toggle('open');
      body.classList.toggle('open', open);
    });
    section.appendChild(hd);
    section.appendChild(body);
    wrap.appendChild(section);
  }
}

window.setCS = function(btn) {
  const { sem, code, st } = btn.dataset;
  if (!S.states[sem]) S.states[sem] = {};
  S.states[sem][code] = st;
  btn.closest('.state-btns').querySelectorAll('.st-btn').forEach(b => {
    b.classList.toggle('on', b.dataset.st === st);
  });
  refreshUnitBar();
};

window.removeCS = function(sem, code) {
  if (!S.removedCourses[sem]) S.removedCourses[sem] = {};
  S.removedCourses[sem][code] = true;
  if (S.states[sem]) delete S.states[sem][code];
  buildAccordions();
  refreshUnitBar();
};

window.restoreCS = function(sem, code) {
  if (S.removedCourses[sem]) delete S.removedCourses[sem][code];
  if (!S.states[sem]) S.states[sem] = {};
  S.states[sem][code] = 'graded';
  buildAccordions();
  refreshUnitBar();
};

/* ════════════════════════════════════════
    STEP NAVIGATION
════════════════════════════════════════ */
window.goStep = function(n) {
  if (n === 2) {
    const c = parseFloat(document.getElementById('cgpaIn').value);
    if (!S.dept || S.lastIdx < 0) return;
    if (isNaN(c) || c < 0 || c > 5) { alert('Please enter a valid CGPA (0–5).'); return; }
    if (!S.targetCgpa)               { alert('Please select a graduation target.'); return; }
    if (!S.why)                      { alert('Please answer the reflection question.'); return; }
    S.cgpa = c;
    buildStep3();
  }
  document.querySelectorAll('.step-panel').forEach((p, i) => p.classList.toggle('active', i + 1 === n));
  for (let i = 1; i <= 2; i++) {
    const node = document.getElementById(`snode-${i}`);
    node.classList.remove('active','done');
    if (i < n) node.classList.add('done');
    else if (i === n) node.classList.add('active');
    if (i < n) document.getElementById(`sc-${i}`).textContent = '✓';
    else document.getElementById(`sc-${i}`).textContent = i;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

/* ════════════════════════════════════════
    TARGET & REFLECTION
════════════════════════════════════════ */
window.pickTarget = function(btn) {
  document.querySelectorAll('.tgt-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  S.targetCls  = btn.dataset.cls;
  S.targetCgpa = parseFloat(btn.dataset.cgpa);
  document.getElementById('specIn').value = '';
  refreshCard();
};

document.getElementById('specIn').addEventListener('input', function() {
  const v = parseFloat(this.value);
  if (isNaN(v) || v < 0 || v > 5) return;
  document.querySelectorAll('.tgt-btn').forEach(b => b.classList.remove('on'));
  S.targetCls  = 'custom';
  S.targetCgpa = v;
  refreshCard();
});

document.getElementById('cgpaIn').addEventListener('input', () => {
  if (S.targetCgpa != null) refreshCard();
  checkPlanReady();
});

function refreshCard() {
  const cgpa = parseFloat(document.getElementById('cgpaIn').value);
  const tgt  = S.targetCgpa;
  if (!tgt) return;

  document.getElementById('profileCard').classList.add('vis');
  document.getElementById('reflectWrap').classList.add('vis');

  const gap = tgt - (isNaN(cgpa) ? 0 : cgpa);

  const lblMap = { first:'First Class (≥4.50)', upper:'2nd Class Upper (≥3.50)', lower:'2nd Class Lower (≥2.40)', pass:'Pass (≥1.50)', custom: tgt.toFixed(2) };
  document.getElementById('pc-target').textContent  = lblMap[S.targetCls] || tgt.toFixed(2);
  document.getElementById('pc-current').textContent = isNaN(cgpa) ? '—' : cgpa.toFixed(2);

  const gapEl = document.getElementById('pc-gap');
  gapEl.textContent = isNaN(cgpa) ? '—' : (gap > 0 ? `+${gap.toFixed(2)}` : gap.toFixed(2));
  gapEl.className    = 'pc-val ' + (gap > 0.5 ? 'red' : gap > 0 ? 'yellow' : 'green');

  let req;
  if (isNaN(cgpa))  req = 'Enter your CGPA above to see guidance here.';
  else if (gap <= 0) req = "You're already at or above target — protect your average.";
  else if (gap < 0.2) req = 'Tiny gap — steady B+ performance closes it.';
  else if (gap < 0.5) req = 'Moderate gap — aim for B+ to A range in most courses.';
  else if (gap < 1.0) req = 'Significant gap — near-A performance in most courses from here.';
  else req = 'Large gap — exceptional performance every semester is essential.';
  document.getElementById('pc-req').textContent = req;

  const c = isNaN(cgpa) ? 0 : cgpa;
  let mode, modeCls;
  if (c < 2.5 || gap > 1.0)   { mode='Recovery'; modeCls='recovery'; }
  else if (gap <= 0.1)           { mode='Stability'; modeCls='stability'; }
  else if (gap < 0.6)           { mode='Push'; modeCls='push'; }
  else                          { mode='Elite'; modeCls='elite'; }
  S.mode = mode;
  document.getElementById('pc-mode').innerHTML = `<span class="mode-badge ${modeCls}">${mode}</span>`;

  checkPlanReady();
}

function checkPlanReady() {
  const c = parseFloat(document.getElementById('cgpaIn').value);
  const ok = S.dept && S.lastIdx >= 0 && !isNaN(c) && c >= 0 && c <= 5 && S.targetCgpa != null && S.why;
  const btn = document.getElementById('planBtn');
  if (btn) btn.style.display = ok ? 'inline-flex' : 'none';
}

window.pickWhy = function(el) {
  document.querySelectorAll('.radio-opt').forEach(e => e.classList.remove('on'));
  el.classList.add('on');
  S.why = el.dataset.why;
  checkPlanReady();
};

/* ════════════════════════════════════════
    STEP 3 — BUILD PLAN
════════════════════════════════════════ */
function buildStep3() {
  const dept      = S.dept;
  const lastIdx   = S.lastIdx;
  const cgpa      = S.cgpa;
  const tgt       = S.targetCgpa;
  const { g: compUnits } = calcUnits();

  // Collect future semesters
  const futureSems = [];
  let futureUnits  = 0;
  for (let i = lastIdx + 1; i < ALL_SEMS.length; i++) {
    const sem     = ALL_SEMS[i];
    const courses = (COURSES[dept] || {})[sem];
    if (!courses) continue;
    const u = courses.reduce((s, c) => s + unitOf(c), 0);
    futureUnits += u;
    futureSems.push({ sem, idx: i, units: u, courses });
  }

  const totalUnits = compUnits + futureUnits;
  const currentQP  = cgpa * compUnits;
  const targetQP   = tgt * totalUnits;
  const neededQP   = targetQP - currentQP;
  const neededAvg  = futureUnits > 0 ? neededQP / futureUnits : 0;
  S.neededAvg      = neededAvg;

  // Feasibility
  let fCls, fIcon, fText;
  if (neededAvg <= 0) {
    fCls='go';   fIcon='✅'; fText="You've already secured your target class — just keep it up.";
  } else if (neededAvg <= 3.5) {
    fCls='go';   fIcon='🎯'; fText='Achievable — consistent work from here gets you there.';
  } else if (neededAvg <= 4.5) {
    fCls='warn'; fIcon='⚠️'; fText='Stretch goal — requires strong, sustained performance every semester.';
  } else {
    fCls='hard'; fIcon='⚡'; fText='Very Difficult — near-perfect grades in every remaining course needed.';
  }
  const banner = document.getElementById('feasBanner');
  banner.className = `feas-banner ${fCls}`;
  document.getElementById('feasIcon').textContent = fIcon;
  document.getElementById('feasText').textContent = fText;

  // Required average card
  const clamped = Math.max(0, Math.min(5, neededAvg));
  document.getElementById('avgNum').textContent  = neededAvg <= 0 ? 'On Track' : clamped.toFixed(2);
  document.getElementById('avgDesc').textContent = neededAvg <= 0
    ? "You're already on pace for your graduation target."
    : gpToWords(neededAvg);

  // Roadmap
  buildRoadmap(lastIdx, futureSems, neededAvg);

  // What-If: This Semester
  buildThisSem(lastIdx, compUnits, cgpa, dept);

  // What-If: Long Term
  buildLeverage(futureSems, compUnits, futureUnits, neededAvg);
}

function gpToWords(gp) {
  if (gp >= 4.7) return 'A in virtually every course — near-perfect performance is essential';
  if (gp >= 4.3) return 'Mostly A grades, very few Bs allowed across all remaining courses';
  if (gp >= 3.7) return 'Strong A–B range consistently across all remaining courses';
  if (gp >= 3.0) return 'Solid B average — reliable, consistent effort every semester';
  if (gp >= 2.0) return 'C to B range — pass all courses and avoid failures';
  return 'Stay consistent and pass your courses each semester';
}

function buildRoadmap(lastIdx, futureSems, neededAvg) {
  const wrap = document.getElementById('roadmap');
  wrap.innerHTML = '';

  for (let i = 0; i <= lastIdx; i++) {
    const d = document.createElement('div');
    d.className = 'rm-item done';
    d.innerHTML = `<div class="rm-dot">✓</div><div class="rm-content"><div class="rm-sem">${ALL_SEMS[i]}</div><div class="rm-status">Done</div></div>`;
    wrap.appendChild(d);
  }

  futureSems.forEach(({ sem, idx, units }, fi) => {
    const isCur  = fi === 0;
    const isEst  = idx >= 6;   // 400L+ = estimated
    const avgStr = neededAvg <= 0 ? 'Already on track' : `Aim for GP ≥ ${Math.min(5, neededAvg).toFixed(2)}`;
    const d = document.createElement('div');
    d.className = `rm-item${isCur ? ' cur' : ''}${isEst ? ' est' : ''}`;
    d.innerHTML = `
      <div class="rm-dot">${isCur ? '→' : ''}</div>
      <div class="rm-content">
        <div class="rm-sem">${sem}${isEst ? '<span class="est-tag">est.</span>' : ''}</div>
        <div class="rm-status${isCur ? ' hi' : ''}">${isCur ? 'Next up · ' : ''}${avgStr} · ${units} units</div>
      </div>`;
    wrap.appendChild(d);
  });
}

/* ── WHAT-IF: THIS SEMESTER ── */
function buildThisSem(lastIdx, compUnits, cgpa, dept) {
  const nextIdx = lastIdx + 1;
  const wrap    = document.getElementById('thisCourses');
  wrap.innerHTML = '';

  if (nextIdx >= ALL_SEMS.length || !COURSES[dept]?.[ALL_SEMS[nextIdx]]) {
    wrap.innerHTML = '<p style="color:var(--text3);font-size:13px;padding:8px 0">No remaining semesters — congratulations!</p>';
    document.getElementById('projNum').textContent = cgpa.toFixed(2);
    document.getElementById('ceilNum').textContent = cgpa.toFixed(2);
    return;
  }

  const sem     = ALL_SEMS[nextIdx];
  const courses = COURSES[dept][sem];
  const gradeMap = {};
  courses.forEach(c => { gradeMap[c] = 4; }); // default B

  function recalc() {
    let semQP = 0, maxQP = 0, semU = 0;
    courses.forEach(c => { const u = unitOf(c); semQP += (gradeMap[c] ?? 4) * u; maxQP += 5 * u; semU += u; });
    const totU  = compUnits + semU;
    const proj  = totU > 0 ? (cgpa * compUnits + semQP) / totU : cgpa;
    const ceil  = totU > 0 ? (cgpa * compUnits + maxQP) / totU : cgpa;
    document.getElementById('projNum').textContent = proj.toFixed(2);
    document.getElementById('ceilNum').textContent = ceil.toFixed(2);
  }

  courses.forEach(code => {
    const u   = unitOf(code);
    const row = document.createElement('div');
    row.className = 'wi-course';

    const info = document.createElement('div');
    info.innerHTML = `<div class="wi-code">${code}</div><div class="wi-u">${u} unit${u!==1?'s':''}</div>`;

    const sel = document.createElement('select');
    sel.className = 'grade-sel';
    [['A — 5.0',5],['B — 4.0',4],['C — 3.0',3],['D — 2.0',2],['E — 1.0',1],['F — 0.0',0]].forEach(([lbl, v]) => {
      const o = document.createElement('option');
      o.value = v; o.textContent = lbl;
      if (v === 4) o.selected = true;
      sel.appendChild(o);
    });
    sel.addEventListener('change', () => { gradeMap[code] = parseInt(sel.value); recalc(); });

    row.appendChild(info);
    row.appendChild(sel);
    wrap.appendChild(row);
  });

  recalc();
}

/* ── WHAT-IF: LONG TERM ── */
function buildLeverage(futureSems, compUnits, futureUnits, neededAvg) {
  const wrap = document.getElementById('levList');
  wrap.innerHTML = '';

  const all = [];
  futureSems.forEach(({ courses }) => courses.forEach(c => all.push({ code: c, units: unitOf(c) })));
  all.sort((a, b) => b.units - a.units);

  const totalAfter = compUnits + futureUnits;
  all.slice(0, 24).forEach(({ code, units }) => {
    const gain = totalAfter > 0 ? Math.max(0, (5.0 - Math.max(0, neededAvg)) * units / totalAfter) : 0;
    const row  = document.createElement('div');
    row.className = 'lev-row';
    row.innerHTML = `
      <div>
        <div class="lev-code">${code}</div>
        <div class="lev-u">${units} unit${units!==1?'s':''}</div>
      </div>
      <div class="lev-gain">+${gain.toFixed(3)} per A</div>`;
    wrap.appendChild(row);
  });
}

window.switchTab = function(id, btn) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('on'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('on'));
  btn.classList.add('on');
  document.getElementById(`tab-${id}`).classList.add('on');
};

/* ════════════════════════════════════════
    FIREBASE SAVE / LOAD
════════════════════════════════════════ */
window.savePlan = async function() {
  if (!currentUser) return;
  const btn = document.getElementById('saveBtn');
  btn.textContent = 'Saving…'; btn.disabled = true;
  try {
    const { g: completedUnits } = calcUnits();
    await setDoc(doc(db, 'users', currentUser.uid), {
      gradePlanner: {
        dept:           S.dept,
        lastSem:        ALL_SEMS[S.lastIdx] || '',
        completedUnits,
        cgpa:           S.cgpa,
        target:         S.targetCgpa,
        targetClass:    S.targetCls,
        whyChoice:      S.why,
        academicMode:   S.mode,
        neededAvg:      S.neededAvg,
        courseStates:   S.states,
        removedCourses: S.removedCourses,
        updatedAt:      serverTimestamp(),
      }
    }, { merge: true });
    document.getElementById('saveOk').classList.add('vis');
    btn.textContent = '✓ Saved';
    setTimeout(() => { btn.textContent = 'Save My Plan'; btn.disabled = false; }, 3000);
  } catch (e) {
    console.error('Save error', e);
    btn.textContent = 'Save My Plan'; btn.disabled = false;
    alert('Save failed — please try again.');
  }
};

// Maps full department name (stored in Firestore profile) → short code
const DEPT_NAME_TO_CODE = {
  'Electronic & Computer Engineering':  'ECE',
  'Mechanical Engineering':             'MEE',
  'Chemical & Polymer Engineering':     'CPE',
  'Civil Engineering':                  'CVE',
  'Aerospace Engineering':              'ASE',
  'Industrial & Petroleum Engineering': 'IPE',
};

// Maps "200 Level" → last completed semester index (end of prior year)
const LEVEL_TO_LAST_SEM_IDX = {
  '100 Level': -1,   // just starting — no completed semesters
  '200 Level':  1,   // completed 100L Sem 2
  '300 Level':  3,   // completed 200L Sem 2
  '400 Level':  5,   // completed 300L Sem 2
  '500 Level':  7,   // completed 400L Sem 2
};

async function loadSaved() {
  if (!currentUser) return;
  try {
    const snap = await getDoc(doc(db, 'users', currentUser.uid));
    if (!snap.exists()) return;
    const data = snap.data();
    const gp   = data.gradePlanner;

    if (gp && gp.dept && COURSES[gp.dept]) {
      // ── Restore saved grade planner ──────────────────

      const deptBtn = document.querySelector(`.dept-btn[data-dept="${gp.dept}"]`);
      if (deptBtn) pickDept(deptBtn);

      if (gp.lastSem && ALL_SEMS.includes(gp.lastSem) && (COURSES[gp.dept] || {})[gp.lastSem]) {
        const idx = ALL_SEMS.indexOf(gp.lastSem);
        const semBtn = document.querySelector(`.sem-chip[data-idx="${idx}"]`);
        if (semBtn) pickSem(semBtn);
        if (gp.removedCourses && typeof gp.removedCourses === 'object') S.removedCourses = gp.removedCourses;
        if (gp.courseStates && typeof gp.courseStates === 'object') S.states = gp.courseStates;
        refreshUnitBar();
        buildAccordions();
      }

      if (gp.cgpa != null) { document.getElementById('cgpaIn').value = gp.cgpa; S.cgpa = gp.cgpa; }

      if (gp.target != null) {
        S.targetCgpa = gp.target; S.targetCls = gp.targetClass || 'custom';
        document.querySelectorAll('.tgt-btn').forEach(b => {
          if (parseFloat(b.dataset.cgpa) === gp.target) b.classList.add('on');
        });
        if (gp.cgpa != null) refreshCard();
      }

      if (gp.whyChoice) {
        S.why = gp.whyChoice;
        document.querySelectorAll('.radio-opt').forEach(el => {
          if (el.dataset.why === gp.whyChoice) el.classList.add('on');
        });
      }

      if (gp.cgpa != null && gp.target != null && gp.whyChoice) checkPlanReady();

    } else if (data.department) {
      // ── No grade planner data yet — pre-fill from profile ──
      const code = DEPT_NAME_TO_CODE[data.department];
      if (code) {
        const deptBtn = document.querySelector(`.dept-btn[data-dept="${code}"]`);
        if (deptBtn) pickDept(deptBtn);

        // Pre-select last semester based on their current level
        const levelIdx = LEVEL_TO_LAST_SEM_IDX[data.level];
        if (levelIdx != null && levelIdx >= 0) {
          const sem = ALL_SEMS[levelIdx];
          if ((COURSES[code] || {})[sem]) {
            const semBtn = document.querySelector(`.sem-chip[data-idx="${levelIdx}"]`);
            if (semBtn) pickSem(semBtn);
          }
        }
      }
    }
  } catch (e) {
    console.error('Grade planner load error:', e);
  }
}

// Register auth listener LAST — after all constants and functions are defined
onAuthStateChanged(auth, async user => {
  if (!user) { window.location.href = 'auth.html'; return; }
  currentUser = user;
  try {
    await loadSaved();
  } catch (e) {
    console.error('Auth setup error:', e);
  } finally {
    document.getElementById('loadingOverlay').style.display = 'none';
  }
});
