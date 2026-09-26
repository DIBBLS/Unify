import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Check, X, Loader2 } from 'lucide-react';
import Mascot from '../components/Mascot';
import Typewriter from '../components/Typewriter';
import Flash from '../components/Flash';
import { supabaseBrowser, saveRememberSession, restoreRememberedSession, touchActivity, isSessionExpired, expireSession } from '../lib/supabase';
import { api } from '../lib/api';
import { log } from '../lib/log';

// Note: no client-side persistence here. Rate limiting is enforced
// server-side (API rate limits + Supabase Auth built-in limits).
const FLASH_TTL = 6000;

export default function AuthRoute() {
  const navigate = useNavigate();
  const sb = supabaseBrowser();
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [signupPw, setSignupPw] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [recovery, setRecovery] = useState(false);
  const [recoveryPw, setRecoveryPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState(false);
  const [remember, setRemember] = useState(false);

  const routeToApp = async () => {
    touchActivity();
    setWelcomeBack(true);
    try {
      const me = await api.me();
      log.info('session', `profile check ok (onboarded=${me.onboarded})`);
      if (!me.onboarded) {
        navigate('/onboarding');
        return;
      }
      // Unread first: coming back to waiting notifications opens them
      // before anything else (dashboard/resume can wait one tap).
      try {
        const n = await api.notifications(1);
        if ((n.unread || 0) > 0) {
          navigate('/notifications');
          return;
        }
      } catch {
        // notification check flaked — fall through to resume/dashboard
      }
      // Exact restore is a student path: authors/admins land on dashboard.
      if (me.resume?.course && me.profile?.role === 'student') {
        const c = encodeURIComponent(me.resume.course.trim());
        navigate(`/learn/${c}/week/${me.resume.week}${me.resume.topic ? `?t=${me.resume.topic}` : ''}`, { replace: true });
        return;
      }
      navigate('/dashboard');
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
      }
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
        setError(err.message);
        return;
      }
      if (data.session) {
        if (remember) saveRememberSession(data.session);
        await routeToApp();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed.');
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
    const name = (form.elements.namedItem('name') as HTMLInputElement).value.trim();
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
          data: { display_name: name },
          emailRedirectTo: `${window.location.origin}/auth?verified=1`,
        },
      });
      if (err) {
        setError(err.message);
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
      setError(err instanceof Error ? err.message : 'Sign-up failed.');
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
        setError(err.message);
        return;
      }
      setSuccess(`Verification email re-sent to ${pendingEmail}. Check inbox and spam.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Resend failed.');
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
        setError(err.message);
        return;
      }
      setSuccess('Reset link sent! Check your inbox (and spam folder).');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed.');
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
        setError(err.message);
        return;
      }
      await client.auth.signOut({ scope: 'local' }).catch(() => {});
      setRecovery(false);
      setRecoveryPw('');
      setTab('signin');
      setSuccess('Password updated! Sign in with your new password.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSuccess('');
    const client = sb;
    if (!client) {
      setError('Something went wrong. Please reload and try again.');
      return;
    }
    try {
      const { error: err } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (err) setError(err.message);
      // Success redirects to Google; the return leg routes via the session listener.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  if (welcomeBack)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, maxWidth: 480, margin: '0 auto', background: 'var(--surface)', padding: 24, textAlign: 'center' }}>
        <Mascot size={140} animate="sip" />
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28 }}>Own your journey.</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', color: '#10b981' }} />
          Getting your space ready…
        </div>
      </div>
    );

  if (recovery)
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', background: 'var(--surface)', padding: 20, justifyContent: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Mascot size={110} />
        </div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 26, textAlign: 'center' }}>Set a new password</h1>
        <p style={{ fontSize: 13, color: 'var(--text2)', textAlign: 'center', margin: '8px 0 16px' }}>Choose the password you'll sign in with from now on.</p>
        {error && <Flash tone="error" message={error} ttl={6000} onDismiss={() => setError('')} />}
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
          <button disabled={loading} type="submit" style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
            {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
            {loading ? 'Saving' : 'Save new password'} <ArrowRight size={18} />
          </button>
        </form>
      </div>
    );

  return (
    <div className="auth-page">
      <style>{`.auth-page{min-height:100vh;background:var(--bg)}.auth-side{display:none}.auth-card{maxWidth:480px;margin:0 auto}@media(min-width:900px){.auth-page{display:flex;flex-direction:row;background:var(--surface2)}.auth-side{display:flex;flex:1;flex-direction:column;justify-content:center;gap:18px;background:linear-gradient(135deg,#4ade80,#16a34a);color:#06281a;padding:64px;min-height:100vh}.auth-main{flex:1.2;display:flex;align-items:center;justify-content:center;padding:48px 32px;background:var(--bg)}.auth-card{width:100%;max-width:440px;background:var(--surface);border:1px solid var(--border);border-radius:20px;padding:32px;box-shadow:0 12px 32px rgba(6,95,70,.12);margin:0}.auth-hero-mobile{border-radius:16px !important}}`}</style>
      <aside className="auth-side">
        <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 22 }}>Unify Learn</div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 40, lineHeight: 1.1, margin: 0 }}>
          Welcome to Unify Learn
        </h1>
        <p style={{ opacity: 0.92, fontSize: 16, margin: 0, minHeight: 24 }}><Typewriter text="Built for the ones who build" /></p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
          {['Guided 12-week paths', 'XP, streaks and badges', 'Notes that fit your courses'].map((t) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'center', fontSize: 15, fontWeight: 600 }}>
              <span style={{ width: 26, height: 26, borderRadius: 9999, background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Check size={14} />
              </span>
              {t}
            </div>
          ))}
        </div>
      </aside>
      <div className="auth-main">
      <div className="auth-card">
      <div className="auth-hero-mobile" style={{ background: 'linear-gradient(135deg,#10b981,#059669)', color: '#fff', padding: 28, borderRadius: '0 0 16px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 20 }}>Unify Learn</div>
          <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 32, marginTop: 12, lineHeight: 1.1 }}>
            Welcome to Unify Learn
          </h1>
          <p style={{ marginTop: 8, opacity: 0.92, fontSize: 14, minHeight: 20 }}><Typewriter text="Built for the ones who build" /></p>
        </div>
        <Mascot size={104} animate="sip" />
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
              background: tab === 'signin' ? '#10b981' : 'transparent',
              color: tab === 'signin' ? '#fff' : 'var(--text2)',
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
              background: tab === 'signup' ? '#10b981' : 'transparent',
              color: tab === 'signup' ? '#fff' : 'var(--text2)',
              fontWeight: 700,
            }}
          >
            Sign Up
          </button>
        </div>

        {error && <Flash tone="error" message={error} ttl={FLASH_TTL} onDismiss={() => setError('')} />}
        {success && <Flash tone="success" message={success} ttl={FLASH_TTL} onDismiss={() => setSuccess('')} />}
        {success && pendingEmail && (
          <button onClick={handleResend} disabled={loading} style={{ background: 'none', border: 'none', color: '#059669', fontSize: 13, fontWeight: 700, textDecoration: 'underline', marginBottom: 12 }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                Password <button type="button" onClick={() => setTab('forgot')} style={{ background: 'none', border: 'none', fontSize: 11, color: 'var(--text2)', textDecoration: 'underline' }}>Forgot password?</button>
              </div>
              <div style={{ position: 'relative', marginTop: 6 }}>
                <input name="password" type={showPw ? 'text' : 'password'} required placeholder="Your password" style={{ width: '100%', padding: 12, paddingRight: 44, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 44, background: 'none', border: 'none', color: 'var(--text2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: '#555', fontWeight: 600, cursor: 'pointer' }}>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ width: 16, height: 16, accentColor: '#10b981' }} />
              Remember me on this device
            </label>
            <button disabled={loading} type="submit" style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Signing in' : 'Sign In'} <ArrowRight size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: 'var(--text2)', fontSize: 11 }}>
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} /> or <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>
            <button type="button" disabled title="Coming soon — email sign-in for now" style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: 8, opacity: 0.55 }}>
              Continue with Google · Coming soon
            </button>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Full Name
              <input name="name" required placeholder="Your full name" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Email
              <input name="email" type="email" required placeholder="you@email.com" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Password
              <input name="new-password" type={showPw ? 'text' : 'password'} value={signupPw} onChange={(e) => setSignupPw(e.target.value)} required placeholder="Min. 8 characters" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
              <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${([signupPw.length >= 8, /[A-Z]/.test(signupPw), /[0-9]/.test(signupPw)].filter(Boolean).length / 3) * 100}%`, height: '100%', background: score === 1 ? '#ff4b4b' : score === 2 ? '#ff9600' : '#10b981', transition: 'width .2s' }} />
              </div>
              <div style={{ fontSize: 11, color: hasLength ? '#059669' : 'var(--text2)', marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>{hasLength ? <Check size={12} /> : <X size={12} />} At least 8 characters</div>
              <div style={{ fontSize: 11, color: hasUpper ? '#059669' : 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center' }}>{hasUpper ? <Check size={12} /> : <X size={12} />} One uppercase letter</div>
              <div style={{ fontSize: 11, color: hasNumber ? '#059669' : 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center' }}>{hasNumber ? <Check size={12} /> : <X size={12} />} One number</div>
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Confirm Password
              <input name="confirm-password" type="password" required placeholder="Repeat your password" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid var(--border)', borderRadius: 12, display: 'block' }} />
            </label>
            <button disabled={loading} type="submit" style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Creating' : 'Create Account'} <ArrowRight size={18} />
            </button>
            <button type="button" disabled title="Coming soon — email sign-up for now" style={{ padding: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderBottom: '4px solid var(--border)', borderRadius: 16, fontWeight: 700, opacity: 0.55 }}>
              Continue with Google · Coming soon
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Reset your password</h3>
            <p style={{ fontSize: 13, color: 'var(--text2)' }}>Enter your email and we'll send you a reset link.</p>
            <input id="forgotEmail" placeholder="you@email.com" style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 12 }} />
            <button onClick={handleForgot} disabled={loading} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8 }}>
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
  );
}
