import { db } from './firebase-config.js';
import {
  doc, getDoc, setDoc, getDocs, addDoc, collection, writeBatch, serverTimestamp,
} from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ── SETTINGS ──────────────────────────────────────────────────────────────────

window.onAdminReady = async function () {
  try {
    const snap = await getDoc(doc(db, 'settings', 'platform'));
    if (!snap.exists()) return;
    const s = snap.data();
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
    set('set-registrations',  s.registrations   !== false);
    set('set-feedback',       s.feedbackEnabled  !== false);
    set('set-maintenance',    s.maintenanceMode  === true);
    set('set-push',           s.pushEnabled      === true);
    set('set-exam-reminders', s.examReminders    !== false);
  } catch {}
};

window.saveSetting = async (key, value) => {
  try {
    await setDoc(doc(db, 'settings', 'platform'), { [key]: value }, { merge: true });
    window.showToast('Setting saved');
  } catch { window.showToast('Failed to save'); }
};

// ── IMPORT ────────────────────────────────────────────────────────────────────

const COLS = ['faculty','facultyDuration','department','level','semester','code','title','units','isCompulsory'];
const REQUIRED = ['faculty','department','code','semester'];

let _parsedRows = null;

// ── Template download ─────────────────────────────────────────────────────────

window.downloadTemplate = function () {
  const csv = [
    COLS.join(','),
    'Engineering,5,Electronic and Computer Engineering,300 Level,First Semester,ECE 301,Circuit Theory,3,true',
    'Engineering,5,Electronic and Computer Engineering,300 Level,First Semester,ECE 303,Electromagnetic Fields and Waves,3,true',
    'Engineering,5,Mechanical Engineering,300 Level,First Semester,MEE 305,Fluid Mechanics,3,true',
  ].join('\n');
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })),
    download: 'unify-import-template.csv',
  });
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};

// ── CSV parser ────────────────────────────────────────────────────────────────

function parseCSVLine(line) {
  const fields = [];
  let field = '', inQuote = false, i = 0;
  while (i < line.length) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') { field += '"'; i += 2; continue; }
      if (ch === '"') { inQuote = false; i++; continue; }
      field += ch;
    } else {
      if (ch === '"') { inQuote = true; i++; continue; }
      if (ch === ',') { fields.push(field); field = ''; i++; continue; }
      field += ch;
    }
    i++;
  }
  fields.push(field);
  return fields;
}

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (!lines.length) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const vals = parseCSVLine(lines[i]);
    const row = {};
    headers.forEach((h, j) => { row[h] = String(vals[j] ?? '').trim(); });
    rows.push(row);
  }
  return rows;
}

// ── SheetJS lazy loader ───────────────────────────────────────────────────────

function loadXLSX() {
  if (window.XLSX) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
    s.onload = resolve;
    s.onerror = () => reject(new Error('Could not load XLSX library from CDN'));
    document.head.appendChild(s);
  });
}

// ── File selection ────────────────────────────────────────────────────────────

window.handleFileSelect = async function (input) {
  const file = input.files[0];
  _parsedRows = null;
  _resetUI();

  const nameEl = document.getElementById('import-filename');
  if (!file) { nameEl.textContent = 'No file chosen'; return; }
  nameEl.textContent = file.name;

  const ext = file.name.split('.').pop().toLowerCase();
  if (!['csv', 'xlsx'].includes(ext)) {
    _showError('Unsupported file type — please upload a .csv or .xlsx file.');
    return;
  }

  nameEl.textContent = file.name + ' · parsing…';
  try {
    let rows;
    if (ext === 'csv') {
      rows = parseCSV(await file.text());
    } else {
      await loadXLSX();
      const wb = window.XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      rows = window.XLSX.utils.sheet_to_json(ws, { defval: '', raw: false });
      // Trim all string values (XLSX can carry whitespace)
      rows = rows.map(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k.trim(), String(v).trim()])));
    }
    nameEl.textContent = file.name;

    if (!rows.length) { _showError('The file is empty.'); return; }

    const missingCols = COLS.filter(c => !(c in rows[0]));
    if (missingCols.length) {
      _showError(`Missing columns: ${missingCols.join(', ')}. Make sure the header row matches the template exactly (case-sensitive).`);
      return;
    }

    _parsedRows = rows;
    _renderPreview(rows);
  } catch (e) {
    nameEl.textContent = file.name + ' · error';
    _showError('Could not parse file: ' + (e.message || String(e)));
  }
};

