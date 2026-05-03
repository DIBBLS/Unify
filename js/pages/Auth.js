  import { auth, db, provider } from '../firebase-config.js';
  import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, updateProfile, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
  import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
    const btn = document.getElementById('signinBtn');
    btn.disabled = true; btn.textContent = 'Signing in...';
    try {
      await signInWithEmailAndPassword(auth,
        document.getElementById('signinEmail').value,
        document.getElementById('signinPassword').value
      );
      window.location.href = 'dashboard.html';
    } catch(err) {
      showError(friendlyError(err.code));
      btn.disabled = false; btn.textContent = 'Sign In →';
    }
  }

  window.signUp = async function(e) {
    e.preventDefault(); clearMessages();
    const btn = document.getElementById('signupBtn');
    btn.disabled = true; btn.textContent = 'Creating account...';
    try {
      const cred = await createUserWithEmailAndPassword(auth,
        document.getElementById('signupEmail').value,
        document.getElementById('signupPassword').value
      );
      // New user → onboarding. Existing user → dashboard
      updateProfile(cred.user, { displayName: document.getElementById('signupName').value });
      window.location.href = 'Onboarding.html';
    } catch(err) {
      showError(friendlyError(err.code));
      btn.disabled = false; btn.textContent = 'Create Account →';
    }
  }

  window.signInWithGoogle = async function() {
    clearMessages();
    try {
      await signInWithPopup(auth, provider);
      window.location.href = 'dashboard.html';
    } catch(err) {
      // If this email already exists with email/password, sign them in then link Google
      if (err.code === 'auth/account-exists-with-different-credential') {
        const email = err.customData?.email;
        if (email) {
          showError('This email is registered with a password. Sign in with your password first, then link Google in settings.');
          // Auto-switch to sign in tab and pre-fill email
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
    return 'Something went wrong. Please try again.';
  }
