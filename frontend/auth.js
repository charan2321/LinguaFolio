/* ============================================================
   AUTH.JS — Real Supabase Authentication
   ============================================================ */

// ===== SIGN IN =====
async function handleSignin() {
  const email = document.getElementById('signinEmail').value.trim();
  const pwd = document.getElementById('signinPwd').value;
  
  if (!email || !pwd) {
    if (!email) {
      document.getElementById('signinEmail').classList.add('error');
      document.getElementById('signinEmailErr').classList.add('show');
    }
    if (!pwd) {
      document.getElementById('signinPwd').classList.add('error');
      document.getElementById('signinPwdErr').classList.add('show');
    }
    return;
  }
  
  try {
    const { data, error } = await _sb.auth.signInWithPassword({
      email,
      password: pwd
    });

    if (error) {
      showToast('❌ ' + (error.message || 'Login failed'), 'error');
      return;
    }

    if (!data?.user || !data?.session) {
      showToast('❌ Login did not return a valid session', 'error');
      return;
    }

    currentUser = {
      ...data.user,
      access_token: data.session.access_token
    };
    
    // Check if admin
    const { data: profile } = await _sb
      .from('profiles')
      .select('role')
      .eq('id', currentUser.id)
      .maybeSingle();
      
    if (profile?.role === 'admin') {
      currentUser.role = 'admin';
    }

    setLoggedIn(currentUser);
    showToast('✅ Logged in successfully!', 'success');
    
    // Clear form
    document.getElementById('signinEmail').value = '';
    document.getElementById('signinPwd').value = '';
    
    setTimeout(() => show('home', null), 500);
  } catch (e) {
    console.error('Sign in exception:', e);
    showToast('❌ Error: ' + e.message, 'error');
  }
}

// ===== SIGN UP =====
async function handleSignup() {
  const name = document.getElementById('signupName').value.trim();
  const email = document.getElementById('signupEmail').value.trim();
  const pwd = document.getElementById('signupPwd').value;
  const pwd2 = document.getElementById('signupPwd2').value;
  const terms = document.getElementById('agreeTerms').checked;
  
  let isValid = true;
  
  if (!name) {
    document.getElementById('signupName').classList.add('error');
    document.getElementById('signupNameErr').classList.add('show');
    isValid = false;
  }
  if (!validateEmail(email)) {
    document.getElementById('signupEmail').classList.add('error');
    document.getElementById('signupEmailErr').classList.add('show');
    isValid = false;
  }
  if (pwd.length < 8) {
    document.getElementById('signupPwd').classList.add('error');
    document.getElementById('signupPwdErr').classList.add('show');
    isValid = false;
  }
  if (pwd !== pwd2) {
    document.getElementById('signupPwd2').classList.add('error');
    document.getElementById('signupPwd2Err').classList.add('show');
    isValid = false;
  }
  if (!terms) {
    document.getElementById('signupTermsErr').classList.add('show');
    isValid = false;
  }
  
  if (!isValid) return;
  
  try {
    // Create auth account
    const { data, error } = await _sb.auth.signUp({
      email,
      password: pwd,
      options: {
        data: { full_name: name }
      }
    });
    
    if (error) {
      showToast('❌ ' + (error.message || 'Signup failed'), 'error');
      return;
    }
    
    const user = data?.user || data?.session?.user;
    
    // Create or update user profile (do NOT set role from client)
    const { error: profileError } = await _sb
      .from('profiles')
      .upsert({
        id: user.id,
        email,
        full_name: name,
        created_at: new Date().toISOString()
      });
    
    if (profileError) {
      console.warn('Profile creation warning:', profileError);
    }
    
    showToast('✅ Account created! Check your email for confirmation.', 'success');
    if (data?.session?.user) {
      currentUser = {
        ...data.session.user,
        access_token: data.session.access_token
      };
      setLoggedIn(currentUser);
      // If immediate session returned, go to home
      setTimeout(() => show('home', null), 500);
    } else {
      // No session (email confirmation required) — go to signin page
      setTimeout(() => show('signin', null), 1500);
    }
  } catch (e) {
    console.error('Signup exception:', e);
    showToast('❌ Error: ' + e.message, 'error');
  }
}

