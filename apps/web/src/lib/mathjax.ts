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

export async function typesetMath(el: Element | null): Promise<void> {
  if (!el || typeof window === 'undefined') return;
  try {
    await ensureMathJax();
    const w = window as unknown as MathJaxWindow;
    await w.MathJax?.typesetPromise?.([el]);
  } catch {
    // raw TeX remains visible — never blank
  }
}

export function escHtml(s: string): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
