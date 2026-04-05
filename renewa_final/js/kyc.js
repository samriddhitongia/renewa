/* ============================================================
   RENEWA — Aadhaar KYC Frontend Module
   Handles: banner display, KYC modal, submission, status check
   ============================================================ */

const KYC_API = 'http://localhost:5000/api/kyc';

/* ── Get token (self-contained) ─────────────────────────────── */
function _kycToken() {
  return localStorage.getItem('token') ||
    (() => { try { return JSON.parse(sessionStorage.getItem('renewa_user'))?.token; } catch { return null; } })();
}

/* ── Check KYC status and inject banner if not verified ──────── */
async function initKYCBanner() {
  await _checkAndRenderKYC();
  // Poll every 20s so dashboard updates automatically after admin verifies
  setInterval(_checkAndRenderKYC, 20000);
}

async function _checkAndRenderKYC() {
  const token = _kycToken();
  if (!token) return;
  try {
    const res  = await fetch(`${KYC_API}/status`, {
      headers: { Authorization: 'Bearer ' + token }
    });
    if (!res.ok) return;
    const data = await res.json();
    const prev = window._kycStatus;
    window._kycStatus = data.status;

    if (data.status === 'verified') {
      document.getElementById('kycBanner')?.remove();
      // If status just changed to verified — show big green success banner
      if (prev && prev !== 'verified') showKYCVerifiedBanner(data.name);
      updateKycBadge('verified');
      return;
    }

    // Refresh banner if status changed
    if (prev !== data.status) {
      document.getElementById('kycBanner')?.remove();
      injectKYCBanner(data);
    }
    updateKycBadge(data.status);
  } catch (e) {
    console.warn('KYC status check failed:', e.message);
  }
}

/* ── Green "KYC Verified" celebration banner ─────────────────── */
function showKYCVerifiedBanner(name) {
  const old = document.getElementById('kycVerifiedBanner');
  if (old) old.remove();

  const b = document.createElement('div');
  b.id = 'kycVerifiedBanner';
  b.style.cssText = `
    position:fixed;top:0;left:0;right:0;z-index:9999;
    background:linear-gradient(135deg,#16a34a,#15803d);
    color:#fff;padding:1rem 1.5rem;
    display:flex;align-items:center;justify-content:space-between;
    box-shadow:0 4px 20px rgba(22,163,74,.4);
    font-family:'Plus Jakarta Sans',sans-serif;
  `;
  b.innerHTML = `
    <div style="display:flex;align-items:center;gap:.75rem;">
      <span style="font-size:1.75rem;">🎉</span>
      <div>
        <div style="font-weight:900;font-size:1rem;">KYC Verified Successfully!</div>
        <div style="font-size:.8rem;opacity:.9;">Your Aadhaar identity has been confirmed. You now have full access to all Renewa features.</div>
      </div>
    </div>
    <button onclick="document.getElementById('kycVerifiedBanner').remove()"
      style="background:rgba(255,255,255,.2);border:none;color:#fff;padding:.4rem .875rem;
             border-radius:.5rem;font-weight:700;font-size:.82rem;cursor:pointer;flex-shrink:0;">
      Dismiss ✕
    </button>
  `;

  document.body.insertAdjacentElement('afterbegin', b);
  // Auto-dismiss after 12 seconds
  setTimeout(() => b.remove(), 12000);
}

