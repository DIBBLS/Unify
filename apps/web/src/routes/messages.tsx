import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronRight, MessageCircle } from 'lucide-react';
import { api } from '../lib/api';
import BackButton from '../components/BackButton';
import CourseChat from '../components/CourseChat';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label } from '../components/redesign/ui';

// Messages between lecturers and contributors, one thread per course.
// /messages lists my courses' threads (newest first, unread counts);
// /messages/:course opens one.
export default function MessagesRoute() {
  const { course } = useParams();
  const shell = { maxWidth: 'min(var(--shell, 480px), 720px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (course) {
    return (
      <div style={shell}>
        <BackButton to="/messages" />
        <Label>Messages</Label>
        <Display size={28}>{course}</Display>
        <div style={{ marginTop: 12 }}><CourseChat course={course} /></div>
      </div>
    );
  }
  return <Threads shell={shell} />;
}

function Threads({ shell }: { shell: React.CSSProperties }) {
  const [threads, setThreads] = useState<Awaited<ReturnType<typeof api.courseChatThreads>>['threads'] | null>(null);
  useEffect(() => { api.courseChatThreads().then((r) => setThreads(r.threads)).catch(() => setThreads([])); }, []);
  return (
    <div style={shell}>
      <BackButton to="/home" />
      <Label>Your courses</Label>
      <Display size={28}>Messages</Display>
      <div className="t-14 muted" style={{ marginTop: 4 }}>Talk to the lecturer and the contributors of each course you teach or write for.</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
        {threads === null && <SectionSkeleton rows={3} quote={false} />}
        {threads && threads.length === 0 && (
          <Card style={{ alignItems: 'center', textAlign: 'center', gap: 8 }}>
            <BoxBoy pose="peeking" width={90} />
            <div className="t-15 w-6">No courses yet</div>
            <div className="t-13 muted">Once you teach or write for a course, its thread shows here.</div>
          </Card>
        )}
        {threads?.map((t) => (
          <Link key={t.course} to={`/messages/${encodeURIComponent(t.course)}`} className="card" style={{ display: 'flex', gap: 12, alignItems: 'center', padding: 14, textDecoration: 'none', color: 'var(--text)' }}>
            <span style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--u-good-tint)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><MessageCircle size={18} color="var(--u-good)" /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontWeight: 800 }}>{t.course}</span>
              <span style={{ display: 'block', fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.last ? `${t.last.mine ? 'You: ' : ''}${t.last.body}` : 'No messages yet'}
              </span>
            </span>
            {t.unread > 0 && <span className="pill pill--amber">{t.unread}</span>}
            <ChevronRight size={18} color="var(--text3)" />
          </Link>
        ))}
      </div>
    </div>
  );
}
