import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Check, X, Loader2 } from 'lucide-react';
import Mascot from '../components/Mascot';
import Flash from '../components/Flash';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';
import { log } from '../lib/log';

// Note: no client-side persistence here. Rate limiting is enforced
// server-side (API rate limits + Supabase Auth built-in limits).
const FLASH_TTL = 6000;

// Typed-out tagline: types character by character, cursor blinks,
// then disappears shortly after the line completes.
function Typewriter({ text, speed = 45 }: { text: string; speed?: number }) {
  const [n, setN] = useState(0);
  const [cursorGone, setCursorGone] = useState(false);
  useEffect(() => {
    if (n >= text.length) {
      const t = setTimeout(() => setCursorGone(true), 700);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setN((v) => v + 1), speed);
    return () => clearTimeout(t);
  }, [n, text, speed]);
  return (
    <span>
      {text.slice(0, n)}
      {!cursorGone && <span className="type-cursor" />}
    </span>
  );
}

export default function AuthRoute() {
  const navigate = useNavigate();
  const sb = supabaseBrowser();
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [signupPw, setSignupPw] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [welcomeBack, setWelcomeBack] = useState(false);

  const routeToApp = async () => {
    setWelcomeBack(true);
    try {
      const { onboarded } = await api.me();
      log.info('session', `profile check ok (onboarded=${onboarded})`);
      navigate(onboarded ? '/dashboard' : '/onboarding');
    } catch {
      log.error('session', 'profile check failed (API unreachable?)');
      setWelcomeBack(false);
      setError("Signed in, but can't reach the server. Check your connection and retry.");
    }
  };

  useEffect(() => {
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => {
      if (data.session) void routeToApp();
    });
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      log.info('session', `event=${event} signedIn=${!!session}`);
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
      if (data.session) await routeToApp();
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
        options: { data: { display_name: name } },
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
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, maxWidth: 480, margin: '0 auto', background: '#fff', padding: 24, textAlign: 'center' }}>
        <Mascot size={140} animate="sip" />
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 28 }}>Own your journey.</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#777', fontSize: 13, fontWeight: 600 }}>
          <Loader2 size={16} style={{ animation: 'spin 0.8s linear infinite', color: '#10b981' }} />
          Getting your space ready…
        </div>
      </div>
    );

  return (
    <div className="auth-page">
      <style>{`.auth-page{min-height:100vh;background:#fff}.auth-side{display:none}.auth-card{maxWidth:480px;margin:0 auto}@media(min-width:900px){.auth-page{display:flex;flex-direction:row;background:#d1fae5}.auth-side{display:flex;flex:1;flex-direction:column;justify-content:center;gap:18px;background:linear-gradient(135deg,#10b981,#059669);color:#fff;padding:64px;min-height:100vh}.auth-main{flex:1.2;display:flex;align-items:center;justify-content:center;padding:48px 32px;background:#ecfdf5}.auth-card{width:100%;max-width:440px;background:#fff;border:1px solid #e5e5e5;border-radius:20px;padding:32px;box-shadow:0 12px 32px rgba(6,95,70,.12);margin:0}.auth-hero-mobile{border-radius:16px !important}}`}</style>
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
        <div style={{ display: 'flex', gap: 4, background: '#f7f7f7', border: '1px solid #e5e5e5', borderRadius: 9999, padding: 4, marginBottom: 20 }}>
          <button
            onClick={() => setTab('signin')}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 9999,
              border: 'none',
              background: tab === 'signin' ? '#10b981' : 'transparent',
              color: tab === 'signin' ? '#fff' : '#777',
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
              color: tab === 'signup' ? '#fff' : '#777',
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
              <input name="email" type="email" required placeholder="you@email.com" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                Password <button type="button" onClick={() => setTab('forgot')} style={{ background: 'none', border: 'none', fontSize: 11, color: '#777', textDecoration: 'underline' }}>Forgot password?</button>
              </div>
              <div style={{ position: 'relative', marginTop: 6 }}>
                <input name="password" type={showPw ? 'text' : 'password'} required placeholder="Your password" style={{ width: '100%', padding: 12, paddingRight: 44, border: '1px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 44, background: 'none', border: 'none', color: '#777', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>
            <button disabled={loading} type="submit" style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, fontSize: 16, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Signing in' : 'Sign In'} <ArrowRight size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#777', fontSize: 11 }}>
              <span style={{ flex: 1, height: 1, background: '#e5e5e5' }} /> or <span style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
            </div>
            <button type="button" disabled title="Coming soon — email sign-in for now" style={{ padding: 12, background: '#fff', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: 8, opacity: 0.55 }}>
              Continue with Google · Coming soon
            </button>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Full Name
              <input name="name" required placeholder="Your full name" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Email
              <input name="email" type="email" required placeholder="you@email.com" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Password
              <input name="new-password" type={showPw ? 'text' : 'password'} value={signupPw} onChange={(e) => setSignupPw(e.target.value)} required placeholder="Min. 8 characters" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
              <div style={{ height: 4, background: '#e5e5e5', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${([signupPw.length >= 8, /[A-Z]/.test(signupPw), /[0-9]/.test(signupPw)].filter(Boolean).length / 3) * 100}%`, height: '100%', background: score === 1 ? '#ff4b4b' : score === 2 ? '#ff9600' : '#10b981', transition: 'width .2s' }} />
              </div>
              <div style={{ fontSize: 11, color: hasLength ? '#059669' : '#777', marginTop: 4, display: 'flex', gap: 6, alignItems: 'center' }}>{hasLength ? <Check size={12} /> : <X size={12} />} At least 8 characters</div>
              <div style={{ fontSize: 11, color: hasUpper ? '#059669' : '#777', display: 'flex', gap: 6, alignItems: 'center' }}>{hasUpper ? <Check size={12} /> : <X size={12} />} One uppercase letter</div>
              <div style={{ fontSize: 11, color: hasNumber ? '#059669' : '#777', display: 'flex', gap: 6, alignItems: 'center' }}>{hasNumber ? <Check size={12} /> : <X size={12} />} One number</div>
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Confirm Password
              <input name="confirm-password" type="password" required placeholder="Repeat your password" style={{ width: '100%', padding: 12, marginTop: 6, border: '1px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
            </label>
            <button disabled={loading} type="submit" style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8, alignItems: 'center' }}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null}
              {loading ? 'Creating' : 'Create Account'} <ArrowRight size={18} />
            </button>
            <button type="button" disabled title="Coming soon — email sign-up for now" style={{ padding: 12, background: '#fff', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 700, opacity: 0.55 }}>
              Continue with Google · Coming soon
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Reset your password</h3>
            <p style={{ fontSize: 13, color: '#777' }}>Enter your email and we'll send you a reset link.</p>
            <input id="forgotEmail" placeholder="you@email.com" style={{ padding: 12, border: '1px solid #e5e5e5', borderRadius: 12 }} />
            <button onClick={handleForgot} disabled={loading} style={{ padding: 14, background: '#10b981', color: '#fff', border: 'none', borderBottom: '4px solid #059669', borderRadius: 16, fontWeight: 800, display: 'flex', justifyContent: 'center', gap: 8 }}>
              {loading ? <Loader2 size={18} style={{ animation: 'spin 0.8s linear infinite' }} /> : null} Send Reset Link <ArrowRight size={18} />
            </button>
            <button onClick={() => setTab('signin')} style={{ background: 'none', border: 'none', color: '#777', fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
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
