import { auth, db, provider } from '../firebase-config.js';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  updateProfile,
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const RL_KEY = 'unify-auth-rl';
const RL_MAX = 10;
const RL_WINDOW = 7 * 60 * 1000;

function getRl() {
  try { return JSON.parse(localStorage.getItem(RL_KEY)) || { count: 0, lockUntil: 0 }; }
  catch { return { count: 0, lockUntil: 0 }; }
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
  if (rl.count >= RL_MAX) { rl.lockUntil = Date.now() + RL_WINDOW; rl.count = 0; }
  localStorage.setItem(RL_KEY, JSON.stringify(rl));
}
function clearRl() { localStorage.removeItem(RL_KEY); }

// If already logged in → check if onboarded
onAuthStateChanged(auth, async user => {
  if (!user) return;
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (snap.exists() && snap.data().university) {
      window.location.href = 'dashboard.html';
    } else {
      window.location.href = 'Onboarding.html';
    }
  } catch(e) {
    window.location.href = 'dashboard.html';
  }
});

function showError(msg) {
  const el = document.getElementById('errorMsg');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('successMsg').style.display = 'none';
}
function showSuccess(msg) {
  const el = document.getElementById('successMsg');
  el.textContent = msg; el.style.display = 'block';
  document.getElementById('errorMsg').style.display = 'none';
}
function clearMessages() {
  document.getElementById('errorMsg').style.display = 'none';
  document.getElementById('successMsg').style.display = 'none';
}

window.switchTab = function(tab) {
  clearMessages();
  const tabs = document.getElementById('authTabs');
  const signinForm = document.getElementById('signinForm');
  const signupForm = document.getElementById('signupForm');
  const forgotForm = document.getElementById('forgotForm');

  if (tab === 'forgot') {
    tabs.style.display = 'none';
    signinForm.classList.remove('active');
    signupForm.classList.remove('active');
    forgotForm.classList.add('active');
    return;
  }

  tabs.style.display = '';
  forgotForm.classList.remove('active');
  document.querySelectorAll('.auth-tab').forEach((t, i) => {
    t.classList.toggle('active', (tab === 'signin' && i === 0) || (tab === 'signup' && i === 1));
  });
  signinForm.classList.toggle('active', tab === 'signin');
  signupForm.classList.toggle('active', tab === 'signup');
}

window.togglePw = function(inputId, btn) {
  const input = document.getElementById(inputId);
  const isHidden = input.type === 'password';
  input.type = isHidden ? 'text' : 'password';
  btn.setAttribute('aria-label', isHidden ? 'Hide password' : 'Show password');
  // Swap eye/eye-off icon
  btn.querySelector('svg').innerHTML = isHidden
    ? '<path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88"/>'
    : '<path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z"/><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>';
}

// Password strength meter
const pwInput = document.getElementById('signupPassword');
if (pwInput) {
  pwInput.addEventListener('input', () => {
    const val = pwInput.value;
    const hasLength = val.length >= 8;
    const hasUpper = /[A-Z]/.test(val);
    const hasNumber = /[0-9]/.test(val);
    const score = [hasLength, hasUpper, hasNumber].filter(Boolean).length;

    const fill = document.getElementById('strengthFill');
    fill.style.width = `${(score / 3) * 100}%`;
    fill.style.background = score === 1 ? '#ef4444' : score === 2 ? '#fbbf24' : '#4ade80';

    setRule('rule-length', hasLength, 'At least 8 characters');
    setRule('rule-upper', hasUpper, 'One uppercase letter');
    setRule('rule-number', hasNumber, 'One number');
  });
}

function setRule(id, passed, text) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = (passed ? '✓ ' : '✗ ') + text;
  el.classList.toggle('ok', passed);
}

