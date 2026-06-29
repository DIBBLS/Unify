/**
 * Unify — Floating Feedback Widget
 * Include as <script type="module" src="js/feedback.js"></script> on any page.
 * Writes to Firestore `feedback` collection.
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const CSS = `
#fb-btn{position:fixed;bottom:88px;right:20px;z-index:500;width:48px;height:48px;border-radius:50%;background:#16a34a;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(22,163,74,.35);transition:transform .15s,box-shadow .15s}
#fb-btn:hover{transform:scale(1.08);box-shadow:0 6px 18px rgba(22,163,74,.45)}
#fb-btn svg{color:#fff;flex-shrink:0}
@media(min-width:769px){#fb-btn{bottom:28px}}

#fb-modal-bg{display:none;position:fixed;inset:0;z-index:600;background:rgba(0,0,0,.45);backdrop-filter:blur(2px)}
#fb-modal-bg.open{display:flex;align-items:flex-end;justify-content:center}
@media(min-width:500px){#fb-modal-bg.open{align-items:center}}
#fb-modal{background:var(--surface,#fff);border-radius:18px 18px 0 0;padding:24px 20px 28px;width:100%;max-width:440px;position:relative}
@media(min-width:500px){#fb-modal{border-radius:18px}}
#fb-modal h3{font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--text,#111);margin-bottom:4px}
#fb-modal p{font-size:13px;color:var(--text3,#999);margin-bottom:18px}
.fb-label{display:block;font-size:13px;font-weight:500;color:var(--text2,#555);margin-bottom:6px}
#fb-category{width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border,#e5e5e5);background:var(--surface2,#f5f4ef);color:var(--text,#111);font-size:14px;margin-bottom:14px;font-family:inherit}
#fb-message{width:100%;padding:9px 12px;border-radius:8px;border:1px solid var(--border,#e5e5e5);background:var(--surface2,#f5f4ef);color:var(--text,#111);font-size:14px;font-family:inherit;resize:vertical;min-height:96px;margin-bottom:18px}
#fb-category:focus,#fb-message:focus{outline:none;border-color:#16a34a}
#fb-submit{width:100%;padding:11px;background:#16a34a;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;transition:opacity .15s}
#fb-submit:disabled{opacity:.6;cursor:default}
#fb-close{position:absolute;top:16px;right:16px;background:none;border:none;cursor:pointer;color:var(--text3,#999);padding:4px}
#fb-success{display:none;text-align:center;padding:24px 0}
#fb-success-icon{width:48px;height:48px;background:rgba(22,163,74,.12);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px}
#fb-success h4{font-size:16px;font-weight:600;color:var(--text,#111);margin-bottom:6px}
#fb-success p{font-size:14px;color:var(--text3,#999)}
`;

function inject() {
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  document.body.insertAdjacentHTML('beforeend', `
<button id="fb-btn" aria-label="Send feedback" title="Send feedback">
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
</button>

<div id="fb-modal-bg" role="dialog" aria-modal="true" aria-label="Feedback">
  <div id="fb-modal">
    <button id="fb-close" aria-label="Close">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
    </button>
    <div id="fb-form-area">
      <h3>Send Feedback</h3>
      <p>Help us make Unify Learn better for you.</p>
      <label class="fb-label" for="fb-category">Category</label>
      <select id="fb-category">
        <option value="">Select a category…</option>
        <option value="Bug Report">Bug Report</option>
        <option value="Feature Request">Feature Request</option>
        <option value="UI/UX Issue">UI/UX Issue</option>
        <option value="Academic Issue">Academic Issue</option>
        <option value="Other">Other</option>
      </select>
      <label class="fb-label" for="fb-message">Your feedback</label>
      <textarea id="fb-message" placeholder="Describe your feedback…" rows="4"></textarea>
      <button id="fb-submit">Submit Feedback</button>
    </div>
    <div id="fb-success">
      <div id="fb-success-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <h4>Thanks for your feedback!</h4>
      <p>We'll review it and use it to improve Unify Learn.</p>
    </div>
  </div>
</div>`);

  const btn = document.getElementById('fb-btn');
  const bg = document.getElementById('fb-modal-bg');
  const closeBtn = document.getElementById('fb-close');
  const submitBtn = document.getElementById('fb-submit');
  const formArea = document.getElementById('fb-form-area');
  const successArea = document.getElementById('fb-success');

  btn.addEventListener('click', () => bg.classList.add('open'));
  closeBtn.addEventListener('click', close);
  bg.addEventListener('click', (e) => { if (e.target === bg) close(); });

  function close() {
    bg.classList.remove('open');
    setTimeout(() => {
      formArea.style.display = '';
      successArea.style.display = 'none';
      document.getElementById('fb-category').value = '';
      document.getElementById('fb-message').value = '';
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Feedback';
    }, 200);
  }

  submitBtn.addEventListener('click', async () => {
    const category = document.getElementById('fb-category').value.trim();
    const message = document.getElementById('fb-message').value.trim();
    if (!category || !message) {
      submitBtn.textContent = 'Please fill in all fields';
      setTimeout(() => { submitBtn.textContent = 'Submit Feedback'; }, 1800);
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    try {
      const user = auth.currentUser;
      await addDoc(collection(db, 'feedback'), {
        category,
        message,
        uid: user ? user.uid : null,
        timestamp: serverTimestamp(),
        page: window.location.pathname,
      });
      formArea.style.display = 'none';
      successArea.style.display = '';
      setTimeout(close, 2800);
    } catch (err) {
      console.error('feedback submit:', err);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Failed — try again';
      setTimeout(() => { submitBtn.textContent = 'Submit Feedback'; }, 2000);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', inject);
} else {
  inject();
}
