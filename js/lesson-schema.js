/**
 * js/lesson-schema.js
 *
 * Lesson data schema v2.0 for Unify Learn.
 *
 * Data flow: lesson-parser-prompt.js → AI → JSON → validateLesson() → lesson-renderer.js
 * Firestore: collection "lessons", doc ID "{COURSE_CODE}_W{weekNumber}"  e.g. "MEE352_W1"
 *
 * Breaking changes from v1.x → v2.0
 *   course      → courseCode
 *   week_of     → totalWeeks  (number, not a date string)
 *   outcome     → learningOutcome
 *   content[].html      → content[].text       (paragraph blocks)
 *   content[].equation  → content[].latex      (formula blocks)
 *   options[].correct   removed — correct answer is q.answer (letter) at question level
 *   quiz questions gain: conceptTested, bloomLevel, difficulty
 */

window.LESSON_SCHEMA_VERSION = '2.0';

/** Content block types emitted by the parser. */
window.LESSON_CONTENT_TYPES  = ['paragraph', 'ordered_list', 'unordered_list', 'formula'];

/** Question types used in mini_checks, pulse_check, and quiz. */
window.LESSON_QUESTION_TYPES = ['mcq', 'fitb', 'reveal'];

/** Recall-card badge types. */
window.LESSON_BADGE_TYPES    = ['DEF', 'MECH', 'APP', 'COMP'];

/**
 * Validate a parsed lesson object against the v2.0 schema.
 *
 * @param  {object} data - Raw lesson object (AI output or Firestore doc)
 * @returns {{ valid: boolean, errors: string[] }}
 *
 * Schema reference:
 *
 * LessonData {
 *   courseCode:      string          — "MEE 352"
 *   week:            number          — 1-based week index
 *   totalWeeks:      number          — total weeks in the course
 *   title:           string          — week title
 *   subtitle?:       string          — italic subtitle shown under title
 *   learningOutcome: string          — "By the end of this week, you should…"
 *   meta?:           LessonMeta      — hero chip data
 *   tags:            string[]        — keyword tags below the tab nav
 *   topics:          LessonTopic[]   — one entry per tab (non-empty)
 *   quiz:            LessonQuiz
 * }
 *
 * LessonMeta {
 *   courseName?:  string   — "Energy Conservation & Dissipation"
 *   faculty?:     string   — "Faculty of Engineering"
 *   university?:  string   — "LASU"
 * }
 *
 * LessonTopic {
 *   id:             string          — "t1", "t2", … (unique within lesson)
 *   tab_label:      string          — tab button text e.g. "Topic 1: Solar Radiation"
 *   section_label?: string          — small caps label above title e.g. "Topic 1"
 *   section_title:  string          — h2-level topic title
 *   subtopics:      LessonSubtopic[]
 *   recall_cards?:  RecallCard[]
 *   post_recall_checks?: Question[] — optional checks after recall section
 *   pulse_check?:   PulseCheck
 * }
 *
 * LessonSubtopic {
 *   number:      string     — "1.1", "1.2", …
 *   title:       string     — subtopic heading
 *   content:     ContentBlock[]
 *   mini_checks?: Question[]
 * }
 *
 * ContentBlock — one of:
 *   { type: 'paragraph',     text: string }            — inline HTML allowed
 *   { type: 'ordered_list',  items: string[] }         — inline HTML in items
 *   { type: 'unordered_list', items: string[] }
 *   { type: 'formula',       label?: string, latex: string, notes?: string }
 *     latex  — LaTeX math string (no surrounding \[ \], renderer adds delimiters)
 *     notes  — optional explanation below the formula; inline HTML allowed
 *
 * Question — one of:
 *   { type: 'mcq',    question: string, options: Option[], answer: string }
 *     answer — letter of the correct option e.g. "B"
 *   { type: 'fitb',   question: string, answers: string[] }
 *     answers — all accepted values (case-insensitive matching)
 *   { type: 'reveal', question: string, answer: string }
 *     answer — inline HTML shown when revealed
 *
 * Option { letter: string, text: string }
 *
 * RecallCard {
 *   badge:    'DEF' | 'MECH' | 'APP' | 'COMP'
 *   question: string
 *   answer:   string   — inline HTML allowed
 * }
 *
 * PulseCheck {
 *   number:    number      — pulse check index (1, 2, …)
 *   questions: Question[]  — only 'mcq' and 'fitb' types
 * }
 *
 * LessonQuiz {
 *   pass_threshold: number        — e.g. 60 means 60% to pass
 *   questions:      QuizQuestion[]
 * }
 *
 * QuizQuestion extends Question {
 *   num:          number   — 1-based question number
 *   feedback:     string   — explanation shown after submit
 *   topic_label:  string   — topic/section this question tests
 *   conceptTested: string  — brief concept name e.g. "Angstrom-Prescott equation"
 *   bloomLevel:   string   — Bloom's taxonomy level: Remember|Understand|Apply|Analyse|Evaluate|Create
 *   difficulty:   string   — "easy" | "medium" | "hard"
 * }
 */
