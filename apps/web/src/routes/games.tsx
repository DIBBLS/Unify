import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Gamepad2, Grid3x3 } from 'lucide-react';
import { api } from '../lib/api';
import { ROUTES } from '../lib/routes';
import BackButton from '../components/BackButton';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Chip, Chips, Display, Label } from '../components/redesign/ui';
import GameLeaderboard from '../components/GameLeaderboard';

// Practice games: one place to pick a course and a week and jump into
// Keywords or Crossword, and to see the leaderboards (the whole course, or
// one week). Announcements on Home can point here, since a game on its own
// needs a course and a week. ?course=CODE opens on that course.
type Week = { week: number; title: string; topics: number; done: number };

export default function GamesRoute() {
  const [courses, setCourses] = useState<{ code: string; title: string }[] | null>(null);
  const [course, setCourse] = useState('');
  const [weeks, setWeeks] = useState<Week[] | null>(null);
  const [err, setErr] = useState('');
  const [params] = useSearchParams();
  const wanted = (params.get('course') || '').toUpperCase().trim();
  // Which leaderboard: the whole course, or one week.
  const [boardWeek, setBoardWeek] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const me = await api.me();
        const codes = (me.courses || []).map((c) => (c || '').toUpperCase().trim()).filter(Boolean);
        let titles: Record<string, string> = {};
        try { titles = Object.fromEntries((await api.courses()).map((c) => [c.code.toUpperCase(), c.title])); } catch { /* codes only */ }
        setCourses(codes.map((code) => ({ code, title: titles[code] || '' })));
        setCourse(codes.includes(wanted) ? wanted : codes[0] || '');
      } catch {
        setErr("Couldn't load your courses. Check your network and try again.");
      }
    })();
  }, []);

  useEffect(() => {
    if (!course) return;
    setWeeks(null);
    setBoardWeek(null);
    api.myCourseProgress(course)
      .then((r) => setWeeks(r.weeks || []))
      .catch(() => setWeeks([]));
  }, [course]);

  // Weeks you've started first (most recent at the top), then the rest in order.
  const sorted = weeks ? [...weeks].sort((a, b) => (b.done > 0 ? 1 : 0) - (a.done > 0 ? 1 : 0) || (a.done > 0 ? b.week - a.week : a.week - b.week)) : null;

  return (
    <div className="g-shell" style={{ maxWidth: 'min(var(--shell, 480px), 720px)' }}>
      <BackButton to={ROUTES.home} />
      <Label>Practice</Label>
      <Display size={28}>Course games</Display>
      <div className="t-14 muted" style={{ marginTop: 4 }}>Spell the week's key terms in Keywords, or cross them in a Crossword. Every word comes from your notes.</div>

      {err && <div className="t-14" style={{ color: 'var(--u-red)', marginTop: 12 }}>{err}</div>}
      {!err && !courses && <div className="t-13 muted" style={{ marginTop: 12 }}>Loading your courses…</div>}
      {courses && courses.length === 0 && (
        <Card style={{ alignItems: 'center', textAlign: 'center', gap: 10, marginTop: 14 }}>
          <BoxBoy pose="peeking" width={110} />
          <Display size={22}>No courses yet</Display>
          <div className="t-14 muted">Add your courses and their weeks show up here to play.</div>
          <Link to={ROUTES.findCourses} className="btn btn--amber btn--block">Find courses</Link>
        </Card>
      )}

      {courses && courses.length > 1 && (
        <div style={{ marginTop: 14 }}>
          <Chips>
            {courses.map((c) => <Chip key={c.code} on={c.code === course} onClick={() => setCourse(c.code)}>{c.code}</Chip>)}
          </Chips>
        </div>
      )}

      {course && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 16 }}>
          <div className="t-13 w-7" style={{ color: 'var(--text2)', letterSpacing: 1 }}>LEADERBOARD</div>
          {weeks && weeks.length > 0 && (
            <Chips>
              <Chip small on={boardWeek == null} onClick={() => setBoardWeek(null)}>Whole course</Chip>
              {weeks.map((w) => <Chip key={w.week} small on={boardWeek === w.week} onClick={() => setBoardWeek(w.week)}>Week {w.week}</Chip>)}
            </Chips>
          )}
          <GameLeaderboard course={course} week={boardWeek ?? undefined} title={boardWeek ? `${course} · Week ${boardWeek}` : `${course} · whole course`} />
        </div>
      )}

      {course && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 18 }}>
          <div className="t-13 w-7" style={{ color: 'var(--text2)', letterSpacing: 1 }}>PLAY A WEEK</div>
          {!sorted && <div className="t-13 muted">Loading weeks…</div>}
          {sorted && sorted.length === 0 && <div className="t-14 muted">No weeks published for {course} yet.</div>}
          {sorted?.map((w) => (
            <Card key={w.week} pad={14} gap={10} className="g-in">
              <div>
                <div className="t-13 w-7" style={{ color: 'var(--u-good)' }}>{course} · Week {w.week}{w.done > 0 ? ' · started' : ''}</div>
                <div className="t-15 w-7" style={{ marginTop: 2 }}>{w.title || `Week ${w.week}`}</div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Link to={ROUTES.keywords(course, w.week)} className="btn btn--green btn--sm"><Gamepad2 size={15} /> Keywords</Link>
                <Link to={ROUTES.crossword(course, w.week)} className="btn btn--white btn--sm"><Grid3x3 size={15} /> Crossword</Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