// ── Preview ───────────────────────────────────────────────────────────────────

function _renderPreview(rows) {
  const preview = rows.slice(0, 5);
  document.getElementById('import-preview-table').innerHTML =
    '<thead><tr>' + COLS.map(c => `<th>${c}</th>`).join('') + '</tr></thead>' +
    '<tbody>' + preview.map(r =>
      '<tr>' + COLS.map(c => `<td>${_esc(String(r[c] ?? ''))}</td>`).join('') + '</tr>'
    ).join('') + '</tbody>';
  document.getElementById('import-row-count').textContent =
    rows.length === 1 ? '1 row' : `${rows.length} rows${rows.length > 5 ? ' (showing first 5)' : ''}`;
  document.getElementById('import-preview').style.display = 'block';
}

// ── Validation ────────────────────────────────────────────────────────────────

function _validate(rows) {
  const errs = [];
  rows.forEach((r, i) => {
    const rowErrs = [];
    REQUIRED.forEach(col => { if (!String(r[col] ?? '').trim()) rowErrs.push(`${col} is required`); });
    const sem = String(r.semester ?? '').trim();
    if (sem && !['First Semester', 'Second Semester'].includes(sem)) {
      rowErrs.push(`semester must be "First Semester" or "Second Semester", got "${sem}"`);
    }
    if (rowErrs.length) errs.push(`Row ${i + 2}: ${rowErrs.join('; ')}`);
  });
  return errs;
}

// ── Import ────────────────────────────────────────────────────────────────────

