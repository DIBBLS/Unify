import { useEffect, useRef } from 'react';
import { Target } from 'lucide-react';
import type { Topic } from '../types/note';
import { ContentBlockView } from './ContentBlock';
import { MiniCheck } from './MiniCheck';
import { RecallDeck } from './RecallDeck';
import { MathPlain } from './MathText';

// Story beat: each block rises in the first time it scrolls into view,
// so a topic reads like chapters unfolding, not a wall of text.
function Beat({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('in');
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            el.classList.add('in');
            io.disconnect();
          }
        });
      },
      { threshold: 0.06 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="beat">
      {children}
    </div>
  );
}

export function TopicSlice({ topic }: { topic: Topic }) {
  // Number diagram blocks per topic so figures read "Fig 1, Fig 2…".
  let figSeen = 0;
  const figFor = (b: Topic['subtopics'][number]['content'][number]): number | undefined => {
    if (b.type !== 'diagram') return undefined;
    figSeen += 1;
    return figSeen;
  };
  return (
    <div>
      <div className="section-label">Topic {topic.number}</div>
      <div className="section-title">
        <MathPlain text={topic.title} />
      </div>
      {topic.subtopics.map((sub) => (
        <Beat key={sub.number}>
          <div className="subtopic-heading">
            <span className="subtopic-num">{sub.number}</span>
            <h3>
              <MathPlain text={sub.title} />
            </h3>
          </div>
          <div className="topic-card">
            {sub.content.map((b, i) => (
              <ContentBlockView key={i} block={b} fig={figFor(b)} />
            ))}
          </div>
          <MiniCheck questions={sub.miniCheck.questions} subTitle={sub.title} topicNum={topic.number} subAbbr={sub.abbr} />
        </Beat>
      ))}
      {topic.activeRecall && topic.activeRecall.length > 0 && (
        <Beat>
          <RecallDeck items={topic.activeRecall} />
        </Beat>
      )}
      {topic.pulseCheck && (
        <Beat>
          <div className="mini-check" style={{ borderLeft: '3px solid var(--green-deep)', marginTop: 32 }}>
            <div className="mini-check-header">
              <Target size={14} color="#059669" />
              <span className="mini-check-title">Pulse Check 0{topic.pulseCheck.number}</span>
            </div>
            <MiniCheck questions={topic.pulseCheck.questions as any} subTitle="Pulse Check" topicNum={topic.number} subAbbr="pulse" />
          </div>
        </Beat>
      )}
    </div>
  );
}
