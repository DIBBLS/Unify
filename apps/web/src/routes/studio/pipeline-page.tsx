import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import BackButton from '../../components/BackButton';
import Pipeline from './Pipeline';

// The Pipeline on its own page (/studio/pipeline): every course you teach and
// where each week stands. It asks for each course's materials and weeks, so it
// loads only when opened, never as part of the Studio itself. Picking a week
// opens the Studio with that course and week filled in.
export default function StudioPipelineRoute() {
  const navigate = useNavigate();
  return (
    <div style={{ maxWidth: 'min(var(--shell, 480px), 760px)', margin: '0 auto', padding: '20px 16px 80px' }}>
      <BackButton to={ROUTES.studio} />
      <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 26, margin: '8px 0 4px' }}>Pipeline</h1>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 14 }}>Every course you teach, week by week: what's published and what's ready to write. Pick a week to start it in the Studio.</div>
      <Pipeline onPick={(c, w) => navigate(`${ROUTES.studio}?course=${encodeURIComponent(c)}&week=${w}`)} />
    </div>
  );
}
