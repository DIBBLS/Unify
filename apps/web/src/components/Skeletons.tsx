// Structural loading skeletons: each one mirrors its screen's real
// containers (same widths, paddings, gaps) so content settles in with
// zero layout shift. Generic mascot spinners stay only on transient
// screens (auth gates, studio jobs, share landings).
import LoadingQuote from './LoadingQuote';

// The rotating fact/proverb sits AFTER the skeleton: at the top it pushed the
// placeholders down, so the real page jumped up when it arrived. Skeletons are
// kept short enough that it still shows above the tab bar.
export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div role="status" aria-label="Loading" style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      {children}
      <LoadingQuote style={{ margin: '24px auto 0' }} />
    </div>
  );
}

// Home. Students: the dark greeting card (week tracker, greeting, name, proverb,
// Box Boy), the four stats, the updates slider, then the course cards in one
// column. Authors keep their header + panel stack.
export function DashboardSkeleton({ author }: { author: boolean }) {
  const stats = (
    <div style={{ margin: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div className="skel" style={{ height: 18, width: 36 }} />
          <div className="skel" style={{ height: 11, width: 44 }} />
        </div>
      ))}
    </div>
  );
  if (author) {
    return (
      <div role="status" aria-label="Loading" style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', paddingBottom: 96 }}>
        <div style={{ padding: '20px 16px 12px', background: 'var(--surface)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div className="skel" style={{ height: 11, width: 110 }} />
            <div className="skel" style={{ height: 28, width: '70%', marginTop: 8 }} />
            <div className="skel" style={{ height: 13, width: '55%', marginTop: 8 }} />
          </div>
          <div className="skel" style={{ width: 64, height: 64, borderRadius: 16, flexShrink: 0 }} />
        </div>
        {stats}
        <div style={{ margin: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ height: 66, borderRadius: 12 }} />
          {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 64, borderRadius: 12 }} />)}
        </div>
        <LoadingQuote style={{ margin: '20px auto 0' }} />
      </div>
    );
  }
  return (
    <div role="status" aria-label="Loading" style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', paddingBottom: 80 }}>
      <div className="card card--dark" style={{ margin: 16, padding: '24px 20px 30px' }}>
        <div className="skel skel--dark" style={{ height: 26, width: 220, borderRadius: 14, marginBottom: 20 }} />
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div style={{ flex: 1 }}>
            <div className="skel skel--dark" style={{ height: 11, width: 150 }} />
            <div className="skel skel--dark" style={{ height: 28, width: '55%', marginTop: 10 }} />
            <div className="skel skel--dark" style={{ height: 13, width: '92%', marginTop: 12 }} />
            <div className="skel skel--dark" style={{ height: 13, width: '70%', marginTop: 6 }} />
            <div className="skel skel--dark" style={{ height: 13, width: '80%', marginTop: 12 }} />
          </div>
          <div className="skel skel--dark" style={{ width: 72, height: 96, borderRadius: 16, flexShrink: 0 }} />
        </div>
      </div>
      {stats}
      <div className="skel" style={{ height: 150, borderRadius: 16, margin: '0 16px 12px' }} />
      <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="skel" style={{ height: 20, width: 130 }} />
        <div className="skel" style={{ height: 14, width: 110 }} />
      </div>
      <div style={{ margin: '12px 16px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ aspectRatio: '1 / 1', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div className="skel" style={{ width: 34, height: 34, borderRadius: 9999 }} />
              <div className="skel" style={{ width: 56, height: 16, borderRadius: 9999 }} />
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              <div className="skel" style={{ height: 18, width: '60%' }} />
              <div className="skel" style={{ height: 11, width: '90%' }} />
            </div>
            <div className="skel" style={{ height: 4, borderRadius: 9999 }} />
            <div className="skel" style={{ height: 10, width: '55%' }} />
          </div>
        ))}
      </div>
      <LoadingQuote style={{ margin: '8px auto 0' }} />
    </div>
  );
}

