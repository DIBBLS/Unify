import { Link } from 'react-router-dom';
import { LEADERBOARD } from '../lib/features';
import { Trophy } from 'lucide-react';
import { CrosswordIcon, KeywordsIcon } from './GameIcons';
import { ROUTES } from '../lib/routes';
import GameLeaderboard from './GameLeaderboard';

// End of a week's notes: practise the key terms you just read in Keywords or
// Crossword (the week's leaderboard is held for now: lib/features).
export default function PracticeGames({ course, week }: { course: string; week: number }) {
  return (
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
      <div>
        <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: 1, color: 'var(--u-good)' }}>PRACTICE THIS WEEK</div>
        <div style={{ fontSize: 14, marginTop: 4, color: 'var(--text2)' }}>Lock in this week's key terms with a quick game. Every word comes from these notes.</div>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to={ROUTES.keywords(course, week)} className="btn btn--green btn--sm"><KeywordsIcon size={15} /> Keywords</Link>
        <Link to={ROUTES.crossword(course, week)} className="btn btn--white btn--sm"><CrosswordIcon size={15} /> Crossword</Link>
      </div>
      {LEADERBOARD && <GameLeaderboard course={course} week={week} limit={3} />}
      <Link to={`${ROUTES.games}?course=${encodeURIComponent(course)}`} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, fontWeight: 700, color: 'var(--u-good)', textDecoration: 'none' }}>
        <Trophy size={14} /> {LEADERBOARD ? 'See all leaderboards' : 'All course games'}
      </Link>
    </div>
  );
}
