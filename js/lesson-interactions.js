// js/lesson-interactions.js
// All user-interaction handlers for rendered lesson pages.
// Loaded by lesson.html after lesson-renderer.js renders the content.

// ── Theme ──────────────────────────────────────
function toggleDark() {
  const h   = document.documentElement;
  const btn = document.getElementById('dark-toggle');
  const dark = h.getAttribute('data-theme') === 'dark';
  h.setAttribute('data-theme', dark ? 'light' : 'dark');
  localStorage.setItem('unify-theme', dark ? 'light' : 'dark');
  if (btn) btn.textContent = dark ? '☾' : '☀';
}

// ── Tab switching ──────────────────────────────
function switchTab(id, btn) {
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  const panel = document.getElementById('panel-' + id);
  if (panel) panel.classList.add('active');
  if (btn) btn.classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = '0%';
}

// ── Recall reveals ─────────────────────────────
function revealAnswer(id) {
  const el = document.getElementById(id);
  if (!el) return;
  const shown = el.classList.contains('show');
  el.classList.toggle('show', !shown);
  const btn = el.previousElementSibling;
  if (btn && (btn.classList.contains('reveal-btn') || btn.classList.contains('mc-reveal-btn')))
    btn.textContent = shown ? 'Reveal Answer' : 'Hide Answer';
}

function mcReveal(btn) {
  const answer = btn.nextElementSibling;
  const shown  = answer.classList.contains('show');
  answer.classList.toggle('show', !shown);
  btn.textContent = shown ? 'Reveal Answer' : 'Hide Answer';
}

// ── Accordion ──────────────────────────────────
function toggleAccordion(btn) {
  const item    = btn.closest('.accordion-item');
  const wasOpen = item.classList.contains('open');
  // Close all others in the same card
  const card = item.closest('.topic-card');
  if (card) card.querySelectorAll('.accordion-item.open').forEach(i => {
    if (i !== item) i.classList.remove('open');
  });
  item.classList.toggle('open', !wasOpen);
}

// ── MCQ (mini-check) ───────────────────────────
function mcMcq(el, gid, correct, fbId) {
  const opts = document.getElementById(gid).querySelectorAll('.mc-mcq-opt');
  // Prevent re-answer
  if ([...opts].some(o => o.classList.contains('mc-correct') || o.classList.contains('mc-wrong'))) return;
  opts.forEach(o => o.classList.add('mc-locked'));
  el.classList.add(correct ? 'mc-correct' : 'mc-wrong');
  // Highlight correct answer if wrong was chosen
  if (!correct) opts.forEach(o => {
    if ((o.getAttribute('onclick') || '').includes(',true,')) o.classList.add('mc-correct');
  });
  const fb = document.getElementById(fbId);
  if (fb) {
    fb.style.display = 'block';
    fb.textContent   = correct ? '✓ Correct!' : '✗ Not quite — correct answer highlighted.';
    fb.style.color   = correct ? '#166534' : '#991b1b';
  }
}

// ── FITB (mini-check) ──────────────────────────
function mcFitb(inpId, fbId, answers) {
  const inp = document.getElementById(inpId);
  const val = inp.value.trim().toLowerCase();
  const ok  = (answers || []).some(a => val === a.toLowerCase() || val.includes(a.toLowerCase()));
  inp.disabled = true;
  inp.style.borderColor = ok ? 'var(--green)' : 'rgba(239,68,68,.5)';
  const fb = document.getElementById(fbId);
  if (fb) {
    fb.style.display = 'block';
    fb.textContent   = ok ? '✓ Correct!' : '✗ Incorrect — expected: ' + (answers[0] || '');
    fb.style.color   = ok ? '#166534' : '#991b1b';
  }
}

// ── End-of-week quiz ───────────────────────────
const _eoqAnswers = {};

function eoqSelect(el, qNum) {
  const q = el.closest('.eoq-question');
  if (q.querySelectorAll('.eoq-option.locked').length) return;
  q.querySelectorAll('.eoq-option').forEach(o => o.classList.remove('selected'));
  el.classList.add('selected');
  _eoqAnswers[qNum] = el.getAttribute('data-letter');
}

function eoqSubmit() {
  const fb        = window._eoqFB       || {};
  const tm        = window._eoqTM       || {};
  const total     = window._eoqTotal    || 10;
  const threshold = window._eoqThreshold || 60;

  let score = 0;
  document.querySelectorAll('.eoq-question').forEach(q => {
    const qNum    = parseInt(q.getAttribute('data-q'));
    const correct = q.getAttribute('data-ans');
    const sel     = _eoqAnswers[qNum];
    const isRight = sel === correct;
    if (isRight) score++;

    q.querySelectorAll('.eoq-option').forEach(o => {
      o.classList.add('locked');
      const l = o.getAttribute('data-letter');
      if (l === correct)         o.classList.add('correct-reveal');
      else if (l === sel && !isRight) o.classList.add('wrong-reveal');
    });

    const fbEl = q.querySelector('.eoq-feedback');
    if (fbEl) {
      fbEl.style.display = 'block';
      fbEl.className     = 'eoq-feedback ' + (isRight ? 'correct-fb' : 'wrong-fb');
      const entry        = fb[qNum] || {};
      fbEl.textContent   = (isRight ? '✔ ' : '✖ ') + (isRight ? entry.c : entry.w);
    }
  });

  const btn = document.getElementById('eoq-submit-btn');
  if (btn) btn.disabled = true;

  const pct    = Math.round(score / total * 100);
  const passed = pct >= threshold;
  const result = document.getElementById('eoq-result');
  if (result) {
    result.style.display = 'block';
    result.className     = 'eoq-result ' + (passed ? 'pass' : 'fail');
  }

  const scoreEl = document.getElementById('result-score');
  if (scoreEl) scoreEl.textContent = score + '/' + total;

  const pillEl = document.getElementById('result-pill');
  if (pillEl) pillEl.innerHTML =
    `<span class="result-pill ${passed ? 'pill-pass' : 'pill-fail'}">${pct}% &mdash; ${passed ? 'PASSED' : 'NOT YET'}</span>`;

  const msgEl = document.getElementById('result-msg');
  if (msgEl) msgEl.textContent = passed
    ? 'Good work. You have covered all the content for this week.'
    : 'Review the topics above before moving on.';

  const extraEl = document.getElementById('result-extra');
  if (passed) {
    if (extraEl) extraEl.innerHTML =
      '<div class="unlock-banner" style="margin-top:16px;">✔ Week Complete</div>';
  } else {
    const missed = [];
    document.querySelectorAll('.eoq-question').forEach(q => {
      const qNum = parseInt(q.getAttribute('data-q'));
      if (_eoqAnswers[qNum] !== q.getAttribute('data-ans') && tm[qNum]) missed.push(tm[qNum]);
    });
    if (extraEl) extraEl.innerHTML =
      '<div class="review-nudge" style="margin-top:16px;"><p>Topics to review:</p><ul>' +
      [...new Set(missed)].map(t => '<li>' + t + '</li>').join('') + '</ul></div>';
  }

  if (result) result.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Progress bar ───────────────────────────────
window.addEventListener('scroll', function () {
  const e   = document.documentElement;
  const bar = document.getElementById('progress-bar');
  if (bar) bar.style.width = (e.scrollTop / (e.scrollHeight - e.clientHeight) * 100) + '%';
});
