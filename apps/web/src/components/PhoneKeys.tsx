import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';

// Typing for the word games with the phone's own keyboard (and a computer's),
// instead of a keyboard drawn on the screen. An invisible box takes the
// typing; the game shows the letters where they land (the guess row, the
// crossword square), and keeps that spot in view while the keyboard is up, so
// the student never has to scroll to see what they're typing.
//
// Phone keyboards don't report most keys reliably, so the box holds one space:
// a longer value means letters were typed, an empty one means Backspace.
export type PhoneKeysHandle = { focus: () => void; blur: () => void };
type Props = {
  onLetter: (ch: string) => void;
  onBack: () => void;
  onEnter?: () => void;
  /** Kept in view (centred) when the keyboard opens or the spot moves. */
  target?: React.RefObject<HTMLElement | null>;
  label: string;
};
const SENTINEL = ' ';

/**
 * Put `el` in the middle of what's actually visible: the area above the phone
 * keyboard (the visual viewport), not the whole page. Centring in the page
 * instead put the row under the keyboard or pushed it past the top.
 */
export function centreInView(el: HTMLElement | null | undefined): void {
  if (!el) return;
  const vv = window.visualViewport;
  const r = el.getBoundingClientRect();
  const visTop = vv ? vv.offsetTop : 0;
  const visH = vv ? vv.height : window.innerHeight;
  const delta = r.top + r.height / 2 - (visTop + visH / 2);
  if (Math.abs(delta) < 8) return;
  try { window.scrollBy({ top: delta, behavior: 'smooth' }); } catch { window.scrollBy(0, delta); }
}

const PhoneKeys = forwardRef<PhoneKeysHandle, Props>(function PhoneKeys({ onLetter, onBack, onEnter, target, label }, ref) {
  const box = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => ({
    // preventScroll: the box sits at the foot of the screen; we scroll to the game spot ourselves.
    focus: () => {
      box.current?.focus({ preventScroll: true });
      // Once the keyboard has slid up, centre the spot above it.
      window.setTimeout(() => centreInView(target?.current), 350);
    },
    blur: () => box.current?.blur(),
  }));

  // When the keyboard opens (the visible area shrinks) bring the spot into view.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv || !target) return;
    let t = 0;
    const show = () => {
      if (document.activeElement !== box.current) return;
      // Wait for the keyboard to finish moving, then centre once.
      window.clearTimeout(t);
      t = window.setTimeout(() => centreInView(target.current), 120);
    };
    vv.addEventListener('resize', show);
    return () => { vv.removeEventListener('resize', show); window.clearTimeout(t); };
  }, [target]);

  return (
    <input
      ref={box}
      aria-label={label}
      value={SENTINEL}
      autoCapitalize="characters"
      autoComplete="off"
      autoCorrect="off"
      spellCheck={false}
      inputMode="text"
      enterKeyHint="go"
      onChange={(e) => {
        const v = e.target.value;
        if (v.length < SENTINEL.length) onBack();
        else for (const ch of v.replace(SENTINEL, '').toUpperCase()) if (/^[A-Z]$/.test(ch)) onLetter(ch);
      }}
      onKeyDown={(e) => {
        // The game's own listener (arrow keys on a computer) must not get these too.
        if (e.key === 'Enter') { e.preventDefault(); onEnter?.(); }
        if (e.key === 'Enter' || e.key === 'Backspace' || e.key.length === 1) e.stopPropagation();
        // Backspace on a computer: the box keeps its space, so act here.
        if (e.key === 'Backspace') { e.preventDefault(); onBack(); }
      }}
      // 16px stops iPhones zooming in; invisible but still focusable. Mid-screen,
      // so the phone has no reason to scroll the page to show it.
      style={{ position: 'fixed', left: 0, top: '40%', width: 1, height: 1, opacity: 0, fontSize: 16, border: 0, padding: 0, pointerEvents: 'none' }}
    />
  );
});
export default PhoneKeys;