window.startImport = async function () {
  if (!_parsedRows?.length) return;

  const valErrs = _validate(_parsedRows);
  if (valErrs.length) {
    _showError(
      `${valErrs.length} row${valErrs.length !== 1 ? 's have' : ' has'} errors — fix these before importing:`,
      valErrs
    );
    return;
  }

  const btn = document.getElementById('import-btn');
  btn.disabled = true;
  document.getElementById('import-errors').style.display = 'none';
  document.getElementById('import-summary').style.display = 'none';
  document.getElementById('import-progress').style.display = 'block';

  let facCreated = 0, deptCreated = 0, courseCount = 0;

  try {
    // 1 — Load existing faculties and departments to match by name
    _setProgress(0, 'Loading existing data…');
    const [facSnap, deptSnap] = await Promise.all([
      getDocs(collection(db, 'faculties')),
      getDocs(collection(db, 'departments')),
    ]);

    const existingFac = new Map(); // lc name → {id, programDurationYears}
    facSnap.docs.forEach(d => existingFac.set((d.data().name || '').toLowerCase().trim(), { id: d.id, ...d.data() }));

    const existingDept = new Map(); // `${lc deptName}|${facultyId}` → {id}
    deptSnap.docs.forEach(d => {
      existingDept.set(`${(d.data().name || '').toLowerCase().trim()}|${d.data().facultyId || ''}`, { id: d.id });
    });

    // 2 — Collect unique faculties and departments (first occurrence wins)
    const uniqueFac = new Map();  // name → {name, duration}
    const uniqueDept = new Map(); // `${deptName}|${facultyName}` → {name, facultyName}
    for (const r of _parsedRows) {
      const fName = r.faculty.trim();
      if (fName && !uniqueFac.has(fName)) {
        uniqueFac.set(fName, { name: fName, duration: parseInt(r.facultyDuration) || null });
      }
      const dName = r.department.trim();
      if (fName && dName) {
        const key = `${dName}|${fName}`;
        if (!uniqueDept.has(key)) uniqueDept.set(key, { name: dName, facultyName: fName });
      }
    }

    // 3 — Write faculties
    _setProgress(5, `Processing ${uniqueFac.size} ${uniqueFac.size === 1 ? 'faculty' : 'faculties'}…`);
    const facNameToId = new Map(); // import name → Firestore doc ID

    for (const [name, { duration }] of uniqueFac) {
      const lc = name.toLowerCase();
      if (existingFac.has(lc)) {
        const ex = existingFac.get(lc);
        facNameToId.set(name, ex.id);
        if (duration && duration !== ex.programDurationYears) {
          await setDoc(doc(db, 'faculties', ex.id), { programDurationYears: duration, updatedAt: serverTimestamp() }, { merge: true });
        }
      } else {
        const ref = await addDoc(collection(db, 'faculties'), {
          name, programDurationYears: duration,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        facNameToId.set(name, ref.id);
        facCreated++;
      }
    }

    // 4 — Write departments
    _setProgress(20, `Processing ${uniqueDept.size} ${uniqueDept.size === 1 ? 'department' : 'departments'}…`);
    const deptKeyToId = new Map(); // `${deptName}|${facultyName}` → Firestore doc ID

    for (const [key, { name, facultyName }] of uniqueDept) {
      const facultyId = facNameToId.get(facultyName);
      if (!facultyId) continue;
      const lookupKey = `${name.toLowerCase()}|${facultyId}`;
      if (existingDept.has(lookupKey)) {
        deptKeyToId.set(key, existingDept.get(lookupKey).id);
      } else {
        const ref = await addDoc(collection(db, 'departments'), {
          name, facultyId,
          createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
        deptKeyToId.set(key, ref.id);
        deptCreated++;
      }
    }

    // 5 — Deduplicate courses by code (first row wins)
    const seenCodes = new Set();
    const courseRows = [];
    for (const r of _parsedRows) {
      const code = _normalizeCode(r.code);
      if (code && !seenCodes.has(code)) { seenCodes.add(code); courseRows.push(r); }
    }

    // 6 — Write courses in batches of 400
    const BATCH = 400;
    for (let i = 0; i < courseRows.length; i += BATCH) {
      const chunk = courseRows.slice(i, i + BATCH);
      const batch = writeBatch(db);
      for (const r of chunk) {
        const code = _normalizeCode(r.code);
        const id = code.replace(/\s+/g, '_');
        const deptKey = `${r.department.trim()}|${r.faculty.trim()}`;
        batch.set(doc(db, 'courses', id), {
          code,
          title:        String(r.title ?? '').trim(),
          faculty:      r.faculty.trim(),
          department:   r.department.trim(),
          facultyId:    facNameToId.get(r.faculty.trim()) || '',
          departmentId: deptKeyToId.get(deptKey) || '',
          level:        String(r.level ?? '').trim(),
          semester:     String(r.semester ?? '').trim(),
          units:        parseInt(r.units) || 0,
          isCompulsory: String(r.isCompulsory ?? '').trim().toLowerCase() === 'true',
          description:  '',
        }, { merge: true });
      }
      await batch.commit();
      courseCount += chunk.length;
      _setProgress(40 + Math.round((courseCount / courseRows.length) * 60),
        `Writing courses… (${courseCount}/${courseRows.length})`);
    }

    // Done
    _setProgress(100, 'Done');
    document.getElementById('import-progress').style.display = 'none';
    const s = document.getElementById('import-summary');
    s.innerHTML =
      `✓ Import complete — <strong>${facCreated}</strong> new ${facCreated === 1 ? 'faculty' : 'faculties'}, ` +
      `<strong>${deptCreated}</strong> new ${deptCreated === 1 ? 'department' : 'departments'}, ` +
      `<strong>${courseCount}</strong> ${courseCount === 1 ? 'course' : 'courses'} written.`;
    s.style.display = 'block';
    window.showToast('Import complete');

  } catch (e) {
    console.error('[import]', e);
    document.getElementById('import-progress').style.display = 'none';
    _showError(
      `Import failed after ${facCreated} faculties, ${deptCreated} departments, ${courseCount} courses written. ` +
      `Error: ${e.message || String(e)}`
    );
  } finally {
    btn.disabled = false;
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function _normalizeCode(raw) {
  return String(raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
}

function _esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _resetUI() {
  ['import-preview','import-errors','import-summary','import-progress'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  const btn = document.getElementById('import-btn');
  if (btn) btn.disabled = false;
}

function _setProgress(pct, label) {
  document.getElementById('import-progress-fill').style.width = pct + '%';
  if (label) document.getElementById('import-progress-label').textContent = label;
}

function _showError(heading, items) {
  const el = document.getElementById('import-errors');
  if (items && items.length) {
    const shown = items.slice(0, 25);
    el.innerHTML =
      `<strong>${_esc(heading)}</strong>` +
      '<ul style="margin:6px 0 0;padding-left:18px;">' +
      shown.map(e => `<li>${_esc(e)}</li>`).join('') +
      (items.length > 25 ? `<li style="opacity:.6">…and ${items.length - 25} more</li>` : '') +
      '</ul>';
  } else {
    el.textContent = heading;
  }
  el.style.display = 'block';
}
