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
  title: string;
  abbr: string;
  subtopics: Subtopic[];
  activeRecall?: { badge: string; question: string; answer: string }[];
  pulseCheck?: { number: number; questions: MiniCheckQuestion[] };
};

export type EOQ = {
  questions: {
    number: number;
    type: 'mcq' | 'fitb';
    question: string;
    options?: string[];
    correct?: string;
    acceptedAnswers?: string[];
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
