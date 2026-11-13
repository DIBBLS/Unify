import { useEffect, useState } from 'react';
import { api, type BugReport } from '../../lib/api';
import { errorToast } from '../../lib/errors';
import { toastSuccess } from '../../lib/toast';
import { SectionSkeleton } from '../../components/Skeletons';

// Admin › Bug reports: what people reported from Me › Report a bug (or an
// error screen), newest first, with who sent it, the screen, app version and
// device. Resolve when fixed; resolved ones stay readable under their tab.
const card: React.CSSProperties = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 14 };

export default function AdminBugs() {
  const [tab, setTab] = useState<'open' | 'resolved'>('open');
  const [data, setData] = useState<{ open: number; reports: BugReport[] } | null>(null);
  const load = () => { setData(null); api.adminBugReports(tab).then(setData).catch((e) => { errorToast(e, 'load bug reports'); setData({ open: 0, reports: [] }); }); };
  useEffect(load, [tab]);

  const set = async (r: BugReport, action: 'resolve' | 'reopen') => {
    try {
      await api.adminBugReportSet(r.id, action);
      toastSuccess(action === 'resolve' ? 'Marked as resolved.' : 'Reopened.');
      setData((d) => (d ? { open: d.open + (action === 'resolve' ? -1 : 1), reports: d.reports.filter((x) => x.id !== r.id) } : d));
    } catch (e) {
      errorToast(e, action === 'resolve' ? 'resolve that' : 'reopen that');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        {(['open', 'resolved'] as const).map((t) => (
          <button key={t} className={`chip chip--sm${tab === t ? ' chip--on' : ''}`} onClick={() => setTab(t)}>
            {t === 'open' ? `Open${data && tab === 'open' ? ` · ${data.open}` : ''}` : 'Resolved'}
          </button>
        ))}
      </div>
      {!data && <SectionSkeleton rows={3} quote={false} />}
      {data && data.reports.length === 0 && (
        <div style={{ ...card, fontSize: 13, color: 'var(--text2)' }}>{tab === 'open' ? 'No open bug reports. Nice.' : 'Nothing resolved yet.'}</div>
      )}
      {data?.reports.map((r) => (
        <div key={r.id} style={{ ...card, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 800, fontSize: 14 }}>{r.by.name}</span>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>{r.by.role}{r.by.email ? ` · ${r.by.email}` : ''}</span>
            <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text2)' }}>{new Date(r.createdAt).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}</span>
          </div>
          <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{r.what}</div>
          {r.doing && <div style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'pre-wrap' }}><b>Doing:</b> {r.doing}</div>}
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {[r.page && `Screen ${r.page}`, r.appVersion && `v${r.appVersion}`, r.device].filter(Boolean).join(' · ')}
          </div>
          <div>
            <button className="btn btn--white btn--sm" onClick={() => void set(r, r.status === 'open' ? 'resolve' : 'reopen')}>
              {r.status === 'open' ? 'Mark resolved' : 'Reopen'}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
