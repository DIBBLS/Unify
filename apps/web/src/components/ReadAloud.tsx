import { useEffect, useMemo, useRef, useState } from 'react';
import { Volume2, Square } from 'lucide-react';
import Drop from './Drop';
import type { ContentBlock, Topic } from '../types/note';
import { PAUSE, phrases, speakPhrases, voiceScore, type Seg } from '../lib/speech';

function stripHtml(s: string): string {
  try {
    const el = document.createElement('div');
    el.innerHTML = s;
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return s.replace(/<[^>]*>/g, ' ');
  }
}

// A heading is said on its own, then a longer breath.
const heading = (s: string): Seg[] => phrases(stripHtml(s), PAUSE.heading);
const said = (s: string, end: number = PAUSE.block): Seg[] => phrases(stripHtml(s), end);

function blockSegs(b: ContentBlock): Seg[] {
  switch (b.type) {
    case 'paragraph':
      return said(b.text);
    case 'insight':
      return [...said('Key point.', PAUSE.colon), ...said(b.text)];
    case 'analogy':
      return [...said('Think of it like this.', PAUSE.colon), ...said(b.text)];
    case 'bullets':
      // Each bullet is its own thought, with a breath after it.
      return b.items.flatMap((it, i) => said(it, i === b.items.length - 1 ? PAUSE.block : PAUSE.bullet));
    case 'formula':
      // The equation itself is for the eyes; say what it is and what it means.
      return [...said(`${b.label}.`, PAUSE.colon), ...(b.note ? said(b.note) : [])];
    case 'symbol':
      return said(`${b.symbol} is ${b.name}. ${b.desc}`);
    case 'workedExample':
      return [
        ...said(`Worked example: ${b.title}.`, PAUSE.heading),
        ...(b.given.length ? said(`We are given: ${b.given.join('; ')}.`) : []),
        ...b.steps.flatMap((s) => [...said(`${s.label}: ${s.title}.`, PAUSE.colon), ...said(s.body)]),
        ...said(`So, ${b.result}`),
      ];
    case 'diagram':
      return said(`The diagram shows ${b.caption}. ${b.description}`);
    default:
      return [];
  }
}

type Part = { title: string; segs: Seg[] };

// Flatten a topic into parts (one per subtopic, for the progress line), each
// a run of short phrases with natural pauses between them.
function speakable(topic: Topic): Part[] {
  const parts: Part[] = [{ title: topic.title, segs: heading(topic.title) }];
  for (const sub of topic.subtopics) {
    const segs = [
      ...heading(sub.title),
      ...sub.content.flatMap(blockSegs),
      ...(sub.miniCheck.questions.length
        ? [...said('Quick check. Try these in your head.', PAUSE.colon), ...sub.miniCheck.questions.flatMap((q) => said(q.question, PAUSE.between))]
        : []),
    ];
    if (segs.length) parts.push({ title: sub.title, segs });
  }
  if (topic.activeRecall?.length) {
    parts.push({
      title: 'Active recall',
      segs: [
        ...heading('Active recall'),
        // A real pause after each question, so there's time to think before the answer.
        ...topic.activeRecall.flatMap((c) => [...said(c.question, PAUSE.between * 2), ...said(c.answer)]),
      ],
    });
  }
  return parts.filter((p) => p.segs.length);
}

function supported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

const VOICE_KEY = 'unify.voice.v1';
const RATE_KEY = 'unify.speech.rate.v1';
const RATES = [0.75, 1, 1.25, 1.5, 2];

