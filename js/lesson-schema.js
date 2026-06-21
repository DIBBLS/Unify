// js/lesson-schema.js
// Source of truth for the Unify lesson data model.
//
// To add a new block type:
//   1. Add it to LESSON_CONTENT_TYPES or LESSON_QUESTION_TYPES below
//   2. Add a matching renderXxx() function in lesson-renderer.js
//   3. Add it to the LESSON_SCHEMA shape (documentation only)
//   4. Add it to the parser prompt in lesson-parser-prompt.js

window.LESSON_SCHEMA_VERSION = '1.1';

// Valid types for subtopic.content[] blocks
window.LESSON_CONTENT_TYPES = [
  'paragraph',
  'ordered_list',
  'unordered_list',
  'formula',
];

// Valid types for mini_checks, post_recall_checks, and pulse_check.questions
window.LESSON_QUESTION_TYPES = [
  'mcq',    // multiple choice
  'fitb',   // fill in the blank
  'reveal', // simple reveal card
];

// Valid badge values for recall_cards
window.LESSON_BADGE_TYPES = ['DEF', 'MECH', 'APP', 'COMP'];

// Full lesson document shape — reference for AI parser and admin panel.
// Fields marked (required) must be present for validateLesson() to pass.
window.LESSON_SCHEMA = {
  course:   'string (required)',   // e.g. "MEE 352"
  week:     'number (required)',   // e.g. 8
  week_of:  'number',             // total weeks e.g. 12
  title:    'string (required)',   // hero title
  subtitle: 'string',             // italic subheading below title
  outcome:  'string',             // "By the end of this week…" — text only, no leading phrase
  meta:     ['string'],           // chips in the hero, e.g. ["MEE 352 — Course Name", "LASU · Faculty of Engineering", "Week 8 of 12"]
  tags:     ['string'],           // keyword pills below hero

  topics: [
    {
      id:            'string (required)', // e.g. "t1" — used for DOM panel IDs
      tab_label:     'string',           // text on the tab button, e.g. "Topic 1: Fuel Cells"
      section_label: 'string',           // small eyebrow, e.g. "Topic 1"
      section_title: 'string (required)',// large heading inside the panel

      subtopics: [
        {
          number:  'string', // section number from notes, e.g. "2.17" or "2.17.2"
          title:   'string (required)',
          content: [
            // paragraph — HTML allowed (use <strong>, <em>, subscript etc.)
            { type: 'paragraph', html: 'string' },

            // ordered / unordered list
            { type: 'ordered_list',   items: ['string'] },
            { type: 'unordered_list', items: ['string'] },

            // formula block
            {
              type:     'formula',
              label:    'string', // e.g. "Battery energy efficiency"
              equation: 'string', // e.g. "η = E₁ × Ah_out / E₂ × Ah_in"
              vars:     'string', // plain text or HTML, one variable per line
            },
          ],
          mini_checks: [
            {
              type:     'mcq',
              question: 'string',
              options: [
                { letter: 'A', text: 'string', correct: false },
                { letter: 'B', text: 'string', correct: true  },
                { letter: 'C', text: 'string', correct: false },
                { letter: 'D', text: 'string', correct: false },
              ],
            },
            {
              type:     'fitb',
              question: 'string — use ________ for blank',
              answers:  ['string'], // all lowercase; first is shown on wrong answer
            },
            {
              type:     'reveal',
              question: 'string',
              answer:   'string', // HTML allowed
            },
          ],
        },
      ],

      recall_cards: [
        {
          badge:    'DEF | MECH | APP | COMP',
          question: 'string',
          answer:   'string', // HTML allowed
        },
      ],

      // A second question block shown after the recall cards for the whole topic
      post_recall_checks: [
        // same types as mini_checks
      ],

      pulse_check: {
        number:    'number', // 1, 2, 3 … displayed as circled numeral
        questions: [
          // same types as mini_checks — covers ALL subtopics in this topic
        ],
      },
    },
  ],

  quiz: {
    pass_threshold: 60, // percent — default 60
    questions: [
      {
        num:      'number',
        question: 'string',
        options: [
          { letter: 'A', text: 'string' },
          { letter: 'B', text: 'string' },
          { letter: 'C', text: 'string' },
          { letter: 'D', text: 'string' },
        ],
        answer:   'string', // correct letter e.g. "B"
        feedback: {
          correct: 'string', // explanation shown on correct
          wrong:   'string', // explanation shown on wrong — include what the right answer is
        },
        topic_label: 'string', // e.g. "Topic 1 — Fuel Cells" — used in review nudge on fail
      },
    ],
  },
};

// validateLesson(data) → { valid: boolean, errors: string[] }
window.validateLesson = function(data) {
  const errors = [];
  if (!data.course)   errors.push('Missing: course');
  if (!data.week)     errors.push('Missing: week');
  if (!data.title)    errors.push('Missing: title');
  if (!Array.isArray(data.topics) || data.topics.length === 0)
    errors.push('Missing or empty: topics');
  if (!data.quiz || !Array.isArray(data.quiz.questions))
    errors.push('Missing: quiz.questions');

  (data.topics || []).forEach((t, ti) => {
    const p = `topics[${ti}]`;
    if (!t.id)            errors.push(`${p}: missing id`);
    if (!t.section_title) errors.push(`${p}: missing section_title`);
    if (!Array.isArray(t.subtopics)) {
      errors.push(`${p}: missing subtopics array`);
      return;
    }
    t.subtopics.forEach((s, si) => {
      const sp = `${p}.subtopics[${si}]`;
      if (!s.title) errors.push(`${sp}: missing title`);
      (s.content || []).forEach((b, bi) => {
        if (!window.LESSON_CONTENT_TYPES.includes(b.type))
          errors.push(`${sp}.content[${bi}]: unknown type "${b.type}"`);
      });
      [...(s.mini_checks || [])].forEach((q, qi) => {
        if (!window.LESSON_QUESTION_TYPES.includes(q.type))
          errors.push(`${sp}.mini_checks[${qi}]: unknown type "${q.type}"`);
      });
    });
  });

  return { valid: errors.length === 0, errors };
};
