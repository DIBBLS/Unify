// Single math renderer for the whole app (BUG-002 + UNIFY_MATHJAX_RULE).
// MathJax v3 (tex-chtml) typesets \(...\) inline and \[...\] display
// segments wherever note HTML renders. Loaded once from CDN; if it fails
// (offline), the raw TeX stays readable instead of a blank box.

type MathJaxWindow = {
  MathJax?: {
    typesetPromise?: (els?: Element[]) => Promise<unknown>;
    startup?: { promise?: Promise<unknown> };
  };
};

let loadPromise: Promise<void> | null = null;

export function ensureMathJax(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') return Promise.resolve();
  const w = window as unknown as MathJaxWindow;
  if (w.MathJax?.typesetPromise) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = new Promise((resolve) => {
    let settled = false;
    const done = () => {
      if (!settled) {
        settled = true;
        resolve();
      }
    };
    try {
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js';
      s.async = true;
      s.onload = done;
      s.onerror = done;
      document.head.appendChild(s);
      window.setTimeout(done, 8000);
    } catch {
      done();
    }
  });
  return loadPromise;
}

// Typesets `el` and reports whether it actually succeeded. False means
// "caller must fall back to glyph text" — a missing CDN, a rejected typeset
// (malformed TeX) or a hung font fetch must never leave raw \( \) code on
// screen. Races the typeset against a deadline so it can never hang.
export async function typesetMath(el: Element | null): Promise<boolean> {
  if (!el || typeof window === 'undefined') return false;
  try {
    await ensureMathJax();
    const w = window as unknown as MathJaxWindow;
    // Script onload can fire before MathJax finishes startup, when
    // typesetPromise is still undefined — that used to no-op silently and
    // leave raw TeX (\sqrt ...) on screen. Wait for startup, then poll
    // briefly for typesetPromise before giving up.
    if (w.MathJax?.startup?.promise) {
      await Promise.race([
        Promise.resolve(w.MathJax.startup.promise),
        new Promise((r) => setTimeout(r, 4000)),
      ]).catch(() => undefined);
    }
    for (let i = 0; i < 25 && w.MathJax && !w.MathJax.typesetPromise; i++) {
      await new Promise((r) => setTimeout(r, 200));
    }
    if (!w.MathJax?.typesetPromise) return false;
    const run = async (): Promise<boolean> => {
      try {
        await w.MathJax!.typesetPromise!([el]);
        return true;
      } catch {
        // One retry after a clear — a poisoned queue state rejects the
        // first call; the second usually lands.
        try {
          (w.MathJax as { typesetClear?: (els?: Element[]) => void }).typesetClear?.([el]);
          await w.MathJax!.typesetPromise!([el]);
          return true;
        } catch {
          return false;
        }
      }
    };
    return await Promise.race([
      run(),
      new Promise<boolean>((r) => setTimeout(() => r(false), 6000)),
    ]);
  } catch {
    return false;
  }
}

export function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