// ===== LOGOUT =====
async function handleLogout() {
  try {
    const { error } = await _sb.auth.signOut();
    
    if (error) {
      console.error('Logout error:', error);
    }
    
    currentUser = null;
    document.getElementById('signinNavBtn').style.display = 'inline-block';
    document.getElementById('signupNavBtn').style.display = 'inline-block';
    document.getElementById('profileNavLink').style.display = 'none';
    document.getElementById('mobSignin').style.display = 'inline-block';
    document.getElementById('mobSignup').style.display = 'inline-block';
    document.getElementById('mobProfileLink').style.display = 'none';
    document.getElementById('mobLogout').style.display = 'none';
    
    showToast('✅ Logged out', 'success');
    show('home', null);
  } catch (e) {
    console.error('Logout exception:', e);
    showToast('❌ Logout failed', 'error');
  }
}

// ===== SOCIAL LOGIN (Google OAuth) =====
async function socialLogin(provider) {
  try {
    const { data, error } = await _sb.auth.signInWithOAuth({
      provider: provider.toLowerCase(),
      options: {
        redirectTo: window.location.origin
      }
    });
    
    if (error) {
      console.error('OAuth error:', error);
      showToast('❌ ' + (error.message || 'Social login failed'), 'error');
    }
  } catch (e) {
    console.error('Social login exception:', e);
    showToast('❌ Error: ' + e.message, 'error');
  }
}

// ===== FORGOT PASSWORD =====
function handleForgot() {
  const email = document.getElementById('signinEmail').value.trim();
  
  if (!validateEmail(email)) {
    showToast('⚠️ Please enter your email first', 'error');
    return;
  }
  
  (async () => {
    try {
      const { error } = await _sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '?reset=true'
      });
      
      if (error) console.error('Reset error:', error);
      // Always show the same message to avoid user enumeration
      showToast("If that email is registered, a reset link has been sent.", 'info');
    } catch (e) {
      console.error('Reset exception:', e);
      showToast('❌ Error: ' + e.message, 'error');
    }
  })();
}

// ===== SET LOGGED IN STATE =====
function setLoggedIn(user) {
  if (user) {
    currentUser = {
      ...user,
      access_token: user.access_token || currentUser?.access_token
    };
    const name = user.user_metadata?.full_name || user.full_name || user.email;
    const initial = name?.charAt(0)?.toUpperCase() || 'U';
    const memberSince = user.created_at
      ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const isAdmin = user.role === 'admin' || user.user_metadata?.role === 'admin';

    // Update navbar
    document.getElementById('signinNavBtn').style.display = 'none';
    document.getElementById('signupNavBtn').style.display = 'none';
    document.getElementById('profileNavLink').style.display = 'inline';
    const adminNavLink = document.getElementById('adminNavLink');
    if (adminNavLink) adminNavLink.style.display = isAdmin ? 'inline' : 'none';
    
    // Update mobile menu
    document.getElementById('mobSignin').style.display = 'none';
    document.getElementById('mobSignup').style.display = 'none';
    document.getElementById('mobProfileLink').style.display = 'inline';
    document.getElementById('mobLogout').style.display = 'inline';
    const mobAdminLink = document.getElementById('mobAdminLink');
    if (mobAdminLink) mobAdminLink.style.display = isAdmin ? 'inline-block' : 'none';
    
    // Update profile page
    document.getElementById('profileAvatar').textContent = initial;
    document.getElementById('profileName').textContent = name;
    document.getElementById('profileEmail').textContent = `${user.email} · Member since ${memberSince}`;

    const settingsName = document.getElementById('settingsName');
    const settingsEmail = document.getElementById('settingsEmail');
    if (settingsName) settingsName.value = name;
    if (settingsEmail) settingsEmail.value = user.email || '';
    
    // Load user's books
    if (typeof loadMyBooks === 'function') {
      loadMyBooks();
    }
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
  try {
    // Check if user is already logged in (session restore on page reload)
    const { data, error } = await _sb.auth.getSession();

    if (data?.session?.user) {
      currentUser = {
        ...data.session.user,
        access_token: data.session.access_token
      };

      setLoggedIn(currentUser);
    }
  } catch (e) {
    console.error('Session check error:', e);
  }

  // Listen for auth state changes (fired on login, logout, and token refresh)
  _sb.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      currentUser = {
        ...session.user,
        access_token: session.access_token
      };
      setLoggedIn(currentUser);
    }
  });
});

// Expose auth functions globally for HTML onclick handlers
window.handleSignin = handleSignin;
window.handleSignup = handleSignup;
window.handleLogout = handleLogout;
window.socialLogin = socialLogin;
window.handleForgot = handleForgot;
window.setLoggedIn = setLoggedIn;

console.log('✅ Auth system initialized');
