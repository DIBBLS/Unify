import { useState } from 'react';
import { Zap, Check, X } from 'lucide-react';
import type { MiniCheckQuestion } from '../types/note';

export function MiniCheck({ questions, subTitle, topicNum, subAbbr }: { questions: MiniCheckQuestion[]; subTitle: string; topicNum: number; subAbbr: string }) {
  return (
    <div className="mini-check">
      <div className="mini-check-header">
        <Zap size={14} color="#58a700" />
        <span className="mini-check-title">Quick Check — {subTitle}</span>
        <span className="mini-check-sub">{questions.length} question(s)</span>
      </div>
      {questions.map((q, idx) => (
        <MiniCheckItem key={`${topicNum}-${subAbbr}-${idx}`} q={q} id={`mc-${topicNum}-${subAbbr}-${idx}`} />
      ))}
    </div>
  );
}

function MiniCheckItem({ q, id }: { q: MiniCheckQuestion; id: string }) {
  const [revealed, setRevealed] = useState(false);
  const [selected, setSelected] = useState<number | null>(null);
  const [fitb, setFitb] = useState('');
  const [fitbOk, setFitbOk] = useState<boolean | null>(null);

  if (q.type === 'mcq') {
    return (
      <div className="mc-mcq-item">
        <div className="mc-q">{q.question}</div>
        <div className="mc-mcq-opts">
          {q.options.map((opt, i) => {
            const isCorrect = i === q.correctIndex;
            const isSelected = selected === i;
            const show = selected !== null;
            return (
              <div
                key={i}
                className={`mc-mcq-opt ${show && isCorrect ? 'mc-correct' : ''} ${show && isSelected && !isCorrect ? 'mc-wrong' : ''} ${show ? 'mc-locked' : ''}`}
                onClick={() => selected === null && setSelected(i)}
              >
                <span className="mc-ltr">{String.fromCharCode(65 + i)}</span> {opt}
              </div>
            );
          })}
        </div>
        {selected !== null && (
          <div className="mc-mcq-fb" style={{ display: 'flex', gap: 6, alignItems: 'center', color: selected === q.correctIndex ? '#166534' : '#991b1b' }}>
            {selected === q.correctIndex ? <Check size={14} /> : <X size={14} />} {selected === q.correctIndex ? 'Correct!' : 'Not quite — correct highlighted'}
          </div>
        )}
      </div>
    );
  }
  if (q.type === 'fitb') {
    return (
      <div className="mc-fitb-item">
        <div className="mc-q">{q.question}</div>
        <div className="mc-fitb-row">
          <input className="mc-fitb-input" value={fitb} onChange={(e) => setFitb(e.target.value)} placeholder="Your answer…" />
          <button
            className="mc-fitb-btn"
            onClick={() => {
              const ok = q.acceptedAnswers.some((a) => a.trim().toLowerCase() === fitb.trim().toLowerCase());
              setFitbOk(ok);
            }}
          >
            Check
          </button>
        </div>
        {fitbOk !== null && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: fitbOk ? '#166534' : '#991b1b', fontSize: 11, marginTop: 6 }}>
            {fitbOk ? <Check size={12} /> : <X size={12} />} {fitbOk ? 'Correct!' : `Accepted: ${q.acceptedAnswers.join(' OR ')}`}
          </div>
        )}
      </div>
    );
  }
  return (
    <div className="mc-reveal-item">
      <div className="mc-q">{q.question}</div>
      <button className="mc-reveal-btn" onClick={() => setRevealed(!revealed)}>
        {revealed ? 'Hide Answer' : 'Reveal Answer'}
      </button>
      {revealed && <div className="mc-answer show" dangerouslySetInnerHTML={{ __html: q.answer }} />}
    </div>
  );
}
