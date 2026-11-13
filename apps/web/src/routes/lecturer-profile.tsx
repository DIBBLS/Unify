import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { describeError } from '../lib/errors';
import { resolvePicture } from '../lib/picture';
import BackButton from '../components/BackButton';
import { SectionSkeleton } from '../components/Skeletons';
import { BoxBoy } from '../components/redesign/brand';
import { Card, Display, Label, ListCard } from '../components/redesign/ui';

// S53: a lecturer's profile as students see it: name, department, courses taught.
export default function LecturerProfileRoute() {
  const { id = '' } = useParams();
  const [p, setP] = useState<Awaited<ReturnType<typeof api.lecturerProfile>> | null>(null);
  const [err, setErr] = useState('');
  useEffect(() => { api.lecturerProfile(id).then(setP).catch((e) => setErr(describeError(e, 'load that profile'))); }, [id]);
  const shell = { maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '20px 16px 96px' } as const;
  if (err) return <div style={shell}><BackButton to="/home" /><Card style={{ marginTop: 8 }}><div className="t-13 muted">{err}</div></Card></div>;
  if (!p) return <div style={shell}><SectionSkeleton rows={2} /></div>;
  const pic = resolvePicture({ avatar_url: p.avatar, box_boy_persona: p.persona });
  return (
    <div style={shell}>
      <BackButton to="/home" />
      <Card style={{ alignItems: 'center', textAlign: 'center', marginTop: 8 }}>
        {pic.kind !== 'none' ? (
          <img src={pic.src} alt="" width={88} height={88} style={{ width: 88, height: 88, borderRadius: 9999, objectFit: 'cover' }} />
        ) : (
          <BoxBoy pose="teaching" width={100} />
        )}
        <Display size={26}>{p.name}</Display>
        <div className="t-13 muted">{[p.department, p.faculty].filter(Boolean).join(' · ') || 'Lecturer'}</div>
      </Card>
      {p.courses.length > 0 && (
        <section style={{ marginTop: 18 }}>
          <Label>Teaches</Label>
          <ListCard style={{ marginTop: 8 }}>
            {p.courses.map((c) => (
              <Link key={c} to={`/courses/${encodeURIComponent(c)}`} className="row" style={{ padding: '13px 16px', textDecoration: 'none', color: 'var(--u-text)' }}>
                <span className="t-15 w-6">{c}</span>
              </Link>
            ))}
          </ListCard>
        </section>
      )}
    </div>
  );
}
