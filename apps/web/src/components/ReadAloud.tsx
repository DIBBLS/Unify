import { useEffect, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import type { ContentBlock, Topic } from '../types/note';

function stripHtml(s: string): string {
  try {
    const el = document.createElement('div');
    el.innerHTML = s;
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return s.replace(/<[^>]*>/g, ' ');
  }
}

function blockText(b: ContentBlock): string {
  switch (b.type) {
    case 'paragraph':
    case 'insight':
    case 'analogy':
      return stripHtml(b.text);
    case 'bullets':
      return b.items.map(stripHtml).join('. ');
    case 'formula':
      // Equations read as gibberish — voice the label + note instead.
      return stripHtml(`${b.label}. ${b.note || ''}`);
    case 'symbol':
      return stripHtml(`${b.symbol}, ${b.name}. ${b.desc}`);
    case 'workedExample':
      return stripHtml(
        [
          `${b.eyebrow}. ${b.title}`,
          `Given: ${b.given.join(', ')}`,
          ...b.steps.map((s) => `${s.label}. ${s.title}. ${s.body}`),
          `Result: ${b.result}`,
        ].join('. ')
      );
    case 'diagram':
      return stripHtml(`${b.caption}. ${b.description}`);
    default:
      return '';
  }
}

type Part = { title: string; text: string };

// Flatten a topic into speakable parts (one utterance each so the UI can
// track progress and stop cleanly between parts).
function speakable(topic: Topic): Part[] {
  const parts: Part[] = [{ title: topic.title, text: topic.title }];
  for (const sub of topic.subtopics) {
    const body = sub.content.map(blockText).filter(Boolean).join('. ');
    const checks = sub.miniCheck.questions.map((q) => stripHtml(q.question)).join('. ');
    const text = [sub.title, body, checks ? `Quick check: ${checks}` : ''].filter(Boolean).join('. ');
    if (text) parts.push({ title: sub.title, text });
  }
  if (topic.activeRecall?.length) {
    parts.push({
      title: 'Active recall',
      text:
        'Active recall. ' +
        topic.activeRecall
          .map((c) => `${stripHtml(c.question)}. ${stripHtml(c.answer)}`)
          .join('. '),
    });
  }
  return parts.filter((p) => p.text);
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

// Listen-to-topic via the device's built-in voice. No recording, no
// network — pure client-side speech. Stops on unmount/tab switch.
export function ReadAloud({ topic }: { topic: Topic }) {
  const [partIdx, setPartIdx] = useState(-1);
  const [ok, setOk] = useState(false);
  const cancelled = useRef(false);

  useEffect(() => {
    setOk(supported());
    return () => {
      cancelled.current = true;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  if (!ok) return null;

  const stop = () => {
    cancelled.current = true;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    setPartIdx(-1);
  };

  const play = () => {
    const parts = speakable(topic);
    if (!parts.length) return;
    cancelled.current = false;
    try {
      window.speechSynthesis.cancel();
    } catch {
      // ignore
    }
    let i = 0;
    const next = () => {
      if (cancelled.current || i >= parts.length) {
        setPartIdx(-1);
        return;
      }
      setPartIdx(i);
      const u = new SpeechSynthesisUtterance(parts[i].text);
      u.rate = 1;
      u.onend = () => {
        i += 1;
        // Small beat between parts so sections don't blur together.
        window.setTimeout(next, 250);
      };
      u.onerror = () => setPartIdx(-1);
      window.speechSynthesis.speak(u);
    };
    next();
  };

  const playing = partIdx >= 0;
  const parts = speakable(topic);

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 12 }}>
      <button
        onClick={playing ? stop : play}
        aria-label={playing ? 'Stop reading aloud' : 'Listen to this topic'}
        className={playing ? 'listening' : undefined}
        style={{ display: 'flex', gap: 6, alignItems: 'center', background: playing ? '#059669' : '#fff', color: playing ? '#fff' : '#059669', border: `1px solid ${playing ? '#059669' : '#a7f3d0'}`, borderRadius: 9999, padding: '8px 16px', fontSize: 13, fontWeight: 800 }}
      >
        {playing ? <Square size={14} /> : <Volume2 size={14} />}
        {playing ? 'Stop' : 'Listen'}
      </button>
      {playing && partIdx < parts.length && (
        <div style={{ fontSize: 12, color: '#777', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {partIdx + 1}/{parts.length} · {parts[partIdx].title}
        </div>
      )}
    </div>
  );
}
