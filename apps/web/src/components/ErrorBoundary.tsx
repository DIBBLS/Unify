import { Component, type ReactNode } from 'react';
import { BoxBoy } from './redesign/brand';
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
          <BoxBoy pose="wavePhone" width={96} />
          <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 24, marginTop: 12, color: 'var(--text)' }}>
            Something didn't work.
          </h1>
          <p style={{ color: 'var(--text2)', fontSize: 14, margin: '8px 0 20px' }}>
            This screen ran into a problem. Your progress is safe. Reload and you'll pick up where you were.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ padding: '12px 28px', borderRadius: 9999, background: 'var(--u-amber)', color: 'var(--u-black)', border: 'none', borderBottom: '4px solid #c69a1a', fontWeight: 800, fontSize: 14 }}
          >
            Reload
          </button>
          {/* A full page load (not a router link): the crashed tree can't be trusted to navigate. */}
          <div style={{ marginTop: 16 }}>
            <a
              href={`/report-bug?from=${encodeURIComponent(window.location.pathname)}&what=${encodeURIComponent(`The screen crashed: ${this.state.error.message || 'unknown error'}`)}`}
              style={{ fontSize: 13, fontWeight: 700, color: 'var(--u-good)' }}
            >
              Keeps happening? Report this problem
            </a>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

