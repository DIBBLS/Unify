// Lean Unify Note JSON — from notes-engine/samples/hand_authored_note.json + server.js SCHEMA_SPEC
export type ContentBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'bullets'; items: string[] }
  | { type: 'formula'; label: string; equation: string; note?: string }
  | { type: 'symbol'; symbol: string; name: string; desc: string }
  | { type: 'insight'; text: string }
  | { type: 'analogy'; text: string }
  | { type: 'workedExample'; eyebrow: string; title: string; given: string[]; steps: { label: string; title: string; body: string; math: string }[]; result: string }
  | { type: 'diagram'; caption: string; description: string; imageRef: string | null };

export type MiniCheckQuestion =
  | { type: 'mcq'; question: string; options: string[]; correctIndex: number }
  | { type: 'fitb'; question: string; acceptedAnswers: string[] }
  | { type: 'reveal'; question: string; answer: string };

export type Subtopic = {
  number: string;
  abbr: string;
  title: string;
  content: ContentBlock[];
  miniCheck: { questions: MiniCheckQuestion[] };
};

export type Topic = {
  number: number;
  lecture?: number;
  title: string;
  abbr: string;
  audioRef?: string | null;
  subtopics: Subtopic[];
  activeRecall?: { badge: string; question: string; answer: string }[];
  pulseCheck?: { number: number; questions: MiniCheckQuestion[] };
};

export type EOQ = {
  /** Minutes allowed once the student answers the first question. Absent or 0 = untimed. */
  timerMinutes?: number;
  /** Correct answers needed to pass. Absent = 60% of the questions. */
  passMark?: number;
  questions: {
    number: number;
    /** mcq, fitb (a word), number (S30: numeric answer within a tolerance), maths (S31: an expression, checked by value). */
    type: 'mcq' | 'fitb' | 'number' | 'maths';
    question: string;
    options?: string[];
    correct?: string;
    acceptedAnswers?: string[];
    /** number: the answer, an allowed +/- tolerance (absolute; default 1% of the answer) and a unit shown after the box. */
    answer?: number;
    tolerance?: number;
    unit?: string;
    feedback?: { correct: string; wrong: string };
    topicRef?: string;
  }[];
};

export type UnifyNote = {
  course: string;
  week: number;
  title: string;
  subtitle: string;
  learningOutcome: string;
  metaChips: string[];
  tags: string[];
  topics: Topic[];
  eoq: EOQ;
};

