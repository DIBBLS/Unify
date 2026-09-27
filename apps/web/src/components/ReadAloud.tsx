import { useEffect, useMemo, useRef, useState } from 'react';
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

const VOICE_KEY = 'unify.voice.v1';

// All English voices on this device, Nigerian first. We can't invent an
// accent — the voice must exist in the OS/browser TTS engine (many
// Androids ship Google's English (Nigeria); iPhones usually don't, and
// fall back to British/American). Android users can download more under
// Settings → Language → Text-to-speech → preferred engine voices.
function rankVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  const score = (v: SpeechSynthesisVoice): number => {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    if (lang === 'en-ng' || lang.startsWith('en-ng') || name.includes('nigeria')) return 0;
    if (name.includes('google') && lang.startsWith('en')) return 1;
    if (lang.startsWith('en')) return 2;
    return 3;
  };
  return [...en].sort((a, b) => score(a) - score(b));
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    try {
      const synth = window.speechSynthesis;
      const first = synth.getVoices();
      if (first.length) {
        resolve(first);
        return;
      }
      // Chrome loads voices asynchronously — wait for the event (once).
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve(synth.getVoices());
      };
      synth.onvoiceschanged = finish;
      window.setTimeout(finish, 1500);
    } catch {
      resolve([]);
    }
  });
}

// Listen-to-topic via the device's built-in voice. No recording, no
// network — pure client-side speech. Stops on unmount/tab switch.
export function ReadAloud({ topic }: { topic: Topic }) {
  const [partIdx, setPartIdx] = useState(-1);
  const [ok, setOk] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceURI, setVoiceURI] = useState('');
  const cancelled = useRef(false);
  const ranked = useMemo(() => rankVoices(voices), [voices]);
  const hasNaija = ranked.length > 0 && /ng|nigeria/i.test(ranked[0].lang + ' ' + ranked[0].name);

  useEffect(() => {
    setOk(supported());
    if (!supported()) return;
    try {
      const saved = localStorage.getItem(VOICE_KEY) || '';
      if (saved) setVoiceURI(saved);
    } catch {
      // ignore
    }
    let live = true;
    void loadVoices().then((list) => {
      if (!live) return;
      const ranked = rankVoices(list);
      setVoices(ranked);
    });
    return () => {
      live = false;
      cancelled.current = true;
      try {
        window.speechSynthesis?.cancel();
      } catch {
        // ignore
      }
    };
  }, []);

  if (!ok) return null;

  const activeVoice = voices.find((v) => v.voiceURI === voiceURI) || voices[0] || null;

  const pickVoice = (uri: string) => {
    setVoiceURI(uri);
    try {
      localStorage.setItem(VOICE_KEY, uri);
    } catch {
      // ignore
    }
  };

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
      if (activeVoice) {
        u.voice = activeVoice;
        u.lang = activeVoice.lang;
      }
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
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={playing ? stop : play}
          aria-label={playing ? 'Stop reading aloud' : 'Listen to this topic'}
          className={playing ? 'listening' : undefined}
          style={{ display: 'flex', gap: 6, alignItems: 'center', background: playing ? '#059669' : 'var(--surface)', color: playing ? '#fff' : '#059669', border: `1px solid ${playing ? '#059669' : '#a7f3d0'}`, borderRadius: 9999, padding: '8px 16px', fontSize: 13, fontWeight: 800 }}
        >
          {playing ? <Square size={14} /> : <Volume2 size={14} />}
          {playing ? 'Stop' : 'Listen'}
        </button>
        {playing && partIdx < parts.length && (
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {partIdx + 1}/{parts.length} · {parts[partIdx].title}
          </div>
        )}
        {!playing && ranked.length > 1 && (
          <select
            value={activeVoice?.voiceURI || ''}
            onChange={(e) => pickVoice(e.target.value)}
            aria-label="Reading voice"
            style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid var(--border)', borderRadius: 9999, fontSize: 12, fontWeight: 700, color: 'var(--text2)', background: 'var(--surface)' }}
          >
            {ranked.map((v) => (
              <option key={v.voiceURI} value={v.voiceURI}>
                {v.name} ({v.lang}){hasNaija && v.voiceURI === ranked[0].voiceURI ? ' · Naija' : ''}
              </option>
            ))}
          </select>
        )}
      </div>
      {!playing && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          {hasNaija
            ? `Voice: ${ranked[0].name} — Nigerian English found on this device.`
            : 'No Nigerian voice on this device yet — Android: download “English (Nigeria)” under Settings → Language → Text-to-speech.'}
        </div>
      )}
    </div>
  );
}
