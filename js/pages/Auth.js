  import { auth, db, provider } from '../firebase-config.js';
  import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, signInWithRedirect, getRedirectResult, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
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
    document.querySelectorAll('.auth-tab').forEach((t, i) => {
      t.classList.toggle('active', (tab === 'signin' && i === 0) || (tab === 'signup' && i === 1));
    });
    document.getElementById('signinForm').classList.toggle('active', tab === 'signin');
    document.getElementById('signupForm').classList.toggle('active', tab === 'signup');
  }

  window.signIn = async function(e) {
    e.preventDefault(); clearMessages();
    const blocked = checkRl();
    if (blocked) { showError(blocked); return; }
    const btn = document.getElementById('signinBtn');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      await signInWithEmailAndPassword(auth,
        document.getElementById('signinEmail').value,
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
    const btn = document.getElementById('signupBtn');
    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
      const cred = await createUserWithEmailAndPassword(auth,
        document.getElementById('signupEmail').value,
        document.getElementById('signupPassword').value
      );
      clearRl();
      updateProfile(cred.user, { displayName: document.getElementById('signupName').value });
      window.location.href = 'Onboarding.html';
    } catch(err) {
      recordFail();
      const blocked2 = checkRl();
      showError(blocked2 || friendlyError(err.code));
      btn.disabled = false; btn.textContent = 'Create Account →';
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
        // Redirect flow — avoids popup blocking on mobile browsers
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
    if (code === 'auth/user-not-found') return 'No account found with this email.';
    if (code === 'auth/wrong-password') return 'Incorrect password. Try again.';
    if (code === 'auth/email-already-in-use') return 'An account with this email already exists.';
    if (code === 'auth/weak-password') return 'Password must be at least 6 characters.';
    if (code === 'auth/invalid-email') return 'Please enter a valid email address.';
    if (code === 'auth/popup-closed-by-user') return 'Google sign-in was cancelled.';
    if (code === 'auth/popup-blocked') return 'Popup was blocked. Please allow popups for this site.';
    if (code === 'auth/cancelled-popup-request') return '';
    if (code === 'auth/unauthorized-domain') return 'Google sign-in is not enabled for this domain yet. Please try email/password sign-in.';
    if (code === 'auth/operation-not-allowed') return 'Google sign-in is not enabled. Please contact support.';
    if (code === 'auth/network-request-failed') return 'Network error. Check your connection and try again.';
    return 'Something went wrong. Please try again.';
  }
