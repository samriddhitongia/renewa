/* ============================================================
   RENEWA — App Router & Shared Utilities
   ============================================================ */

// ── State ─────────────────────────────────────────────────────
const App = {
  currentPage: 'home',
  role: 'consumer', // current selected role
};

// ── Pages registered ──────────────────────────────────────────
const PAGES = ['home', 'marketplace', 'auth', 'producer', 'consumer', 'investor'];

// ── Router ────────────────────────────────────────────────────
function navigate(pageId) {
  // Hide all pages
  PAGES.forEach(id => {
    const el = document.getElementById('page-' + id);
    if (el) el.classList.remove('active');
  });

  // Show target
  const target = document.getElementById('page-' + pageId);
  if (!target) return;
  target.classList.add('active');
  App.currentPage = pageId;

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Close mobile drawer
  closeMobileNav();

  // Update nav active state
  updateNavLinks(pageId);

  // Page-specific inits
  onPageEnter(pageId);
}

function onPageEnter(pageId) {
  switch (pageId) {
    case 'home':
      initHeroBars();
      break;
    case 'marketplace':
      renderListings(allListings);
      break;
    case 'producer':
      renderProducerChart();
      break;
    case 'consumer':
      renderDonutChart();
      break;
    case 'investor':
      renderProjects();
      break;
  }
}

// ── Nav Link Active State ──────────────────────────────────────
function updateNavLinks(pageId) {
  const map = {
    marketplace: 'nav-marketplace',
    producer:    'nav-producer',
    consumer:    'nav-consumer',
    investor:    'nav-investor',
  };

  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
  if (map[pageId]) {
    const el = document.getElementById(map[pageId]);
    if (el) el.classList.add('active');
  }
}

// ── Mobile Nav ────────────────────────────────────────────────
function toggleMobileNav() {
  const drawer = document.getElementById('navDrawer');
  if (!drawer) return;
  drawer.classList.toggle('open');
}
function closeMobileNav() {
  const drawer = document.getElementById('navDrawer');
  if (drawer) drawer.classList.remove('open');
}

// ── Toast System ──────────────────────────────────────────────
function showToast(title, desc) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `
    <div class="toast-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
    </div>
    <div class="toast-body">
      <div class="toast-title">${title}</div>
      <div class="toast-desc">${desc}</div>
    </div>
  `;
  container.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ── Hero Bars Animation ───────────────────────────────────────
function initHeroBars() {
  const bars = [
    { id: 'barSolar',   width: '45%' },
    { id: 'barWind',    width: '35%' },
    { id: 'barBiomass', width: '14%' },
  ];
  // Reset first
  bars.forEach(b => {
    const el = document.getElementById(b.id);
    if (el) el.style.width = '0%';
  });
  // Animate
  setTimeout(() => {
    bars.forEach((b, i) => {
      setTimeout(() => {
        const el = document.getElementById(b.id);
        if (el) el.style.width = b.width;
      }, i * 120);
    });
  }, 350);
}

// ── Init ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Start on home
  navigate('home');
});
