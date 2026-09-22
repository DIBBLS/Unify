import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowRight, Check, X, Loader2 } from 'lucide-react';
import Mascot from '../components/Mascot';
import { supabaseBrowser } from '../lib/supabase';
import { api } from '../lib/api';

const RL_KEY = 'unify-auth-rl';
const RL_MAX = 10;
const RL_WINDOW = 7 * 60 * 1000;

function getRl() {
  try {
    return JSON.parse(localStorage.getItem(RL_KEY) || 'null') || { count: 0, lockUntil: 0 };
  } catch {
    return { count: 0, lockUntil: 0 };
  }
}
function checkRl() {
  const { lockUntil } = getRl();
  if (lockUntil > Date.now()) {
    const mins = Math.ceil((lockUntil - Date.now()) / 60000);
    return `Too many failed attempts. Try again in ${mins} minute${mins !== 1 ? 's' : ''}.`;
  }
  return null;
}
function recordFail() {
  const rl = getRl();
  if (rl.lockUntil > Date.now()) return;
  rl.count = (rl.count || 0) + 1;
  if (rl.count >= RL_MAX) {
    rl.lockUntil = Date.now() + RL_WINDOW;
    rl.count = 0;
  }
  localStorage.setItem(RL_KEY, JSON.stringify(rl));
}
function clearRl() {
  localStorage.removeItem(RL_KEY);
}

export default function AuthRoute() {
  const navigate = useNavigate();
  const sb = supabaseBrowser();
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [configError, setConfigError] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [signupPw, setSignupPw] = useState('');
  const [loading, setLoading] = useState(false);

  const routeToApp = async () => {
    try {
      const { onboarded } = await api.me();
      navigate(onboarded ? '/dashboard' : '/onboarding');
    } catch {
      setError("Signed in, but can't reach the server. Check your connection and retry.");
    }
  };

  useEffect(() => {
    if (!sb) {
      setConfigError('Auth is not configured yet (Supabase keys missing).');
      return;
    }
    sb.auth.getSession().then(({ data }) => {
      if (data.session) void routeToApp();
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, session) => {
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
      setError('Auth is not configured yet.');
      return;
    }
    const blocked = checkRl();
    if (blocked) return setError(blocked);
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    setLoading(true);
    try {
      const { data, error: err } = await client.auth.signInWithPassword({ email, password });
      if (err) {
        recordFail();
        setError(checkRl() || err.message);
        return;
      }
      clearRl();
      if (data.session) await routeToApp();
    } catch (err) {
      recordFail();
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
      setError('Auth is not configured yet.');
      return;
    }
    const blocked = checkRl();
    if (blocked) return setError(blocked);
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
        recordFail();
        setError(checkRl() || err.message);
        return;
      }
      clearRl();
      if (data.session) {
        await routeToApp();
      } else {
        setSuccess('Account created! Check your email to verify, then sign in.');
        setTab('signin');
      }
    } catch (err) {
      recordFail();
      setError(err instanceof Error ? err.message : 'Sign-up failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setSuccess('');
    const client = sb;
    if (!client) {
      setError('Auth is not configured yet.');
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
      setError('Auth is not configured yet.');
      return;
    }
    const blocked = checkRl();
    if (blocked) return setError(blocked);
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

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', background: '#fff' }}>
      <div style={{ background: '#10b981', color: '#fff', padding: 28, borderRadius: '0 0 16px 16px', display: 'flex', gap: 16, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 20 }}>Unify<span style={{ color: '#fff' }}>.</span></div>
          <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 32, marginTop: 12, lineHeight: 1.1 }}>
            Own your <span style={{ background: '#fff', color: '#10b981', padding: '0 6px', borderRadius: 6 }}>journey.</span>
          </h1>
          <p style={{ marginTop: 8, opacity: 0.92, fontSize: 14 }}>Duolingo-style learning</p>
        </div>
        <Mascot size={104} />
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

        {configError && <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 12, padding: 10, color: '#9a3412', fontSize: 13, marginBottom: 12 }}>{configError}</div>}
        {error && <div style={{ background: '#fff0f0', border: '1px solid #ffcccc', borderRadius: 12, padding: 10, color: '#cc0000', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ background: '#f0fff4', border: '1px solid #b3f0c8', borderRadius: 12, padding: 10, color: '#006620', fontSize: 13, marginBottom: 12 }}>{success}</div>}

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
            <button type="button" onClick={handleGoogle} style={{ padding: 12, background: '#fff', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: 8 }}>
              Continue with Google
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
            <button type="button" onClick={handleGoogle} style={{ padding: 12, background: '#fff', border: '1px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 700 }}>
              Continue with Google
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
  );
}