/* ── Inject the sticky warning banner at top of page ─────────── */
function injectKYCBanner(data) {
  if (document.getElementById('kycBanner')) return; // already injected

  const messages = {
    pending:   { icon: '⚠️', text: 'Complete your Aadhaar KYC to unlock all features.', btn: 'Verify Now', color: '#f59e0b', bg: '#fffbeb', border: '#fcd34d' },
    submitted: { icon: '🕐', text: 'KYC under review — we\'ll notify you once verified.', btn: 'View Status', color: '#2563eb', bg: '#eff6ff', border: '#93c5fd' },
    rejected:  { icon: '❌', text: `KYC rejected: ${data.rejectedReason || 'Documents unclear'}. Please resubmit.`, btn: 'Resubmit', color: '#dc2626', bg: '#fef2f2', border: '#fca5a5' }
  };

  const m = messages[data.status] || messages.pending;

  const banner = document.createElement('div');
  banner.id = 'kycBanner';
  banner.style.cssText = `
    position:sticky; top:0; z-index:1000;
    background:${m.bg}; border-bottom:2px solid ${m.border};
    padding:.65rem 1.25rem; display:flex; align-items:center;
    justify-content:space-between; gap:1rem; flex-wrap:wrap;
    font-family:'Plus Jakarta Sans',sans-serif;
  `;

  banner.innerHTML = `
    <div style="display:flex;align-items:center;gap:.6rem;flex:1;">
      <span style="font-size:1.1rem">${m.icon}</span>
      <span style="font-size:.85rem;font-weight:600;color:${m.color};">${m.text}</span>
    </div>
    <div style="display:flex;align-items:center;gap:.75rem;flex-shrink:0">
      <button onclick="openKYCModal()"
        style="background:${m.color};color:#fff;border:none;padding:.4rem 1rem;
               border-radius:.5rem;font-size:.82rem;font-weight:700;cursor:pointer;">
        ${m.btn}
      </button>
      ${data.status === 'submitted' ? '' : `
        <button onclick="document.getElementById('kycBanner').style.display='none'"
          style="background:transparent;border:none;color:${m.color};font-size:1.1rem;cursor:pointer;line-height:1">✕</button>
      `}
    </div>
  `;

  // Insert after <header> or at top of <main>
  const header = document.querySelector('header.navbar');
  if (header) header.insertAdjacentElement('afterend', banner);
  else document.body.insertAdjacentElement('afterbegin', banner);
}

/* ── Update Face ID / KYC badge in the wallet card ───────────── */
function updateKycBadge(status) {
  const badge = document.getElementById('kycStatusBadge');
  if (!badge) return;
  const map = {
    pending:   '<span style="color:#f59e0b;font-weight:700;">⚠️ KYC Pending</span>',
    submitted: '<span style="color:#2563eb;font-weight:700;">🕐 KYC Under Review</span>',
    verified:  '<span style="color:#16a34a;font-weight:700;">✅ KYC Verified</span>',
    rejected:  '<span style="color:#dc2626;font-weight:700;">❌ KYC Rejected — Resubmit</span>'
  };
  badge.innerHTML = map[status] || map.pending;
}

/* ── Open the KYC modal ──────────────────────────────────────── */
function openKYCModal() {
  // Create modal if it doesn't exist
  if (!document.getElementById('kycModal')) buildKYCModal();
  document.getElementById('kycModal').style.display = 'flex';

  // If already submitted, show status view instead of form
  if (window._kycStatus === 'submitted') showKYCStatusView();
  else showKYCFormView();
}

function closeKYCModal() {
  const m = document.getElementById('kycModal');
  if (m) m.style.display = 'none';
}

