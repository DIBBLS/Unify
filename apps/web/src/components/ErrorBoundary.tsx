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
    // DB log (works with or without Sentry): admins read the latest
    // crashes in the panel. Fire-and-forget, tiny payload, never throws.
    try {
      void import('../lib/api').then(({ api }) => {
        void import('../lib/version').then(({ APP_VERSION }) => {
          api.logError({
            kind: 'render-crash',
            message: String(error?.message || 'render crash').slice(0, 500),
            stack: String(info?.componentStack || '').slice(0, 4000),
            url: typeof window !== 'undefined' ? window.location.href.slice(0, 300) : '',
            appVersion: APP_VERSION,
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
    } catch {
      // ignore
    }
    // Sentry (CDN-loaded in main.tsx when VITE_SENTRY_DSN is set): render
    // crashes land in the dashboard with the component stack. Guarded.
    try {
      (window as { Sentry?: { captureException: (e: unknown, ctx?: unknown) => void } }).Sentry?.captureException(
        error,
        { extra: { componentStack: info.componentStack } }
      );
    } catch {
      // reporting must never crash the crash screen
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ maxWidth: 'var(--shell, 480px)', margin: '0 auto', padding: '60px 20px 80px', textAlign: 'center' }}>
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