window.signIn = async function(e) {
  e.preventDefault(); clearMessages();
  const blocked = checkRl();
  if (blocked) { showError(blocked); return; }
  const btn = document.getElementById('signinBtn');
  btn.disabled = true; btn.textContent = 'Signing in...';
  try {
    await signInWithEmailAndPassword(auth,
      document.getElementById('signinEmail').value.trim(),
      document.getElementById('signinPassword').value
    );
    clearRl();
    window.location.href = 'dashboard.html';
  } catch(err) {
    recordFail();
    const blocked2 = checkRl();
    showError(blocked2 || friendlyError(err.code));
    btn.disabled = false; btn.textContent = 'Sign In →';
  }
}

window.signUp = async function(e) {
  e.preventDefault(); clearMessages();
  const blocked = checkRl();
  if (blocked) { showError(blocked); return; }

  const password = document.getElementById('signupPassword').value;
  const confirm = document.getElementById('signupConfirm').value;
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();

  if (password.length < 8) { showError('Password must be at least 8 characters.'); return; }
  if (password !== confirm) { showError('Passwords do not match.'); return; }

  const btn = document.getElementById('signupBtn');
  btn.disabled = true; btn.textContent = 'Creating account...';
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    clearRl();
    await updateProfile(cred.user, { displayName: name });
    await sendEmailVerification(cred.user);
    showSuccess('Account created! Check your email to verify your address, then sign in.');
    switchTab('signin');
    btn.disabled = false; btn.textContent = 'Create Account →';
  } catch(err) {
    recordFail();
    const blocked2 = checkRl();
    showError(blocked2 || friendlyError(err.code));
    btn.disabled = false; btn.textContent = 'Create Account →';
  }
}

window.forgotPassword = async function() {
  clearMessages();
  const email = document.getElementById('forgotEmail').value.trim();
  if (!email) { showError('Please enter your email address.'); return; }
  const btn = document.getElementById('forgotBtn');
  btn.disabled = true; btn.textContent = 'Sending...';
  try {
    await sendPasswordResetEmail(auth, email);
    showSuccess('Reset link sent! Check your inbox (and spam folder).');
  } catch(err) {
    showError(friendlyError(err.code));
  } finally {
    btn.disabled = false; btn.textContent = 'Send Reset Link →';
  }
}

const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

// Handle redirect result on page load (for mobile Google sign-in)
getRedirectResult(auth).then(result => {
  if (result?.user) {
    clearRl();
    window.location.href = 'dashboard.html';
  }
}).catch(err => {
  if (err.code && err.code !== 'auth/cancelled-popup-request') {
    showError(friendlyError(err.code));
  }
});

window.signInWithGoogle = async function() {
  clearMessages();
  const blocked = checkRl();
  if (blocked) { showError(blocked); return; }
  try {
    if (isMobile) {
      await signInWithRedirect(auth, provider);
    } else {
      await signInWithPopup(auth, provider);
      clearRl();
      window.location.href = 'dashboard.html';
    }
  } catch(err) {
    console.error('[Google sign-in error]', err.code, err.message);
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') recordFail();
    if (err.code === 'auth/account-exists-with-different-credential') {
      const email = err.customData?.email;
      if (email) {
        showError('This email is registered with a password. Sign in with your password first, then link Google in settings.');
        switchTab('signin');
        document.getElementById('signinEmail').value = email;
      } else {
        showError('This email is already registered. Please sign in with your password.');
      }
    } else {
      showError(friendlyError(err.code));
    }
  }
}

function friendlyError(code) {
  if (code === 'auth/invalid-credential') return 'Incorrect email or password.';
  if (code === 'auth/user-not-found') return 'No account found with this email.';
  if (code === 'auth/wrong-password') return 'Incorrect password. Try again.';
  if (code === 'auth/email-already-in-use') return 'An account with this email already exists. Try signing in instead.';
  if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
  if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
  if (code === 'auth/user-disabled') return 'This account has been disabled. Contact support.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Please wait a few minutes and try again.';
  if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
  if (code === 'auth/popup-blocked') return 'Popup was blocked. Please allow popups for this site.';
  if (code === 'auth/cancelled-popup-request') return '';
  if (code === 'auth/unauthorized-domain') return 'Google sign-in is not enabled for this domain yet. Please try email/password sign-in.';
  if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled. Please contact support.';
  if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
  return 'Something went wrong. Please try again.';
}
