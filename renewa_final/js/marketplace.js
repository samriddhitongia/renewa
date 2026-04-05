/* ============================================================
   RENEWA — Marketplace (FINAL FULL VERSION)
   ============================================================ */

const API = "http://localhost:5000/api/listings";

let DB = [];
let currentListing = null;
let buyQty = 100;
let cartCount = 0;


/* ============================================================
   TYPE ICONS
============================================================ */

const typeIcons = {
  Solar: "☀️",
  Wind: "💨",
  Biomass: "🌿"
};


/* ============================================================
   HELPER — AUTH TOKEN
============================================================ */

function getToken() {
  return localStorage.getItem("token") ||
    (() => { try { return JSON.parse(sessionStorage.getItem("renewa_user"))?.token; } catch { return null; } })();
}


/* ============================================================
   LOAD LISTINGS FROM BACKEND
============================================================ */

async function loadListings() {

  const grid = document.getElementById("lg");
  if (!grid) return;

  grid.innerHTML =
    `<p style="padding:2rem">Loading listings...</p>`;

  try {

    const res = await fetch(API);
    if (!res.ok) throw new Error("API error");

    DB = await res.json();

    const counter = document.getElementById("lc");
    if (counter) counter.textContent = DB.length;

    renderListings(DB);

  } catch (err) {
    console.error(err);
    grid.innerHTML =
      `<p style="padding:2rem;color:red">
        Failed to load listings
      </p>`;
  }
}


/* ============================================================
   RENDER LISTINGS
============================================================ */

function renderListings(list) {

  const grid = document.getElementById("lg");
  if (!grid) return;

  if (!list.length) {
    grid.innerHTML =
      `<div style="padding:3rem;text-align:center">
        No listings found
      </div>`;
    return;
  }

  grid.innerHTML = list.map(l => {

    return `
      <div class="lcard">

        ${l.image ? `
          <img src="http://localhost:5000/uploads/${l.image}"
          style="width:100%;height:160px;object-fit:cover">
        ` : ""}

        <div class="lbody">

          <h3>${typeIcons[l.type] || ""} ${l.type}</h3>

          <div class="sloc">📍 ${l.loc}</div>

          <p style="margin:8px 0">${l.desc || ""}</p>

          <div class="prow">
            <div class="pbig">₹${l.price}/kWh</div>
            <div class="kavail">
              ${l.kwh.toLocaleString()} kWh
            </div>
          </div>

          <button class="buybtn"
            onclick="openBuy('${l._id}')">
            Buy Energy
          </button>

        </div>
      </div>
    `;
  }).join("");
}


/* ============================================================
   SEARCH FILTER
============================================================ */

function filterListings() {

  const q =
    document.getElementById("sq")?.value
      .toLowerCase()
      .trim() || "";

  if (!q) return renderListings(DB);

  const filtered = DB.filter(l =>
    `${l.seller} ${l.type} ${l.loc}`
      .toLowerCase()
      .includes(q)
  );

  renderListings(filtered);
}


/* ============================================================
   OPEN BUY MODAL
============================================================ */

function openBuy(id) {

  const user = Session.get();

  if (!user) {
    showToast("Login Required","Please login first");
    setTimeout(() => location.href="auth.html",1200);
    return;
  }

  currentListing = DB.find(x => x._id === id);
  if (!currentListing) return;

  buyQty = Math.min(100, currentListing.kwh);

  document.getElementById("bTitle").textContent =
    `Purchase ${currentListing.type} Energy`;

  document.getElementById("bSeller").textContent =
    `From ${currentListing.seller}`;

  updateBuyModal();

  document.getElementById("buyMod")
    ?.classList.add("open");
}


function closeBuy() {
  currentListing = null;
  document.getElementById("buyMod")
    ?.classList.remove("open");
}


/* ============================================================
   BUY QUANTITY CONTROL
============================================================ */

function chQ(delta) {

  if (!currentListing) return;

  buyQty = Math.max(
    50,
    Math.min(currentListing.kwh, buyQty + delta)
  );

  updateBuyModal();
}


function updateBuyModal() {

  if (!currentListing) return;

  const total =
    (buyQty * currentListing.price).toFixed(2);

  document.getElementById("qv").textContent = buyQty;
  document.getElementById("bQl").textContent =
    `${buyQty} kWh`;

  document.getElementById("bPpk").textContent =
    `₹${currentListing.price}`;

  document.getElementById("bTot").textContent =
    `₹${total}`;
}


/* ============================================================
   CONFIRM PURCHASE — via Razorpay
============================================================ */

async function confirmBuy() {

  if (!currentListing) return;

  const user = Session.get();
  if (!user) {
    showToast('Login Required', 'Please login first');
    setTimeout(() => location.href = 'auth.html', 1200);
    return;
  }

  const totalAmount = +(buyQty * currentListing.price).toFixed(2);

  // Close the buy modal first, then open Razorpay
  closeBuy();

  await razorpayEnergyPurchase(
    currentListing._id,
    buyQty,
    totalAmount,
    (data) => {
      // Update cart badge
      cartCount++;
      const cartBadge = document.getElementById('cartN');
      if (cartBadge) cartBadge.textContent = cartCount;

      // Refresh listings
      loadListings();
    }
  );
}


/* ============================================================
   ADD LISTING (PRODUCER)
============================================================ */

async function submitL() {

  try {

    const token = getToken();

    const formData = new FormData();
    formData.append("type",  document.getElementById("nT").value);
    formData.append("kwh",   document.getElementById("nK").value);
    formData.append("price", document.getElementById("nP").value);
    formData.append("loc",   document.getElementById("nL").value);
    formData.append("avail", document.getElementById("nAv")?.value || "Available Now");
    formData.append("cert",  document.getElementById("nC")?.value  || "REC Certified");
    formData.append("desc",  document.getElementById("nD")?.value  || "");

    const imgEl = document.getElementById("nImg");
    if (imgEl && imgEl.files && imgEl.files[0]) {
      formData.append("image", imgEl.files[0]);
    }

    const res = await fetch(API, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + token
        // DO NOT set Content-Type; browser sets it with boundary for FormData
      },
      body: formData
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.message);

    document.getElementById("addMod")
      ?.classList.remove("open");

    showToast("Listing Created 🎉",
      "Your energy is now live!");

    loadListings();

  } catch (err) {
    alert(err.message || "Failed to create listing");
  }
}


/* ============================================================
   INITIALIZE PAGE
============================================================ */

document.addEventListener("DOMContentLoaded", () => {

  injectNavbar("marketplace");

  // show producer CTA automatically
  const user = Session.get();
  if (user?.role === "producer") {
    const cta = document.getElementById("pCta");
    if (cta) cta.style.display = "flex";
  }

  const search = document.getElementById("sq");
  if (search)
    search.addEventListener("input", filterListings);

  loadListings();
});