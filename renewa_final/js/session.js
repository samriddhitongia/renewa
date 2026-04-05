/* ============================================================
   RENEWA — Session & Auth State Management
   Stores user session in sessionStorage
   ============================================================ */

const Session = {

  // ── Get full session ─────────────────────────────────────
  get() {
    try {
      return JSON.parse(sessionStorage.getItem('renewa_user')) || null;
    } catch {
      return null;
    }
  },

  // ── Save session ─────────────────────────────────────────
  set(user) {
    // merge with existing session if present (SAFE UPDATE)
    const existing = this.get() || {};
    const merged = { ...existing, ...user };

    sessionStorage.setItem('renewa_user', JSON.stringify(merged));
  },

  // ── Clear session ────────────────────────────────────────
  clear() {
    sessionStorage.removeItem('renewa_user');
  },

  // ── Status helpers ───────────────────────────────────────
  isLoggedIn() {
    return !!this.get();
  },

  getRole() {
    const u = this.get();
    return u ? u.role : null;
  },

  // ✅ NEW — REQUIRED FOR PURCHASE SYSTEM
  getUserId() {
    const u = this.get();
    return u ? u.id : null;
  },

  // ✅ Wallet helper
  getWallet() {
    const u = this.get();
    return u ? u.walletBalance : 0;
  },

  // ✅ Token helper (future protected APIs)
  getToken() {
    const u = this.get();
    return u ? u.token : null;
  }
};


// ── Navbar updater ──────────────────────────────────────────
function updateNavForSession() {

  const user = Session.get();

  const signInLinks = document.querySelectorAll('.nav-signin-link');
  const dashLinks   = document.querySelectorAll('.nav-dashboard-link');
  const userMenus   = document.querySelectorAll('.nav-user-menu');

  if (user) {

    signInLinks.forEach(el => el.style.display = 'none');

    dashLinks.forEach(el => {
      el.style.display = '';
      const roleMap = {
        consumer: 'consumer.html',
        producer: 'producer.html',
        investor: 'investor.html'
      };
      el.href = roleMap[user.role] || 'consumer.html';
    });

    userMenus.forEach(el => {
      el.style.display = '';

      const nameEl = el.querySelector('.nav-user-name');
      if (nameEl) nameEl.textContent = user.name || user.email;

      const roleEl = el.querySelector('.nav-user-role');
      if (roleEl)
        roleEl.textContent =
          user.role.charAt(0).toUpperCase() + user.role.slice(1);
    });

  } else {
    signInLinks.forEach(el => el.style.display = '');
    dashLinks.forEach(el => el.style.display = 'none');
    userMenus.forEach(el => el.style.display = 'none');
  }
}


// ── Login handler (legacy support kept) ──────────────────────
function doLogin(email, role, name) {

  // now also supports future fields automatically
  Session.set({
    email,
    role,
    name: name || email.split('@')[0]
  });

  updateNavForSession();

  const prefix = window.location.pathname.includes('/pages/') ? '' : 'pages/';

  const roleMap = {
    consumer: prefix + 'consumer.html',
    producer: prefix + 'producer.html',
    investor: prefix + 'investor.html',
  };

  window.location.href = roleMap[role] || prefix + 'consumer.html';
}


// ── Logout handler ───────────────────────────────────────────
function doLogout() {
  Session.clear();

  const isInPages = window.location.pathname.includes('/pages/');
  window.location.href = isInPages ? '../index.html' : 'index.html';
}


// ── Guard: redirect logged-in users on auth page ─────────────
function authPageGuard() {
  if (Session.isLoggedIn()) {
    const user = Session.get();

    const roleMap = {
      consumer: 'consumer.html',
      producer: 'producer.html',
      investor: 'investor.html'
    };

    window.location.href = roleMap[user.role] || 'consumer.html';
  }
}


// ── Guard: require login for dashboard pages ─────────────────
function dashboardGuard() {
  if (!Session.isLoggedIn()) {
    window.location.href = 'auth.html';
  }
}


// Run nav update on every page load
document.addEventListener('DOMContentLoaded', updateNavForSession);