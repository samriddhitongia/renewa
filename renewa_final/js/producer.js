// ===============================
// MODAL OPEN/CLOSE
// ===============================

function openListingModal() {
  const modal = document.getElementById('listingModal');
  if (modal) {
    modal.style.display = 'flex';
    const msg = document.getElementById('listingMsg');
    if (msg) msg.style.display = 'none';
  }
}

function closeListingModal() {
  const modal = document.getElementById('listingModal');
  if (modal) modal.style.display = 'none';
  const form = document.getElementById('listingForm');
  if (form) form.reset();
}

// ===============================
// HELPERS
// ===============================

function getAuthToken() {
  return localStorage.getItem("token") ||
    (() => { try { return JSON.parse(sessionStorage.getItem("renewa_user"))?.token; } catch { return null; } })();
}

function showListingMsg(msg, ok) {
  const el = document.getElementById('listingMsg');
  if (!el) return;
  el.style.background = ok ? 'hsl(152,76%,94%)' : 'hsl(0,80%,96%)';
  el.style.border = ok ? '1.5px solid hsl(152,50%,70%)' : '1.5px solid hsl(0,72%,85%)';
  el.style.color = ok ? 'hsl(152,76%,28%)' : 'hsl(0,72%,40%)';
  el.textContent = (ok ? '✅ ' : '⚠ ') + msg;
  el.style.display = 'block';
}

// ===============================
// CREATE LISTING
// ===============================

const form = document.getElementById("listingForm");

if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const token = getAuthToken();
    if (!token) {
      showListingMsg('Please sign in first.');
      return;
    }

    const submitBtn = form.querySelector('button[type=submit]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Posting...';

    const formData = new FormData();
    formData.append("type",  document.getElementById("type").value);
    formData.append("kwh",   document.getElementById("kwh").value);
    formData.append("price", document.getElementById("price").value);
    formData.append("loc",   document.getElementById("loc").value);
    formData.append("avail", document.getElementById("avail")?.value || "Available Now");
    formData.append("cert",  document.getElementById("cert")?.value || "REC Certified");
    formData.append("desc",  document.getElementById("desc")?.value || "");

    const imageEl = document.getElementById("image");
    if (imageEl && imageEl.files[0]) formData.append("image", imageEl.files[0]);

    try {
      const res = await fetch("http://localhost:5000/api/listings", {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: formData
      });

      const data = await res.json();

      if (!res.ok) {
        showListingMsg(data.message || 'Could not create listing');
        return;
      }

      showListingMsg('Listing created successfully!', true);
      setTimeout(() => {
        closeListingModal();
        if (typeof showToast === 'function') showToast('Listing Live! 🎉', 'Your energy is now on the marketplace');
      }, 800);
      loadMyListings();
      form.reset();

    } catch (err) {
      showListingMsg('Cannot reach server. Is backend running on port 5000?');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> Post Listing';
    }
  });
}


// ===============================
// LOAD PRODUCER LISTINGS
// ===============================

async function loadMyListings() {
  const token = getAuthToken();
  if (!token) return;

  try {
    const res = await fetch("http://localhost:5000/api/listings/mine/producer", {
      headers: { Authorization: "Bearer " + token }
    });

    if (!res.ok) {
      console.error("Failed to load producer listings:", res.status);
      return;
    }

    const listings = await res.json();
    const body = document.getElementById("listingsBody");
    if (!body) return;

    if (!listings.length) {
      body.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--muted-fg)">
        <div style="font-size:1.5rem;margin-bottom:0.5rem">📋</div>
        No listings yet. <button onclick="openListingModal()" style="background:none;border:none;color:var(--primary);font-weight:700;cursor:pointer;text-decoration:underline">Create your first listing!</button>
      </td></tr>`;
      return;
    }

    body.innerHTML = listings.map(l => {
      const imgCol = l.image
        ? `<img src="http://localhost:5000/uploads/${l.image}" style="width:2.5rem;height:2.5rem;object-fit:cover;border-radius:0.5rem;border:1px solid var(--border)" onerror="this.style.display='none'">`
        : `<div style="width:2.5rem;height:2.5rem;border-radius:0.5rem;background:var(--muted);display:flex;align-items:center;justify-content:center;font-size:1rem">${l.type==='Solar'?'☀️':l.type==='Wind'?'💨':'🌿'}</div>`;
      return `<tr>
        <td style="display:flex;align-items:center;gap:0.75rem;padding-block:0.75rem">${imgCol}<div><div style="font-weight:700">${l.type} Energy</div><div style="font-size:0.75rem;color:var(--muted-fg)">${l.desc||'No description'}</div></div></td>
        <td>${l.loc || "—"}</td>
        <td>${l.kwh.toLocaleString()} kWh</td>
        <td>₹${l.price}</td>
        <td><span style="padding:0.25rem 0.625rem;border-radius:50rem;font-size:0.72rem;font-weight:700;background:${l.active?'var(--primary-10)':'var(--muted)'};color:${l.active?'var(--primary)':'var(--muted-fg)'}">${l.active ? "● Active" : "Sold Out"}</span></td>
        <td>
          <button onclick="deleteListing('${l._id}')" style="color:hsl(0,72%,50%);background:none;border:1.5px solid hsl(0,72%,85%);padding:0.3rem 0.75rem;border-radius:0.5rem;cursor:pointer;font-size:0.78rem;font-weight:700;transition:all 0.15s" onmouseover="this.style.background='hsl(0,80%,96%)'" onmouseout="this.style.background='none'">Delete</button>
        </td>
      </tr>`;
    }).join("");
  } catch (err) {
    console.error('Error loading listings:', err);
  }
}

loadMyListings();


// ===============================
// DELETE LISTING
// ===============================

async function deleteListing(id) {
  if (!confirm("Delete this listing? This cannot be undone.")) return;

  const token = getAuthToken();
  try {
    const res = await fetch(`http://localhost:5000/api/listings/${id}`, {
      method: "DELETE",
      headers: { Authorization: "Bearer " + token }
    });

    if (res.ok) {
      if (typeof showToast === 'function') showToast('Deleted', 'Listing removed from marketplace');
      loadMyListings();
    } else {
      const d = await res.json();
      if (typeof showToast === 'function') showToast('Error', d.message || "Delete failed");
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Error', 'Could not delete listing');
  }
}
