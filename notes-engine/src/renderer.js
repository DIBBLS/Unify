/**
 * Unify Note Renderer
 * Converts structured Unify Note JSON into a standalone, pixel-identical HTML document
 * using CSS, JavaScript, and markup structures extracted verbatim from mee352-week2-unify.html.
 */

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Render a content block item into HTML.
 */
function renderContentBlock(item) {
  if (!item || typeof item !== "object") return "";

  switch (item.type) {
    case "paragraph":
      return `<p>${item.text}</p>`;

    case "bullets":
      if (!Array.isArray(item.items)) return "";
      return `<ul>${item.items.map(li => `<li>${li}</li>`).join("")}</ul>`;

    case "symbol":
      return `
    <div class="symbol-card">
      <div class="sym">${item.symbol || ""}</div>
      <div class="sym-body">
        <div class="sym-name">${item.name || ""}</div>
        <div class="sym-desc">${item.desc || ""}</div>
      </div>
    </div>`;

    case "formula":
      return `
    <div class="formula-box">
      <div class="f-label">${item.label || "Formula"}</div>
      <div class="f-eq">${item.equation || ""}</div>
      ${item.note ? `<div class="f-note">${item.note}</div>` : ""}
    </div>`;

    case "insight":
      return `
    <div class="insight-box">
      <div class="i-label">Key Insight</div>
      <p>${item.text || ""}</p>
    </div>`;

    case "analogy":
      return `
    <div class="analogy-box">
      <div class="a-label">Analogy</div>
      <p>${item.text || ""}</p>
    </div>`;

    case "workedExample":
      return `
    <div class="worked-example">
      <div class="we-eyebrow">${item.eyebrow || "Worked Example"}</div>
      <div class="we-title">${item.title || ""}</div>
      ${
        Array.isArray(item.given) && item.given.length > 0
          ? `<div class="we-given">
        <div class="g-label">Given</div>
        <ul>${item.given.map(g => `<li>${g}</li>`).join("")}</ul>
      </div>`
          : ""
      }
      ${
        Array.isArray(item.steps)
          ? item.steps
              .map(
                st => `
        <div class="we-step">
          <div class="we-step-label">${st.label || ""}</div>
          <div class="we-step-title">${st.title || ""}</div>
          ${st.body ? `<div class="we-step-body">${st.body}</div>` : ""}
          ${st.math ? `<div class="we-math">${st.math}</div>` : ""}
        </div>`
              )
              .join("")
          : ""
      }
      ${item.result ? `<div class="we-result">${item.result}</div>` : ""}
    </div>`;

    case "diagram":
      const hasImage = Boolean(item.imageRef);
      return `
    <div class="diagram-wrap">
      <div class="diagram-box" style="border: 2px dashed var(--border); padding: 24px; border-radius: 8px; background: var(--surface);">
        ${
          hasImage
            ? `<img src="${item.imageRef}" alt="${item.caption || "Diagram"}" style="max-width: 100%; height: auto; border-radius: 6px;" />`
            : `<div style="font-weight: 700; color: var(--green-deep); font-size: 14px;">[ DIAGRAM PLACEHOLDER ]</div>`
        }
        <div style="font-size: 13px; font-weight: 600; color: var(--text); margin-top: 8px;">${item.caption || "Figure"}</div>
        ${item.description ? `<div style="font-size: 12px; color: var(--text2); margin-top: 4px;">${item.description}</div>` : ""}
      </div>
      <div class="d-caption">${item.caption || ""}</div>
    </div>`;

    default:
      return "";
  }
}

/**
 * Render a Mini Check item.
 */
