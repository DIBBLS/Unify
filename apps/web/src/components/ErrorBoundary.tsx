import { Component, type ReactNode } from 'react';
import Mascot from './Mascot';
import { log } from '../lib/log';

// Last-resort crash catcher: any render crash anywhere becomes a designed
// screen with a reload path instead of a white death. componentDidCatch
// logs the component stack, so the next console export NAMES the culprit.
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    log.error('render', `boundary: ${error.message}${info.componentStack}`);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 480, margin: '0 auto', padding: '60px 20px 80px', textAlign: 'center' }}>
          <Mascot size={120} />
          <h1 style={{ fontFamily: 'Playfair Display, Georgia, serif', fontWeight: 900, fontSize: 24, marginTop: 12, color: 'var(--text)' }}>
            Something tripped.
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, margin: '8px 0 20px' }}>
            The app hit a render snag. Your progress is safe — reload to continue.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 28px', borderRadius: 9999, background: '#16a34a', color: '#fff', border: 'none', borderBottom: '4px solid #14532d', fontWeight: 800, fontSize: 14 }}
          >
            Reload app
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