export function SearchListSkeleton({ titleWidth = '45%', rows = 5, withIcon = true, withAction = true }: { titleWidth?: string; rows?: number; withIcon?: boolean; withAction?: boolean }) {
  return (
    <PageShell>
      <div className="skel" style={{ height: 32, width: titleWidth, marginTop: 4 }} />
      <div className="skel" style={{ height: 14, width: '70%', marginTop: 10 }} />
      <div className="skel" style={{ height: 12, width: '50%', marginTop: 8 }} />
      <div className="skel" style={{ height: 42, borderRadius: 12, marginTop: 10 }} />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
            {withIcon && <div className="skel" style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0 }} />}
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ height: 16, width: '45%' }} />
              <div className="skel" style={{ height: 12, width: '80%', marginTop: 8 }} />
            </div>
            {withAction && <div className="skel" style={{ height: 30, width: 64, borderRadius: 9999, flexShrink: 0 }} />}
          </div>
        ))}
      </div>
    </PageShell>
  );
}

export function ClassesSkeleton() {
  return (
    <PageShell>
      <div className="skel" style={{ height: 32, width: '45%', marginTop: 4 }} />
      <div className="skel" style={{ height: 14, width: '80%', marginTop: 10 }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
        {[0, 1].map((i) => (
          <div key={i} className="skel" style={{ height: 34, flex: 1, borderRadius: 9999 }} />
        ))}
      </div>
      <div className="skel" style={{ height: 20, width: 160, marginTop: 16 }} />
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1].map((i) => (
          <div key={i} className="skel" style={{ height: 62, borderRadius: 12 }} />
        ))}
      </div>
      <div className="skel" style={{ height: 230, borderRadius: 12, marginTop: 12 }} />
      <div className="skel" style={{ height: 20, width: 180, marginTop: 20 }} />
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="skel" style={{ height: 60, borderRadius: 12 }} />
        ))}
      </div>
    </PageShell>
  );
}


const row = { padding: '14px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12 } as const;

/** The one loading look for a section inside a page (a list, a card group): rows
 *  shaped like the real rows, then a rotating line. Page-level skeletons above
 *  use the same rows, so every wait in the app has the same structure. */
export function SectionSkeleton({ rows = 3, quote = true }: { rows?: number; quote?: boolean }) {
  return (
    <div role="status" aria-label="Loading" style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ ...row, display: 'flex', gap: 12, alignItems: 'center' }}>
          <div className="skel" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skel" style={{ height: 15, width: '55%' }} />
            <div className="skel" style={{ height: 12, width: '85%', marginTop: 8 }} />
          </div>
        </div>
      ))}
      {quote && <LoadingQuote style={{ margin: '16px auto 0' }} />}
    </div>
  );
}

/** Title + subtitle + a stack of cards (Courses, Notifications, Add courses lists). */
export function ListSkeleton({ rows = 4, titleWidth = '40%' }: { rows?: number; titleWidth?: string }) {
  return (
    <PageShell>
      <div className="skel" style={{ height: 32, width: titleWidth, marginTop: 4 }} />
      <div className="skel" style={{ height: 14, width: '65%', marginTop: 10 }} />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} style={{ ...row, display: 'flex', gap: 12, alignItems: 'center' }}>
            <div className="skel" style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ height: 15, width: '55%' }} />
              <div className="skel" style={{ height: 12, width: '85%', marginTop: 8 }} />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/** Course page (design S23): Back, title and code line, the lecturer card,
 *  Save for offline / Report, the week bar, the three tabs, then week cards. */
