/* ============================================================
   RENEWA — Frontend Auth
   Connects to backend, then stores user in Session (sessionStorage)
   so all other pages (dashboards, marketplace) can read it.
   ============================================================ */

const API_URL = 'http://localhost:5000/api/auth';

let loginRole = 'consumer';
let regRole   = 'consumer';

// ── Tab switch ────────────────────────────────────────────────
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab-btn')
    .forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.auth-panel')
    .forEach(p => p.classList.toggle('active', p.id === 'panel-' + tab));
}

// ── Role pills ────────────────────────────────────────────────
function selectLoginRole(role, el) {
  loginRole = role;
  document.querySelectorAll('#loginRoleGroup .role-pill-btn')
    .forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

function selectRegRole(role, el) {
  regRole = role;
  document.querySelectorAll('#registerRoleGroup .role-pill-btn')
    .forEach(b => b.classList.remove('selected'));
  el.classList.add('selected');
}

// ── Inline error/success messages ────────────────────────────
function setMsg(panel, msg, ok) {
  const id = 'msg_' + panel;
  let el = document.getElementById(id);

  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.style.cssText =
      'padding:0.65rem 1rem;border-radius:0.6rem;font-size:0.82rem;font-weight:600;margin-bottom:0.75rem;display:none';
    document.getElementById('panel-' + panel)?.prepend(el);
  }

  el.style.background = ok ? 'hsl(152,76%,94%)' : 'hsl(0,80%,96%)';
  el.style.border     = ok ? '1.5px solid hsl(152,50%,70%)' : '1.5px solid hsl(0,72%,85%)';
  el.style.color      = ok ? 'hsl(152,76%,28%)' : 'hsl(0,72%,40%)';
  el.textContent      = (ok ? '✅ ' : '⚠ ') + msg;
  el.style.display    = 'block';

  if (ok) setTimeout(() => { el.style.display = 'none'; }, 4000);
}

// ── Register ──────────────────────────────────────────────────
async function handleRegister(e) {
  e.preventDefault();

  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if (!name || !email || !password) {
    setMsg('register', 'Please fill all fields.');
    return;
  }

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Creating account…';

  try {
    const res = await fetch(API_URL + '/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, role: regRole })
    });

    const data = await res.json();

    if (!res.ok) {
      setMsg('register', data.message || 'Registration failed.');
      return;
    }

    setMsg('register', 'Account created! Signing you in…', true);

    setTimeout(() => _loginRequest(email, password), 700);

  } catch {
    setMsg('register', 'Cannot reach server. Is backend running on port 5000?');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Create Account';
  }
}

// ── Login ─────────────────────────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();

  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;

  if (!email || !password) {
    setMsg('login', 'Please fill all fields.');
    return;
  }

  const btn = e.target.querySelector('button[type=submit]');
  btn.disabled = true;
  btn.textContent = 'Signing in…';

  try {
    await _loginRequest(email, password);
  } catch {
    setMsg('login', 'Cannot reach server. Is backend running on port 5000?');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sign In';
  }
}

// ── Core login (FIXED SESSION STORAGE) ───────────────────────
async function _loginRequest(email, password) {

  const res = await fetch(API_URL + '/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await res.json();

  if (!res.ok) {
    setMsg('login', data.message || 'Login failed.');
    return;
  }

  // Fetch full user profile (includes walletBalance from DB)
  let userId = null;
  let walletBalance = 1000;
  try {
    const meRes = await fetch('http://localhost:5000/api/auth/me', {
      headers: { Authorization: 'Bearer ' + data.token }
    });
    if (meRes.ok) {
      const me = await meRes.json();
      userId = me._id;
      walletBalance = me.walletBalance ?? 1000;
    }
  } catch {}

  Session.set({
    id:            userId,
    email:         data.email  || email,
    role:          data.role,
    name:          data.name   || email.split('@')[0],
    walletBalance: walletBalance,
    token:         data.token
  });

  // Store token in localStorage too so all pages can find it
  localStorage.setItem('token', data.token);

  const map = {
    consumer: 'consumer.html',
    producer: 'producer.html',
    investor: 'investor.html'
  };

  window.location.href = map[data.role] || 'consumer.html';
}

// ── Demo login ───────────────────────────────────────────────
function demoLogin(role) {

  const d = {
    consumer: { name: 'Alex Green', email: 'alex@renewa.io' },
    producer: { name: 'Sarah Chen', email: 'sarah@renewa.io' },
    investor: { name: 'Dr. Amara Patel', email: 'amara@renewa.io' }
  }[role] || { name: 'Guest', email: 'guest@renewa.io' };

  Session.set({
    id: "demo-user",
    email: d.email,
    role,
    name: d.name,
    walletBalance: 1000,
    demo: true
  });

  const map = {
    consumer: 'consumer.html',
    producer: 'producer.html',
    investor: 'investor.html'
  };

  window.location.href = map[role];
}

// ── Skip auth if already logged in ───────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  if (Session.isLoggedIn()) {
    const map = {
      consumer: 'consumer.html',
      producer: 'producer.html',
      investor: 'investor.html'
    };

    window.location.href = map[Session.getRole()] || 'consumer.html';
    return;
  }

  injectNavbar('auth');
});