// All English voices on this device, Nigerian first. We can't invent an
// accent — the voice must exist in the OS/browser TTS engine (many
// Androids ship Google's English (Nigeria); iPhones usually don't, and
// fall back to British/American). Android users can download more under
// Settings → Language → Text-to-speech → preferred engine voices.
// Browsers don't expose gender; we read it from the voice name where the
// engine prints it (e.g. "...Male"/"...Female" variants Google ships).
function voiceGender(v: SpeechSynthesisVoice): '' | 'male' | 'female' {
  const name = v.name.toLowerCase();
  if (name.includes('female')) return 'female';
  if (name.includes('male')) return 'male';
  return '';
}
function rankVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
  return [...en].sort((a, b) => voiceScore(a) - voiceScore(b));
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
  // Narrator track: a human Nigerian-voice recording attached in Studio.
  // It plays first; device TTS stays one tap away as fallback.
  const hasNarrator = Boolean(topic.audioRef);
  const [useNarrator, setUseNarrator] = useState(true);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  // Playback speed, persisted per device. Applied to every utterance;
  // changing it mid-read takes effect from the next part.
  const [rate, setRate] = useState(() => {
    try {
      const n = Number(localStorage.getItem(RATE_KEY));
      return RATES.includes(n) ? n : 1;
    } catch {
      return 1;
    }
  });
  const cancelled = useRef(false);
  const stopRef = useRef<(() => void) | null>(null);
  // Live ref: the speaking loop outlives renders, so speed changes apply
  // to the very next part, mid-read.
  const rateRef = useRef(rate);
  useEffect(() => {
    rateRef.current = rate;
    // Keep the narrator track on the same saved speed.
    if (audioRef.current) {
      try {
        audioRef.current.playbackRate = rate;
      } catch {
        // ignore
      }
    }
  });
  const ranked = useMemo(() => rankVoices(voices), [voices]);
  const hasNaija = ranked.length > 0 && /ng|nigeria/i.test(ranked[0].lang + ' ' + ranked[0].name);
  const naijaVoices = useMemo(
    () => ranked.filter((v) => /ng|nigeria/i.test(v.lang + ' ' + v.name)),
    [ranked]
  );
  const naijaGenders = useMemo(
    () => [...new Set(naijaVoices.map(voiceGender).filter(Boolean))],
    [naijaVoices]
  );

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
      stopRef.current?.();
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

  const pickRate = (r: number) => {
    setRate(r);
    try {
      localStorage.setItem(RATE_KEY, String(r));
    } catch {
      // ignore
    }
  };

  const stop = () => {
    cancelled.current = true;
    stopRef.current?.();
    stopRef.current = null;
    setPartIdx(-1);
  };

  const play = () => {
    const parts = speakable(topic);
    if (!parts.length) return;
    cancelled.current = false;
    // One flat run of phrases; remember which part each phrase belongs to
    // so the progress line follows along.
    const segs: Seg[] = [];
    const partOf: number[] = [];
    parts.forEach((p, pi) => p.segs.forEach((s, si) => {
      segs.push(si === p.segs.length - 1 ? { ...s, pause: Math.max(s.pause, PAUSE.between) } : s);
      partOf.push(pi);
    }));
    stopRef.current = speakPhrases(segs, {
      voice: activeVoice,
      rate: () => rateRef.current,
      onPhrase: (i) => { if (!cancelled.current) setPartIdx(partOf[i]); },
      onDone: () => setPartIdx(-1),
      onError: () => setPartIdx(-1),
    });
  };

  const playing = partIdx >= 0;
  const parts = speakable(topic);

  // Narrator track present: native player with the same speed control.
  if (hasNarrator && useNarrator) {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 10 }}>
          <span style={{ width: 36, height: 36, borderRadius: '50%', background: 'var(--u-green)', color: 'var(--u-black)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Volume2 size={16} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 800 }}>Narrated version</div>
            <audio
              ref={audioRef}
              controls
              src={topic.audioRef as string}
              onRateChange={(e) => {
                const r = (e.target as HTMLAudioElement).playbackRate;
                if (RATES.includes(Math.round(r * 100) / 100)) pickRate(Math.round(r * 100) / 100);
              }}
              style={{ width: '100%', marginTop: 4, height: 32 }}
            />
          </div>
          <Drop
            value={String(rate)}
            onChange={(v) => {
              const r = Number(v);
              pickRate(r);
              if (audioRef.current) {
                try {
                  audioRef.current.playbackRate = r;
                } catch {
                  // ignore
                }
              }
            }}
            label="Playback speed"
            style={{ width: 74, flexShrink: 0 }}
            options={RATES.map((r) => ({ value: String(r), label: `${r}×` }))}
          />
        </div>
        <button onClick={() => setUseNarrator(false)} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, fontWeight: 700, marginTop: 4 }}>
          Prefer the device voice instead?
        </button>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      {hasNarrator && (
        <div style={{ marginBottom: 6 }}>
          <button onClick={() => setUseNarrator(true)} style={{ background: 'none', border: 'none', color: 'var(--u-good)', fontSize: 11, fontWeight: 700 }}>
            ← Back to narrated version
          </button>
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <button
          onClick={playing ? stop : play}
          aria-label={playing ? 'Stop reading aloud' : 'Listen to this topic'}
          className={playing ? 'listening' : undefined}
          style={{ display: 'flex', gap: 6, alignItems: 'center', background: playing ? 'var(--u-good)' : 'var(--surface)', color: playing ? 'var(--u-on-good)' : 'var(--u-good)', border: `1px solid ${playing ? 'var(--u-good)' : 'var(--u-good-tint)'}`, borderRadius: 9999, padding: '8px 16px', fontSize: 13, fontWeight: 800 }}
        >
          {playing ? <Square size={14} /> : <Volume2 size={14} />}
          {playing ? 'Stop' : 'Listen'}
        </button>
        {playing && partIdx < parts.length && (
          <div style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {partIdx + 1}/{parts.length} · {parts[partIdx].title}
          </div>
        )}
        <Drop
          value={String(rate)}
          onChange={(v) => pickRate(Number(v))}
          label="Playback speed"
          style={{ width: 74, flexShrink: 0 }}
          options={RATES.map((r) => ({ value: String(r), label: `${r}×` }))}
        />
        {!playing && ranked.length > 1 && (
          <Drop
            value={activeVoice?.voiceURI || ''}
            onChange={pickVoice}
            label="Reading voice"
            style={{ flex: '1 1 170px', minWidth: 170 }}
            options={ranked.map((v) => {
              const g = voiceGender(v);
              const naija = /ng|nigeria/i.test(v.lang + ' ' + v.name);
              return {
                value: v.voiceURI,
                label: `${v.name} (${v.lang})${naija ? ' · Naija' : ''}${g ? ` · ${g}` : ''}`,
              };
            })}
          />
        )}
      </div>
      {!playing && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          {hasNaija
            ? `Voice: ${ranked[0].name} — ${naijaVoices.length} Nigerian voice${naijaVoices.length === 1 ? '' : 's'} on this device${naijaGenders.length ? ` (${naijaGenders.join(' + ')})` : ''}. Pick another above any time.`
            : 'No Nigerian voice on this device yet. On Android, download “English (Nigeria)” under Settings → Language → Text-to-speech. On a laptop, Microsoft Edge has natural Nigerian voices (Abeo and Ezinne).'}
        </div>
      )}
    </div>
  );
}

