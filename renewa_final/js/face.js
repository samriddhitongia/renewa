/* ============================================================
   RENEWA — Face Recognition  (v4 — fully working)

   Library : justadudewhohacks/face-api.js  (CDN)
   Models  : same repo via githack CDN (guaranteed matching)
   Strategy: load → camera → detect loop → capture descriptor
   ============================================================ */

const FACE_API   = 'http://localhost:5000/api/face';

// These two MUST match — same repo, same version
const FACEAPI_CDN = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODELS_URL  = 'https://raw.githack.com/justadudewhohacks/face-api.js/master/weights';


/* ─────────────────────────────────────────────────────────────
   Token helper — works on ALL pages (no dependency on marketplace.js)
───────────────────────────────────────────────────────────── */
function _getFaceToken() {
  return localStorage.getItem('token') ||
    (() => { try { return JSON.parse(sessionStorage.getItem('renewa_user'))?.token; } catch { return null; } })();
}

let faceModelsLoaded = false;
let faceStream       = null;
let faceDetectTimer  = null;

/* ─────────────────────────────────────────────────────────────
   1. Inject face-api.js script tag dynamically (so we control
      exactly which version loads before we call loadFaceModels)
───────────────────────────────────────────────────────────── */
function ensureFaceApiScript() {
  return new Promise((resolve, reject) => {
    if (window.faceapi) { resolve(); return; }
    const s = document.createElement('script');
    s.src = FACEAPI_CDN;
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Failed to load face-api.js from CDN. Check internet connection.'));
    document.head.appendChild(s);
  });
}

/* ─────────────────────────────────────────────────────────────
   2. Load model weights from githack (matches the library)
───────────────────────────────────────────────────────────── */
async function loadFaceModels() {
  if (faceModelsLoaded) return;

  // Make sure the JS library itself is loaded first
  await ensureFaceApiScript();

  await Promise.all([
    faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
    faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
  ]);

  faceModelsLoaded = true;
  console.log('✅ Face models loaded OK');
}

/* ─────────────────────────────────────────────────────────────
   3. Start webcam
───────────────────────────────────────────────────────────── */
async function startFaceCamera(videoElId) {
  const video = document.getElementById(videoElId);
  if (!video) throw new Error('Video element #' + videoElId + ' not found');

  if (faceStream) {
    faceStream.getTracks().forEach(t => t.stop());
    faceStream = null;
  }

  faceStream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
  });

  video.srcObject = faceStream;
  video.play();

  // Wait until video dimensions are actually available
  await new Promise(resolve => {
    const check = () => {
      if (video.videoWidth > 0) { resolve(); }
      else { setTimeout(check, 100); }
    };
    check();
  });

  // Extra buffer for stable frames
  await new Promise(r => setTimeout(r, 600));
}

/* ─────────────────────────────────────────────────────────────
   4. Stop webcam + detection loop
───────────────────────────────────────────────────────────── */
function stopFaceCamera() {
  if (faceDetectTimer) { clearInterval(faceDetectTimer); faceDetectTimer = null; }
  if (faceStream)      { faceStream.getTracks().forEach(t => t.stop()); faceStream = null; }
}

/* ─────────────────────────────────────────────────────────────
   5. Live detection preview loop
      Draws bounding box + landmarks on canvas overlay
───────────────────────────────────────────────────────────── */
function startLiveDetection(videoElId, canvasElId, statusElId) {
  const video  = document.getElementById(videoElId);
  const canvas = document.getElementById(canvasElId);
  if (!video || !canvas) return;

  const opts = new faceapi.TinyFaceDetectorOptions({
    inputSize: 320,
    scoreThreshold: 0.2
  });

  faceDetectTimer = setInterval(async () => {
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) return; // not ready yet

      // Always sync canvas size to video
      canvas.width  = vw;
      canvas.height = vh;

      const result = await faceapi
        .detectSingleFace(video, opts)
        .withFaceLandmarks();

      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, vw, vh);

      if (result) {
        // Green bounding box
        const box = result.detection.box;
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth   = 3;
        ctx.strokeRect(box.x, box.y, box.width, box.height);

        // Landmark dots
        ctx.fillStyle = 'rgba(34,197,94,0.8)';
        result.landmarks.positions.forEach(pt => {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        });

        updateFaceStatusEl(statusElId, '✅ Face detected — click Register / Login now!', 'ok');
      } else {
        updateFaceStatusEl(statusElId, '🔍 No face found — move closer, face the camera directly', 'waiting');
      }
    } catch (e) {
      // Swallow errors in live loop — don't spam
    }
  }, 500);
}

