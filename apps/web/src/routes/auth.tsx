import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  sendPasswordResetEmail,
  sendEmailVerification,
  onAuthStateChanged,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, provider, db } from '../lib/firebase';

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
function friendlyError(code: string) {
  if (code === 'auth/invalid-credential') return 'Incorrect email or password.';
  if (code === 'auth/user-not-found') return 'No account found with this email.';
  if (code === 'auth/wrong-password') return 'Incorrect password. Try again.';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Try signing in instead.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes and try again.';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
  if (code === 'auth/popup-blocked') return 'Popup was blocked. Please allow popups.';
  return 'Something went wrong. Please try again.';
}

export default function AuthRoute() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [signupPw, setSignupPw] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (!user) return;
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists() && snap.data().university) navigate('/dashboard');
        else navigate('/onboarding');
      } catch {
        navigate('/dashboard');
      }
    });
    getRedirectResult(auth)
      .then((r) => {
        if (r?.user) {
          clearRl();
          navigate('/dashboard');
        }
      })
      .catch((err: any) => {
        if (err.code && err.code !== 'auth/cancelled-popup-request') setError(friendlyError(err.code));
      });
    return () => unsub();
  }, [navigate]);

  const hasLength = signupPw.length >= 8;
  const hasUpper = /[A-Z]/.test(signupPw);
  const hasNumber = /[0-9]/.test(signupPw);
  const score = [hasLength, hasUpper, hasNumber].filter(Boolean).length;

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    const blocked = checkRl();
    if (blocked) return setError(blocked);
    const form = e.currentTarget;
    const email = (form.elements.namedItem('email') as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem('password') as HTMLInputElement).value;
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      clearRl();
      navigate('/dashboard');
    } catch (err: any) {
      recordFail();
      setError(checkRl() || friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    setSuccess('');
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
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      clearRl();
      await updateProfile(cred.user, { displayName: name });
      await sendEmailVerification(cred.user);
      setSuccess('Account created! Check your email to verify, then sign in.');
      setTab('signin');
    } catch (err: any) {
      recordFail();
      setError(checkRl() || friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async () => {
    setError('');
    setSuccess('');
    const email = (document.getElementById('forgotEmail') as HTMLInputElement)?.value.trim();
    if (!email) return setError('Please enter your email address.');
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      setSuccess('Reset link sent! Check your inbox (and spam folder).');
    } catch (err: any) {
      setError(friendlyError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError('');
    setSuccess('');
    const blocked = checkRl();
    if (blocked) return setError(blocked);
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    try {
      if (isMobile) await signInWithRedirect(auth, provider);
      else {
        await signInWithPopup(auth, provider);
        clearRl();
        navigate('/dashboard');
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') recordFail();
      if (err.code === 'auth/account-exists-with-different-credential') {
        setError('This email is registered with a password. Sign in with password first.');
        setTab('signin');
      } else setError(friendlyError(err.code));
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', maxWidth: 480, margin: '0 auto', background: '#fff' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@700;800&display=swap');`}</style>
      <div style={{ background: '#58cc02', color: '#fff', padding: 28, borderRadius: '0 0 16px 16px' }}>
        <div style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 20 }}>Unify<span style={{ color: '#fff' }}>.</span></div>
        <h1 style={{ fontFamily: 'Nunito', fontWeight: 800, fontSize: 32, marginTop: 12, lineHeight: 1.1 }}>
          Own your <span style={{ background: '#fff', color: '#58cc02', padding: '0 6px', borderRadius: 6 }}>journey.</span>
        </h1>
        <p style={{ marginTop: 8, opacity: 0.92, fontSize: 14 }}>Duolingo-style learning — 4px tactile, 16px radii</p>
      </div>
      <div style={{ padding: 20, flex: 1 }}>
        <div style={{ display: 'flex', gap: 4, background: '#f7f7f7', border: '2px solid #e5e5e5', borderRadius: 9999, padding: 4, marginBottom: 20 }}>
          <button
            onClick={() => setTab('signin')}
            style={{
              flex: 1,
              padding: 10,
              borderRadius: 9999,
              border: 'none',
              background: tab === 'signin' ? '#58cc02' : 'transparent',
              color: tab === 'signin' ? '#fff' : '#777',
              fontWeight: 700,
              borderBottom: tab === 'signin' ? '3px solid #58a700' : 'none',
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
              background: tab === 'signup' ? '#58cc02' : 'transparent',
              color: tab === 'signup' ? '#fff' : '#777',
              fontWeight: 700,
              borderBottom: tab === 'signup' ? '3px solid #58a700' : 'none',
            }}
          >
            Sign Up
          </button>
        </div>

        {error && <div style={{ background: '#fff0f0', border: '2px solid #ffcccc', borderRadius: 12, padding: 10, color: '#cc0000', fontSize: 13, marginBottom: 12 }}>{error}</div>}
        {success && <div style={{ background: '#f0fff4', border: '2px solid #b3f0c8', borderRadius: 12, padding: 10, color: '#006620', fontSize: 13, marginBottom: 12 }}>{success}</div>}

        {tab === 'signin' && (
          <form onSubmit={handleSignIn} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Email
              <input name="email" type="email" required placeholder="you@email.com" style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                Password <button type="button" onClick={() => setTab('forgot')} style={{ background: 'none', border: 'none', fontSize: 11, color: '#777', textDecoration: 'underline' }}>
                  Forgot password?
                </button>
              </div>
              <div style={{ position: 'relative', marginTop: 6 }}>
                <input name="password" type={showPw ? 'text' : 'password'} required placeholder="Your password" style={{ width: '100%', padding: 12, paddingRight: 44, border: '2px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
                <button type="button" onClick={() => setShowPw(!showPw)} style={{ position: 'absolute', right: 0, top: 0, height: '100%', width: 44, background: 'none', border: 'none', color: '#777' }}>
                  {showPw ? '🙈' : '👁️'}
                </button>
              </div>
            </label>
            <button disabled={loading} type="submit" style={{ padding: 14, background: '#58cc02', color: '#fff', border: 'none', borderBottom: '4px solid #58a700', borderRadius: 16, fontWeight: 800, fontSize: 16 }}>
              {loading ? 'Signing in…' : 'Sign In →'}
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, color: '#777', fontSize: 11 }}>
              <span style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
              or
              <span style={{ flex: 1, height: 1, background: '#e5e5e5' }} />
            </div>
            <button type="button" onClick={handleGoogle} style={{ padding: 12, background: '#fff', border: '2px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 700, display: 'flex', justifyContent: 'center', gap: 8 }}>
              Continue with Google
            </button>
          </form>
        )}

        {tab === 'signup' && (
          <form onSubmit={handleSignUp} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Full Name
              <input name="name" required placeholder="Your full name" style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Email
              <input name="email" type="email" required placeholder="you@email.com" style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Password
              <input name="new-password" type={showPw ? 'text' : 'password'} value={signupPw} onChange={(e) => setSignupPw(e.target.value)} required placeholder="Min. 8 characters" style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
              <div style={{ height: 4, background: '#e5e5e5', borderRadius: 2, marginTop: 8, overflow: 'hidden' }}>
                <div style={{ width: `${([signupPw.length >= 8, /[A-Z]/.test(signupPw), /[0-9]/.test(signupPw)].filter(Boolean).length / 3) * 100}%`, height: '100%', background: score === 1 ? '#ff4b4b' : score === 2 ? '#ff9600' : '#58cc02', transition: 'width .2s' }} />
              </div>
              <div style={{ fontSize: 11, color: hasLength ? '#58a700' : '#777', marginTop: 4 }}>{hasLength ? '✓' : '✗'} At least 8 characters</div>
              <div style={{ fontSize: 11, color: hasUpper ? '#58a700' : '#777' }}>{hasUpper ? '✓' : '✗'} One uppercase letter</div>
              <div style={{ fontSize: 11, color: hasNumber ? '#58a700' : '#777' }}>{hasNumber ? '✓' : '✗'} One number</div>
            </label>
            <label style={{ fontSize: 12, fontWeight: 700 }}>
              Confirm Password
              <input name="confirm-password" type="password" required placeholder="Repeat your password" style={{ width: '100%', padding: 12, marginTop: 6, border: '2px solid #e5e5e5', borderRadius: 12, display: 'block' }} />
            </label>
            <button disabled={loading} type="submit" style={{ padding: 14, background: '#58cc02', color: '#fff', border: 'none', borderBottom: '4px solid #58a700', borderRadius: 16, fontWeight: 800 }}>
              {loading ? 'Creating…' : 'Create Account →'}
            </button>
            <button type="button" onClick={handleGoogle} style={{ padding: 12, background: '#fff', border: '2px solid #e5e5e5', borderBottom: '4px solid #e5e5e5', borderRadius: 16, fontWeight: 700 }}>
              Continue with Google
            </button>
          </form>
        )}

        {tab === 'forgot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <h3 style={{ fontFamily: 'Nunito', fontWeight: 800 }}>Reset your password</h3>
            <p style={{ fontSize: 13, color: '#777' }}>Enter your email and we'll send you a reset link.</p>
            <input id="forgotEmail" placeholder="you@email.com" style={{ padding: 12, border: '2px solid #e5e5e5', borderRadius: 12 }} />
            <button onClick={handleForgot} disabled={loading} style={{ padding: 14, background: '#58cc02', color: '#fff', border: 'none', borderBottom: '4px solid #58a700', borderRadius: 16, fontWeight: 800 }}>
              Send Reset Link →
            </button>
            <button onClick={() => setTab('signin')} style={{ background: 'none', border: 'none', color: '#777', fontSize: 13 }}>
              ← Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
