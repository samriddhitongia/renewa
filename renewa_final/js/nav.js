/* ============================================================
   RENEWA — Shared Navbar Injector
   Call injectNavbar(activeLink) where activeLink is one of:
   'home' | 'marketplace' | 'about' | 'dashboard'
   ============================================================ */

function injectNavbar(activeLink) {
  const isRoot  = !window.location.pathname.includes('/pages/');
  const base    = isRoot ? 'pages/' : '';
  const rootBase = isRoot ? '' : '../';

  const links = [
    { key: 'home',        label: 'Home',        href: rootBase + 'index.html' },
    { key: 'marketplace', label: 'Marketplace',  href: base + 'marketplace.html' },
    { key: 'about',       label: 'About',         href: base + 'about.html' },
  ];

  const user = (typeof Session !== 'undefined') ? Session.get() : null;
  const roleMap = { consumer: base + 'consumer.html', producer: base + 'producer.html', investor: base + 'investor.html' };

  const navItems = links.map(l => `
    <li><a class="nav-link ${activeLink === l.key ? 'active' : ''}" href="${l.href}">${l.label}</a></li>
  `).join('');

  const authArea = user ? `
    <li><a class="nav-link nav-dashboard-link ${activeLink === 'dashboard' ? 'active' : ''}" href="${roleMap[user.role] || base + 'consumer.html'}">Dashboard</a></li>
    <li>
      <div class="nav-user-chip">
        <div class="nav-user-avatar">${(user.name || user.email || 'U')[0].toUpperCase()}</div>
        <div class="nav-user-info">
          <span class="nav-user-name">${user.name || user.email}</span>
          <span class="nav-user-role">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
        </div>
        <button class="nav-logout-btn" onclick="doLogout()" title="Sign out">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
        </button>
      </div>
    </li>
  ` : `
    <li><a class="nav-signin-link btn btn-default" href="${base + 'auth.html'}">Sign In</a></li>
  `;

  const mobileItems = links.map(l =>
    `<a class="nav-link ${activeLink === l.key ? 'active' : ''}" href="${l.href}">${l.label}</a>`
  ).join('');

  const mobileAuth = user ? `
    <a class="nav-link ${activeLink === 'dashboard' ? 'active' : ''}" href="${roleMap[user.role] || base + 'consumer.html'}">Dashboard</a>
    <div style="padding-top:1rem;border-top:1px solid var(--border);margin-top:0.5rem">
      <button class="btn btn-outline" style="width:100%;display:block;text-align:center" onclick="doLogout()">Sign Out</button>
    </div>
  ` : `
    <div style="padding-top:1rem;border-top:1px solid var(--border);margin-top:0.5rem">
      <a class="btn btn-default" style="width:100%;display:block;text-align:center" href="${base + 'auth.html'}">Sign In</a>
    </div>
  `;

  const html = `
    <div class="navbar-inner">
      <a class="nav-logo" href="${rootBase}index.html" aria-label="Renewa Home">
        <div class="nav-logo-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>
        </div>
        <span class="nav-logo-text">Renewa</span>
      </a>
      <nav aria-label="Main navigation">
        <ul class="nav-links" role="list">
          ${navItems}
          ${authArea}
        </ul>
      </nav>
      <button class="nav-hamburger" onclick="toggleMobileNav()" aria-label="Toggle menu" aria-expanded="false">
        <span></span><span></span><span></span>
      </button>
    </div>
    <div id="navDrawer" class="nav-drawer" aria-label="Mobile navigation">
      ${mobileItems}
      ${mobileAuth}
    </div>
  `;

  const header = document.querySelector('header.navbar');
  if (header) header.innerHTML = html;
}

function toggleMobileNav() {
  const d = document.getElementById('navDrawer');
  const b = document.querySelector('.nav-hamburger');
  if (!d) return;
  const open = d.classList.toggle('open');
  b.setAttribute('aria-expanded', open);
}