function renderMiniCheckItem(q, qIdx, topicNum, subAbbr) {
  const uniqueId = `mc-${topicNum}-${subAbbr}-${qIdx + 1}`;
  const fbId = `${uniqueId}-fb`;

  if (q.type === "mcq") {
    const letters = ["A", "B", "C", "D"];
    const optsHtml = (q.options || [])
      .map((opt, oIdx) => {
        const isCorrect = oIdx === q.correctIndex;
        const letter = letters[oIdx] || String.fromCharCode(65 + oIdx);
        return `
        <div class="mc-mcq-opt" onclick="mcMcq(this,'${uniqueId}',${isCorrect},'${fbId}')">
          <span class="mc-ltr">${letter}</span> ${opt}
        </div>`;
      })
      .join("");

    return `
    <div class="mc-mcq-item">
      <div class="mc-q">${q.question}</div>
      <div class="mc-mcq-opts" id="${uniqueId}">
        ${optsHtml}
      </div>
      <div class="mc-mcq-fb" id="${fbId}"></div>
    </div>`;
  }

  if (q.type === "fitb") {
    const inputId = `${uniqueId}-inp`;
    const acceptedJson = JSON.stringify(q.acceptedAnswers || []).replace(/"/g, "&quot;");

    return `
    <div class="mc-fitb-item">
      <div class="mc-q">${q.question}</div>
      <div class="mc-fitb-row">
        <input class="mc-fitb-input" id="${inputId}" placeholder="Your answer…" type="text">
        <button class="mc-fitb-btn" onclick="mcFitb('${inputId}','${fbId}',${acceptedJson})">Check</button>
      </div>
      <div class="mc-fitb-fb" id="${fbId}"></div>
    </div>`;
  }

  if (q.type === "reveal") {
    return `
    <div class="mc-reveal-item">
      <div class="mc-q">${q.question}</div>
      <button class="mc-reveal-btn" onclick="mcReveal(this)">Reveal Answer</button>
      <div class="mc-answer">${q.answer}</div>
    </div>`;
  }

  return "";
}

/**
 * Render Active Recall Cards
 */
function renderActiveRecall(recallCards) {
  if (!Array.isArray(recallCards) || recallCards.length === 0) return "";

  const badgeClassMap = {
    Definition: "badge-def",
    Mechanism: "badge-mech",
    Comparison: "badge-comp",
    Application: "badge-app",
    Sequence: "badge-mech"
  };

  const cardsHtml = recallCards
    .map(card => {
      const badgeClass = badgeClassMap[card.badge] || "badge-def";
      return `
    <div class="recall-card">
      <span class="recall-badge ${badgeClass}">${card.badge || "Recall"}</span>
      <div class="recall-q">${card.question}</div>
      <button class="reveal-btn" onclick="toggleAnswer(this)">Reveal Answer</button>
      <div class="recall-answer">${card.answer}</div>
    </div>`;
    })
    .join("");

  return `
  <div class="recall-section">
    <div class="recall-label">Topic Active Recall</div>
    ${cardsHtml}
  </div>`;
}

/**
 * Render Pulse Check
 */
function renderPulseCheck(pulseCheck, topicNum, topicAbbr) {
  if (!pulseCheck || !Array.isArray(pulseCheck.questions)) return "";

  const qItems = pulseCheck.questions
    .map((q, idx) => {
      const uniqueId = `pc-${topicNum}-${idx + 1}`;
      const fbId = `${uniqueId}-fb`;

      if (q.type === "mcq") {
        const letters = ["A", "B", "C", "D"];
        const optsHtml = (q.options || [])
          .map((opt, oIdx) => {
            const isCorrect = oIdx === q.correctIndex;
            const letter = letters[oIdx] || String.fromCharCode(65 + oIdx);
            return `
          <div class="mc-mcq-opt" onclick="mcMcq(this,'${uniqueId}',${isCorrect},'${fbId}')">
            <span class="mc-ltr">${letter}</span> ${opt}
          </div>`;
          })
          .join("");

        return `
        <div class="mc-mcq-item">
          <div class="mc-q"><strong>Q${idx + 1}:</strong> ${q.question}</div>
          <div class="mc-mcq-opts" id="${uniqueId}">${optsHtml}</div>
          <div class="mc-mcq-fb" id="${fbId}"></div>
        </div>`;
      } else {
        const inputId = `${uniqueId}-inp`;
        const acceptedJson = JSON.stringify(q.acceptedAnswers || []).replace(/"/g, "&quot;");
        return `
        <div class="mc-fitb-item">
          <div class="mc-q"><strong>Q${idx + 1}:</strong> ${q.question}</div>
          <div class="mc-fitb-row">
            <input class="mc-fitb-input" id="${inputId}" placeholder="Your answer…" type="text">
            <button class="mc-fitb-btn" onclick="mcFitb('${inputId}','${fbId}',${acceptedJson})">Check</button>
          </div>
          <div class="mc-fitb-fb" id="${fbId}"></div>
        </div>`;
      }
    })
    .join("");

  return `
  <div class="mini-check" style="margin-top: 32px; background: var(--surface); border-left: 3px solid var(--green-deep);">
    <div class="mini-check-header">
      <span style="font-size: 14px">🎯</span>
      <span class="mini-check-title">Pulse Check 0${pulseCheck.number || topicNum}</span>
      <span class="mini-check-sub">3 questions</span>
    </div>
    ${qItems}
  </div>`;
}

/**
 * Main Renderer Function
 * @param {object} note Note JSON matching Unify Schema
 * @returns {string} Full HTML document string
 */
function renderUnifyNote(note) {
  const course = note.course || "COURSE";
  const week = note.week || 1;
  const title = note.title || "Lecture Note";
  const subtitle = note.subtitle || "";
  const learningOutcome = note.learningOutcome || "";
  const metaChips = note.metaChips || [course, `Week ${week}`];
  const topics = note.topics || [];
  const eoq = note.eoq || { questions: [] };

  // Tab Buttons
  const tabBtns = topics
    .map((t, idx) => {
      const activeClass = idx === 0 ? "active" : "";
      return `<button class="tab-btn ${activeClass}" onclick="switchTab('t${t.number}',this)" id="tab-t${t.number}">▶ Topic ${t.number}: ${t.title.split("—")[0].trim()}</button>`;
    })
    .join("\n  ");

  // Topic Panels
  const topicPanels = topics
    .map((topic, tIdx) => {
      const activeClass = tIdx === 0 ? "active" : "";
      const panelId = `panel-t${topic.number}`;
      const nextTabId = tIdx < topics.length - 1 ? `t${topics[tIdx + 1].number}` : "q";
      const nextBtnText = tIdx < topics.length - 1 ? `Next: Topic ${topics[tIdx + 1].number} <span>→</span>` : "Take the Quiz <span>→</span>";

      const subtopicsHtml = (topic.subtopics || [])
        .map(sub => {
          const contentHtml = (sub.content || []).map(renderContentBlock).join("\n    ");
          const mcQuestions = (sub.miniCheck && sub.miniCheck.questions) || [];
          const miniCheckHtml = mcQuestions
            .map((q, qIdx) => renderMiniCheckItem(q, qIdx, topic.number, sub.abbr))
            .join("\n");

          return `
  <div class="subtopic-heading"><span class="subtopic-num">${sub.number}</span><h3>${sub.title}</h3></div>
  <div class="topic-card">
    ${contentHtml}
  </div>

  <div class="mini-check">
    <div class="mini-check-header">
      <span style="font-size:14px">⚡</span>
      <span class="mini-check-title">Quick Check — ${sub.title}</span>
      <span class="mini-check-sub">${mcQuestions.length} question(s)</span>
    </div>
    ${miniCheckHtml}
  </div>`;
        })
        .join("\n");

      const activeRecallHtml = renderActiveRecall(topic.activeRecall);
      const pulseCheckHtml = renderPulseCheck(topic.pulseCheck, topic.number, topic.abbr);

      return `
<!-- ═══ TAB ${topic.number}: ${topic.title.toUpperCase()} ═══ -->
<div class="tab-panel ${activeClass}" id="${panelId}">
  <div class="section-label">Topic ${topic.number}</div>
  <div class="section-title">${topic.title}</div>

  ${subtopicsHtml}
  ${activeRecallHtml}
  ${pulseCheckHtml}

  <button class="next-topic-btn" onclick="switchTab('${nextTabId}',document.getElementById('tab-${nextTabId}'))">${nextBtnText}</button>
</div>`;
    })
    .join("\n\n");

  // EOQ Questions HTML & JS Feedback map
  const eoqFBObj = {};

  const eoqQuestionsHtml = (eoq.questions || [])
    .map((q, idx) => {
      const qNum = q.number || idx + 1;

      // Store feedback
      eoqFBObj[qNum] = {
        c: (q.feedback && (q.feedback.correct || q.feedback.c)) || "Correct!",
        w: (q.feedback && (q.feedback.wrong || q.feedback.w)) || "Incorrect."
      };

      if (q.type === "mcq") {
        const letters = ["A", "B", "C", "D"];
        const optsHtml = (q.options || [])
          .map((opt, oIdx) => {
            const letter = letters[oIdx] || String.fromCharCode(65 + oIdx);
            return `
      <div class="eoq-option" onclick="eoqSelect(this,${qNum},'${letter}')"><span class="eoq-letter">${letter}</span> ${opt}</div>`;
          })
          .join("");

        return `
  <div class="eoq-question" data-q="${qNum}" data-type="mcq" data-correct="${q.correct || 'A'}">
    <div class="eoq-qnum">Question ${qNum}</div>
    <div class="eoq-q-text">${q.question}</div>
    <div class="eoq-options">
      ${optsHtml}
    </div>
    <div class="eoq-feedback" id="eoq-fb-${qNum}"></div>
  </div>`;
      } else {
        const correctAnswers = Array.isArray(q.acceptedAnswers)
          ? q.acceptedAnswers.join(",")
          : q.correct || "";

        return `
  <div class="eoq-question" data-q="${qNum}" data-type="fitb" data-correct="${correctAnswers}">
    <div class="eoq-qnum">Question ${qNum}</div>
    <div class="eoq-q-text">${q.question}</div>
    <div class="eoq-fitb-row"><input type="text" id="eoq-input-${qNum}" placeholder="Type your answer…"></div>
    <div class="eoq-feedback" id="eoq-fb-${qNum}"></div>
  </div>`;
      }
    })
    .join("\n\n");

  // Topic Review Map for Quiz Failures
  const topicMapObj = {};
  (eoq.questions || []).forEach((q, idx) => {
    const qNum = q.number || idx + 1;
    topicMapObj[qNum] = q.topicRef || `Topic ${((idx % topics.length) + 1)}`;
  });

  return `<!DOCTYPE html>
<html lang="en" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${course} &mdash; Week ${week} | Unify Learn</title>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,700;0,900;1,400;1,700&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet">
<script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
<style>
:root{--bg:#f5f4f0;--surface:#fff;--surface2:#f8f7f3;--border:#e0deda;--text:#0a0a0a;--text2:#555;--text3:#999;--green:#4ade80;--green-deep:#16a34a;--green-bg:rgba(74,222,128,0.1);--fd:'Playfair Display',serif;--fb:'DM Sans',sans-serif;--radius:12px;--shadow:0 2px 12px rgba(0,0,0,.06);}
[data-theme="dark"]{--bg:#0f0f0f;--surface:#1a1a1a;--surface2:#222;--border:#2a2a2a;--text:#f0efeb;--text2:#aaa;--text3:#666;}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}html{scroll-behavior:smooth;}
body{font-family:var(--fb);background:var(--bg);color:var(--text);font-size:15px;line-height:1.7;transition:background .3s,color .3s;}
#progress-bar{position:fixed;top:0;left:0;height:3px;background:var(--green);width:0%;z-index:1000;transition:width .2s;}
.topbar{position:fixed;top:3px;left:0;right:0;height:52px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:0 20px;z-index:999;}
.topbar-wordmark{font-family:var(--fd);font-weight:900;font-size:18px;color:var(--text);letter-spacing:-.5px;}.topbar-wordmark span{color:var(--green);}
.topbar-right{display:flex;align-items:center;gap:12px;}
.course-pill{font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;border-radius:20px;background:var(--surface2);border:1px solid var(--border);color:var(--text3);}
#dark-toggle{width:36px;height:36px;border-radius:50%;border:1px solid var(--border);background:var(--surface);color:var(--text);cursor:pointer;font-size:15px;}
.wrapper{max-width:780px;margin:0 auto;padding:88px 20px 100px;}

/* HERO */
.hero{background:#0a0a0a;color:#f5f4f0;border-radius:var(--radius);padding:36px;margin-bottom:28px;position:relative;overflow:hidden;}
.hero::before{content:'';position:absolute;top:-40px;right:-40px;width:200px;height:200px;border-radius:50%;background:rgba(74,222,128,.07);pointer-events:none;}
.hero-eyebrow{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#4ade80;margin-bottom:10px;}
.hero-title{font-family:var(--fd);font-size:30px;font-weight:900;letter-spacing:-1px;line-height:1.15;color:#f5f4f0;margin-bottom:8px;}
.hero-subtitle{font-family:var(--fd);font-size:16px;font-style:italic;color:rgba(245,244,240,.65);margin-bottom:20px;}
.hero-outcome{background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.25);border-radius:8px;padding:12px 16px;font-size:13px;color:rgba(245,244,240,.9);line-height:1.6;margin-bottom:20px;}
.hero-outcome strong{color:#4ade80;}
.hero-meta{display:flex;flex-wrap:wrap;gap:8px;}
.meta-chip{font-size:11px;font-weight:500;padding:4px 12px;border-radius:20px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.12);color:rgba(245,244,240,.7);}

/* TAB NAV */
.tab-nav{display:flex;gap:4px;background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:4px;margin-bottom:28px;flex-wrap:wrap;}
.tab-btn{flex:1;min-width:120px;font-family:var(--fb);font-size:12px;font-weight:600;padding:9px 14px;border-radius:7px;border:none;background:transparent;color:var(--text3);cursor:pointer;transition:all .2s;white-space:nowrap;}
.tab-btn:hover{background:var(--surface);color:var(--text2);}
.tab-btn.active{background:var(--text);color:var(--bg);}
.tab-btn.done{background:var(--green-bg);color:var(--green-deep);}
.tab-panel{display:none;}.tab-panel.active{display:block;}

/* SECTION */
.section-label{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--green-deep);margin-bottom:6px;}
.section-title{font-family:var(--fd);font-size:22px;font-weight:700;letter-spacing:-.5px;color:var(--text);margin-bottom:20px;line-height:1.25;}
.subtopic-heading{display:flex;align-items:center;gap:10px;margin:28px 0 12px;}
.subtopic-heading h3{font-family:var(--fd);font-size:17px;font-weight:700;color:var(--text);letter-spacing:-.3px;}
.subtopic-num{font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;background:var(--green-bg);border:1px solid rgba(74,222,128,.3);color:var(--green-deep);letter-spacing:1px;text-transform:uppercase;white-space:nowrap;}

/* CARDS */
.topic-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:22px 26px;box-shadow:var(--shadow);margin-bottom:20px;}
.topic-card p{max-width:66ch;color:var(--text2);font-size:14px;line-height:1.8;margin-bottom:12px;}
.topic-card ul,.topic-card ol{max-width:66ch;padding-left:20px;color:var(--text2);font-size:14px;line-height:1.8;margin-bottom:12px;}
.topic-card li{margin-bottom:6px;}.topic-card strong{color:var(--text);}

/* SYMBOL CARD */
.symbol-card{display:flex;align-items:flex-start;gap:12px;background:var(--surface2);border:1px solid var(--border);border-left:3px solid var(--green);border-radius:0 8px 8px 0;padding:11px 15px;margin:10px 0 16px;max-width:66ch;}
.symbol-card .sym{font-family:Georgia,serif;font-size:17px;font-weight:700;color:var(--green-deep);min-width:30px;margin-top:2px;}
.symbol-card .sym-name{font-size:12px;font-weight:600;color:var(--text);margin-bottom:3px;}
.symbol-card .sym-desc{font-size:12px;color:var(--text2);line-height:1.6;}

/* FORMULA BOX */
.formula-box{background:var(--surface2);border:1px solid var(--border);border-left:3px solid var(--green);border-radius:0 10px 10px 0;padding:18px 22px;margin:14px 0;overflow-x:auto;}
.formula-box .f-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--green-deep);margin-bottom:10px;}
.formula-box .f-eq{font-size:15px;color:var(--text);line-height:2.4;}
.formula-box .f-note{font-size:12px;color:var(--text2);margin-top:10px;line-height:1.7;border-top:1px solid var(--border);padding-top:10px;}

/* INSIGHT / ANALOGY */
.insight-box{background:rgba(74,222,128,.07);border:1px solid rgba(74,222,128,.2);border-radius:10px;padding:14px 18px;margin:14px 0;}
.insight-box .i-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--green-deep);margin-bottom:8px;}
.insight-box p{font-size:13px;color:var(--text2);line-height:1.7;max-width:66ch;margin:0;}
.analogy-box{background:var(--surface2);border:1px dashed var(--border);border-radius:10px;padding:14px 18px;margin:14px 0;}
.analogy-box .a-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--text3);margin-bottom:8px;}
.analogy-box p{font-size:13px;color:var(--text2);line-height:1.7;max-width:66ch;margin:0;font-style:italic;}

/* WORKED EXAMPLE */
.worked-example{background:var(--text);border-radius:var(--radius);padding:26px 30px;margin:28px 0;}
.we-eyebrow{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--green);margin-bottom:6px;}
.we-title{font-family:var(--fd);font-size:19px;font-weight:900;color:#f5f4f0;margin-bottom:14px;letter-spacing:-.5px;}
.we-given{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:8px;padding:12px 16px;margin-bottom:18px;}
.we-given .g-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:rgba(240,239,235,.5);margin-bottom:8px;}
.we-given ul{padding-left:18px;color:rgba(240,239,235,.8);font-size:13px;line-height:1.9;}
.we-given li{margin-bottom:3px;}
.we-step{margin-bottom:18px;}
.we-step-label{font-size:10px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:var(--green);margin-bottom:5px;}
.we-step-title{font-size:13px;font-weight:600;color:#f0efeb;margin-bottom:7px;}
.we-step-body{font-size:13px;color:rgba(240,239,235,.7);line-height:1.8;margin-bottom:7px;max-width:66ch;}
.we-math{background:rgba(255,255,255,.06);border-left:2px solid var(--green);border-radius:0 6px 6px 0;padding:10px 16px;margin:7px 0;color:#f0efeb;overflow-x:auto;line-height:2.4;}
.we-result{background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.25);border-radius:8px;padding:10px 16px;font-size:13px;font-weight:500;color:#4ade80;margin-top:10px;line-height:1.6;}

/* MINI CHECK */
.mini-check{background:var(--surface2);border:1px solid var(--border);border-left:3px solid var(--green);border-radius:0 var(--radius) var(--radius) 0;padding:18px 22px;margin:0 0 20px 0;}
.mini-check-header{display:flex;align-items:center;gap:8px;margin-bottom:12px;}
.mini-check-title{font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--green-deep);}
.mini-check-sub{font-size:11px;color:var(--text3);margin-left:auto;}
.mc-q{font-size:13px;font-weight:500;color:var(--text);margin-bottom:8px;max-width:66ch;line-height:1.6;}
.mc-reveal-btn{font-size:10px;font-weight:600;padding:5px 14px;border-radius:6px;border:1px solid var(--border);background:var(--surface);color:var(--text2);cursor:pointer;}
.mc-reveal-btn:hover{background:var(--green-bg);color:var(--green-deep);}
.mc-answer{display:none;margin-top:8px;padding:10px 14px;background:var(--surface);border-left:2px solid var(--green);border-radius:0 6px 6px 0;font-size:12px;color:var(--text2);line-height:1.7;max-width:66ch;}
.mc-answer.show{display:block;}
.mc-mcq-item{margin-bottom:14px;}
.mc-mcq-opts{display:flex;flex-direction:column;gap:5px;margin-top:8px;max-width:56ch;}
.mc-mcq-opt{display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;padding:7px 12px;border-radius:7px;background:var(--surface);border:1px solid var(--border);color:var(--text2);transition:all .15s;user-select:none;}
.mc-mcq-opt:hover:not(.mc-locked){background:var(--green-bg);}
.mc-mcq-opt.mc-correct{background:var(--green-bg);border-color:rgba(74,222,128,.4);color:var(--green-deep);font-weight:600;}
.mc-mcq-opt.mc-wrong{background:rgba(239,68,68,.07);border-color:rgba(239,68,68,.3);color:#b91c1c;}
.mc-ltr{font-weight:700;font-size:10px;width:20px;height:20px;border-radius:50%;background:var(--surface2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.mc-mcq-fb{display:none;margin-top:7px;font-size:11px;font-weight:600;}
.mc-fitb-row{display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap;}
.mc-fitb-input{font-size:12px;padding:7px 12px;border-radius:7px;border:1px solid var(--border);background:var(--surface);color:var(--text);outline:none;width:200px;}
.mc-fitb-input:focus{border-color:var(--green);}
.mc-fitb-btn{font-size:10px;font-weight:700;padding:7px 14px;border-radius:7px;border:none;background:var(--text);color:var(--bg);cursor:pointer;}
.mc-fitb-fb{display:none;margin-top:7px;font-size:11px;font-weight:600;}

/* RECALL */
.recall-section{margin-top:22px;}
.recall-label{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--green-deep);margin-bottom:12px;display:flex;align-items:center;gap:8px;}
.recall-label::after{content:'';flex:1;height:1px;background:var(--border);}
.recall-card{background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:10px;}
.recall-badge{display:inline-block;font-size:9px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;padding:3px 9px;border-radius:20px;margin-bottom:10px;}
.badge-def{background:rgba(74,222,128,.15);color:var(--green-deep);border:1px solid rgba(74,222,128,.3);}
.badge-mech{background:rgba(251,191,36,.15);color:#b45309;border:1px solid rgba(251,191,36,.3);}
.badge-app{background:rgba(59,130,246,.1);color:#1d4ed8;border:1px solid rgba(59,130,246,.2);}
.badge-comp{background:rgba(139,92,246,.1);color:#6d28d9;border:1px solid rgba(139,92,246,.2);}
.recall-q{font-size:14px;font-weight:500;color:var(--text);max-width:66ch;line-height:1.6;margin-bottom:12px;}
.reveal-btn{font-size:11px;font-weight:600;padding:6px 16px;border-radius:6px;border:1px solid var(--border);background:var(--surface2);color:var(--text2);cursor:pointer;}
.reveal-btn:hover{background:var(--green-bg);color:var(--green-deep);}
.recall-answer{display:none;margin-top:12px;padding:12px 16px;background:var(--surface2);border-left:3px solid var(--green);border-radius:0 8px 8px 0;font-size:13px;color:var(--text2);line-height:1.7;max-width:66ch;}
.recall-answer.show{display:block;}

/* NEXT TOPIC BTN */
.next-topic-btn{display:inline-flex;align-items:center;gap:8px;margin-top:28px;font-size:13px;font-weight:600;padding:12px 24px;border-radius:8px;border:none;background:var(--text);color:var(--bg);cursor:pointer;transition:opacity .2s;}
.next-topic-btn:hover{opacity:.85;}
.next-topic-btn span{font-size:16px;}

/* DIAGRAM */
.diagram-wrap{background:var(--surface2);border:1px solid var(--border);border-radius:12px;padding:18px;margin:16px 0;text-align:center;}
.diagram-wrap .d-caption{font-size:11px;color:var(--text3);margin-top:10px;font-style:italic;}

/* EOQ */
.eoq-eyebrow{font-size:10px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:var(--green);margin-bottom:6px;}
.eoq-title{font-family:var(--fd);font-size:24px;font-weight:900;color:#f5f4f0;margin-bottom:4px;letter-spacing:-.5px;}
.eoq-sub{font-size:12px;color:rgba(240,239,235,.5);margin-bottom:24px;}
.eoq-question{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.08);border-radius:10px;padding:16px 18px;margin-bottom:14px;}
.eoq-qnum{font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:rgba(240,239,235,.4);margin-bottom:6px;}
.eoq-q-text{font-size:14px;font-weight:500;color:#f0efeb;max-width:66ch;line-height:1.6;margin-bottom:12px;}
.eoq-options{display:flex;flex-direction:column;gap:6px;}
.eoq-option{display:flex;align-items:center;gap:10px;font-size:13px;cursor:pointer;padding:9px 13px;border-radius:8px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);color:rgba(240,239,235,.8);transition:all .15s;max-width:66ch;user-select:none;}
.eoq-option:hover:not(.locked){background:rgba(255,255,255,.1);}
.eoq-option.selected{border-color:var(--green);background:rgba(74,222,128,.1);}
.eoq-option.correct-reveal{border-color:var(--green);background:rgba(74,222,128,.15);color:#f0efeb;}
.eoq-option.wrong-reveal{border-color:rgba(239,68,68,.5);background:rgba(239,68,68,.1);}
.eoq-option.locked{cursor:default;}
.eoq-letter{font-weight:700;font-size:11px;width:22px;height:22px;border-radius:50%;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.eoq-fitb-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;}
.eoq-fitb-row input{font-size:13px;padding:8px 13px;border-radius:7px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.08);color:#f0efeb;outline:none;width:200px;}
.eoq-fitb-row input:focus{border-color:var(--green);}
.eoq-fitb-row input.correct-input{border-color:var(--green);background:rgba(74,222,128,.1);}
.eoq-fitb-row input.wrong-input{border-color:rgba(239,68,68,.4);background:rgba(239,68,68,.08);}
.eoq-feedback{display:none;margin-top:8px;font-size:12px;font-weight:500;padding:6px 10px;border-radius:6px;}
.correct-fb{background:rgba(74,222,128,.1);color:#4ade80;}
.wrong-fb{background:rgba(239,68,68,.1);color:#f87171;}
.eoq-submit-btn{margin-top:8px;font-size:12px;font-weight:700;padding:12px 28px;border-radius:8px;border:none;background:var(--green);color:#0a0a0a;cursor:pointer;}
.eoq-submit-btn:disabled{opacity:.4;cursor:default;}
.eoq-result{display:none;margin-top:24px;padding:22px;border-radius:10px;}
.eoq-result.pass{background:rgba(74,222,128,.1);border:1px solid rgba(74,222,128,.25);}
.eoq-result.fail{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);}
.result-score-big{font-family:var(--fd);font-size:40px;font-weight:900;color:#f5f4f0;line-height:1;margin-bottom:4px;}
.result-pill{display:inline-block;font-size:10px;font-weight:700;letter-spacing:1.5px;padding:3px 10px;border-radius:20px;margin-bottom:12px;}
.pill-pass{background:rgba(74,222,128,.2);color:#4ade80;border:1px solid rgba(74,222,128,.3);}
.pill-fail{background:rgba(239,68,68,.15);color:#f87171;border:1px solid rgba(239,68,68,.25);}
.result-msg{font-size:13px;color:rgba(240,239,235,.7);line-height:1.6;margin-bottom:16px;}
.unlock-banner{background:rgba(74,222,128,.12);border:1px solid rgba(74,222,128,.25);border-radius:8px;padding:12px 16px;font-size:13px;font-weight:600;color:#4ade80;}
.review-nudge{background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:12px 16px;font-size:13px;color:rgba(240,239,235,.7);}
.review-nudge p{font-weight:600;color:#f87171;margin-bottom:8px;}
.review-nudge ul{padding-left:18px;}.review-nudge li{margin-bottom:4px;}
</style>
</head>
<body>
<div id="progress-bar"></div>
<div class="topbar">
  <div class="topbar-wordmark">Unify<span>.</span></div>
  <div class="topbar-right"><span class="course-pill">${course}</span><button id="dark-toggle" onclick="toggleDark()">&#9790;</button></div>
</div>
<div class="wrapper">

<div class="hero">
  <div class="hero-eyebrow">${course} &middot; Week ${week}</div>
  <div class="hero-title">${title}</div>
  <div class="hero-subtitle">${subtitle}</div>
  <div class="hero-outcome"><strong>By the end of this week</strong>, ${learningOutcome}</div>
  <div class="hero-meta">
    ${metaChips.map(c => `<span class="meta-chip">${c}</span>`).join("\n    ")}
  </div>
</div>

<!-- TAB NAV -->
<div class="tab-nav">
  ${tabBtns}
  <button class="tab-btn" onclick="switchTab('tq',this)" id="tab-tq">&#128220; Quiz</button>
</div>

${topicPanels}

<!-- ═══ TAB QUIZ ═══ -->
<div class="tab-panel" id="panel-tq" style="background:var(--text);border-radius:var(--radius);padding:28px 30px;">
  <div class="eoq-eyebrow">End-of-Week Quiz</div>
  <div class="eoq-title">Week ${week} Assessment</div>
  <div class="eoq-sub">${(eoq.questions || []).length} questions &middot; 60% to pass &middot; ${title}</div>

  ${eoqQuestionsHtml}

  <button class="eoq-submit-btn" id="eoq-submit-btn" onclick="eoqSubmit()">Submit Quiz</button>
  <div class="eoq-result" id="eoq-result">
    <div class="result-score-big" id="result-score"></div>
    <div id="result-pill"></div>
    <div class="result-msg" id="result-msg"></div>
    <div id="result-extra"></div>
  </div>
</div>

</div><!-- wrapper -->

<script>
function toggleDark(){const h=document.documentElement,b=document.getElementById('dark-toggle');h.getAttribute('data-theme')==='dark'?(h.setAttribute('data-theme','light'),b.textContent='&#9790;'):(h.setAttribute('data-theme','dark'),b.textContent='&#9728;');}
function switchTab(id,btn){document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));document.querySelectorAll('.tab-btn').forEach(b=>{b.classList.remove('active');});document.getElementById('panel-'+id).classList.add('active');if(btn)btn.classList.add('active');window.scrollTo({top:0,behavior:'smooth'});document.getElementById('progress-bar').style.width='0%';if(window.MathJax && window.MathJax.typesetPromise){window.MathJax.typesetPromise();}}
window.addEventListener('scroll',()=>{const e=document.documentElement;document.getElementById('progress-bar').style.width=(e.scrollTop/(e.scrollHeight-e.clientHeight)*100)+'%';});
function toggleAnswer(btn){const a=btn.nextElementSibling,s=a.classList.contains('show');a.classList.toggle('show',!s);btn.textContent=s?'Reveal Answer':'Hide Answer';}
function mcReveal(btn){const a=btn.nextElementSibling,s=a.classList.contains('show');a.classList.toggle('show',!s);btn.textContent=s?'Reveal Answer':'Hide Answer';}
function mcMcq(el,gid,correct,fbId){const opts=document.getElementById(gid).querySelectorAll('.mc-mcq-opt');if([...opts].some(o=>o.classList.contains('mc-correct')||o.classList.contains('mc-wrong')))return;opts.forEach(o=>o.classList.add('mc-locked'));el.classList.add(correct?'mc-correct':'mc-wrong');if(!correct)opts.forEach(o=>{if((o.getAttribute('onclick')||'').includes(',true,'))o.classList.add('mc-correct');});const fb=document.getElementById(fbId);fb.style.display='block';fb.textContent=correct?'&#10003; Correct!':'&#10007; Not quite &#8212; correct answer highlighted.';fb.style.color=correct?'#166534':'#991b1b';}
function mcFitb(inpId,fbId,acceptedArr){const input=document.getElementById(inpId);const val=input?input.value.trim().toLowerCase():'';const fb=document.getElementById(fbId);const isC=(acceptedArr||[]).some(a=>val===String(a).trim().toLowerCase());fb.style.display='block';if(isC){fb.textContent='&#10003; Correct!';fb.style.color='#166534';input.style.borderColor='var(--green)';}else{fb.textContent='&#10007; Not quite. Accepted answers: '+(acceptedArr||[]).join(' OR ');fb.style.color='#991b1b';input.style.borderColor='#ef4444';}}

const eoqAnswers={};const totalQ=${(eoq.questions || []).length};
const eoqFB=${JSON.stringify(eoqFBObj, null, 2)};
const topicMap=${JSON.stringify(topicMapObj, null, 2)};

function eoqSelect(el,qNum,choice){if(!el.closest('.eoq-question').querySelectorAll('.eoq-option.locked').length){el.closest('.eoq-question').querySelectorAll('.eoq-option').forEach(o=>o.classList.remove('selected'));el.classList.add('selected');eoqAnswers[qNum]=choice;}}
function eoqSubmit(){let score=0;document.querySelectorAll('.eoq-question').forEach(q=>{const qNum=parseInt(q.getAttribute('data-q')),type=q.getAttribute('data-type'),correct=q.getAttribute('data-correct'),fb=document.getElementById('eoq-fb-'+qNum);if(type==='mcq'){const sel=eoqAnswers[qNum],isC=sel===correct;if(isC)score++;q.querySelectorAll('.eoq-option').forEach(o=>{o.classList.add('locked');const l=o.querySelector('.eoq-letter').textContent.trim();if(l===correct)o.classList.add('correct-reveal');else if(l===sel&&!isC)o.classList.add('wrong-reveal');});fb.style.display='block';fb.className='eoq-feedback '+(isC?'correct-fb':'wrong-fb');fb.textContent=(isC?'&#10003; '+(eoqFB[qNum]?eoqFB[qNum].c:'Correct!'):'&#10007; '+(eoqFB[qNum]?eoqFB[qNum].w:'Incorrect.'));}else{const input=document.getElementById('eoq-input-'+qNum),val=input?input.value.trim().toLowerCase():'',isC=correct.split(',').some(a=>val===a.trim().toLowerCase());if(isC)score++;if(input){input.disabled=true;input.classList.add(isC?'correct-input':'wrong-input');}fb.style.display='block';fb.className='eoq-feedback '+(isC?'correct-fb':'wrong-fb');fb.textContent=(isC?'&#10003; '+(eoqFB[qNum]?eoqFB[qNum].c:'Correct!'):'&#10007; '+(eoqFB[qNum]?eoqFB[qNum].w:'Incorrect.'));}});
document.getElementById('eoq-submit-btn').disabled=true;
const pct=Math.round(score/totalQ*100),passed=pct>=60,result=document.getElementById('eoq-result');
result.style.display='block';result.className='eoq-result '+(passed?'pass':'fail');
document.getElementById('result-score').textContent=score+'/'+totalQ;
document.getElementById('result-pill').innerHTML='<span class="result-pill '+(passed?'pill-pass':'pill-fail')+'">'+pct+'% &#8212; '+(passed?'PASSED':'NOT YET')+'</span>';
document.getElementById('result-msg').textContent=passed?'Good work! You have passed the assessment for this week.':'Review the topics above before retrying.';
const extra=document.getElementById('result-extra');
if(passed){extra.innerHTML='<div class="unlock-banner" style="margin-top:16px;">&#10003; Week ${week + 1} unlocked</div>';}
else{const missed=[];
document.querySelectorAll('.eoq-question').forEach(q=>{const qNum=parseInt(q.getAttribute('data-q')),type=q.getAttribute('data-type'),correct=q.getAttribute('data-correct');let isC=false;if(type==='mcq')isC=eoqAnswers[qNum]===correct;else{const input=document.getElementById('eoq-input-'+qNum),val=input?input.value.trim().toLowerCase():'';isC=correct.split(',').some(a=>val===a.trim().toLowerCase());}if(!isC&&topicMap[qNum])missed.push(topicMap[qNum]);});
extra.innerHTML='<div class="review-nudge" style="margin-top:16px;"><p>Topics to review:</p><ul>'+[...new Set(missed)].map(t=>'<li>'+t+'</li>').join('')+'</ul></div>';}
result.scrollIntoView({behavior:'smooth',block:'start'});}
</script>
</body>
</html>`;
}

module.exports = {
  renderUnifyNote
};
