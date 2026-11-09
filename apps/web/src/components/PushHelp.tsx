import { ConfirmModal } from './ConfirmModal';
import { pushGuide, type GuideKind } from '../lib/pushHelp';

// Step-by-step help for the browser's notification permission, matched to the
// browser and device in use.
export function GuideSteps({ kind }: { kind: GuideKind }) {
  const g = pushGuide(kind);
  return (
    <div style={{ textAlign: 'left' }}>
      <p style={{ margin: '0 0 8px', textAlign: 'center' }}>{g.lead}</p>
      <ol style={{ margin: '0 0 8px', paddingLeft: 20, display: 'grid', gap: 4 }}>
        {g.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
      <p style={{ margin: 0, fontSize: 12, opacity: 0.8 }}>{g.foot}</p>
    </div>
  );
}

export default function PushHelp({ kind, onClose }: { kind: GuideKind; onClose: () => void }) {
  const g = pushGuide(kind);
  return <ConfirmModal title={g.title} body={<GuideSteps kind={kind} />} confirmLabel="Got it" cancelLabel="Close" tone="go" icon="bell" onConfirm={onClose} onCancel={onClose} />;
}