export function DetailSkeleton() {
  return (
    <PageShell>
      <div className="skel" style={{ height: 18, width: 64, marginBottom: 16 }} />
      <div className="skel" style={{ height: 28, width: '70%' }} />
      <div className="skel" style={{ height: 13, width: '55%', marginTop: 10 }} />
      <div style={{ ...row, marginTop: 12, display: 'flex', gap: 12, alignItems: 'center', borderRadius: 16 }}>
        <div className="skel" style={{ width: 48, height: 48, borderRadius: 9999, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 15, width: '50%' }} />
          <div className="skel" style={{ height: 12, width: '40%', marginTop: 6 }} />
          <div className="skel" style={{ height: 12, width: '85%', marginTop: 6 }} />
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
        <div className="skel" style={{ height: 32, width: 140, borderRadius: 9999 }} />
        <div className="skel" style={{ height: 14, width: 110, marginTop: 9 }} />
      </div>
      <div className="skel" style={{ height: 6, borderRadius: 9999, marginTop: 16 }} />
      <div style={{ display: 'flex', gap: 6, marginTop: 16 }}>
        {[72, 76, 80].map((w, i) => <div key={i} className="skel" style={{ height: 32, width: w, borderRadius: 9999 }} />)}
      </div>
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ ...row, display: 'flex', gap: 12, alignItems: 'center', borderRadius: 18 }}>
            <div className="skel" style={{ width: 46, height: 46, borderRadius: 14, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skel" style={{ height: 15, width: '30%' }} />
              <div className="skel" style={{ height: 12, width: '70%', marginTop: 6 }} />
              <div className="skel" style={{ height: 11, width: '45%', marginTop: 6 }} />
            </div>
          </div>
        ))}
      </div>
    </PageShell>
  );
}

/** The note reader, shape for shape: Back, the action pills, the dark week
 *  header (eyebrow, title, subtitle, chips), topic tabs, the narration bar,
 *  then the topic heading and subtopic cards. Same width and padding as the
 *  reader, so nothing jumps when the notes arrive. */
export function ReaderSkeleton() {
  return (
    <div role="status" aria-label="Loading the notes" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 100px' }}>
      <div className="skel" style={{ height: 18, width: 64, marginBottom: 16 }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        {[118, 84, 84].map((w, i) => <div key={i} className="skel" style={{ height: 34, width: w, borderRadius: 9999 }} />)}
      </div>
      <div className="hero" style={{ minHeight: 150 }}>
        <div className="skel skel--dark" style={{ height: 10, width: 120, marginBottom: 14 }} />
        <div className="skel skel--dark" style={{ height: 24, width: '82%' }} />
        <div className="skel skel--dark" style={{ height: 24, width: '55%', marginTop: 8 }} />
        <div className="skel skel--dark" style={{ height: 13, width: '70%', marginTop: 12 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          {[70, 90, 110].map((w, i) => <div key={i} className="skel skel--dark" style={{ height: 24, width: w, borderRadius: 20 }} />)}
        </div>
      </div>
      <div className="segbar">
        {[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ flex: 1, height: 34, borderRadius: 9999 }} />)}
      </div>
      <div className="skel" style={{ height: 58, borderRadius: 14, marginBottom: 12 }} />
      <div className="skel" style={{ height: 10, width: 64, marginTop: 8 }} />
      <div className="skel" style={{ height: 24, width: '68%', marginTop: 10 }} />
      {[0, 1].map((b) => (
        <div key={b}>
          <div className="subtopic-heading">
            <div className="skel" style={{ height: 22, width: 44, borderRadius: 9999 }} />
            <div className="skel" style={{ height: 16, width: '48%' }} />
          </div>
          <div className="topic-card">
            {[100, 97, 92, 64].map((w, i) => <div key={i} className="skel" style={{ height: 13, width: `${w}%`, marginTop: i ? 10 : 0 }} />)}
          </div>
        </div>
      ))}
      <LoadingQuote style={{ margin: '8px auto 0' }} />
    </div>
  );
}

/** Me: Back, the avatar row (picture, name, email, Box Boy), the details
 *  card, then the link rows (class list, guide, settings…). */
export function ProfileSkeleton() {
  return (
    <div role="status" aria-label="Loading" style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '24px 16px 80px' }}>
      <div className="skel" style={{ height: 18, width: 64, marginBottom: 16 }} />
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div className="skel" style={{ width: 64, height: 64, borderRadius: 9999, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 22, width: '50%' }} />
          <div className="skel" style={{ height: 13, width: '75%', marginTop: 8 }} />
        </div>
        <div className="skel" style={{ width: 52, height: 64, borderRadius: 14, flexShrink: 0 }} />
      </div>
      <div style={{ ...row, padding: 0, overflow: 'hidden', marginBottom: 16 }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <div className="skel" style={{ height: 13, width: 90 }} />
            <div className="skel" style={{ height: 13, width: 120 }} />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...row, padding: 14, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div className="skel" style={{ height: 13, width: '35%' }} />
            <div className="skel" style={{ height: 12, width: '70%', marginTop: 6 }} />
          </div>
          <div className="skel" style={{ height: 12, width: 8 }} />
        </div>
      ))}
      <LoadingQuote style={{ margin: '20px auto 0' }} />
    </div>
  );
}

