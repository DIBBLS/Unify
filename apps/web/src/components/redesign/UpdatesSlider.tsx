import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { BoxBoy, type Pose } from './brand';

export type UpdateSlide = { id: string; pose: Pose; tag: string; title: string; body: string; to?: string; cta?: string };

// Updates slider: one card at a time, a different Box Boy on each. Swipe or tap
// the dots; it also drifts to the next card every 7 s until the person touches
// it. The strip scrolls inside its own box, so the page never scrolls sideways.
export function UpdatesSlider({ slides }: { slides: UpdateSlide[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [i, setI] = useState(0);
  const touched = useRef(false);

  const go = (n: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollTo({ left: n * el.clientWidth, behavior: 'smooth' });
  };

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onScroll = () => setI(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    const onTouch = () => { touched.current = true; };
    el.addEventListener('scroll', onScroll, { passive: true });
    el.addEventListener('pointerdown', onTouch, { passive: true });
    return () => { el.removeEventListener('scroll', onScroll); el.removeEventListener('pointerdown', onTouch); };
  }, []);

  useEffect(() => {
    if (slides.length < 2) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const t = setInterval(() => {
      if (touched.current || document.hidden) return;
      const el = ref.current;
      if (!el) return;
      const cur = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      go((cur + 1) % slides.length);
    }, 7000);
    return () => clearInterval(t);
  }, [slides.length]);

  if (!slides.length) return null;
  return (
    <section aria-label="Updates" className="rise" style={{ margin: '0 16px 12px' }}>
      <div ref={ref} className="upd-track">
        {slides.map((s, k) => (
          <article key={s.id} className="upd-card" aria-hidden={k !== i} aria-roledescription="slide">
            <div className="upd-art"><BoxBoy full pose={s.pose} width={68} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="eyebrow" style={{ color: 'var(--green-deep)' }}>{s.tag}</div>
              <div className="t-15 w-7" style={{ marginTop: 2 }}>{s.title}</div>
              <div className="t-13 muted" style={{ marginTop: 3, lineHeight: 1.4 }}>{s.body}</div>
              {s.to && <Link to={s.to} className="upd-cta" tabIndex={k === i ? 0 : -1}>{s.cta || 'Open'}</Link>}
            </div>
          </article>
        ))}
      </div>
      {slides.length > 1 && (
        <div className="upd-dots" role="tablist" aria-label="Choose an update">
          {slides.map((s, k) => (
            <button key={s.id} role="tab" aria-selected={k === i} aria-label={`Update ${k + 1}`} onClick={() => { touched.current = true; go(k); }} className={k === i ? 'on' : ''} />
          ))}
        </div>
      )}
    </section>
  );
}
