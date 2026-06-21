// js/lesson-renderer.js
// Converts a lesson JSON object into an HTML string for injection into lesson.html.
//
// Entry point: renderLesson(data) → string
//
// To change how a block type looks:
//   - Find the matching render function (e.g. renderFormula for formula blocks)
//   - Edit the HTML template string inside it
//   - CSS classes are in css/lesson.css

(function (window) {
  // ── ID counter (reset per render call) ───────
  let _seq = 0;
  function uid(prefix) { return prefix + '-' + (++_seq); }
  function resetUid()  { _seq = 0; }

  // ── HTML escape ───────────────────────────────
  function esc(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── Circled numeral (① ② ③ …) ────────────────
  function circled(n) {
    const code = 9311 + n; // ① = U+2460
    return '&#' + code + ';';
  }

  // ═══════════════════════════════════════════
  //  CONTENT BLOCKS
  // ═══════════════════════════════════════════

  function renderParagraph(b) {
    return `<p>${b.html}</p>`;
  }

  function renderOrderedList(b) {
    const items = (b.items || []).map(i => `<li>${i}</li>`).join('');
    return `<ol>${items}</ol>`;
  }

  function renderUnorderedList(b) {
    const items = (b.items || []).map(i => `<li>${i}</li>`).join('');
    return `<ul>${items}</ul>`;
  }

  function renderFormula(b) {
    return `
      <div class="formula-block">
        <span class="formula-label">${esc(b.label)}</span>
        <span class="formula-eq">${b.equation}</span>
        ${b.vars ? `<div class="formula-vars">${b.vars}</div>` : ''}
      </div>`;
  }

  function renderContentBlock(b) {
    switch (b.type) {
      case 'paragraph':       return renderParagraph(b);
      case 'ordered_list':    return renderOrderedList(b);
      case 'unordered_list':  return renderUnorderedList(b);
      case 'formula':         return renderFormula(b);
      default:
        return b.html ? `<p>${b.html}</p>` : '';
    }
  }

  // ═══════════════════════════════════════════
  //  QUESTION BLOCKS
  // ═══════════════════════════════════════════

  function renderMcq(q, prefix) {
    const gid   = uid(prefix + '-mcq');
    const fbId  = gid + '-fb';
    const opts  = (q.options || []).map(o => {
      const correct = o.correct ? 'true' : 'false';
      return `<div class="mc-mcq-opt" onclick="mcMcq(this,'${gid}',${correct},'${fbId}')">
        <span class="mc-ltr">${esc(o.letter)}</span>${o.text}
      </div>`;
    }).join('');
    return `
      <div class="mc-mcq-item">
        <div class="mc-q">${q.question}</div>
        <div class="mc-mcq-opts" id="${gid}">${opts}</div>
        <div class="mc-mcq-fb" id="${fbId}"></div>
      </div>`;
  }

  function renderFitb(q, prefix) {
    const inpId = uid(prefix + '-fitb');
    const fbId  = inpId + '-fb';
    return `
      <div class="mc-fitb-item">
        <div class="mc-q">${q.question}</div>
        <div class="mc-fitb-row">
          <input class="mc-fitb-input" id="${inpId}" placeholder="Your answer…" type="text">
          <button class="mc-fitb-btn" onclick="mcFitb('${inpId}','${fbId}',${JSON.stringify(q.answers || [])})">Check</button>
        </div>
        <div class="mc-fitb-fb" id="${fbId}"></div>
      </div>`;
  }

  function renderReveal(q, prefix) {
    const id = uid(prefix + '-reveal');
    return `
      <div class="mc-reveal-item">
        <div class="mc-q">${q.question}</div>
        <button class="mc-reveal-btn" onclick="mcReveal(this)">Reveal Answer</button>
        <div class="mc-answer" id="${id}">${q.answer}</div>
      </div>`;
  }

  function renderQuestion(q, prefix) {
    switch (q.type) {
      case 'mcq':    return renderMcq(q, prefix);
      case 'fitb':   return renderFitb(q, prefix);
      case 'reveal': return renderReveal(q, prefix);
      default:       return '';
    }
  }

  function renderQuestions(questions, prefix) {
    return (questions || []).map(q => renderQuestion(q, prefix)).join('');
  }

  // ═══════════════════════════════════════════
  //  SUBTOPIC
  // ═══════════════════════════════════════════

  function renderSubtopic(sub, prefix) {
    const content = (sub.content || []).map(renderContentBlock).join('');

    const accordion = `
      <div class="accordion-section-label">Active Recall</div>
      <div class="accordion-wrap">
        <div class="accordion-item">
          <button class="accordion-btn" onclick="toggleAccordion(this)">
            <div class="accordion-btn-inner">
              <div class="accordion-btn-text">
                <span class="q-type">Review</span><br>
                What are the key facts, figures, and definitions from ${esc(sub.title)}?
              </div>
              <div class="accordion-icon">+</div>
            </div>
          </button>
          <div class="accordion-body">
            <div class="answer-inner">
              Review the notes above. Focus on: specific numerical values, definitions,
              classification schemes, and the logic connecting ideas in
              <strong>${esc(sub.title)}</strong>.
            </div>
          </div>
        </div>
      </div>`;

    const miniChecks = (sub.mini_checks && sub.mini_checks.length) ? `
      <div class="mini-check">
        <div class="mini-check-header">
          <span class="mini-check-icon">&#9889;</span>
          <span class="mini-check-title">Quick Check &mdash; ${esc(sub.title)}</span>
          <span class="mini-check-sub">${sub.mini_checks.length} question${sub.mini_checks.length !== 1 ? 's' : ''}</span>
        </div>
        ${renderQuestions(sub.mini_checks, prefix + '-mc')}
      </div>` : '';

    const heading = sub.number || sub.title ? `
      <div class="subtopic-heading">
        ${sub.number ? `<span class="subtopic-num">${esc(sub.number)}</span>` : ''}
        <h3>${esc(sub.title)}</h3>
      </div>` : '';

    return `
      ${heading}
      <div class="topic-card">
        ${content}
        ${accordion}
      </div>
      ${miniChecks}`;
  }

  // ═══════════════════════════════════════════
  //  RECALL CARDS
  // ═══════════════════════════════════════════

  function renderRecallCards(cards, prefix) {
    if (!cards || !cards.length) return '';
    const badgeClass = { DEF: 'badge-def', MECH: 'badge-mech', APP: 'badge-app', COMP: 'badge-comp' };
    const cardsHtml = cards.map(c => {
      const rcId = uid(prefix + '-rc');
      return `
        <div class="recall-card">
          <span class="recall-badge ${badgeClass[c.badge] || 'badge-def'}">${esc(c.badge)}</span>
          <div class="recall-q">${c.question}</div>
          <button class="reveal-btn" onclick="revealAnswer('${rcId}')">Reveal Answer</button>
          <div class="recall-answer" id="${rcId}">${c.answer}</div>
        </div>`;
    }).join('');
    return `<div class="recall-section"><div class="recall-label">Active Recall</div>${cardsHtml}</div>`;
  }

  // ═══════════════════════════════════════════
  //  POST-RECALL CHECKS
  // ═══════════════════════════════════════════

  function renderPostRecallChecks(questions, prefix) {
    if (!questions || !questions.length) return '';
    return `
      <div class="mini-check">
        <div class="mini-check-header">
          <span class="mini-check-icon">&#9889;</span>
          <span class="mini-check-title">Quick Check</span>
          <span class="mini-check-sub">${questions.length} question${questions.length !== 1 ? 's' : ''}</span>
        </div>
        ${renderQuestions(questions, prefix + '-prc')}
      </div>`;
  }

  // ═══════════════════════════════════════════
  //  PULSE CHECK
  // ═══════════════════════════════════════════

  function renderPulseCheck(pc, prefix) {
    if (!pc || !pc.questions || !pc.questions.length) return '';
    const num = pc.number ? circled(pc.number) : '';
    return `
      <div class="pulse-check">
        <div class="pulse-check-header">
          <span class="pulse-icon">&#128161;</span>
          <span class="pulse-title">Pulse Check ${num}</span>
          <span class="pulse-sub">${pc.questions.length} questions &middot; covers full topic</span>
        </div>
        ${renderQuestions(pc.questions, prefix + '-pc')}
      </div>`;
  }

  // ═══════════════════════════════════════════
  //  TOPIC PANEL
  // ═══════════════════════════════════════════

  function renderTopicPanel(topic, idx, allTopics, hasQuiz) {
    const prefix    = 't' + idx;
    const isFirst   = idx === 0;
    const nextIdx   = idx + 1;
    const isLast    = nextIdx >= allTopics.length;
    const nextId    = isLast ? 'tq' : allTopics[nextIdx].id;
    const nextLabel = isLast
      ? 'Take the Quiz'
      : 'Next: ' + esc(allTopics[nextIdx].tab_label || '');
    const nextBtnTarget = isLast ? 'tab-tq' : ('tab-' + (allTopics[nextIdx].id || ''));

    const subtopicsHtml = (topic.subtopics || [])
      .map((s, si) => renderSubtopic(s, prefix + 's' + si))
      .join('');

    const showNextBtn = hasQuiz || !isLast;

    return `
      <div class="tab-panel${isFirst ? ' active' : ''}" id="panel-${esc(topic.id)}">
        <div class="section-label">${esc(topic.section_label || '')}</div>
        <div class="section-title">${esc(topic.section_title)}</div>
        ${subtopicsHtml}
        ${renderRecallCards(topic.recall_cards, prefix)}
        ${renderPostRecallChecks(topic.post_recall_checks, prefix)}
        ${renderPulseCheck(topic.pulse_check, prefix)}
        ${showNextBtn ? `
          <button class="next-topic-btn" onclick="switchTab('${nextId}',document.getElementById('${nextBtnTarget}'))">
            ${nextLabel} <span>&rarr;</span>
          </button>` : ''}
      </div>`;
  }

  // ═══════════════════════════════════════════
  //  QUIZ PANEL
  // ═══════════════════════════════════════════

  function renderQuizPanel(quiz, data) {
    if (!quiz || !quiz.questions || !quiz.questions.length) return '';

    const total     = quiz.questions.length;
    const threshold = quiz.pass_threshold || 60;

    const questionsHtml = quiz.questions.map(q => {
      const opts = (q.options || []).map(o =>
        `<div class="eoq-option" data-letter="${esc(o.letter)}" onclick="eoqSelect(this,${q.num})">
          <span class="eoq-letter">${esc(o.letter)}</span>${o.text}
        </div>`
      ).join('');
      return `
        <div class="eoq-question" data-q="${q.num}" data-type="mcq" data-ans="${esc(q.answer)}">
          <div class="eoq-qnum">EQ${q.num}</div>
          <div class="eoq-q-text">${q.question}</div>
          <div class="eoq-options">${opts}</div>
          <div class="eoq-feedback"></div>
        </div>`;
    }).join('');

    // Serialize feedback + topic map for eoqSubmit() in lesson-interactions.js
    const fb = {}, tm = {};
    quiz.questions.forEach(q => {
      fb[q.num] = { c: q.feedback && q.feedback.correct || '', w: q.feedback && q.feedback.wrong || '' };
      tm[q.num] = q.topic_label || '';
    });

    return `
      <div class="tab-panel" id="panel-tq" style="background:var(--text);border-radius:12px;padding:28px 30px;">
        <div class="eoq-eyebrow">End-of-Week Quiz</div>
        <div class="eoq-title">Week ${esc(String(data.week || ''))} Assessment</div>
        <div class="eoq-sub">${total} questions &middot; ${threshold}% to pass</div>
        ${questionsHtml}
        <button class="eoq-submit-btn" id="eoq-submit-btn" onclick="eoqSubmit()">Submit Quiz</button>
        <div class="eoq-result" id="eoq-result">
          <div class="result-score-big" id="result-score"></div>
          <div id="result-pill"></div>
          <div class="result-msg" id="result-msg"></div>
          <div id="result-extra"></div>
        </div>
      </div>
      <script>
        window._eoqFB = ${JSON.stringify(fb)};
        window._eoqTM = ${JSON.stringify(tm)};
        window._eoqTotal = ${total};
        window._eoqThreshold = ${threshold};
      <\/script>`;
  }

  // ═══════════════════════════════════════════
  //  HERO, TAGS, TAB NAV
  // ═══════════════════════════════════════════

  function renderHero(data) {
    const chips = (data.meta || []).map(m => `<span class="meta-chip">${esc(m)}</span>`).join('');
    const weekOf = data.week_of || data.week || '';
    return `
      <div class="hero">
        <div class="hero-eyebrow">${esc(data.course)} &middot; Week ${esc(String(data.week))} of ${esc(String(weekOf))}</div>
        <div class="hero-title">${esc(data.title)}</div>
        ${data.subtitle ? `<div class="hero-subtitle">${esc(data.subtitle)}</div>` : ''}
        ${data.outcome  ? `<div class="hero-outcome"><strong>By the end of this week</strong>, ${esc(data.outcome)}</div>` : ''}
        ${chips ? `<div class="hero-meta">${chips}</div>` : ''}
      </div>`;
  }

  function renderTagsRow(tags) {
    if (!tags || !tags.length) return '';
    return `<div class="tags-row">${tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>`;
  }

  function renderTabNav(topics, hasQuiz) {
    const topicBtns = topics.map((t, i) =>
      `<button class="tab-btn${i === 0 ? ' active' : ''}" onclick="switchTab('${esc(t.id)}',this)" id="tab-${esc(t.id)}">&#9654; ${esc(t.tab_label || t.section_label || ('Topic ' + (i + 1)))}</button>`
    ).join('');
    const quizBtn = hasQuiz
      ? `<button class="tab-btn" onclick="switchTab('tq',this)" id="tab-tq">&#128220; Quiz</button>`
      : '';
    return `<div class="tab-nav">${topicBtns}${quizBtn}</div>`;
  }

  // ═══════════════════════════════════════════
  //  MAIN ENTRY POINT
  // ═══════════════════════════════════════════

  // renderLesson(data) → HTML string
  // Inject into a container element's innerHTML, then call initLesson() if needed.
  window.renderLesson = function (data) {
    resetUid();
    const hasQuiz = !!(data.quiz && data.quiz.questions && data.quiz.questions.length);
    const topicPanels = (data.topics || []).map((t, i) =>
      renderTopicPanel(t, i, data.topics, hasQuiz)
    ).join('');
    return [
      renderHero(data),
      renderTagsRow(data.tags),
      renderTabNav(data.topics, hasQuiz),
      topicPanels,
      hasQuiz ? renderQuizPanel(data.quiz, data) : '',
    ].join('\n');
  };

}(window));
