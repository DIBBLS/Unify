/**
 * Unify Note Schema Validator & Hard Quality Rules Enforcement
 */

const NOTE_SCHEMA = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  required: ["course", "week", "title", "subtitle", "learningOutcome", "metaChips", "tags", "topics", "eoq"],
  properties: {
    course: { type: "string" },
    week: { type: "integer" },
    title: { type: "string" },
    subtitle: { type: "string" },
    learningOutcome: { type: "string" },
    metaChips: { type: "array", items: { type: "string" } },
    tags: { type: "array", items: { type: "string" } },
    topics: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        required: ["number", "title", "abbr", "subtopics", "activeRecall", "pulseCheck"],
        properties: {
          number: { type: "integer" },
          title: { type: "string" },
          abbr: { type: "string" },
          subtopics: {
            type: "array",
            minItems: 1,
            items: {
              type: "object",
              required: ["number", "title", "abbr", "content", "miniCheck"],
              properties: {
                number: { type: "string" },
                title: { type: "string" },
                abbr: { type: "string" },
                content: { type: "array" },
                miniCheck: {
                  type: "object",
                  required: ["questions"],
                  properties: {
                    questions: { type: "array", minItems: 1 }
                  }
                }
              }
            }
          },
          activeRecall: { type: "array", minItems: 1 },
          pulseCheck: {
            type: "object",
            required: ["number", "questions"],
            properties: {
              number: { type: "integer" },
              questions: { type: "array", minItems: 3, maxItems: 3 }
            }
          }
        }
      }
    },
    eoq: {
      type: "object",
      required: ["questions"],
      properties: {
        questions: { type: "array", minItems: 10, maxItems: 10 }
      }
    }
  }
};

/**
 * Validate a note JSON against the schema and UNIFY_RULES quality checklist.
 * @param {object} data Note JSON
 * @returns {{ valid: boolean, errors: string[] }}
 */
function validateUnifyNote(data) {
  const errors = [];

  if (!data || typeof data !== "object") {
    return { valid: false, errors: ["Data must be a non-null JSON object."] };
  }

  // Basic required fields
  const reqFields = ["course", "week", "title", "subtitle", "learningOutcome", "metaChips", "tags", "topics", "eoq"];
  for (const field of reqFields) {
    if (!data[field]) {
      errors.push(`Missing required top-level field: '${field}'.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Validate Topics & Subtopics
  if (!Array.isArray(data.topics) || data.topics.length === 0) {
    errors.push("Topic array must contain at least 1 topic.");
  } else {
    data.topics.forEach((topic, tIdx) => {
      const topicNum = topic.number || (tIdx + 1);

      if (!topic.title) errors.push(`Topic ${topicNum}: missing title.`);
      if (!Array.isArray(topic.subtopics) || topic.subtopics.length === 0) {
        errors.push(`Topic ${topicNum}: must have at least 1 subtopic.`);
      } else {
        topic.subtopics.forEach((sub, sIdx) => {
          const subNum = sub.number || `${topicNum}.${sIdx + 1}`;
          
          // Rule: Every subtopic must have a miniCheck with >= 1 question
          if (!sub.miniCheck || !Array.isArray(sub.miniCheck.questions) || sub.miniCheck.questions.length === 0) {
            errors.push(`Subtopic ${subNum} ('${sub.title || 'Untitled'}'): missing Mini Check questions (every subtopic must have a Mini Check).`);
          } else {
            // Check question-type rotation (no back-to-back duplicate types)
            let prevType = null;
            sub.miniCheck.questions.forEach((q, qIdx) => {
              if (!q.type) {
                errors.push(`Subtopic ${subNum} Mini Check Q${qIdx + 1}: missing question type.`);
              } else if (q.type === prevType && sub.miniCheck.questions.length > 1) {
                errors.push(`Subtopic ${subNum} Mini Check Q${qIdx + 1}: repeated question type '${q.type}' back-to-back.`);
              }
              prevType = q.type;

              // Check FITB acceptedAnswers
              if (q.type === "fitb") {
                if (!Array.isArray(q.acceptedAnswers) || q.acceptedAnswers.length === 0) {
                  errors.push(`Subtopic ${subNum} Mini Check Q${qIdx + 1} (FITB): missing acceptedAnswers array.`);
                }
              }
            });
          }
        });
      }

      // Validate Active Recall
      if (!Array.isArray(topic.activeRecall) || topic.activeRecall.length < 1) {
        errors.push(`Topic ${topicNum}: must contain at least 1 Active Recall card.`);
      }

      // Validate Pulse Check: exactly 3 questions in MCQ, MCQ, FITB order
      if (!topic.pulseCheck || !Array.isArray(topic.pulseCheck.questions)) {
        errors.push(`Topic ${topicNum}: missing Pulse Check.`);
      } else if (topic.pulseCheck.questions.length !== 3) {
        errors.push(`Topic ${topicNum}: Pulse Check must have exactly 3 questions (got ${topic.pulseCheck.questions.length}).`);
      } else {
        const qTypes = topic.pulseCheck.questions.map(q => q.type);
        if (qTypes[0] !== "mcq" || qTypes[1] !== "mcq" || qTypes[2] !== "fitb") {
          errors.push(`Topic ${topicNum}: Pulse Check questions must be ordered [MCQ, MCQ, FITB] (got [${qTypes.join(", ")}]).`);
        }
      }
    });
  }

  // Validate EOQ: exactly 10 questions (8 MCQ + 2 FITB)
  if (!data.eoq || !Array.isArray(data.eoq.questions)) {
    errors.push("EOQ section missing or questions array invalid.");
  } else if (data.eoq.questions.length !== 10) {
    errors.push(`EOQ must contain exactly 10 questions (got ${data.eoq.questions.length}).`);
  } else {
    let mcqCount = 0;
    let fitbCount = 0;

    data.eoq.questions.forEach((q, idx) => {
      const qNum = q.number || (idx + 1);
      if (q.type === "mcq") mcqCount++;
      if (q.type === "fitb") fitbCount++;

      if (!q.question) errors.push(`EOQ Q${qNum}: missing question text.`);
      if (!q.feedback || (!q.feedback.correct && !q.feedback.c) || (!q.feedback.wrong && !q.feedback.w)) {
        errors.push(`EOQ Q${qNum}: missing feedback object with 'correct' and 'wrong' strings.`);
      }
      if (!q.topicRef) errors.push(`EOQ Q${qNum}: missing topicRef string for student review list.`);
    });

    if (mcqCount !== 8 || fitbCount !== 2) {
      errors.push(`EOQ must consist of 8 MCQ and 2 FITB questions (found ${mcqCount} MCQ, ${fitbCount} FITB).`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

module.exports = {
  NOTE_SCHEMA,
  validateUnifyNote
};
