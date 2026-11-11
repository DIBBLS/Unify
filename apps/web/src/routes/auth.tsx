import { toastError } from '../lib/toast';
import { ProgressBar } from '../components/redesign/ui';
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Check, X, Loader2 } from 'lucide-react';
import { BoxBoy } from '../components/redesign/brand';
import Wordmark from '../components/Wordmark';
import Typewriter from '../components/Typewriter';
import Flash from '../components/Flash';
import { hasSeenWelcome } from '../lib/welcome';
import { WELCOME_LINE } from '../lib/naija';
import { BoxBoySplash } from '../components/BoxBoySplash';
import { supabaseBrowser, saveRememberSession, restoreRememberedSession, touchActivity, isSessionExpired, expireSession } from '../lib/supabase';
import { api, clearMeCache } from '../lib/api';
import { log } from '../lib/log';
import { describeError } from '../lib/errors';

// Note: no client-side persistence here. Rate limiting is enforced
// server-side (API rate limits + Supabase Auth built-in limits).
const FLASH_TTL = 6000;

// Google's official multicolour "G" (brand guidelines: the G mark on a white/neutral button).
function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export default function AuthRoute() {
  const navigate = useNavigate();
  const sb = supabaseBrowser();
  const [showSplash, setShowSplash] = useState(true);
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>(() =>
    new URLSearchParams(window.location.search).get('tab') === 'signup' ? 'signup' : 'signin'
  );
  const [error, setErrorState] = useState('');
  // Toast mirror: every failure surfaces globally AND stays readable inline.
  const setError = (m: string) => { setErrorState(m); if (m) toastError(m); };
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [signupPw, setSignupPw] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [recoveryPw, setRecoveryPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [remember, setRemember] = useState(false);

  const routeToApp = async () => {
    touchActivity();
    // Fresh sign-in: never trust the me() memo from a previous account.
    clearMeCache();
    // A live session always means the sign-in face — never leave a stale
    // signup/recovery form mounted where it can flash mid-redirect.
    setTab('signin');
    setPendingEmail('');
    setSuccess('');
    setWelcomeBack(true);
    try {
      const me = await api.me();
      log.info('session', `profile check ok (onboarded=${me.onboarded})`);
      // Replace, never push: /auth forwards signed-in users straight back,
      // so leaving it in history would trap the Back button.
      navigate(me.onboarded ? '/home' : '/onboarding', { replace: true });
    } catch {
      log.error('session', 'profile check failed (API unreachable?)');
      setWelcomeBack(false);
      setError("Signed in, but can't reach the server. Check your connection and retry.");
    }
  };

  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (!sb) return;
    // Bounced here by the 30-min idle expiry (layout or a stale tab).
    if (searchParams.get('expired') === '1') {
      setError('Signed out after 30 minutes of inactivity. Sign in to continue.');
    }
    const expiredHalt = async () => {
      await expireSession();
      setWelcomeBack(false);
      setError('Signed out after 30 minutes of inactivity. Sign in to continue.');
    };
    sb.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        // Idle past the TTL (even with the app closed) → stay signed out.
        if (isSessionExpired()) {
          await expiredHalt();
          return;
        }
        void routeToApp();
        return;
      }
      // No tab session: adopt a remembered one (opt-in at last sign-in).
      if (await restoreRememberedSession()) {
        if (isSessionExpired()) {
          await expiredHalt();
          return;
        }
        void routeToApp();
        return;
      }
      // First visit on this device, plain /auth (no OAuth/recovery leg, no
      // explicit tab): show the four welcome slides before the form.
      const q = new URLSearchParams(window.location.search);
      const plain = !window.location.hash && !q.get('code') && !q.get('tab') && !q.get('expired');
      if (plain && !hasSeenWelcome()) navigate('/welcome', { replace: true });
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      log.info('session', `event=${event} signedIn=${!!session}`);
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        return;
      }
      if (session) void routeToApp();
    });
    return () => {
      sub.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  const hasLength = signupPw.length >= 8;
  const hasUpper = /[A-Z]/.test(signupPw);
  const hasNumber = /[0-9]/.test(signupPw);
  const score = [hasLength, hasUpper, hasNumber].filter(Boolean).length;

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const client = sb;
    if (!client) {
      setError('Something went wrong. Please reload and try again.');
      return;
    }
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    setLoading(true);
    try {
      const { data, error: err } = await client.auth.signInWithPassword({ email, password });
      if (err) {
        setError(describeError(err, 'sign in'));
        return;
      }
      if (data.session) {
        if (remember) saveRememberSession(data.session);
        await routeToApp();
      }
    } catch (err) {
      setError(describeError(err, 'sign in'));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const client = sb;
    if (!client) {
      setError('Something went wrong. Please reload and try again.');
      return;
    }
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('new-password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm-password') as HTMLInputElement).value;
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const { data, error: err } = await client.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth?verified=1`,
        },
      });
      if (err) {
        setError(describeError(err, 'sign up'));
        return;
      }
      if (data.session) {
        setPendingEmail('');
        await routeToApp();
      } else {
        setPendingEmail(email);
        setSuccess('Account created! Check your email (and spam) to verify, then sign in.');
        setTab('signin');
      }
    } catch (err) {
      setError(describeError(err, 'sign up'));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!pendingEmail) return;
    const client = sb;
    if (!client) {
      setError('Something went wrong. Please reload and try again.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { error: err } = await client.auth.resend({ type: 'signup', email: pendingEmail });
      if (err) {
        setError(describeError(err, 'resend the email'));
        return;
      }
      setSuccess(`Verification email re-sent to ${pendingEmail}. Check inbox and spam.`);
    } catch (err) {
      setError(describeError(err, 'resend the email'));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setSuccess('');
    const client = sb;
    if (!client) {
      setError('Something went wrong. Please reload and try again.');
      return;
    }
    const email = (document.getElementById('forgotEmail') as HTMLInputElement)?.value.trim();
    if (!email) return setError('Please enter your email address.');
    setLoading(true);
    try {
      const { error: err } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`,
      });
      if (err) {
        setError(describeError(err, 'send the reset email'));
        return;
      }
      setSuccess('Reset link sent! Check your inbox (and spam folder).');
    } catch (err) {
      setError(describeError(err, 'send the reset email'));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const client = sb;
    if (!client) {
      setError('Something went wrong. Please reload and try again.');
      return;
    }
    const form = e.currentTarget;
    const password = (form.elements.namedItem('new-password') as HTMLInputElement).value;
    const confirm = (form.elements.namedItem('confirm-password') as HTMLInputElement).value;
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const { error: err } = await client.auth.updateUser({ password });
      if (err) {
        setError(describeError(err, 'set your password'));
        return;
      }
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
      setRecovery(false);
      setRecoveryPw('');
      setTab('signin');
      setSuccess('Password updated! Sign in with your new password.');
    } catch (err) {
      setError(describeError(err, 'set your password'));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    if (!sb || googleLoading) return;
    setError('');
    setSuccess('');
    setGoogleLoading(true);
    try {
      const { error: err } = await sb.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (err) throw err;
      // Success redirects to Google; the return leg routes via the session listener.
    } catch (err) {
      setGoogleLoading(false);
      setError(describeError(err, 'sign in with Google'));
    }
  };

  if (welcomeBack)
    return (
      // See-through: the page's Adire pattern shows through a light layer.
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, maxWidth: 'var(--shell, 480px)', margin: '0 auto', background: 'color-mix(in srgb, var(--surface) 55%, transparent)', padding: 24, textAlign: 'center' }}>
        <BoxBoy pose="cheer" width={112} />
        <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 28 }}>Own your journey.</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', color: 'var(--u-green)' }} />
          Getting your space ready…
        </div>
      </div>
    );

  if (recovery)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 'var(--shell, 480px)', margin: '0 auto', background: 'var(--surface)', padding: 20, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <BoxBoy pose="readingStanding" width={88} />
        </div>
        <h1 style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 26, textAlign: 'center' }}>Set a new password</h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', margin: '8px 0 16px' }}>Choose the password you'll sign in with from now on.</p>
        {success && <Flash tone="success" message={success} ttl={6000} onDismiss={() => setSuccess('')} />}
        <form onSubmit={handlePasswordUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            New password
            <input name="new-password" type={showPw ? 'text' : 'password'} value={recoveryPw} onChange={(e) => setRecoveryPw(e.target.value)} required placeholder="Min. 8 characters" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
          </label>
          <label style={{ fontSize: 12, fontWeight: 700 }}>
            Confirm new password
            <input name="confirm-password" type="password" required placeholder="Repeat it" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
          </label>
          <button disabled={loading} type="submit" className="btn btn--amber" style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
            {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
            {loading ? 'Saving' : 'Save new password'} <ArrowRight size={18} />
          </button>
        </form>
      </div>
    );

  return (
    <>
      <BoxBoySplash onDone={() => setShowSplash(false)} />
      <div className="auth-page">
      <style>{`.auth-page{min-height:100vh;background-color:var(--u-page)}.auth-side{display:none}.auth-card{maxWidth:480px;margin:0 auto}@media(min-width:900px){.auth-page{display:flex;flex-direction:row;background-color:var(--surface2)}.auth-side{display:flex;flex:1;flex-direction:column;justify-content:center;gap:18px;background:#0a0a0a;background-image:radial-gradient(circle at 85% 15%,color-mix(in srgb,var(--u-green) 14%,transparent),transparent 45%),radial-gradient(circle at 10% 90%,rgba(16,185,129,.1),transparent 40%);color:#f5f4f0;padding:64px;min-height:100vh}.auth-main{flex:1.2;display:flex;align-items:center;justify-content:center;padding:48px 32px;background-color:var(--u-page)}.auth-card{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:32px;box-shadow:0 12px 32px rgba(6,95,70,.12);margin:0}.auth-hero-mobile{border-radius:16px !important}.auth-tagline-m{display:none}}`}</style>
      <aside className="auth-side african-dark">
        <Wordmark size={30} light />
        <h1 key={tab} className="quote-fade" style={{ fontFamily: 'var(--fd)', fontWeight: 900, fontSize: 44, lineHeight: 1.08, margin: 0, color: '#f5f4f0' }}>
          Own your academic journey.
        </h1>
        <p style={{ color: 'rgba(245,244,240,.7)', fontSize: 16, margin: 0, maxWidth: 420 }}>
          Everything you need to keep up with your courses, plan your grades and stay ahead of class, in one place.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {[
            { t: 'Everything for your course, together', s: 'No more chasing the class Drive, WhatsApp groups and seniors.' },
            { t: 'Know where your CGPA is heading', s: 'Set a target and see what each course needs to get you there.' },
            { t: 'Practice before the exam does it for you', s: 'Weekly quizzes and practice questions that show what you actually know.' },
          ].map((f) => (
            <div key={f.t} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.09)', borderRadius: 12, padding: '12px 16px' }}>
              <span style={{ width: 26, height: 26, borderRadius: 9999, background: 'color-mix(in srgb,var(--u-green) 15%,transparent)', color: 'var(--u-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                <Check size={14} />
              </span>
              <span>
                <span style={{ display: 'block', fontWeight: 800, fontSize: 15 }}>{f.t}</span>
                <span style={{ display: 'block', fontSize: 13, color: 'rgba(245,244,240,.6)' }}>{f.s}</span>
              </span>
            </div>
          ))}
        </div>
      </aside>
      <div className="auth-main">
      <div className="auth-card">
      <div className="auth-hero-mobile african-band" style={{ background: 'var(--u-green)', color: 'var(--u-black)', padding: 28, borderRadius: '0 0 32px 32px', display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
          <Wordmark size={20} onGreen />
          <div className="eyebrow" style={{ marginTop: 10, opacity: 0.75 }}>{WELCOME_LINE}</div>
          <h1 key={tab} className="quote-fade" style={{ fontFamily: 'var(--fd)', fontWeight: 800, fontSize: 32, marginTop: 12, lineHeight: 1.1 }}>
            {tab === 'signin' ? 'Welcome back' : 'Welcome to Unify Learn'}
          </h1>
          {/* No key here: it would duplicate the h1's key, and React then leaves a stale headline behind on a tab switch. */}
          <p className="auth-tagline-m" style={{ marginTop: 8, opacity: 0.92, fontSize: 16, minHeight: 20, fontFamily: "'Playfair Display',Georgia,serif", fontWeight: 700 }}><Typewriter text="Own your academic journey" /></p>
        </div>
        <BoxBoy pose="wavePhone" width={120} style={{ flexShrink: 0, alignSelf: 'flex-end' }} />
      </div>
      <div style={{ padding: 20, flex: 1 }}>
        <div style={{ display: 'flex', gap: 4, background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 9999, padding: 4, marginBottom: 20 }}>
          <button
            onClick={() => setTab('signin')}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 9999,
              border: 'none',
              background: tab === 'signin' ? 'var(--u-green)' : 'transparent',
              color: tab === 'signin' ? '#0a0a0a' : 'var(--text2)',
              fontWeight: 700,
            }}
          >
            Sign In
          </button>
          <button
            onClick={() => setTab('signup')}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 9999,
              border: 'none',
              background: tab === 'signup' ? 'var(--u-green)' : 'transparent',
              color: tab === 'signup' ? '#0a0a0a' : 'var(--text2)',
              fontWeight: 700,
            }}
          >
            Sign Up
          </button>
        </div>

        {error && <Flash tone="error" message={error} ttl={FLASH_TTL} onDismiss={() => setError('')} />}
        {success && <Flash tone="success" message={success} ttl={FLASH_TTL} onDismiss={() => setSuccess('')} />}
        {success && pendingEmail && (
          <button onClick={handleResend} disabled={loading} style={{ background: 'none', border: 'none', color: 'var(--u-good)', fontSize: 13, fontWeight: 700, textDecoration: 'underline', marginBottom: 12 }}>
            Re-send verification email
          </button>
        )}

        {tab === 'signin' && (
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Email
              <input name="email" type="email" required placeholder="you@email.com" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Password
              <div style={{ position: 'relative', marginTop: 6 }}>
                <input name="password" type={showPw ? 'text' : 'password'} required placeholder="Your password" style={{ width: '100%', padding: 12, paddingRight: 44, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
                <button type="button" onClick={() => setShowPw(!showPw)} aria-label={showPw ? 'Hide password' : 'Show password'} style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 44, background: 'none', border: 'none', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -8 }}>
              <button type="button" onClick={() => setTab('forgot')} style={{ background: 'none', border: 'none', fontSize: 12, fontWeight: 700, color: 'var(--u-good)', textDecoration: 'underline' }}>Forgot password?</button>
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--text2)', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: 'var(--u-green)' }} />
              Remember me on this device
            </label>
            <button disabled={loading} type="submit" className="btn btn--amber" style={{ fontSize: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Signing in' : 'Sign In'} <ArrowRight size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text2)', fontSize: 11 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} /> or <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button type="button" onClick={handleGoogle} disabled={googleLoading || loading} style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', opacity: googleLoading ? 0.6 : 1 }}>
              {googleLoading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <GoogleG />}
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Email
              <input name="email" type="email" required placeholder="you@email.com" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Password
              <input name="new-password" type={showPw ? 'text' : 'password'} value={signupPw} onChange={(e) => setSignupPw(e.target.value)} required placeholder="Min. 8 characters" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
              <div style={{ marginTop: 8 }}>
                <ProgressBar height={12} value={[signupPw.length >= 8, /[A-Z]/.test(signupPw), /[0-9]/.test(signupPw)].filter(Boolean).length / 3} color={score === 1 ? '#ef4444' : score === 2 ? '#f59e0b' : 'var(--u-green)'} />
              </div>
              <div style={{ fontSize: 11, color: hasLength ? 'var(--u-good)' : 'var(--text2)', marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>{hasLength ? <Check size={12} /> : <X size={12} />} At least 8 characters</div>
              <div style={{ fontSize: 11, color: hasUpper ? 'var(--u-good)' : 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center' }}>{hasUpper ? <Check size={12} /> : <X size={12} />} One uppercase letter</div>
              <div style={{ fontSize: 11, color: hasNumber ? 'var(--u-good)' : 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center' }}>{hasNumber ? <Check size={12} /> : <X size={12} />} One number</div>
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Confirm Password
              <input name="confirm-password" type="password" required placeholder="Repeat your password" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
            </label>
            <button disabled={loading} type="submit" className="btn btn--amber" style={{ display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Creating' : 'Create Account'} <ArrowRight size={18} />
            </button>
            <button type="button" onClick={handleGoogle} disabled={googleLoading || loading} style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center', opacity: googleLoading ? 0.6 : 1 }}>
              {googleLoading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : <GoogleG />}
              {googleLoading ? 'Redirecting…' : 'Continue with Google'}
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontFamily: 'var(--fd)', fontWeight: 800 }}>Reset your password</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Enter your email and we'll send you a reset link.</p>
            <input id="forgotEmail" placeholder="you@email.com" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12 }} />
            <button onClick={handleForgot} disabled={loading} className="btn btn--amber" style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null} Send Reset Link <ArrowRight size={18} />
            </button>
            <button onClick={() => setTab('signin')} style={{ background: 'none', border: 'none', color: 'var(--text2)', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Back to Sign In
            </button>
          </div>
        )}
        </div>
        </div>
      </div>
    </div>
    </>
  );
}