window.validateLesson = function validateLesson(data) {
  const errors = [];
  if (!data || typeof data !== 'object') {
    return { valid: false, errors: ['data must be an object'] };
  }

  if (!data.courseCode)                    errors.push('missing courseCode');
  if (typeof data.week !== 'number')       errors.push('week must be a number');
  if (typeof data.totalWeeks !== 'number') errors.push('totalWeeks must be a number');
  if (!data.title)                         errors.push('missing title');
  if (!data.learningOutcome)               errors.push('missing learningOutcome');
  if (!Array.isArray(data.tags))           errors.push('tags must be an array');

  if (!Array.isArray(data.topics) || data.topics.length === 0) {
    errors.push('topics must be a non-empty array');
  } else {
    data.topics.forEach(function (topic, ti) {
      var tp = 'topics[' + ti + ']';
      if (!topic.id)            errors.push(tp + ' missing id');
      if (!topic.tab_label)     errors.push(tp + ' missing tab_label');
      if (!topic.section_title) errors.push(tp + ' missing section_title');

      if (!Array.isArray(topic.subtopics) || topic.subtopics.length === 0) {
        errors.push(tp + ' subtopics must be a non-empty array');
      } else {
        topic.subtopics.forEach(function (sub, si) {
          var sp = tp + '.subtopics[' + si + ']';
          if (!sub.title)              errors.push(sp + ' missing title');
          if (!Array.isArray(sub.content)) errors.push(sp + ' content must be an array');
          (sub.content || []).forEach(function (b, bi) {
            _validateContentBlock(sp + '.content[' + bi + ']', b, errors);
          });
          (sub.mini_checks || []).forEach(function (q, qi) {
            _validateQuestion(sp + '.mini_checks[' + qi + ']', q, errors, false);
          });
        });
      }

      (topic.recall_cards || []).forEach(function (rc, ri) {
        var rp = tp + '.recall_cards[' + ri + ']';
        if (!window.LESSON_BADGE_TYPES.includes(rc.badge))
          errors.push(rp + ' unknown badge "' + rc.badge + '"');
        if (!rc.question) errors.push(rp + ' missing question');
        if (!rc.answer)   errors.push(rp + ' missing answer');
      });

      (topic.post_recall_checks || []).forEach(function (q, qi) {
        _validateQuestion(tp + '.post_recall_checks[' + qi + ']', q, errors, false);
      });

      if (topic.pulse_check) {
        var pc = topic.pulse_check;
        if (typeof pc.number !== 'number')
          errors.push(tp + '.pulse_check missing number');
        if (!Array.isArray(pc.questions) || pc.questions.length === 0)
          errors.push(tp + '.pulse_check must have at least one question');
        (pc.questions || []).forEach(function (q, qi) {
          _validateQuestion(tp + '.pulse_check.questions[' + qi + ']', q, errors, false);
        });
      }
    });
  }

  if (!data.quiz) {
    errors.push('missing quiz');
  } else {
    if (typeof data.quiz.pass_threshold !== 'number')
      errors.push('quiz.pass_threshold must be a number');
    if (!Array.isArray(data.quiz.questions) || data.quiz.questions.length === 0) {
      errors.push('quiz must have at least one question');
    } else {
      data.quiz.questions.forEach(function (q, qi) {
        var qp = 'quiz.questions[' + qi + ']';
        _validateQuestion(qp, q, errors, true);
        if (typeof q.num !== 'number') errors.push(qp + ' missing num');
        if (!q.feedback)               errors.push(qp + ' missing feedback');
        if (!q.topic_label)            errors.push(qp + ' missing topic_label');
        if (!q.conceptTested)          errors.push(qp + ' missing conceptTested');
        if (!q.bloomLevel)             errors.push(qp + ' missing bloomLevel');
        if (!q.difficulty)             errors.push(qp + ' missing difficulty');
      });
    }
  }

  return { valid: errors.length === 0, errors: errors };
};

function _validateContentBlock(path, b, errors) {
  if (!window.LESSON_CONTENT_TYPES.includes(b.type)) {
    errors.push(path + ' unknown type "' + b.type + '"');
    return;
  }
  if (b.type === 'paragraph' && typeof b.text !== 'string')
    errors.push(path + ' paragraph missing text (string)');
  if ((b.type === 'ordered_list' || b.type === 'unordered_list') && !Array.isArray(b.items))
    errors.push(path + ' list missing items array');
  if (b.type === 'formula' && !b.latex)
    errors.push(path + ' formula missing latex');
}

function _validateQuestion(path, q, errors, requireRevealAnswer) {
  if (!window.LESSON_QUESTION_TYPES.includes(q.type))
    errors.push(path + ' unknown type "' + q.type + '"');
  if (!q.question) errors.push(path + ' missing question');

  if (q.type === 'mcq') {
    if (!Array.isArray(q.options) || q.options.length < 2)
      errors.push(path + ' mcq needs at least 2 options');
    (q.options || []).forEach(function (o, oi) {
      if (!o.letter) errors.push(path + '.options[' + oi + '] missing letter');
      if (!o.text)   errors.push(path + '.options[' + oi + '] missing text');
    });
    if (!q.answer) errors.push(path + ' mcq missing answer (correct letter)');
  }

  if (q.type === 'fitb') {
    if (!Array.isArray(q.answers) || q.answers.length === 0)
      errors.push(path + ' fitb missing answers array');
  }

  if (q.type === 'reveal' && requireRevealAnswer) {
    if (!q.answer) errors.push(path + ' reveal missing answer');
  }
}