/* ─────────────────────────────────────────────────────────────
   6. Capture a 128-float face descriptor (up to 20 retries)
───────────────────────────────────────────────────────────── */
async function getFaceDescriptor(videoElId, onProgress) {
  const video = document.getElementById(videoElId);
  if (!video)              throw new Error('Video element not found');
  if (!video.srcObject)   throw new Error('Camera not started yet');
  if (!video.videoWidth)  throw new Error('Video stream not ready — try again in a moment');

  const opts = new faceapi.TinyFaceDetectorOptions({
    inputSize: 416,
    scoreThreshold: 0.2   // very lenient — catches most angles/lighting
  });

  const MAX = 20;
  for (let i = 1; i <= MAX; i++) {
    if (onProgress) onProgress(i, MAX);
    await new Promise(r => setTimeout(r, 400));

    try {
      const det = await faceapi
        .detectSingleFace(video, opts)
        .withFaceLandmarks()
        .withFaceDescriptor();

      if (det && det.descriptor && det.descriptor.length === 128) {
        console.log(`✅ Descriptor on attempt ${i}/${MAX}, score=${det.detection.score.toFixed(3)}`);
        return Array.from(det.descriptor);
      }
      console.log(`⏳ Attempt ${i}/${MAX}: no detection`);

    } catch (e) {
      console.warn(`Attempt ${i} error:`, e.message);
    }
  }

  throw new Error(
    'Could not detect face after many attempts.\n\n' +
    'Please try:\n' +
    '• Sit closer — your face should fill most of the oval\n' +
    '• Face a window or bright lamp\n' +
    '• Remove glasses or hat\n' +
    '• Look straight at the camera'
  );
}

/* ─────────────────────────────────────────────────────────────
   7. Register — save descriptor to MongoDB via backend
───────────────────────────────────────────────────────────── */
async function registerFace(videoElId, statusElId) {
  const token = _getFaceToken();
  if (!token) {
    updateFaceStatusEl(statusElId, '❌ Not logged in', 'error');
    return false;
  }

  try {
    const descriptor = await getFaceDescriptor(videoElId, (i, max) => {
      updateFaceStatusEl(statusElId, `🔍 Detecting face… attempt ${i}/${max} — hold still`, 'waiting');
    });

    updateFaceStatusEl(statusElId, '⬆️ Saving face vector to database…', 'waiting');

    const res  = await fetch(`${FACE_API}/register`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body:    JSON.stringify({ descriptor })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Server error');

    updateFaceStatusEl(statusElId, '✅ Face saved to database!', 'ok');
    if (typeof showToast === 'function')
      showToast('Face Registered 🎉', 'You can now log in with your face!');
    return true;

  } catch (err) {
    updateFaceStatusEl(statusElId, '❌ ' + err.message, 'error');
    console.error('registerFace:', err);
    return false;
  }
}

/* ─────────────────────────────────────────────────────────────
   8. Face Login — match against all registered users
───────────────────────────────────────────────────────────── */
async function faceLogin(videoElId, statusElId) {
  try {
    const descriptor = await getFaceDescriptor(videoElId, (i, max) => {
      updateFaceStatusEl(statusElId, `🔍 Scanning face… attempt ${i}/${max}`, 'waiting');
    });

    updateFaceStatusEl(statusElId, '🔄 Matching against database…', 'waiting');

    const res  = await fetch(`${FACE_API}/login`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ descriptor })
    });
    const data = await res.json();

    if (!res.ok) {
      updateFaceStatusEl(statusElId, '❌ ' + (data.message || 'Face not recognised'), 'error');
      return;
    }

    updateFaceStatusEl(statusElId, `✅ Welcome back, ${data.name}!`, 'ok');
    stopFaceCamera();

    let walletBalance = 1000;
    try {
      const me = await fetch('http://localhost:5000/api/auth/me', {
        headers: { Authorization: 'Bearer ' + data.token }
      });
      if (me.ok) { const u = await me.json(); walletBalance = u.walletBalance ?? 1000; }
    } catch {}

    Session.set({
      id: null, email: data.email, role: data.role,
      name: data.name, walletBalance, token: data.token
    });
    localStorage.setItem('token', data.token);

    if (typeof showToast === 'function')
      showToast('Face Login Successful 😊', `Welcome back, ${data.name}!`);

    setTimeout(() => {
      const map = { consumer: 'consumer.html', producer: 'producer.html', investor: 'investor.html' };
      window.location.href = map[data.role] || 'consumer.html';
    }, 900);

  } catch (err) {
    updateFaceStatusEl(statusElId, '❌ ' + err.message, 'error');
    console.error('faceLogin:', err);
  }
}

/* ─────────────────────────────────────────────────────────────
   Helpers
───────────────────────────────────────────────────────────── */
function updateFaceStatus(msg) {
  const el = document.getElementById('faceStatus');
  if (el) el.textContent = msg;
}

function updateFaceStatusEl(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.style.color =
    type === 'ok'    ? '#16a34a' :
    type === 'error' ? '#dc2626' : '#2563eb';
}
