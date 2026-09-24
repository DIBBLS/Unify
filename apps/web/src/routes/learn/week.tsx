import { useEffect, useState } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Download } from 'lucide-react';
import { api, type TopicMeta } from '../../lib/api';
import { log } from '../../lib/log';
import type { UnifyNote, Topic } from '../../types/note';
import { TopicSlice } from '../../components/TopicSlice';
import EoqQuiz from '../../components/EoqQuiz';
import { useProgress } from '../../hooks/useProgress';
import Mascot from '../../components/Mascot';
import ErrorState from '../../components/ErrorState';

export default function LearnPage() {
  const { courseCode = '', week: weekParam } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const weekNum = Number(weekParam) || 1;
  const [note, setNote] = useState<UnifyNote | null>(null);
  const [topicMeta, setTopicMeta] = useState<TopicMeta[]>([]);
  // Older-version views: topic number -> Topic payload + viewed version.
  const [overrides, setOverrides] = useState<Record<number, Topic>>({});
  const [viewed, setViewed] = useState<Record<number, number>>({});
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // React Router already URL-decodes params — never decode again here.
  const { toggle, isDone } = useProgress((courseCode || '').trim().toUpperCase(), weekNum);
  const [tab, setTab] = useState(0);
  const topics = note?.topics ?? [];
  const hasQuiz = (note?.eoq?.questions?.length || 0) > 0;
  const tabCount = topics.length + (hasQuiz ? 1 : 0);

  useEffect(() => {
    if (!note) return;
    const t = Math.min(Math.max(Number(searchParams.get('t')) || 0, 0), Math.max(tabCount - 1, 0));
    setTab((cur) => (cur === t ? cur : t));
  }, [note, searchParams, tabCount]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const code = (courseCode || '').trim();
      if (!courseCode) {
        setLoadError('No course selected. Pick one from Courses.');
        setLoading(false);
        return;
      }
      try {
        // Week + profile load in parallel: a flaky profile check (cold
        // start) must never hide the week. The enrolled-only gate applies
        // only when the check succeeds (authors in ?preview=1 pass through).
        const previewMode = searchParams.get('preview') === '1';
        const [me, data] = await Promise.all([
          api.me().catch(() => null),
          api.week(code, weekNum),
        ]);
        if (me && !previewMode) {
          const role = me.profile?.role || 'student';
          const enrolled = (me.courses || []).map((c) => c.toUpperCase().trim()).includes(code.toUpperCase());
          if ((role === 'student' || !role) && !enrolled) {
            setBlocked(true);
            setLoading(false);
            return;
          }
        }
        const note = data.note_json as UnifyNote;
        const valid = note && Array.isArray(note.topics) ? note : null;
        setNote(valid);
        setTopicMeta(data.topicMeta || []);
        setOverrides({});
        setViewed({});
        // Track the live position for the dashboard Resume card
        // (previews never pollute it).
        if (valid && !previewMode) {
          const count = valid.topics.length + ((valid.eoq?.questions?.length || 0) > 0 ? 1 : 0);
          const t0 = Math.min(Math.max(Number(searchParams.get('t')) || 0, 0), Math.max(count - 1, 0));
          api.resume(data.course, weekNum, t0).catch(() => {});
        }
      } catch {
        setLoadError("Couldn't load this week. Check your connection and retry.");
      } finally {
        setLoading(false);
      }
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseCode, weekNum]);

  if (loading)
    return (
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 100px' }}>
        <div className="skel" style={{ height: 14, width: 90, marginBottom: 16 }} />
        <div style={{ background: '#fff', border: '1px solid #e5e5e5', borderRadius: 12, padding: 24, marginBottom: 20 }}>
          <div className="skel" style={{ height: 12, width: '40%' }} />
          <div className="skel" style={{ height: 26, width: '75%', marginTop: 10 }} />
          <div className="skel" style={{ height: 14, width: '90%', marginTop: 10 }} />
          <div className="skel" style={{ height: 14, width: '60%', marginTop: 8 }} />
        </div>
        <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="skel" style={{ height: 34, flex: '1 0 auto', borderRadius: 9999 }} />
          ))}
        </div>
        <div style={{ marginBottom: 8 }}>
          <div className="skel" style={{ height: 12, width: '30%', marginBottom: 6 }} />
          <div className="skel" style={{ height: 20, width: '65%', marginBottom: 12 }} />
          <div className="skel" style={{ height: 14, width: '100%', marginBottom: 8 }} />
          <div className="skel" style={{ height: 14, width: '100%', marginBottom: 8 }} />
          <div className="skel" style={{ height: 14, width: '80%', marginBottom: 8 }} />
          <div className="skel" style={{ height: 120, width: '100%', marginTop: 12 }} />
        </div>
        <div style={{ fontSize: 12, color: '#777', textAlign: 'center', marginTop: 12 }}>Loading Week {weekNum}…</div>
      </div>
    );
  if (!courseCode) {
    // Unreachable via router links — redirect to courses instead of stranding.
    log.warn('route', `week with empty course (url=${window.location.href})`);
    return <Navigate to="/course" replace />;
  }
  if (loadError)
    return (
      <ErrorState
        title={`Couldn't load Week ${weekNum}`}
        message={loadError}
      />
    );
  if (blocked)
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#777', maxWidth: 480, margin: '0 auto' }}>
        <Mascot size={110} />
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 20, color: '#3c3c3c', marginTop: 12 }}>You're not enrolled in {courseCode}</h1>
        <p style={{ fontSize: 14, margin: '8px 0 20px' }}>Enroll to unlock its weeks, topics and quizzes.</p>
        <button
          onClick={async () => {
            setEnrolling(true);
            try {
              await api.enroll((courseCode || '').trim(), true);
            } catch {
              // reload surfaces the error state either way
            }
            window.location.reload();
          }}
          disabled={enrolling}
          style={{ padding: '12px 28px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', fontWeight: 800, fontSize: 14, opacity: enrolling ? 0.6 : 1 }}
        >
          {enrolling ? 'Enrolling…' : 'Enroll & continue'}
        </button>
        <div style={{ marginTop: 12 }}>
          <button onClick={() => navigate('/explore')} style={{ background: 'none', border: 'none', color: '#059669', fontWeight: 700, fontSize: 13 }}>
            or explore other courses
          </button>
        </div>
      </div>
    );
  if (!note)
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#777' }}>
        <Mascot size={110} />
        <div style={{ marginTop: 12 }}>No content for {courseCode} Week {weekNum} yet.</div>
      </div>
    );

  const preview = searchParams.get('preview') === '1';
  const goTab = (t: number) => {
    const clamped = Math.min(Math.max(t, 0), tabCount - 1);
    setTab(clamped);
    setSearchParams(clamped ? { t: String(clamped) } : {}, { replace: true });
    // Every tab switch moves the Resume bookmark (never for previews).
    if (!preview && !blocked && note) {
      api.resume(note.course, weekNum, clamped).catch(() => {});
    }
  };

  const versionByTopic: Record<number, TopicMeta> = {};
  for (const m of topicMeta) versionByTopic[m.topic] = m;
  const activeTopic = tab < topics.length ? topics[tab] : undefined;
  const activeMeta = activeTopic ? versionByTopic[activeTopic.number] : undefined;
  const shownTopic =
    activeTopic && viewed[activeTopic.number] !== undefined && overrides[activeTopic.number]
      ? (overrides[activeTopic.number] as Topic)
      : activeTopic;
  const viewingOld =
    !!activeMeta && viewed[activeMeta.topic] !== undefined && viewed[activeMeta.topic] !== activeMeta.version;

  // View one version of the active topic (latest clears back to live).
  const viewVersion = async (m: TopicMeta, version: number, id: string) => {
    if (version === m.version) {
      setViewed((prev) => {
        const next = { ...prev };
        delete next[m.topic];
        return next;
      });
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[m.topic];
        return next;
      });
      return;
    }
    setLoadingVersion(true);
    try {
      const d = await api.noteGet(id);
      setOverrides((prev) => ({ ...prev, [m.topic]: d.noteJson as Topic }));
      setViewed((prev) => ({ ...prev, [m.topic]: version }));
    } catch {
      // keep the live version on failure
    } finally {
      setLoadingVersion(false);
    }
  };

  return (
    <>
    <div className="screen-only" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 100px' }}>
      <button onClick={() => navigate(`/course/${encodeURIComponent(courseCode || '')}`)} style={{ marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center', background: 'none', border: 'none', color: '#777', fontSize: 14 }}>
        <ChevronLeft size={18} /> Back
      </button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
        <button onClick={() => window.print()} style={{ display: 'flex', gap: 6, alignItems: 'center', background: '#fff', border: '1px solid #e5e5e5', borderRadius: 9999, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#059669' }}>
          <Download size={14} /> Save PDF
        </button>
      </div>
      <div className="hero" style={{ background: '#fff', color: '#3c3c3c', border: '1px solid #e5e5e5', borderRadius: 12, padding: 24, marginBottom: 20 }}>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#059669', fontWeight: 700, textTransform: 'uppercase' }}>
          {note.course} · Week {note.week}
        </div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 24, margin: '8px 0' }}>{note.title}</h1>
        <p style={{ fontSize: 14, color: '#777' }}>{note.subtitle}</p>
        {note.learningOutcome && <p style={{ fontSize: 13, color: '#3c3c3c', marginTop: 10 }}>{note.learningOutcome}</p>}
        {(note.metaChips?.length || 0) > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
            {note.metaChips.map((chip) => (
              <span key={chip} style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 9999, background: '#ecfdf5', color: '#059669' }}>
                {chip}
              </span>
            ))}
          </div>
        )}
      </div>

      {preview && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 10, fontSize: 13, color: '#065f46', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Author preview — read-only, nothing is recorded.</span>
          <button onClick={() => navigate(`/studio?edit=${encodeURIComponent(courseCode || '')}&week=${weekNum}`)} style={{ padding: '8px 14px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
            Edit in Studio
          </button>
        </div>
      )}

      {tabCount > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 2px 12px' }}>
          {topics.map((t, idx) => (
            <button
              key={t.number}
              onClick={() => goTab(idx)}
              style={{
                flex: '1 0 auto',
                padding: '8px 14px',
                borderRadius: 9999,
                border: `1px solid ${idx === tab ? '#059669' : '#e5e5e5'}`,
                background: idx === tab ? '#10b981' : '#fff',
                color: idx === tab ? '#fff' : '#777',
                fontWeight: 700,
                fontSize: 12,
                display: 'flex',
                gap: 4,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {isDone(weekNum, idx) && <Check size={12} />} Topic {t.number}
              {(versionByTopic[t.number]?.versions.length || 0) > 1 && (
                <span style={{ fontSize: 10, fontWeight: 800, padding: '1px 7px', borderRadius: 9999, background: idx === tab ? '#fff' : '#ecfdf5', color: '#059669' }}>
                  v{versionByTopic[t.number].version}
                </span>
              )}
            </button>
          ))}
          {hasQuiz && (
            <button
              onClick={() => goTab(topics.length)}
              style={{
                flex: '1 0 auto',
                padding: '8px 14px',
                borderRadius: 9999,
                border: `1px solid ${topics.length === tab ? '#059669' : '#e5e5e5'}`,
                background: topics.length === tab ? '#10b981' : '#fff',
                color: topics.length === tab ? '#fff' : '#777',
                fontWeight: 700,
                fontSize: 12,
              }}
            >
              Quiz
            </button>
          )}
        </div>
      )}

      {tab < topics.length ? (
        <>
          {activeMeta && activeMeta.versions.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: '#777', fontWeight: 700 }}>Versions:</span>
              {activeMeta.versions.map((v) => {
                const current = (viewed[activeMeta.topic] ?? activeMeta.version) === v.version;
                return (
                  <button
                    key={v.id}
                    disabled={loadingVersion}
                    onClick={() => viewVersion(activeMeta, v.version, v.id)}
                    style={{ padding: '4px 12px', borderRadius: 9999, border: `1px solid ${current ? '#059669' : '#e5e5e5'}`, background: current ? '#10b981' : '#fff', color: current ? '#fff' : '#777', fontWeight: 800, fontSize: 11 }}
                  >
                    v{v.version}
                  </button>
                );
              })}
              {viewingOld && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>viewing older version</span>}
            </div>
          )}
          {shownTopic && (
            <TopicTab
              topic={shownTopic}
              done={isDone(weekNum, tab)}
              onToggle={() => toggle(weekNum, tab)}
              preview={preview || viewingOld}
            />
          )}
        </>
      ) : (
        <EoqQuiz eoq={note.eoq ?? { questions: [] }} course={note.course} week={note.week} preview={preview} />
      )}

      {tabCount > 1 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <button
            onClick={() => goTab(tab - 1)}
            disabled={tab === 0}
            style={{ flex: 1, padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #e5e5e5', fontWeight: 800, fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: tab === 0 ? 0.5 : 1 }}
          >
            <ChevronLeft size={16} /> Back
          </button>
          <button
            onClick={() => goTab(tab + 1)}
            disabled={tab >= tabCount - 1}
            style={{ flex: 1, padding: 12, borderRadius: 12, background: '#fff', border: '1px solid #e5e5e5', fontWeight: 800, fontSize: 14, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', opacity: tab >= tabCount - 1 ? 0.5 : 1 }}
          >
            Next <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
    <div className="print-only">
      <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 22 }}>{note.course} · Week {note.week}: {note.title}</h1>
      <p style={{ fontSize: 13, color: '#555' }}>{note.subtitle}</p>
      {topics.map((t) => (
        <TopicSlice key={t.number} topic={t} />
      ))}
    </div>
    </>
  );
}

function TopicTab({ topic, done, onToggle, preview }: { topic: Topic; done: boolean; onToggle: () => void; preview: boolean }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <TopicSlice topic={topic} />
      {!preview && (
        <button
          onClick={onToggle}
          style={{
            marginTop: 12,
            padding: '10px 18px',
            borderRadius: 9999,
            background: done ? '#059669' : '#fff',
            color: done ? '#fff' : '#3c3c3c',
            border: `1px solid ${done ? '#059669' : '#e5e5e5'}`,
            cursor: 'pointer',
            display: 'flex',
            gap: 6,
            alignItems: 'center',
            fontWeight: 600,
          }}
        >
          <Check size={16} /> {done ? 'Completed' : 'Mark Topic Complete'}
        </button>
      )}
    </div>
  );
}