/** A course game (Keywords, Crossword): Back, label, the level title and
 *  progress bar, the clue card, then the board (word boxes or grid). */
export function GameSkeleton({ grid = false }: { grid?: boolean }) {
  return (
    <div role="status" aria-label="Loading the game" className="g-shell">
      <div className="skel" style={{ height: 18, width: 64, marginBottom: 16 }} />
      <div className="skel" style={{ height: 11, width: 160 }} />
      <div className="g-head">
        <div className="skel" style={{ height: 24, width: 96 }} />
        <div className="skel" style={{ flex: 1, height: 16, borderRadius: 9999 }} />
      </div>
      <div className="g-layout">
        <div className="g-main">
          <div className="skel" style={{ height: 76, borderRadius: 18 }} />
          {grid ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4, maxWidth: 360, width: '100%', margin: '0 auto' }}>
              {Array.from({ length: 40 }, (_, i) => <div key={i} className="skel" style={{ aspectRatio: '1', borderRadius: 8, opacity: (i * 7) % 5 === 0 ? 0 : 1 }} />)}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              {[7, 5, 4, 4].map((n, r) => (
                <div key={r} style={{ display: 'flex', gap: 5 }}>
                  {Array.from({ length: n }, (_, i) => <div key={i} className="skel" style={{ width: r ? 32 : 40, height: r ? 36 : 44, borderRadius: 10 }} />)}
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="g-side">
          {grid ? (
            <div className="skel" style={{ height: 160, borderRadius: 14 }} />
          ) : (
            <div className="skel" style={{ width: 'clamp(220px, min(84vw, 40svh), 340px)', aspectRatio: '1', borderRadius: '50%', margin: '46px auto 0' }} />
          )}
        </div>
      </div>
    </div>
  );
}

/** A centred prompt, one input and a button (CGPA planner, onboarding). */
export function FormSkeleton() {
  return (
    <PageShell>
      <div className="skel" style={{ height: 16, width: 70, margin: '8px auto 0' }} />
      <div className="skel" style={{ width: 110, height: 110, borderRadius: 24, margin: '28px auto 0' }} />
      <div className="skel" style={{ height: 28, width: '70%', margin: '24px auto 0' }} />
      <div className="skel" style={{ height: 14, width: '55%', margin: '12px auto 0' }} />
      <div className="skel" style={{ height: 72, borderRadius: 16, margin: '28px auto 0', maxWidth: 280 }} />
      <div className="skel" style={{ height: 54, borderRadius: 16, marginTop: 36 }} />
    </PageShell>
  );
}

/** Section picker, stat tiles and a content card (Admin). */
export function AdminSkeleton() {
  return (
    <PageShell>
      <div className="skel" style={{ height: 28, width: 120, marginTop: 4 }} />
      <div className="skel" style={{ height: 48, borderRadius: 14, marginTop: 14 }} />
      <div className="skel" style={{ height: 110, borderRadius: 18, marginTop: 14 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 8, marginTop: 12 }}>
        {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 76, borderRadius: 12 }} />)}
      </div>
      <div className="skel" style={{ height: 160, borderRadius: 12, marginTop: 12 }} />
    </PageShell>
  );
}

