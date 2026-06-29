import { db } from './firebase-config.js';
import { doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

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