/* ── Build KYC modal DOM ─────────────────────────────────────── */
function buildKYCModal() {
  const modal = document.createElement('div');
  modal.id = 'kycModal';
  modal.style.cssText = `
    display:none;position:fixed;inset:0;background:rgba(0,0,0,.65);
    z-index:10000;align-items:center;justify-content:center;
    font-family:'Plus Jakarta Sans',sans-serif;
  `;

  modal.innerHTML = `
    <div style="background:#fff;border-radius:1rem;padding:0;width:min(520px,95vw);
                max-height:92vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,.3);">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#1e3a5f,#2563eb);padding:1.25rem 1.5rem;
                  border-radius:1rem 1rem 0 0;display:flex;align-items:center;justify-content:space-between;">
        <div>
          <h2 style="margin:0;color:#fff;font-size:1.1rem;">🪪 Aadhaar KYC Verification</h2>
          <p style="margin:.25rem 0 0;color:rgba(255,255,255,.7);font-size:.78rem;">
            Required to access all platform features
          </p>
        </div>
        <button onclick="closeKYCModal()"
          style="background:rgba(255,255,255,.15);border:none;color:#fff;width:2rem;height:2rem;
                 border-radius:50%;font-size:1rem;cursor:pointer;line-height:1;">✕</button>
      </div>

      <!-- Body -->
      <div id="kycModalBody" style="padding:1.5rem;">
        <!-- Filled by showKYCFormView() or showKYCStatusView() -->
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

/* ── KYC Form view ───────────────────────────────────────────── */
function showKYCFormView() {
  const body = document.getElementById('kycModalBody');
  body.innerHTML = `
    <!-- Progress steps -->
    <div style="display:flex;gap:.5rem;margin-bottom:1.5rem;">
      ${['1. Aadhaar Number','2. Upload Docs','3. Selfie'].map((s,i)=>`
        <div style="flex:1;text-align:center;">
          <div style="width:1.75rem;height:1.75rem;border-radius:50%;background:${i===0?'#2563eb':'#e2e8f0'};
                      color:${i===0?'#fff':'#94a3b8'};font-weight:700;font-size:.8rem;
                      display:flex;align-items:center;justify-content:center;margin:0 auto .3rem;">${i+1}</div>
          <div style="font-size:.68rem;color:#64748b;font-weight:600;">${s}</div>
        </div>
      `).join('<div style="flex:0;border-top:2px solid #e2e8f0;margin-top:.875rem;width:1.5rem;"></div>')}
    </div>

    <!-- Status message -->
    <div id="kycFormStatus" style="display:none;padding:.6rem .875rem;border-radius:.5rem;
         font-size:.82rem;font-weight:600;margin-bottom:1rem;"></div>

    <!-- Step 1: Aadhaar number -->
    <div id="kycStep1">
      <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.4rem;">
        Aadhaar Card Number <span style="color:#dc2626">*</span>
      </label>
      <input id="kycAadhaarNum" type="text" maxlength="14" placeholder="XXXX XXXX XXXX"
        oninput="formatAadhaar(this)"
        style="width:100%;padding:.7rem .875rem;border:1.5px solid #e2e8f0;border-radius:.75rem;
               font-size:1rem;font-family:monospace;letter-spacing:.1em;box-sizing:border-box;
               background:#f8fafc;">
      <p style="font-size:.72rem;color:#94a3b8;margin:.4rem 0 1.25rem;">
        🔒 Only last 4 digits are stored — your full number is never saved
      </p>

      <!-- Step 2: Upload files -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.875rem;margin-bottom:1.25rem;">
        ${buildUploadBox('kycFront', 'aadhaarFront', '📄 Aadhaar Front', 'Clear photo of front side')}
        ${buildUploadBox('kycBack',  'aadhaarBack',  '📄 Aadhaar Back',  'Clear photo of back side')}
      </div>

      <!-- Step 3: Selfie -->
      <label style="font-size:.8rem;font-weight:700;display:block;margin-bottom:.6rem;">
        📸 Live Selfie <span style="color:#dc2626">*</span>
      </label>
      <p style="font-size:.72rem;color:#64748b;margin:0 0 .75rem;">
        Take a photo now holding your Aadhaar card next to your face
      </p>

      <!-- Selfie: webcam or upload -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.6rem;margin-bottom:1rem;">
        <button onclick="startKYCSelfie()"
          style="padding:.65rem;border-radius:.75rem;border:1.5px solid #2563eb;
                 background:#eff6ff;color:#2563eb;font-weight:700;font-size:.82rem;cursor:pointer;">
          📷 Use Camera
        </button>
        <label style="padding:.65rem;border-radius:.75rem;border:1.5px solid #e2e8f0;
                      background:#f8fafc;color:#475569;font-weight:700;font-size:.82rem;
                      cursor:pointer;text-align:center;">
          📁 Upload Photo
          <input type="file" id="kycSelfieFile" accept="image/*" style="display:none"
            onchange="previewSelfieFile(this)">
        </label>
      </div>

      <!-- Webcam selfie panel -->
      <div id="kycSelfiePanel" style="display:none;margin-bottom:1rem;">
        <div style="position:relative;width:100%;aspect-ratio:4/3;background:#0f172a;
                    border-radius:.875rem;overflow:hidden;border:2px solid #334155;margin-bottom:.6rem;">
          <video id="kycSelfieVideo" autoplay muted playsinline
            style="width:100%;height:100%;object-fit:cover;transform:scaleX(-1);display:block;"></video>
          <canvas id="kycSelfieCanvas" style="display:none;"></canvas>
        </div>
        <div style="display:flex;gap:.6rem;">
          <button onclick="captureKYCSelfie()"
            style="flex:1;padding:.6rem;background:#16a34a;color:#fff;border:none;
                   border-radius:.75rem;font-weight:700;font-size:.85rem;cursor:pointer;">
            📸 Capture
          </button>
          <button onclick="stopKYCCamera()"
            style="padding:.6rem 1rem;background:#f1f5f9;color:#475569;border:1.5px solid #e2e8f0;
                   border-radius:.75rem;font-weight:700;font-size:.85rem;cursor:pointer;">
            Cancel
          </button>
        </div>
      </div>

      <!-- Selfie preview -->
      <div id="kycSelfiePreview" style="display:none;margin-bottom:1rem;text-align:center;">
        <img id="kycSelfieImg" style="max-width:160px;border-radius:.75rem;border:2px solid #22c55e;">
        <p style="font-size:.75rem;color:#16a34a;font-weight:700;margin:.4rem 0 0;">✅ Selfie ready</p>
        <button onclick="resetSelfie()"
          style="font-size:.72rem;color:#dc2626;background:none;border:none;cursor:pointer;margin-top:.2rem;">
          Remove & redo
        </button>
      </div>

      <!-- Submit button -->
      <button id="kycSubmitBtn" onclick="submitKYC()"
        style="width:100%;padding:.875rem;background:#2563eb;color:#fff;border:none;
               border-radius:.875rem;font-size:.95rem;font-weight:800;cursor:pointer;
               box-shadow:0 4px 14px rgba(37,99,235,.35);margin-top:.5rem;">
        Submit KYC for Verification →
      </button>

      <p style="font-size:.72rem;color:#94a3b8;text-align:center;margin:.75rem 0 0;line-height:1.5;">
        🔐 Your documents are encrypted and reviewed only by Renewa compliance team.<br>
        Verification typically takes 24–48 hours.
      </p>
    </div>
  `;
}

function buildUploadBox(elId, fieldName, label, sublabel) {
  return `
    <label style="display:block;cursor:pointer;">
      <div id="${elId}Box" style="border:2px dashed #cbd5e1;border-radius:.875rem;padding:1.25rem .75rem;
                text-align:center;background:#f8fafc;transition:border-color .2s;"
           onmouseenter="this.style.borderColor='#2563eb'" onmouseleave="this.style.borderColor='#cbd5e1'">
        <div style="font-size:1.5rem;margin-bottom:.35rem;">${label.split(' ')[0]}</div>
        <div style="font-size:.78rem;font-weight:700;color:#334155;">${label.split(' ').slice(1).join(' ')}</div>
        <div style="font-size:.7rem;color:#94a3b8;margin:.2rem 0 .6rem;">${sublabel}</div>
        <div style="font-size:.72rem;background:#e2e8f0;padding:.25rem .6rem;border-radius:999px;
                    color:#475569;display:inline-block;">Click to upload</div>
        <div id="${elId}Name" style="font-size:.7rem;color:#16a34a;margin-top:.4rem;font-weight:600;"></div>
      </div>
      <input type="file" id="${elId}" name="${fieldName}" accept="image/*,application/pdf"
        style="display:none" onchange="previewUpload('${elId}')">
    </label>
  `;
}

/* ── KYC Status view (after submission) ──────────────────────── */
function showKYCStatusView() {
  const body = document.getElementById('kycModalBody');
  const s = window._kycStatus;

  const config = {
    submitted: { icon:'🕐', color:'#2563eb', bg:'#eff6ff', title:'Under Review', msg:'Your documents have been submitted and are being reviewed by our compliance team. This usually takes 24–48 hours.' },
    verified:  { icon:'✅', color:'#16a34a', bg:'#f0fdf4', title:'KYC Verified!', msg:'Your identity has been verified. You have full access to all Renewa platform features.' },
    rejected:  { icon:'❌', color:'#dc2626', bg:'#fef2f2', title:'KYC Rejected', msg:'Your documents were rejected. Please resubmit with clearer photos.' },
    pending:   { icon:'⚠️', color:'#f59e0b', bg:'#fffbeb', title:'Not Started', msg:'Complete your KYC to access all features.' }
  }[s] || { icon:'⚠️', color:'#f59e0b', bg:'#fffbeb', title:'Pending', msg:'' };

  body.innerHTML = `
    <div style="text-align:center;padding:1rem 0;">
      <div style="font-size:3.5rem;margin-bottom:.75rem;">${config.icon}</div>
      <h3 style="color:${config.color};margin:0 0 .5rem;font-size:1.15rem;">${config.title}</h3>
      <p style="color:#64748b;font-size:.875rem;line-height:1.6;margin:0 0 1.5rem;">${config.msg}</p>

      <div style="background:${config.bg};border-radius:.875rem;padding:1rem;margin-bottom:1.25rem;text-align:left;">
        <div style="font-size:.78rem;font-weight:700;color:#334155;margin-bottom:.5rem;">Verification Status</div>
        <div style="display:flex;align-items:center;gap:.5rem;">
          <span style="width:.5rem;height:.5rem;border-radius:50%;background:${config.color};display:inline-block;"></span>
          <span style="font-size:.82rem;font-weight:600;color:${config.color};">${config.title}</span>
        </div>
      </div>

      ${s === 'rejected' ? `
        <button onclick="showKYCFormView()"
          style="width:100%;padding:.875rem;background:#dc2626;color:#fff;border:none;
                 border-radius:.875rem;font-weight:700;font-size:.9rem;cursor:pointer;">
          🔄 Resubmit Documents
        </button>
      ` : ''}

      ${s === 'verified' ? `
        <button onclick="closeKYCModal()"
          style="width:100%;padding:.875rem;background:#16a34a;color:#fff;border:none;
                 border-radius:.875rem;font-weight:700;font-size:.9rem;cursor:pointer;">
          ✅ Continue to Dashboard
        </button>
      ` : ''}
    </div>
  `;
}

/* ── File upload preview ─────────────────────────────────────── */
function previewUpload(elId) {
  const input = document.getElementById(elId);
  const nameEl = document.getElementById(elId + 'Name');
  if (input.files[0] && nameEl) {
    nameEl.textContent = '✅ ' + input.files[0].name;
  }
}

/* ── Format Aadhaar input as XXXX XXXX XXXX ─────────────────── */
function formatAadhaar(input) {
  let v = input.value.replace(/\D/g, '').slice(0, 12);
  input.value = v.replace(/(\d{4})(?=\d)/g, '$1 ');
}

/* ── KYC Selfie webcam ───────────────────────────────────────── */
let kycCamStream = null;
let kycSelfieBlob = null;

async function startKYCSelfie() {
  document.getElementById('kycSelfiePanel').style.display = 'block';
  document.getElementById('kycSelfiePreview').style.display = 'none';
  try {
    kycCamStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    document.getElementById('kycSelfieVideo').srcObject = kycCamStream;
  } catch(e) {
    alert('Camera access denied. Please upload a photo instead.');
    document.getElementById('kycSelfiePanel').style.display = 'none';
  }
}

function captureKYCSelfie() {
  const video  = document.getElementById('kycSelfieVideo');
  const canvas = document.getElementById('kycSelfieCanvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  canvas.toBlob(blob => {
    kycSelfieBlob = blob;
    const url = URL.createObjectURL(blob);
    document.getElementById('kycSelfieImg').src = url;
    document.getElementById('kycSelfiePreview').style.display = 'block';
    document.getElementById('kycSelfiePanel').style.display = 'none';
    stopKYCCamera();
  }, 'image/jpeg', 0.92);
}

function previewSelfieFile(input) {
  if (!input.files[0]) return;
  kycSelfieBlob = input.files[0];
  const url = URL.createObjectURL(input.files[0]);
  document.getElementById('kycSelfieImg').src = url;
  document.getElementById('kycSelfiePreview').style.display = 'block';
}

function resetSelfie() {
  kycSelfieBlob = null;
  document.getElementById('kycSelfiePreview').style.display = 'none';
  document.getElementById('kycSelfieFile').value = '';
}

function stopKYCCamera() {
  if (kycCamStream) { kycCamStream.getTracks().forEach(t => t.stop()); kycCamStream = null; }
  document.getElementById('kycSelfiePanel').style.display = 'none';
}

/* ── Submit KYC ──────────────────────────────────────────────── */
async function submitKYC() {
  const token = _kycToken();
  if (!token) { alert('Please log in first'); return; }

  const numRaw  = document.getElementById('kycAadhaarNum')?.value.replace(/\s/g,'');
  const front   = document.getElementById('kycFront')?.files[0];
  const back    = document.getElementById('kycBack')?.files[0];

  // Validate
  if (!numRaw || numRaw.length !== 12) {
    return setKYCStatus('Please enter a valid 12-digit Aadhaar number', 'error');
  }
  if (!front) return setKYCStatus('Please upload Aadhaar front side', 'error');
  if (!back)  return setKYCStatus('Please upload Aadhaar back side', 'error');
  if (!kycSelfieBlob) return setKYCStatus('Please take or upload a selfie', 'error');

  const btn = document.getElementById('kycSubmitBtn');
  btn.disabled = true;
  btn.textContent = '⏳ Uploading documents…';
  setKYCStatus('Uploading your documents securely…', 'info');

  try {
    const fd = new FormData();
    fd.append('aadhaarNumber', numRaw);
    fd.append('aadhaarFront',  front);
    fd.append('aadhaarBack',   back);
    fd.append('selfie', kycSelfieBlob, 'selfie.jpg');

    const res  = await fetch(`${KYC_API}/submit`, {
      method:  'POST',
      headers: { Authorization: 'Bearer ' + token },
      body:    fd
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.message || 'Submission failed');

    window._kycStatus = 'submitted';
    setKYCStatus('✅ Documents submitted! Under review now.', 'ok');
    if (typeof showToast === 'function')
      showToast('KYC Submitted 📋', 'We\'ll verify your documents within 24–48 hours.');

    // Update banner
    document.getElementById('kycBanner')?.remove();
    injectKYCBanner({ status: 'submitted' });
    updateKycBadge('submitted');

    setTimeout(() => showKYCStatusView(), 1500);

  } catch(e) {
    setKYCStatus('❌ ' + e.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Submit KYC for Verification →';
  }
}

function setKYCStatus(msg, type) {
  const el = document.getElementById('kycFormStatus');
  if (!el) return;
  el.style.display = 'block';
  el.textContent   = msg;
  el.style.background = type === 'ok' ? '#f0fdf4' : type === 'error' ? '#fef2f2' : '#eff6ff';
  el.style.color      = type === 'ok' ? '#16a34a' : type === 'error' ? '#dc2626' : '#2563eb';
  el.style.border     = `1.5px solid ${type === 'ok' ? '#86efac' : type === 'error' ? '#fca5a5' : '#93c5fd'}`;
}