/** Lecturer Home (design L07): the dark header, the photo nudge, then Your
 *  courses with level tabs and course cards. (Today's class card only shows
 *  when there is a class, so it gets no placeholder: no second hero.) */
export function LecturerHomeSkeleton() {
  return (
    <div role="status" aria-label="Loading" style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', paddingBottom: 80 }}>
      <div className="card card--dark" style={{ margin: 16, padding: '22px 20px 26px', display: 'flex', gap: 14, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div className="skel skel--dark" style={{ height: 11, width: 70 }} />
          <div className="skel skel--dark" style={{ height: 26, width: '60%', marginTop: 10 }} />
          <div className="skel skel--dark" style={{ height: 13, width: '75%', marginTop: 10 }} />
        </div>
        <div className="skel skel--dark" style={{ width: 64, height: 84, borderRadius: 14, flexShrink: 0 }} />
      </div>
      <div className="skel" style={{ height: 64, borderRadius: 12, margin: '0 16px 12px' }} />
      <div style={{ margin: '16px 16px 0' }}><div className="skel" style={{ height: 20, width: 130 }} /></div>
      <div style={{ display: 'flex', gap: 6, margin: '10px 16px 0' }}>
        {[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 32, width: 72, borderRadius: 9999 }} />)}
      </div>
      <CourseCardSkeletons />
      <LoadingQuote style={{ margin: '8px auto 0' }} />
    </div>
  );
}

/** The lecturer's course cards (department/number tile, title, count). */
export function CourseCardSkeletons({ rows = 3 }: { rows?: number }) {
  return (
    <div style={{ margin: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', padding: 14 }}>
          <div className="skel" style={{ width: 52, height: 52, borderRadius: 14, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skel" style={{ height: 15, width: '60%' }} />
            <div className="skel" style={{ height: 12, width: '35%', marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Timetable (day view): hours down the side with a couple of class blocks. */
export function TimetableSkeleton() {
  const hours = [0, 1, 2, 3, 4, 5, 6];
  return (
    <div role="status" aria-label="Loading the timetable" style={{ position: 'relative', marginTop: 12, padding: '10px 10px 10px 0', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, height: 6 * 60 + 22 }}>
      {hours.map((h) => (
        <div key={h} style={{ position: 'absolute', left: 0, right: 10, top: 10 + h * 60, display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="skel" style={{ width: 30, height: 10, marginLeft: 12 }} />
          <span style={{ flex: 1, borderTop: '1px dashed var(--border)' }} />
        </div>
      ))}
      <div className="skel" style={{ position: 'absolute', left: 64, right: 12, top: 14, height: 112, borderRadius: 12 }} />
      <div className="skel" style={{ position: 'absolute', left: 64, right: 12, top: 254, height: 52, borderRadius: 12 }} />
    </div>
  );
}

/** A short step-by-step onboarding (progress bar, one card, a button). */
export function StepsSkeleton() {
  return (
    <div role="status" aria-label="Loading" style={{ maxWidth: 'min(var(--shell, 480px), 560px)', margin: '0 auto', padding: '20px 16px 96px' }}>
      <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>{[0, 1, 2, 3].map((i) => <div key={i} className="skel" style={{ flex: 1, height: 6, borderRadius: 9999 }} />)}</div>
      <div className="card" style={{ marginTop: 16, padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
        <div className="skel" style={{ width: 110, height: 130, borderRadius: 16 }} />
        <div className="skel" style={{ height: 11, width: 80 }} />
        <div className="skel" style={{ height: 26, width: '65%' }} />
        <div className="skel" style={{ height: 13, width: '90%' }} />
        <div className="skel" style={{ height: 13, width: '80%' }} />
      </div>
      <div className="skel" style={{ height: 55, borderRadius: 28, marginTop: 16 }} />
    </div>
  );
}
