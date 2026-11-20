import { CheckCheck, Grid3x3, Shuffle, TextCursorInput, WholeWord } from 'lucide-react';

// One icon per course game, used everywhere the game appears (Home, Games,
// the course page, the end of a week), so each game is recognisable at a
// glance and none share the generic controller icon:
//  - Keywords: spell a whole word from a wheel of letters → a word.
//  - Crossword: terms crossing on a grid → a grid.
//  - Term of the Day: guess a word in coloured tiles → the tiles themselves.
export const KeywordsIcon = WholeWord;
export const CrosswordIcon = Grid3x3;
// Match-up: pair terms with meanings → two crossing arrows.
export const MatchIcon = Shuffle;
// True or False: judge each statement → a double tick.
export const TrueFalseIcon = CheckCheck;
// Fill the gap: put the missing term back in a sentence → a text box with a cursor.
export const GapFillIcon = TextCursorInput;

// Term of the Day's tiles: a 3×3 of right (green), close (amber) and wrong
// (grey) letters, like a finished guess board. Meant for dark backgrounds.
const TILES = ['var(--u-green)', 'var(--u-amber)', '#8a8a8a', '#8a8a8a', 'var(--u-green)', 'var(--u-amber)', 'var(--u-green)', 'var(--u-green)', 'var(--u-green)'];
export function TermTiles({ size = 12 }: { size?: number }) {
  const gap = Math.max(2, Math.round(size / 4));
  return (
    <span style={{ display: 'grid', gridTemplateColumns: `repeat(3, ${size}px)`, gap, flexShrink: 0 }} aria-hidden="true">
      {TILES.map((c, i) => <span key={i} style={{ width: size, height: size, borderRadius: Math.max(2, Math.round(size / 4)), background: c }} />)}
    </span>
  );
}
