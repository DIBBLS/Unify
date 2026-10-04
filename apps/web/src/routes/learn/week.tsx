import { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check, Download, ArrowUp, Share2, Lock } from 'lucide-react';
import { api, type TopicMeta } from '../../lib/api';
import { log } from '../../lib/log';
import type { UnifyNote, Topic } from '../../types/note';
import { TopicSlice } from '../../components/TopicSlice';
import EoqQuiz from '../../components/EoqQuiz';
import { ReadAloud } from '../../components/ReadAloud';
import { ShareModal } from '../../components/ShareModal';
import { XP_GATES, meetsXpGate } from '../../lib/xp';
import { saveWeekOffline, isWeekSaved } from '../../lib/offline';
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
  // Older-version views: "lecture::topic" -> Topic payload + viewed version.
  const [overrides, setOverrides] = useState<Record<string, Topic>>({});
  const [viewed, setViewed] = useState<Record<string, number>>({});
  const [loadingVersion, setLoadingVersion] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  // Who's reading (for the preview-aware back target below).
  const [viewer, setViewer] = useState<{ isAdmin: boolean; role: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // React Router already URL-decodes params — never decode again here.
  const { toggle, isDone, doneCount } = useProgress((courseCode || '').trim().toUpperCase(), weekNum);
  // Celebration burst on fresh completions (never on previews, never for
  // progress that was already banked before this visit).
  const [burst, setBurst] = useState<{ k: number; label: string; sub: string } | null>(null);
  const firstCount = useRef(true);
  const [tab, setTab] = useState(0);
  // BUG-009: a week is Lecture 1/2/3, each with its own numbered topics.
  // The reader switches lectures without reload (?c= param); tabs are
  // per-lecture, the EOQ quiz closes the final lecture.
  const [lecture, setLecture] = useState(() => {
    const c = Number(new URLSearchParams(window.location.search).get('c')) || 1;
    return Math.min(Math.max(c, 1), 3);
  });
  // Lifetime XP drives XP-gated perks (PDF unlocks at 300 XP). Null =
  // unknown (never 0-by-default — a failed fetch must not fake-lock).
  // Retries + refocus refetch keep it truthful; XP only grows.
  const [myXp, setMyXp] = useState<number | null>(null);
  useEffect(() => {
    let cancelled = false;
    let tries = 0;
    const load = () => {
      api
        .stats()
        .then((s) => {
          if (!cancelled) setMyXp(s.xp || 0);
        })
        .catch(() => {
          tries += 1;
          if (!cancelled && tries < 4) window.setTimeout(() => !cancelled && load(), 2500 * tries);
        });
    };
    load();
    const onFocus = () => {
      tries = 0;
      load();
    };
    window.addEventListener('focus', onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener('focus', onFocus);
    };
  }, []);
  // Return-to-top lands on the topic head (below hero + chapter bar),
  // not the very top of the page.
  const topicTopRef = useRef<HTMLDivElement>(null);
  const [showTop, setShowTop] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Offline-first: this week saved into Cache Storage opens with zero
  // network (bus, dead hostel wifi). Marker mirrors the cached payload.
  const [savedOff, setSavedOff] = useState(false);
  const [savingOff, setSavingOff] = useState(false);
  const scrollToTopicTop = () => {
    const el = topicTopRef.current;
    const top = el ? el.getBoundingClientRect().top + window.scrollY - 70 : 0;
    try {
      window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    } catch {
      window.scrollTo(0, Math.max(0, top));
    }
  };
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 600);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const topics = note?.topics ?? [];
  const lectures = (() => {
    const set = new Set<number>();
    for (const t of topics) set.add(t.lecture || 1);
    for (const m of topicMeta) set.add(m.lecture || 1);
    if (set.size === 0) set.add(1);
    return [...set].sort((a, b) => a - b);
  })();
  const selLecture = lectures.includes(lecture) ? lecture : lectures[0];
  const lastLecture = lectures[lectures.length - 1];
  const classTopics = topics.filter((t) => (t.lecture || 1) === selLecture);
  const hasQuiz = (note?.eoq?.questions?.length || 0) > 0 && selLecture === lastLecture;
  const tabCount = classTopics.length + (hasQuiz ? 1 : 0);

  useEffect(() => {
    if (!note) return;
    const c = Number(searchParams.get('c')) || 0;
    if (c && lectures.includes(c) && c !== lecture) setLecture(c);
    const t = Math.min(Math.max(Number(searchParams.get('t')) || 0, 0), Math.max(tabCount - 1, 0));
    setTab((cur) => (cur === t ? cur : t));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note, searchParams, tabCount]);

  const previewMode = searchParams.get('preview') === '1';
  // Learning actions (complete buttons, XP bursts) are students-only.
  // Authors/admins read without recording anything.
  const nonLearner = !!viewer && viewer.role !== 'student';
  useEffect(() => {
    // Skip the initial server load (banked progress must never celebrate).
    if (firstCount.current) {
      firstCount.current = false;
      return;
    }
    if (previewMode || nonLearner || topics.length === 0) return;
    if (doneCount >= topics.length) {
      setBurst({ k: Date.now(), label: 'Week complete!', sub: `${topics.length} topics done` });
    } else {
      setBurst({ k: Date.now(), label: '+10 XP', sub: 'Topic complete' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doneCount]);

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
        if (me) setViewer({ isAdmin: !!me.isAdmin, role: me.profile?.role || 'student' });
        if (me && !previewMode) {
          const role = me.profile?.role || 'student';
          const enrolled = (me.courses || []).map((c) => c.toUpperCase().trim()).includes(code.toUpperCase());
          // Admins (role or flag) read every week without enrolling.
          if ((role === 'student' || !role) && !enrolled && !me.isAdmin) {
            setBlocked(true);
            setLoading(false);
            return;
          }
        }
        const note = data.note_json as UnifyNote;
        const valid = note && Array.isArray(note.topics) ? note : null;
        setNote(valid);
        setTopicMeta(data.topicMeta || []);
        setSavedOff(isWeekSaved(code, weekNum));
        setOverrides({});
        setViewed({});
        // Track the live position for the dashboard Resume card
        // (previews never pollute it).
        if (valid && !previewMode) {
          const c0 = Math.min(Math.max(Number(searchParams.get('c')) || 0, 0), 3) || 1;
          const inClass = valid.topics.filter((t) => (t.lecture || 1) === c0);
          const list = inClass.length > 0 ? inClass : valid.topics;
          const count = list.length + ((valid.eoq?.questions?.length || 0) > 0 ? 1 : 0);
          const t0 = Math.min(Math.max(Number(searchParams.get('t')) || 0, 0), Math.max(count - 1, 0));
          api.resume(data.course, weekNum, t0, c0).catch(() => {});
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
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 24, marginBottom: 20 }}>
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
        <div style={{ fontSize: 12, color: 'var(--text2)', textAlign: 'center', marginTop: 12 }}>Loading Week {weekNum}…</div>
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
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)', maxWidth: 'var(--shell, 480px)', margin: '0 auto' }}>
        <Mascot size={110} />
        <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 20, color: 'var(--text)', marginTop: 12 }}>You're not enrolled in {courseCode}</h1>
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
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>
        <Mascot size={110} />
        <div style={{ marginTop: 12 }}>No content for {courseCode} Week {weekNum} yet.</div>
      </div>
    );

  const preview = searchParams.get('preview') === '1';
  // Preview landings (admin/author browsing) go back to their hub, never
  // to the student course page.
  const backTo =
    preview && viewer
      ? viewer.isAdmin
        ? '/admin/content'
        : viewer.role === 'lecturer' || viewer.role === 'collaborator'
          ? '/browse'
          : `/course/${encodeURIComponent(courseCode || '')}`
      : `/course/${encodeURIComponent(courseCode || '')}`;
  const goTab = (t: number, lec: number = selLecture) => {
    const list = lec === selLecture ? classTopics : topics.filter((x) => (x.lecture || 1) === lec);
    const count = list.length + (hasQuiz && lec === lastLecture ? 1 : 0);
    const clamped = Math.min(Math.max(t, 0), Math.max(count - 1, 0));
    if (lec !== selLecture && lectures.includes(lec)) setLecture(lec);
    setTab(clamped);
    // Chapters open at the topic head (below hero + chapter bar) — never
    // the very top, no manual scrolling after Next.
    scrollToTopicTop();
    // Preserve ?preview=1 across tab switches (losing it would drop the
    // read-only banner and start recording resume on a preview).
    setSearchParams(
      {
        ...(preview ? { preview: '1' } : {}),
        ...(lec !== lectures[0] ? { c: String(lec) } : {}),
        ...(clamped ? { t: String(clamped) } : {}),
      },
      { replace: true }
    );
    // Every tab switch moves the Resume bookmark (never for previews).
    if (!preview && !blocked && note) {
      api.resume(note.course, weekNum, clamped, lec).catch(() => {});
    }
  };

  const goLecture = (lec: number) => {
    if (!lectures.includes(lec) || lec === selLecture) return;
    setLecture(lec);
    setTab(0);
    scrollToTopicTop();
    setSearchParams(
      { ...(preview ? { preview: '1' } : {}), ...(lec !== lectures[0] ? { c: String(lec) } : {}) },
      { replace: true }
    );
    if (!preview && !blocked && note) {
      api.resume(note.course, weekNum, 0, lec).catch(() => {});
    }
  };

  const vkey = (lec: number, topic: number) => `${lec}::${topic}`;
  const versionByTopic: Record<string, TopicMeta> = {};
  for (const m of topicMeta) versionByTopic[vkey(m.lecture || 1, m.topic)] = m;
  const activeTopic = tab < classTopics.length ? classTopics[tab] : undefined;
  const activeMeta = activeTopic ? versionByTopic[vkey(selLecture, activeTopic.number)] : undefined;
  const shownTopic =
    activeTopic && viewed[vkey(selLecture, activeTopic.number)] !== undefined && overrides[vkey(selLecture, activeTopic.number)]
      ? (overrides[vkey(selLecture, activeTopic.number)] as Topic)
      : activeTopic;
  const viewingOld =
    !!activeMeta && viewed[vkey(selLecture, activeMeta.topic)] !== undefined && viewed[vkey(selLecture, activeMeta.topic)] !== activeMeta.version;

  // View one version of the active topic (latest clears back to live).
  const viewVersion = async (m: TopicMeta, version: number, id: string) => {
    const k = vkey(m.lecture || 1, m.topic);
    if (version === m.version) {
      setViewed((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });
      return;
    }
    setLoadingVersion(true);
    try {
      const d = await api.noteGet(id);
      setOverrides((prev) => ({ ...prev, [k]: d.noteJson as Topic }));
      setViewed((prev) => ({ ...prev, [k]: version }));
    } catch {
      // keep the live version on failure
    } finally {
      setLoadingVersion(false);
    }
  };

  return (
    <>
    <div className="screen-only" style={{ maxWidth: 640, margin: '0 auto', padding: '24px 20px 100px' }}>
      {burst && (
        <div key={burst.k} className="xp-burst" onAnimationEnd={() => setBurst(null)}>
          <div><span className="xp-burst-pill">{burst.label}</span></div>
          <div style={{ marginTop: 6 }}><span className="xp-burst-sub">{burst.sub}</span></div>
        </div>
      )}
      {showTop && !loading && (
        <button
          className="to-top"
          aria-label="Back to topic top"
          onClick={scrollToTopicTop}
        >
          <ArrowUp size={20} />
        </button>
      )}
      <button onClick={() => navigate(backTo)} style={{ marginBottom: 16, display: 'flex', gap: 6, alignItems: 'center', background: 'none', border: 'none', color: 'var(--text2)', fontSize: 14 }}>
        <ChevronLeft size={18} /> Back
      </button>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginBottom: 8 }}>
        <button
          onClick={async () => {
            if (savedOff || savingOff || !note) return;
            setSavingOff(true);
            try {
              await saveWeekOffline(note.course, weekNum);
              setSavedOff(true);
            } catch {
              // ErrorState/flash territory is overkill: the button just
              // stays unsaved and retryable.
            } finally {
              setSavingOff(false);
            }
          }}
          disabled={savedOff || savingOff}
          title={savedOff ? 'Saved — opens without internet' : 'Save this week to read offline'}
          style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9999, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: savedOff ? '#059669' : 'var(--text2)', opacity: savingOff ? 0.6 : 1 }}
        >
          {savedOff ? <Check size={14} /> : <Download size={14} />} {savedOff ? 'Saved offline' : savingOff ? 'Saving…' : 'Save offline'}
        </button>
        {(!viewer || viewer.role === 'lecturer' || viewer.role === 'collaborator' || viewer.role === 'admin' || viewer.isAdmin) && (
          <button onClick={() => setSharing(true)} style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9999, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#059669' }}>
            <Share2 size={14} /> Share
          </button>
        )}
        {(() => {
          const known = myXp !== null;
          const unlocked = known && meetsXpGate(myXp, 'pdf', viewer ? { role: viewer.role, isAdmin: viewer.isAdmin } : undefined);
          return (
            <button
              onClick={() => unlocked && window.print()}
              disabled={!unlocked}
              title={unlocked ? 'Save this week as PDF' : known ? `Unlocks at ${XP_GATES.pdf} XP — you have ${myXp}` : 'Checking your XP…'}
              style={{ display: 'flex', gap: 6, alignItems: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 9999, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: unlocked ? '#059669' : 'var(--text3)', opacity: unlocked ? 1 : 0.75 }}
            >
              {unlocked ? <Download size={14} /> : <Lock size={14} />} {unlocked ? 'Save PDF' : known ? `PDF · ${myXp}/${XP_GATES.pdf} XP` : 'PDF · …'}
            </button>
          );
        })()}
      </div>
      {sharing && note && (
        <ShareModal course={note.course} week={weekNum} title={note.title} topics={topics.map((t) => t.title || `Topic ${t.number}`)} onClose={() => setSharing(false)} />
      )}
      <div className="hero">
        <div className="hero-eyebrow">{note.course} · Week {note.week}</div>
        <div className="hero-title">{note.title}</div>
        {note.subtitle ? <div className="hero-subtitle">{note.subtitle}</div> : null}
        {note.learningOutcome && (
          <div className="hero-outcome"><strong>Outcome — </strong>{note.learningOutcome}</div>
        )}
        <div className="hero-meta">
          {(note.metaChips || []).map((chip) => (
            <span key={chip} className="meta-chip">{chip}</span>
          ))}
          <span className="meta-chip">{doneCount * 10} XP earned</span>
        </div>
      </div>

      {preview && (
        <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: 12, padding: 10, fontSize: 13, color: '#065f46', marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center', justifyContent: 'space-between' }}>
          <span>Author preview — read-only, nothing is recorded.</span>
          <button onClick={() => navigate(`/studio?edit=${encodeURIComponent(courseCode || '')}&week=${weekNum}`)} style={{ padding: '8px 14px', borderRadius: 9999, background: '#10b981', color: '#fff', border: 'none', fontWeight: 800, fontSize: 12, whiteSpace: 'nowrap' }}>
            Edit in Studio
          </button>
        </div>
      )}

      {lectures.length > 1 && (
        <div className="segbar" role="tablist" aria-label="Week lectures" style={{ marginBottom: 8 }}>
          {lectures.map((lec) => {
            const n = topics.filter((t) => (t.lecture || 1) === lec).length;
            return (
              <button
                key={lec}
                role="tab"
                aria-selected={lec === selLecture}
                title={`Lecture ${lec} · ${n} topic${n === 1 ? '' : 's'}`}
                className={lec === selLecture ? 'current' : ''}
                onClick={() => goLecture(lec)}
                style={{ flex: 1 }}
              >
                Lecture {lec}
              </button>
            );
          })}
        </div>
      )}
      {tabCount > 1 && (
        <div className="segbar" role="tablist" aria-label={lectures.length > 1 ? `Lecture ${selLecture} chapters` : 'Week chapters'}>
          {classTopics.map((t) => {
            const done = isDone(weekNum, t.number, selLecture);
            const idx = classTopics.indexOf(t);
            return (
              <button
                key={`${selLecture}-${t.number}`}
                role="tab"
                aria-selected={idx === tab}
                title={`Topic ${t.number} · +10 XP`}
                className={`${done ? 'done' : ''} ${idx === tab ? 'current' : ''}`}
                onClick={() => goTab(idx)}
              >
                {done ? <Check size={12} /> : null} T{t.number}
              </button>
            );
          })}
          {hasQuiz && (
            <button
              role="tab"
              aria-selected={classTopics.length === tab}
              title="End-of-week quiz"
              className={classTopics.length === tab ? 'current' : ''}
              onClick={() => goTab(classTopics.length)}
            >
              Quiz
            </button>
          )}
        </div>
      )}

      <div ref={topicTopRef}>
      {tab < classTopics.length ? (
        <>
          {activeMeta && activeMeta.versions.length > 1 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>Versions:</span>
              {activeMeta.versions.map((v) => {
                const current = (viewed[vkey(selLecture, activeMeta.topic)] ?? activeMeta.version) === v.version;
                return (
                  <button
                    key={v.id}
                    disabled={loadingVersion}
                    onClick={() => viewVersion(activeMeta, v.version, v.id)}
                    style={{ padding: '4px 12px', borderRadius: 9999, border: `1px solid ${current ? '#059669' : 'var(--border)'}`, background: current ? '#10b981' : 'var(--surface)', color: current ? '#fff' : 'var(--text2)', fontWeight: 800, fontSize: 11 }}
                  >
                    v{v.version}
                  </button>
                );
              })}
              {viewingOld && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 700 }}>viewing older version</span>}
            </div>
          )}
          {shownTopic && (
            <>
              <ReadAloud key={`${weekNum}-${selLecture}-${tab}`} topic={shownTopic} />
              <TopicTab
                topic={shownTopic}
                done={isDone(weekNum, shownTopic.number, selLecture)}
                onToggle={() => toggle(weekNum, shownTopic.number, selLecture)}
                preview={preview || viewingOld || nonLearner}
              />
            </>
          )}
        </>
      ) : (
        <EoqQuiz eoq={note.eoq ?? { questions: [] }} course={note.course} week={note.week} preview={preview} />
      )}
      </div>

      {tabCount > 1 && (() => {
        const li = lectures.indexOf(selLecture);
        const atFirst = tab === 0 && li === 0;
        const atLast = tab >= tabCount - 1 && li === lectures.length - 1;
        const nextLabel = tab < tabCount - 1 ? null : li < lectures.length - 1 ? `Lecture ${lectures[li + 1]}` : null;
        const backLabel = tab > 0 ? null : li > 0 ? `Lecture ${lectures[li - 1]}` : null;
        return (
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              onClick={() => (tab > 0 ? goTab(tab - 1) : goLecture(lectures[li - 1]))}
              disabled={atFirst}
              className="beat-next"
              style={{ flex: 1, justifyContent: 'center', opacity: atFirst ? 0.5 : 1 }}
            >
              <ChevronLeft size={16} /> {backLabel ? `Back · ${backLabel}` : 'Back'}
            </button>
            <button
              onClick={() => (tab < tabCount - 1 ? goTab(tab + 1) : goLecture(lectures[li + 1]))}
              disabled={atLast}
              className="beat-next"
              style={{ flex: 1, justifyContent: 'center', opacity: atLast ? 0.5 : 1 }}
            >
              {nextLabel ? `Next · ${nextLabel}` : 'Next'} <ChevronRight size={16} />
            </button>
          </div>
        );
      })()}
    </div>
    <div className="print-only">
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 22 }}>{note.course} · Week {note.week}: {note.title}</h1>
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
            background: done ? '#059669' : 'var(--surface)',
            color: done ? '#fff' : 'var(--text)',
            border: `1px solid ${done ? '#059669' : 'var(--border)'}`,
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
