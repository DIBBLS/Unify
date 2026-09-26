import { useCallback, useEffect, useState } from 'react';

export type Design = 'classic' | 'story';
const KEY = 'unify.design.v1';

function initial(): Design {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved === 'story' || saved === 'classic') return saved;
  } catch {
    // ignore — fall through to classic (the previous app design)
  }
  return 'classic';
}

// App-wide design (classic default = the previous look, story = the MEE
// editorial look). Sets data-design on <html> so the CSS system follows.
export function useDesign(): { design: Design; setDesign: (d: Design) => void } {
  const [design, setDesignState] = useState<Design>(initial);

  useEffect(() => {
    document.documentElement.setAttribute('data-design', design);
    try {
      localStorage.setItem(KEY, design);
    } catch {
      // ignore (private mode)
    }
  }, [design]);

  const setDesign = useCallback((d: Design) => setDesignState(d), []);
  return { design, setDesign };
}

// Fire-and-forget boot: apply the saved design before React paints.
export function bootDesign(): void {
  try {
    const saved = localStorage.getItem(KEY);
    document.documentElement.setAttribute('data-design', saved === 'story' ? 'story' : 'classic');
  } catch {
    // ignore
  }
}
