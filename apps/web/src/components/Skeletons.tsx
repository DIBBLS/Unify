// Structural loading skeletons: each one mirrors its screen's real
// containers (same widths, paddings, gaps) so content settles in with
// zero layout shift. Generic mascot spinners stay only on transient
// screens (auth gates, studio jobs, share landings).
import LoadingQuote from './LoadingQuote';

export function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 80px' }}>
      {children}
      <LoadingQuote style={{ margin: '28px auto 0' }} />
    </div>
  );
}

export function DashboardSkeleton({ author }: { author: boolean }) {
  return (
    <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', paddingBottom: 80 }}>
      <div style={{ padding: '20px 16px 12px', background: 'var(--surface)', display: 'flex', gap: 12, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 11, width: 110 }} />
          <div className="skel" style={{ height: 28, width: '70%', marginTop: 8 }} />
          <div className="skel" style={{ height: 13, width: '55%', marginTop: 8 }} />
          <div className="skel" style={{ height: 13, width: '40%', marginTop: 6 }} />
        </div>
        <div className="skel" style={{ width: 64, height: 64, borderRadius: 16, flexShrink: 0 }} />
      </div>
      <div style={{ margin: '12px 16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 16, display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
            <div className="skel" style={{ height: 18, width: 36 }} />
            <div className="skel" style={{ height: 11, width: 44 }} />
          </div>
        ))}
      </div>
      {author ? (
        <div style={{ margin: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="skel" style={{ height: 66, borderRadius: 12 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel" style={{ height: 64, borderRadius: 12 }} />
          ))}
        </div>
      ) : (
        <>
          <div className="skel" style={{ height: 76, borderRadius: 12, margin: '0 16px' }} />
          <div style={{ margin: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="skel" style={{ height: 20, width: 130 }} />
            <div className="skel" style={{ height: 14, width: 90 }} />
          </div>
          <div style={{ margin: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skel" style={{ height: 118, borderRadius: 14 }} />
            ))}
          </div>
        </>
      )}
      <LoadingQuote style={{ margin: '24px auto 0' }} />
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

/** Back, big title, a hero card, then week rows (course detail). */
export function DetailSkeleton() {
  return (
    <PageShell>
      <div className="skel" style={{ height: 18, width: 60 }} />
      <div className="skel" style={{ height: 30, width: '60%', marginTop: 14 }} />
      <div className="skel" style={{ height: 14, width: '40%', marginTop: 10 }} />
      <div className="skel" style={{ height: 96, borderRadius: 18, marginTop: 16 }} />
      <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[0, 1, 2, 3, 4].map((i) => <div key={i} className="skel" style={{ height: 58, borderRadius: 12 }} />)}
      </div>
    </PageShell>
  );
}

/** Title, byline and paragraphs (the note reader, shared notes). */
export function ReaderSkeleton() {
  return (
    <PageShell>
      <div className="skel" style={{ height: 14, width: 120 }} />
      <div className="skel" style={{ height: 30, width: '75%', marginTop: 12 }} />
      <div className="skel" style={{ height: 14, width: '50%', marginTop: 10 }} />
      {[0, 1, 2].map((b) => (
        <div key={b} style={{ marginTop: 22 }}>
          <div className="skel" style={{ height: 20, width: '45%' }} />
          {[100, 96, 90, 70].map((w, i) => <div key={i} className="skel" style={{ height: 13, width: `${w}%`, marginTop: 10 }} />)}
        </div>
      ))}
    </PageShell>
  );
}

/** Avatar row, detail rows, buttons (Me). */
export function ProfileSkeleton() {
  return (
    <PageShell>
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div className="skel" style={{ width: 64, height: 64, borderRadius: 9999, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div className="skel" style={{ height: 20, width: '50%' }} />
          <div className="skel" style={{ height: 13, width: '70%', marginTop: 8 }} />
        </div>
      </div>
      <div style={{ ...row, padding: 0, overflow: 'hidden' }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 16px', borderTop: i ? '1px solid var(--border)' : 'none' }}>
            <div className="skel" style={{ height: 13, width: 90 }} />
            <div className="skel" style={{ height: 13, width: 120 }} />
          </div>
        ))}
      </div>
      <div className="skel" style={{ height: 48, borderRadius: 14, marginTop: 16 }} />
    </PageShell>
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
