import { Target } from 'lucide-react';
import type { Topic } from '../types/note';
import { ContentBlockView } from './ContentBlock';
import { MiniCheck } from './MiniCheck';
import { RecallDeck } from './RecallDeck';

export function TopicSlice({ topic }: { topic: Topic }) {
  return (
    <div>
      <div className="section-label">Topic {topic.number}</div>
      <div className="section-title">{topic.title}</div>
      {topic.subtopics.map((sub) => (
        <div key={sub.number}>
          <div className="subtopic-heading">
            <span className="subtopic-num">{sub.number}</span>
            <h3>{sub.title}</h3>
          </div>
          <div className="topic-card">
            {sub.content.map((b, i) => (
              <ContentBlockView key={i} block={b} />
            ))}
          </div>
          <MiniCheck questions={sub.miniCheck.questions} subTitle={sub.title} topicNum={topic.number} subAbbr={sub.abbr} />
        </div>
      ))}
      {topic.activeRecall && topic.activeRecall.length > 0 && (
        <RecallDeck items={topic.activeRecall} />
      )}
      {topic.pulseCheck && (
        <div className="mini-check" style={{ borderLeft: '3px solid var(--green-deep)', marginTop: 32 }}>
          <div className="mini-check-header">
            <Target size={14} color="#059669" />
            <span className="mini-check-title">Pulse Check 0{topic.pulseCheck.number}</span>
          </div>
          <MiniCheck questions={topic.pulseCheck.questions as any} subTitle="Pulse Check" topicNum={topic.number} subAbbr="pulse" />
        </div>
      )}
    </div>
  );
}
