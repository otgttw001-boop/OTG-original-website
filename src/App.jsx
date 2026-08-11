import React, { useState, useEffect, useRef } from "react";

// ── CONFIG ────────────────────────────────────────────────────────────────────
const CONFIG = {
  PAYSTACK_KEY: "pk_live_c419a18c89062faca4fb926a2f5eac74598fe1da",
  SUPABASE_URL: "https://mhfxqfmdfgdztoijkiev.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1oZnhxZm1kZmdkenRvaWpraWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMyNjMwMTYsImV4cCI6MjA4ODgzOTAxNn0.Mrmtx2QrY0WvKTaB8smAeqWAe9AzvVmJ8B5Ld7KqqME",
  SHEET_URL: "https://script.google.com/macros/s/AKfycby0znXUwCPww9Mxje4whT1BvTT-RcEFIkA57f-7RXKnxa_j9q-qMEvDRvxdFhvlebWSaA/exec",
  EMAILJS_SERVICE: "service_3v7xlb2",
  EMAILJS_TEMPLATE: "template_omjmm57",
  EMAILJS_KEY: "BimCOxBdVetnTSGUl",
  CREATORS_PASSWORD: "OTG2025",
};

const IMG = "https://f76d931c-ab95-49f5-94bf-257350810ce.vercel.app/images/uploads";
const fmt = (n) => `₦${Number(n).toLocaleString()}`;

// ── BACKEND HELPERS ───────────────────────────────────────────────────────────
async function saveToSupabase(order) {
  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`, "Prefer": "return=minimal" },
      body: JSON.stringify(order),
    });
    return res.ok;
  } catch(e) { return false; }
}

async function saveToSheet(order) {
  try {
    await fetch(CONFIG.SHEET_URL, {
      method: "POST", headers: { "Content-Type": "text/plain" },
      body: JSON.stringify({ name: order.customer_name, email: order.customer_email, phone: order.customer_phone, address: order.customer_address, items: order.items_text, total: `₦${order.total.toLocaleString()}`, ref: order.payment_ref }),
    });
    return true;
  } catch(e) { return false; }
}

async function sendEmail(order) {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: CONFIG.EMAILJS_SERVICE, template_id: CONFIG.EMAILJS_TEMPLATE, user_id: CONFIG.EMAILJS_KEY, template_params: { customer_name: order.customer_name, customer_email: order.customer_email, customer_phone: order.customer_phone, customer_address: order.customer_address, items: order.items_text, total: `₦${order.total.toLocaleString()}`, order_ref: order.payment_ref } }),
    });
    return res.ok;
  } catch(e) { return false; }
}

async function sendBuyerEmail(order) {
  try {
    const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ service_id: CONFIG.EMAILJS_SERVICE, template_id: CONFIG.EMAILJS_TEMPLATE, user_id: CONFIG.EMAILJS_KEY, template_params: { customer_name: order.customer_name, customer_email: order.customer_email, customer_phone: order.customer_phone, customer_address: order.customer_address, items: order.items_text, total: `₦${order.total.toLocaleString()}`, order_ref: order.payment_ref, to_email: order.customer_email } }),
    });
    return res.ok;
  } catch(e) { return false; }
}

async function processOrder(orderData) {
  await Promise.allSettled([saveToSupabase(orderData), saveToSheet(orderData), sendEmail(orderData), sendBuyerEmail(orderData)]);
  return true;
}

async function validateReferralCode(code) {
  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/referral_codes?code=eq.${code.toUpperCase()}&select=*`, { headers: { "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}` } });
    const data = await res.json();
    return data.length > 0 ? data[0] : null;
  } catch(e) { return null; }
}

async function applyReferralReward(code, orderTotal, buyerEmail, orderRef) {
  try {
    const referrerCredit = Math.round(orderTotal * 0.07);
    const buyerDiscount = Math.round(orderTotal * 0.05);
    await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/referral_uses`, {
      method: "POST", headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`, "Prefer": "return=minimal" },
      body: JSON.stringify({ code: code.toUpperCase(), buyer_email: buyerEmail, order_ref: orderRef, order_total: orderTotal, buyer_discount: buyerDiscount, referrer_credit: referrerCredit }),
    });
    const codeData = await validateReferralCode(code);
    if (!codeData) return;
    const existing = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/referral_credits?owner_email=eq.${encodeURIComponent(codeData.owner_email)}&select=*`, { headers: { "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}` } });
    const existingData = await existing.json();
    if (existingData.length > 0) {
      await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/referral_credits?owner_email=eq.${encodeURIComponent(codeData.owner_email)}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`, "Prefer": "return=minimal" },
        body: JSON.stringify({ credit: existingData[0].credit + referrerCredit, total_earned: existingData[0].total_earned + referrerCredit, updated_at: new Date().toISOString() }),
      });
    } else {
      await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/referral_credits`, {
        method: "POST", headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`, "Prefer": "return=minimal" },
        body: JSON.stringify({ owner_email: codeData.owner_email, credit: referrerCredit, total_earned: referrerCredit }),
      });
    }
  } catch(e) { console.error("Referral reward error:", e); }
}

async function fetchStock(productId) {
  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/inventory?product_id=eq.${productId}&select=size,stock`, { headers: { "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}` } });
    if (!res.ok) throw new Error("fetch failed");
    const rows = await res.json();
    if (!rows.length) return null;
    const stock = {};
    rows.forEach(r => { stock[r.size] = r.stock; });
    return stock;
  } catch(e) { return null; }
}

async function decrementStock(cartItems) {
  try {
    for (const item of cartItems) {
      const current = await fetchStock(item.id) || {};
      const newQty = Math.max(0, (current[item.size] || 10) - item.qty);
      await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/inventory`, {
        method: "POST", headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`, "Prefer": "resolution=merge-duplicates" },
        body: JSON.stringify({ product_id: item.id, size: item.size, stock: newQty }),
      });
    }
  } catch(e) { console.error("Stock error:", e); }
}

async function fetchInfluencerData(code) {
  try {
    const [codeRes, creditRes] = await Promise.all([
      fetch(`${CONFIG.SUPABASE_URL}/rest/v1/referral_codes?code=eq.${code.toUpperCase()}&select=*`, { headers: { "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}` } }),
      fetch(`${CONFIG.SUPABASE_URL}/rest/v1/referral_credits?select=*`, { headers: { "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}` } }),
    ]);
    const codeData = await codeRes.json();
    const creditData = await creditRes.json();
    if (!codeData.length) return null;
    const profile = codeData[0];
    const credit = creditData.find(c => c.owner_email === profile.owner_email) || null;
    const usesRes = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/referral_uses?code=eq.${code.toUpperCase()}&select=*&order=used_at.desc&limit=10`, { headers: { "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}` } });
    const uses = await usesRes.json();
    return { profile, credit, uses };
  } catch(e) { return null; }
}

async function submitWithdrawalRequest(email, code, amount, method, details) {
  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/withdrawal_requests`, {
      method: "POST", headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`, "Prefer": "return=minimal" },
      body: JSON.stringify({ owner_email: email, code: code.toUpperCase(), amount, method, payment_details: details, status: "pending", created_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch(e) { return false; }
}

async function submitRedemptionRequest(email, code, amount, productNote) {
  try {
    const res = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/withdrawal_requests`, {
      method: "POST", headers: { "Content-Type": "application/json", "apikey": CONFIG.SUPABASE_KEY, "Authorization": `Bearer ${CONFIG.SUPABASE_KEY}`, "Prefer": "return=minimal" },
      body: JSON.stringify({ owner_email: email, code: code.toUpperCase(), amount, method: "product_redemption", payment_details: productNote, status: "pending", created_at: new Date().toISOString() }),
    });
    return res.ok;
  } catch(e) { return false; }
}

// ── PRODUCTS ──────────────────────────────────────────────────────────────────
const PRODUCTS = [
  { id: "heart-tee", name: "Heart Tee", price: 27000, category: "vibrant", tag: null, image: `${IMG}/c7ee40f6-3921-4ac8-b7b7-3be3735b5c6b.jpg`, images: [`${IMG}/c7ee40f6-3921-4ac8-b7b7-3be3735b5c6b.jpg`, `${IMG}/72fc88a0-09c5-4561-b2e2-dfe29a4dcdb8.jpg`], description: "Bold graphic tee with heart motif. Premium cotton, oversized fit.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","White","Navy"] },
  { id: "faceless-tee", name: "Faceless Tee", price: 27000, category: "vibrant", tag: null, image: `${IMG}/a293a5c3-a6b1-478a-86a5-7d8a98f58fc9.jpg`, images: [`${IMG}/a293a5c3-a6b1-478a-86a5-7d8a98f58fc9.jpg`, `${IMG}/02355bed-ba48-4fd3-aa3c-7502e472f956.jpg`], description: "Mind over matter. Faceless graphic on premium cotton. Oversized fit.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","White"] },
  { id: "otg-armless", name: "OTG Armless", price: 25000, category: "vibrant", tag: null, image: `${IMG}/8e62108e-4397-4fe7-953e-bef5b2945584.jpg`, images: [`${IMG}/8e62108e-4397-4fe7-953e-bef5b2945584.jpg`, `${IMG}/e004c194-9f65-4a25-a1d5-34d7c91f6230.jpg`], description: "Athletic armless cut with OTG branding. Lightweight performance fabric.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","White"] },
  { id: "polo-black", name: "Paint Our Culture Polo", price: 35000, category: "vibrant", tag: "NEW", image: `${IMG}/450acb2b-37fa-4eb5-b57a-892c7ddd4833.jpg`, images: [`${IMG}/450acb2b-37fa-4eb5-b57a-892c7ddd4833.jpg`, `${IMG}/f0545388-79fc-4873-9596-2543e42af02a.jpg`, `${IMG}/2407ccae-c741-488e-8f9c-be906b542b6b.jpg`, `${IMG}/0f518772-ba8f-449d-bd31-ff226916917b.jpg`], description: "Premium polo with heraldic crest, eagle emblem, and EST.MMXXV branding.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","Navy","Burgundy","Royal Blue"] },
  // Coming soon vibrant
  { id: "fly-again-tee", name: "OTG Fly Again Tee", price: 0, category: "vibrant", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "Fly Again. Premium drop coming soon.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","White"] },
  { id: "heaven-tee", name: "Heaven Tee", price: 0, category: "vibrant", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "Heaven collection tee. Coming soon.", sizes: ["S","M","L","XL","XXL"], colors: ["White","Black"] },
  { id: "hustle-longsleeve", name: "Hustle Long Sleeve", price: 0, category: "vibrant", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "Long sleeve hustle edition. Coming soon.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","Grey"] },
  { id: "naija-polo", name: "Naija Polo", price: 0, category: "vibrant", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "Naija polo. Premium drop coming soon.", sizes: ["S","M","L","XL","XXL"], colors: ["Green","White","Black"] },
  { id: "n2f2p-polo", name: "N2F2P Polo", price: 0, category: "vibrant", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "N2F2P polo. Coming soon.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","White"] },
  { id: "demon-slayer-jersey", name: "Demon Slayer Jersey", price: 0, category: "vibrant", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "OTG x Demon Slayer inspired jersey. Coming soon.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","Red"] },
  { id: "otg-retro-jersey", name: "OTG Retro Jersey", price: 0, category: "vibrant", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "Retro style OTG jersey. Coming soon.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","White","Green"] },
  { id: "poc-polo-v2", name: "Paint Our Culture Polo v2", price: 0, category: "vibrant", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "Second colourway of the OTG x POC polo. Coming soon.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","White","Royal Blue","Forest"] },
  // Girls
  { id: "lips-tee", name: "Lips Graphic Tee", price: 20000, category: "girls", tag: null, image: `${IMG}/c4f46a03-ed2f-454e-9443-73f57f7306e3.jpg`, images: [`${IMG}/c4f46a03-ed2f-454e-9443-73f57f7306e3.jpg`, `${IMG}/c5c6d433-b535-4873-bdfa-ee369fa8989c.jpg`, `${IMG}/9e2a023d-63eb-4382-9a0c-3a0e70d1969f.jpg`], description: "Artistic tee featuring bold lip graphic. Feminine cut, premium fabric.", sizes: ["XS","S","M","L","XL"], colors: ["White","Pink","Black"] },
  { id: "feminist-two-piece", name: "Feminist Two Piece", price: 0, category: "girls", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "OTG feminist two-piece set. Coming soon.", sizes: ["XS","S","M","L","XL"], colors: ["Black","White"] },
  { id: "otg-crop-top", name: "OTG Crop Top", price: 0, category: "girls", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "OTG branded crop top. Coming soon.", sizes: ["XS","S","M","L","XL"], colors: ["Black","White","Green"] },
  { id: "otg-royal-top", name: "OTG Royal Top", price: 0, category: "girls", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "OTG Royal top for the girls. Coming soon.", sizes: ["XS","S","M","L","XL"], colors: ["Black","Royal Blue"] },
  // Bottoms
  { id: "otg-sweatpants", name: "OTG Sweat Pants", price: 30000, category: "bottoms", tag: null, image: `${IMG}/6ee3d55c-af5e-44e7-9c1e-e54f0e81e672.jpg`, images: [`${IMG}/6ee3d55c-af5e-44e7-9c1e-e54f0e81e672.jpg`], description: "Premium heavyweight fleece sweatpants with OTG embroidery.", sizes: ["S","M","L","XL","XXL"], colors: ["Black","Grey","Navy"] },
  // Accessories
  { id: "otg-beanie-black", name: "OTG Beanie — Black", price: 8000, category: "accessories", tag: null, image: `${IMG}/placeholder.jpg`, images: [], description: "Classic OTG ribbed beanie in all black.", sizes: ["One Size"], colors: ["Black"] },
  { id: "otg-beanie-camo", name: "OTG Beanie — Camo", price: 8000, category: "accessories", tag: null, image: `${IMG}/placeholder.jpg`, images: [], description: "OTG ribbed beanie in camo colourway.", sizes: ["One Size"], colors: ["Camo"] },
  { id: "otg-cap", name: "OTG Cap", price: 9000, category: "accessories", tag: null, image: `${IMG}/placeholder.jpg`, images: [], description: "OTG embroidered 6-panel cap.", sizes: ["One Size"], colors: ["Black","White"] },
  { id: "otg-belt", name: "OTG Belt", price: 7500, category: "accessories", tag: null, image: `${IMG}/placeholder.jpg`, images: [], description: "OTG branded canvas belt.", sizes: ["One Size"], colors: ["Black"] },
  { id: "otg-socks", name: "OTG Socks", price: 3500, category: "accessories", tag: null, image: `${IMG}/placeholder.jpg`, images: [], description: "OTG branded crew socks.", sizes: ["One Size"], colors: ["Black","White"] },
  { id: "otg-cap-new", name: "OTG Cap (New Drop)", price: 0, category: "accessories", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "New OTG cap drop. Coming soon.", sizes: ["One Size"], colors: ["Black","Green","White"] },
  { id: "otg-combat-belt", name: "OTG Combat Belt", price: 0, category: "accessories", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "OTG combat utility belt. Coming soon.", sizes: ["One Size"], colors: ["Black","Olive"] },
  { id: "otg-socks-new", name: "OTG Socks (New)", price: 0, category: "accessories", tag: "COMING SOON", image: `${IMG}/placeholder.jpg`, images: [], description: "New colourway OTG socks. Coming soon.", sizes: ["One Size"], colors: ["Black","Green","White"] },
];

const DEFAULT_STOCK = {};
PRODUCTS.forEach(p => { DEFAULT_STOCK[p.id] = {}; (p.sizes || ["S","M","L","XL","XXL"]).forEach(s => { DEFAULT_STOCK[p.id][s] = 10; }); });

// ── DELIVERY ZONES ────────────────────────────────────────────────────────────
const DELIVERY_ZONES = [
  { label: "Select your LGA...", price: 0 },
  { label: "Surulere", price: 1500 },
  { label: "Lagos Mainland (Yaba / Ebute-Metta)", price: 2000 },
  { label: "Mushin", price: 2000 },
  { label: "Shomolu (Bariga / Gbagada)", price: 2500 },
  { label: "Kosofe (Ketu / Ojota / Alapere)", price: 3000 },
  { label: "Oshodi-Isolo (Oshodi / Isolo / Ejigbo)", price: 2500 },
  { label: "Ajeromi-Ifelodun (Ajegunle / Olodi)", price: 3000 },
  { label: "Apapa", price: 3500 },
  { label: "Ikeja (Allen / Maryland / GRA)", price: 3500 },
  { label: "Agege (Dopemu / Orile Agege)", price: 3500 },
  { label: "Ifako-Ijaye (Ifako / Ogba / Abule-Egba)", price: 4000 },
  { label: "Amuwo-Odofin (Festac / Satellite Town)", price: 3500 },
  { label: "Alimosho (Ikotun / Iyana-Ipaja / Egbeda)", price: 5000 },
  { label: "Ojo (Ojo / Okokomaiko / Iba)", price: 5500 },
  { label: "Lagos Island (CMS / Broad Street / Balogun)", price: 4000 },
  { label: "Eti-Osa (Victoria Island / Ikoyi / Lekki Ph1)", price: 5000 },
  { label: "Ibeju-Lekki (Ajah / Sangotedo / Abraham Adesanya)", price: 7000 },
  { label: "Ikorodu", price: 7500 },
  { label: "Badagry", price: 8500 },
  { label: "Epe", price: 9000 },
  { label: "Outside Lagos (nationwide)", price: 10000 },
];

// ── GLOBAL CSS ────────────────────────────────────────────────────────────────
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Boogaloo&family=Nunito:wght@400;600;700;900&family=Space+Mono:wght@400;700&display=swap');
  @import url('https://fonts.googleapis.com/css2?family=Titan+One&family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --black: #0a0a0a;
    --green: #1a6b3a;
    --green-bright: #25a25a;
    --green-dim: #0e3d20;
    --white: #f5f5f5;
    --grey: #141414;
    --grey2: #1e1e1e;
    --grey3: #2a2a2a;
    --gold: #c8a84b;
    --text-muted: #888;
  }

  html { scroll-behavior: smooth; }
  body { background: var(--black); color: var(--white); font-family: 'Nunito', sans-serif; overflow-x: hidden; }

  /* ── NAV ── */
  .nav {
    position: fixed; top: 0; left: 0; right: 0; z-index: 1000;
    display: flex; align-items: center; justify-content: space-between;
    padding: 0 2rem; height: 64px;
    background: rgba(10,10,10,0.85); backdrop-filter: blur(12px);
    border-bottom: 1px solid rgba(26,107,58,0.2);
    transition: background 0.3s;
  }
  .nav-links { display: flex; gap: 2rem; align-items: center; }
  .nav-link {
    font-family: 'Space Mono', monospace; font-size: 0.62rem; letter-spacing: 0.18em;
    text-transform: uppercase; color: var(--text-muted); cursor: pointer;
    transition: color 0.2s; background: none; border: none; padding: 0;
  }
  .nav-link:hover, .nav-link.active { color: var(--white); }
  .nav-logo {
    font-family: 'Boogaloo', cursive; font-size: 1.8rem; letter-spacing: 0.06em;
    color: var(--white); cursor: pointer; position: absolute; left: 50%; transform: translateX(-50%);
  }
  .nav-logo span { color: var(--green-bright); }
  .nav-right { display: flex; align-items: center; gap: 1.2rem; }
  .cart-btn {
    font-family: 'Space Mono', monospace; font-size: 0.62rem; letter-spacing: 0.18em;
    background: none; border: 1px solid var(--green); color: var(--green-bright);
    padding: 0.45rem 1.1rem; cursor: pointer; transition: all 0.2s; text-transform: uppercase;
  }
  .cart-btn:hover { background: var(--green); color: var(--white); }
  .hamburger { display: none; flex-direction: column; gap: 5px; cursor: pointer; background: none; border: none; padding: 0.3rem; }
  .hamburger span { display: block; width: 22px; height: 2px; background: var(--white); transition: all 0.3s; }

  /* ── HERO ── */
  .hero {
    position: relative; height: 100vh; display: flex; align-items: center; justify-content: center;
    overflow: hidden; text-align: center;
  }
  .hero-video {
    position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; z-index: 0;
  }
  .hero-overlay {
    position: absolute; inset: 0; background: linear-gradient(135deg, rgba(10,10,10,0.82) 0%, rgba(10,50,25,0.65) 50%, rgba(10,10,10,0.85) 100%); z-index: 1;
  }
  .hero-content { position: relative; z-index: 2; padding: 1rem; }
  .hero-eyebrow {
    font-family: 'Space Mono', monospace; font-size: 0.6rem; letter-spacing: 0.5em;
    color: var(--green-bright); text-transform: uppercase; margin-bottom: 1.2rem;
    display: flex; align-items: center; justify-content: center; gap: 1rem;
  }
  .hero-eyebrow::before, .hero-eyebrow::after { content: ''; display: block; width: 40px; height: 1px; background: var(--green-bright); opacity: 0.5; }
  .hero-title {
    font-family: 'Boogaloo', cursive; font-size: clamp(4rem, 14vw, 10rem);
    line-height: 0.9; letter-spacing: 0.02em; margin-bottom: 1.5rem;
    text-shadow: 0 4px 40px rgba(0,0,0,0.6);
  }
  .hero-title .green { color: var(--green-bright); }
  .hero-sub {
    font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: clamp(1rem, 2.5vw, 1.4rem);
    color: rgba(245,245,245,0.75); margin-bottom: 2.5rem; letter-spacing: 0.04em;
  }
  .hero-btns { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; }

  /* ── BUTTONS ── */
  .btn {
    font-family: 'Space Mono', monospace; font-size: 0.62rem; letter-spacing: 0.2em;
    text-transform: uppercase; padding: 0.9rem 2rem; cursor: pointer; border: none;
    transition: all 0.25s; display: inline-flex; align-items: center; gap: 0.5rem;
  }
  .btn-green { background: var(--green); color: var(--white); }
  .btn-green:hover { background: var(--green-bright); }
  .btn-outline { background: transparent; color: var(--white); border: 1px solid rgba(255,255,255,0.4); }
  .btn-outline:hover { border-color: var(--white); background: rgba(255,255,255,0.05); }
  .btn-gold { background: var(--gold); color: var(--black); }
  .btn-gold:hover { background: #e0bc6a; }

  /* ── SECTIONS ── */
  .section { padding: 5rem 2rem; max-width: 1400px; margin: 0 auto; }
  .section-eyebrow {
    font-family: 'Space Mono', monospace; font-size: 0.58rem; letter-spacing: 0.4em;
    color: var(--green-bright); text-transform: uppercase; margin-bottom: 0.8rem;
  }
  .section-title {
    font-family: 'Boogaloo', cursive; font-size: clamp(2.5rem, 6vw, 4.5rem);
    line-height: 1; letter-spacing: 0.02em; margin-bottom: 1rem;
  }
  .section-divider { width: 60px; height: 3px; background: var(--green); margin-bottom: 2.5rem; }

  /* ── COLLECTIONS ROW (homepage) ── */
  .collections-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; background: var(--grey3); }
  .collection-card {
    position: relative; aspect-ratio: 3/4; overflow: hidden; cursor: pointer; background: var(--grey);
  }
  .collection-card img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.5s ease; }
  .collection-card:hover img { transform: scale(1.06); }
  .collection-card-overlay {
    position: absolute; inset: 0; background: linear-gradient(to top, rgba(10,10,10,0.9) 0%, transparent 50%);
    display: flex; flex-direction: column; justify-content: flex-end; padding: 1.5rem;
  }
  .collection-card-name {
    font-family: 'Boogaloo', cursive; font-size: 1.6rem; letter-spacing: 0.04em; margin-bottom: 0.3rem;
  }
  .collection-card-count { font-family: 'Space Mono', monospace; font-size: 0.55rem; color: var(--green-bright); letter-spacing: 0.2em; }

  /* ── SHOP LAYOUT ── */
  .shop-layout { display: grid; grid-template-columns: 240px 1fr; gap: 2rem; align-items: start; }
  .shop-sidebar {
    position: sticky; top: 80px; background: var(--grey); border: 1px solid var(--grey3); padding: 1.5rem;
  }
  .sidebar-heading {
    font-family: 'Space Mono', monospace; font-size: 0.58rem; letter-spacing: 0.3em;
    color: var(--green-bright); text-transform: uppercase; margin-bottom: 1.2rem; padding-bottom: 0.8rem;
    border-bottom: 1px solid var(--grey3);
  }
  .sidebar-filter {
    display: block; width: 100%; text-align: left; background: none; border: none;
    font-family: 'Nunito', sans-serif; font-size: 0.9rem; font-weight: 600;
    color: var(--text-muted); padding: 0.6rem 0.8rem; cursor: pointer; transition: all 0.2s;
    border-left: 2px solid transparent;
  }
  .sidebar-filter:hover { color: var(--white); }
  .sidebar-filter.active { color: var(--green-bright); border-left-color: var(--green-bright); background: rgba(26,107,58,0.08); }
  .search-input {
    width: 100%; background: var(--grey2); border: 1px solid var(--grey3); border-bottom: 2px solid var(--green);
    color: var(--white); padding: 0.7rem 1rem; font-family: 'Nunito', sans-serif; font-size: 0.9rem;
    outline: none; margin-bottom: 1.5rem;
  }
  .search-input::placeholder { color: var(--text-muted); }

  /* ── PRODUCT GRID ── */
  .product-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem; }
  .product-card { background: var(--grey); border: 1px solid var(--grey3); overflow: hidden; transition: border-color 0.2s; }
  .product-card:hover { border-color: var(--green); }
  .product-img-wrap { position: relative; aspect-ratio: 3/4; overflow: hidden; background: var(--grey2); }
  .product-img-wrap img { width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease; }
  .product-card:hover .product-img-wrap img { transform: scale(1.04); }
  .product-overlay {
    position: absolute; inset: 0; background: rgba(10,10,10,0.5); display: flex;
    align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;
  }
  .product-card:hover .product-overlay { opacity: 1; }
  .product-tag {
    position: absolute; top: 0.8rem; left: 0.8rem; background: var(--green);
    color: var(--white); font-family: 'Space Mono', monospace; font-size: 0.5rem;
    letter-spacing: 0.2em; padding: 0.25rem 0.6rem; text-transform: uppercase;
  }
  .product-tag.gold { background: var(--gold); color: var(--black); }
  .product-info { padding: 1rem; }
  .product-name { font-family: 'Nunito', sans-serif; font-weight: 700; font-size: 0.95rem; margin-bottom: 0.3rem; }
  .product-price { font-family: 'Space Mono', monospace; font-size: 0.75rem; color: var(--green-bright); }

  /* ── PRODUCT PAGE ── */
  .product-page { display: grid; grid-template-columns: 1fr 1fr; gap: 3rem; padding-top: 5rem; }
  .product-images { position: sticky; top: 80px; }
  .product-main-img { width: 100%; aspect-ratio: 3/4; object-fit: cover; background: var(--grey); margin-bottom: 0.8rem; }
  .product-thumbs { display: flex; gap: 0.6rem; }
  .product-thumb { width: 70px; height: 90px; object-fit: cover; cursor: pointer; border: 2px solid transparent; transition: border-color 0.2s; opacity: 0.7; }
  .product-thumb.active, .product-thumb:hover { border-color: var(--green-bright); opacity: 1; }
  .product-detail-name { font-family: 'Boogaloo', cursive; font-size: 2.5rem; line-height: 1.1; margin-bottom: 0.5rem; }
  .product-detail-price { font-family: 'Space Mono', monospace; font-size: 1.1rem; color: var(--green-bright); margin-bottom: 1.5rem; }
  .size-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 0.5rem; margin-bottom: 1.5rem; }
  .size-btn {
    padding: 0.6rem; text-align: center; border: 1px solid var(--grey3); background: var(--grey);
    color: var(--text-muted); font-family: 'Space Mono', monospace; font-size: 0.65rem;
    cursor: pointer; transition: all 0.2s; letter-spacing: 0.1em;
  }
  .size-btn:hover { border-color: var(--green-bright); color: var(--white); }
  .size-btn.selected { background: var(--green); border-color: var(--green); color: var(--white); }
  .size-btn.disabled { opacity: 0.3; cursor: not-allowed; }
  .qty-control { display: flex; align-items: center; gap: 1rem; margin-bottom: 1.5rem; }
  .qty-btn { width: 36px; height: 36px; background: var(--grey2); border: 1px solid var(--grey3); color: var(--white); font-size: 1.1rem; cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.2s; }
  .qty-btn:hover { border-color: var(--green); }
  .qty-num { font-family: 'Space Mono', monospace; font-size: 1rem; min-width: 2rem; text-align: center; }

  /* ── CART DRAWER ── */
  .cart-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.7); z-index: 1500; }
  .cart-drawer {
    position: fixed; top: 0; right: 0; bottom: 0; width: 420px; max-width: 100vw;
    background: var(--grey); z-index: 1600; display: flex; flex-direction: column;
    transform: translateX(100%); transition: transform 0.35s cubic-bezier(0.4,0,0.2,1);
    border-left: 1px solid var(--grey3);
  }
  .cart-drawer.open { transform: translateX(0); }
  .cart-drawer-header {
    display: flex; justify-content: space-between; align-items: center;
    padding: 1.5rem; border-bottom: 1px solid var(--grey3);
  }
  .cart-drawer-title { font-family: 'Boogaloo', cursive; font-size: 1.5rem; letter-spacing: 0.04em; }
  .cart-close { background: none; border: none; color: var(--white); font-size: 1.3rem; cursor: pointer; }
  .cart-items { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
  .cart-item { display: grid; grid-template-columns: 70px 1fr auto; gap: 0.8rem; padding: 0.8rem; background: var(--grey2); border: 1px solid var(--grey3); }
  .cart-item img { width: 70px; height: 90px; object-fit: cover; }
  .cart-item-name { font-weight: 700; font-size: 0.9rem; margin-bottom: 0.2rem; }
  .cart-item-meta { font-family: 'Space Mono', monospace; font-size: 0.6rem; color: var(--text-muted); }
  .cart-item-price { font-family: 'Space Mono', monospace; font-size: 0.8rem; color: var(--green-bright); align-self: center; }
  .cart-remove { background: none; border: none; color: var(--text-muted); cursor: pointer; font-size: 1rem; transition: color 0.2s; }
  .cart-remove:hover { color: #e55; }
  .cart-footer { padding: 1.5rem; border-top: 1px solid var(--grey3); }
  .cart-total-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.2rem; }
  .cart-total-label { font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 0.15em; color: var(--text-muted); }
  .cart-total-value { font-family: 'Space Mono', monospace; font-size: 1rem; color: var(--green-bright); }

  /* ── CHECKOUT ── */
  .checkout-page { padding: 6rem 2rem 3rem; max-width: 1100px; margin: 0 auto; }
  .checkout-grid { display: grid; grid-template-columns: 1fr 380px; gap: 2.5rem; }
  .checkout-card { background: var(--grey); border: 1px solid var(--grey3); padding: 1.8rem; margin-bottom: 1.5rem; }
  .checkout-card-title { font-family: 'Boogaloo', cursive; font-size: 1.3rem; letter-spacing: 0.04em; margin-bottom: 1.5rem; padding-bottom: 0.8rem; border-bottom: 1px solid var(--grey3); }
  .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .form-group { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1rem; }
  .form-label { font-family: 'Space Mono', monospace; font-size: 0.58rem; letter-spacing: 0.2em; color: var(--text-muted); text-transform: uppercase; }
  .form-input {
    background: var(--grey2); border: 1px solid var(--grey3); border-bottom: 2px solid var(--green);
    color: var(--white); padding: 0.75rem 1rem; font-family: 'Nunito', sans-serif; font-size: 0.95rem;
    outline: none; transition: border-color 0.2s; width: 100%;
  }
  .form-input:focus { border-bottom-color: var(--green-bright); }
  .form-select { background: var(--grey2); border: 1px solid var(--grey3); border-bottom: 2px solid var(--green); color: var(--white); padding: 0.75rem 1rem; font-family: 'Nunito', sans-serif; font-size: 0.95rem; outline: none; width: 100%; cursor: pointer; }
  .pay-option { display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid var(--grey3); cursor: pointer; transition: border-color 0.2s; margin-bottom: 0.8rem; }
  .pay-option.selected { border-color: var(--green-bright); background: rgba(26,107,58,0.08); }
  .pay-option-radio { width: 18px; height: 18px; border-radius: 50%; border: 2px solid var(--grey3); flex-shrink: 0; transition: all 0.2s; }
  .pay-option.selected .pay-option-radio { border-color: var(--green-bright); background: var(--green-bright); }
  .order-summary-item { display: flex; justify-content: space-between; padding: 0.7rem 0; border-bottom: 1px solid var(--grey3); font-size: 0.9rem; }
  .order-summary-total { display: flex; justify-content: space-between; padding: 1rem 0 0; font-weight: 700; font-family: 'Space Mono', monospace; }
  .stepper { display: flex; gap: 0; margin-bottom: 2.5rem; }
  .step { flex: 1; text-align: center; padding: 0.8rem; font-family: 'Space Mono', monospace; font-size: 0.6rem; letter-spacing: 0.15em; text-transform: uppercase; border-bottom: 2px solid var(--grey3); color: var(--text-muted); }
  .step.active { border-bottom-color: var(--green-bright); color: var(--green-bright); }
  .step.done { border-bottom-color: var(--green); color: var(--green-bright); }
  .referral-input-row { display: flex; gap: 0.5rem; }
  .referral-status { font-family: 'Space Mono', monospace; font-size: 0.6rem; margin-top: 0.5rem; }

  /* ── CREATORS PAGE ── */
  .creators-page { min-height: 100vh; background: var(--black); padding-top: 5rem; }
  .creators-login { max-width: 460px; margin: 0 auto; padding: 4rem 2rem; }
  .creators-dashboard { padding: 2rem; max-width: 900px; margin: 0 auto; }
  .stat-card { background: var(--grey); border: 1px solid var(--grey3); border-top: 3px solid var(--green); padding: 1.5rem; text-align: center; }
  .stat-value { font-family: 'Boogaloo', cursive; font-size: 2.2rem; color: var(--green-bright); }
  .stat-label { font-family: 'Space Mono', monospace; font-size: 0.58rem; letter-spacing: 0.2em; color: var(--text-muted); margin-top: 0.3rem; }

  /* ── TOAST ── */
  .toast {
    position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%) translateY(100px);
    background: var(--green); color: var(--white); padding: 0.8rem 1.8rem;
    font-family: 'Space Mono', monospace; font-size: 0.65rem; letter-spacing: 0.15em;
    z-index: 9999; transition: transform 0.3s; white-space: nowrap;
  }
  .toast.show { transform: translateX(-50%) translateY(0); }

  /* ── FOOTER ── */
  .footer { background: var(--grey); border-top: 1px solid var(--grey3); padding: 4rem 2rem 2rem; }
  .footer-grid { display: grid; grid-template-columns: 2fr 1fr 1fr 1fr; gap: 3rem; max-width: 1400px; margin: 0 auto 3rem; }
  .footer-brand { font-family: 'Boogaloo', cursive; font-size: 2.5rem; color: var(--white); margin-bottom: 0.8rem; }
  .footer-brand span { color: var(--green-bright); }
  .footer-tagline { font-family: 'Cormorant Garamond', serif; font-style: italic; color: var(--text-muted); font-size: 0.95rem; }
  .footer-col-title { font-family: 'Space Mono', monospace; font-size: 0.58rem; letter-spacing: 0.3em; color: var(--green-bright); text-transform: uppercase; margin-bottom: 1.2rem; }
  .footer-link { display: block; color: var(--text-muted); font-size: 0.88rem; margin-bottom: 0.7rem; cursor: pointer; transition: color 0.2s; text-decoration: none; }
  .footer-link:hover { color: var(--white); }
  .footer-bottom { display: flex; justify-content: space-between; align-items: center; max-width: 1400px; margin: 0 auto; padding-top: 2rem; border-top: 1px solid var(--grey3); font-family: 'Space Mono', monospace; font-size: 0.55rem; color: var(--text-muted); }

  /* ── EMPTY STATE ── */
  .empty-state { text-align: center; padding: 5rem 2rem; color: var(--text-muted); }
  .empty-state-icon { font-size: 3rem; margin-bottom: 1rem; }
  .empty-state-text { font-family: 'Cormorant Garamond', serif; font-style: italic; font-size: 1.2rem; }

  /* ── MODAL ── */
  .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.88); z-index: 3000; display: flex; align-items: center; justify-content: center; padding: 1rem; }
  .modal-box { background: var(--grey); border: 1px solid var(--grey3); width: 100%; max-width: 460px; padding: 2rem; }
  .modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; }
  .modal-title { font-family: 'Boogaloo', cursive; font-size: 1.5rem; color: var(--green-bright); }
  .modal-close { background: none; border: none; color: var(--white); font-size: 1.3rem; cursor: pointer; }

  /* ── MOBILE ── */
  .mobile-menu {
    position: fixed; top: 64px; left: 0; right: 0; background: var(--grey);
    border-bottom: 1px solid var(--grey3); z-index: 900; padding: 1.5rem;
    display: flex; flex-direction: column; gap: 1rem;
    transform: translateY(-100%); opacity: 0; transition: all 0.3s; pointer-events: none;
  }
  .mobile-menu.open { transform: translateY(0); opacity: 1; pointer-events: all; }

  @media (max-width: 1024px) {
    .product-grid { grid-template-columns: repeat(2, 1fr); }
    .collections-row { grid-template-columns: repeat(2, 1fr); }
    .shop-layout { grid-template-columns: 1fr; }
    .shop-sidebar { position: static; }
    .footer-grid { grid-template-columns: 1fr 1fr; gap: 2rem; }
    .checkout-grid { grid-template-columns: 1fr; }
    .product-page { grid-template-columns: 1fr; }
    .product-images { position: static; }
  }
  @media (max-width: 768px) {
    .nav-links { display: none; }
    .hamburger { display: flex; }
    .nav-logo { position: static; transform: none; }
    .nav { justify-content: space-between; }
    .hero-btns { flex-direction: column; align-items: center; }
    .product-grid { grid-template-columns: repeat(2, 1fr); gap: 0.8rem; }
    .collections-row { grid-template-columns: repeat(2, 1fr); }
    .form-row { grid-template-columns: 1fr; }
    .footer-grid { grid-template-columns: 1fr; gap: 2rem; }
    .footer-bottom { flex-direction: column; gap: 1rem; text-align: center; }
    .section { padding: 3rem 1rem; }
    .cart-drawer { width: 100%; }
  }
  @keyframes fadeUp { from { opacity:0; transform: translateY(20px); } to { opacity:1; transform: translateY(0); } }
  .fade-up { animation: fadeUp 0.5s ease forwards; }
`;

// ── NAV ───────────────────────────────────────────────────────────────────────
function Nav({ page, setPage, cartCount, openCart, mobileOpen, setMobileOpen }) {
  const pages = ["home","shop","about"];
  return (
    <>
      <nav className="nav">
        <div className="nav-links">
          {pages.map(p => (
            <button key={p} className={`nav-link ${page===p?"active":""}`} onClick={() => { setPage(p); setMobileOpen(false); }}>
              {p.charAt(0).toUpperCase()+p.slice(1)}
            </button>
          ))}
        </div>
        <div className="nav-logo" onClick={() => setPage("home")}>OT<span>G</span></div>
        <div className="nav-right">
          <button className="cart-btn" onClick={openCart}>
            Bag {cartCount > 0 && `(${cartCount})`}
          </button>
          <button className="hamburger" onClick={() => setMobileOpen(!mobileOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </nav>
      <div className={`mobile-menu ${mobileOpen?"open":""}`}>
        {[...pages,"creators"].map(p => (
          <button key={p} className={`nav-link ${page===p?"active":""}`} style={{fontSize:"0.9rem",letterSpacing:"0.1em"}} onClick={() => { setPage(p); setMobileOpen(false); }}>
            {p === "creators" ? "Creators ✦" : p.charAt(0).toUpperCase()+p.slice(1)}
          </button>
        ))}
        <button className="btn btn-green" style={{width:"100%",justifyContent:"center"}} onClick={() => { openCart(); setMobileOpen(false); }}>
          View Bag {cartCount > 0 && `(${cartCount})`}
        </button>
      </div>
    </>
  );
}

// ── CART DRAWER ───────────────────────────────────────────────────────────────
function CartDrawer({ cart, open, onClose, removeFromCart, setPage }) {
  const total = cart.reduce((s, i) => s + i.price * i.qty, 0);
  return (
    <>
      {open && <div className="cart-overlay" onClick={onClose} />}
      <div className={`cart-drawer ${open?"open":""}`}>
        <div className="cart-drawer-header">
          <span className="cart-drawer-title">Your Bag</span>
          <button className="cart-close" onClick={onClose}>✕</button>
        </div>
        <div className="cart-items">
          {cart.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🛍</div>
              <p className="empty-state-text">Your bag is empty</p>
            </div>
          ) : cart.map((item, idx) => (
            <div key={idx} className="cart-item">
              <img src={item.image} alt={item.name} onError={e => e.target.style.opacity="0.3"} />
              <div>
                <div className="cart-item-name">{item.name}</div>
                <div className="cart-item-meta">Size: {item.size} · Qty: {item.qty}</div>
                <div className="cart-item-meta" style={{color:"var(--green-bright)",marginTop:"0.3rem"}}>{fmt(item.price * item.qty)}</div>
              </div>
              <button className="cart-remove" onClick={() => removeFromCart(idx)}>✕</button>
            </div>
          ))}
        </div>
        {cart.length > 0 && (
          <div className="cart-footer">
            <div className="cart-total-row">
              <span className="cart-total-label">Subtotal</span>
              <span className="cart-total-value">{fmt(total)}</span>
            </div>
            <button className="btn btn-green" style={{width:"100%",justifyContent:"center",padding:"1rem"}} onClick={() => { onClose(); setPage("checkout"); }}>
              Proceed to Checkout →
            </button>
          </div>
        )}
      </div>
    </>
  );
}

// ── PRODUCT CARD ──────────────────────────────────────────────────────────────
function ProductCard({ product, onClick }) {
  const isComingSoon = product.price === 0;
  return (
    <div className="product-card" onClick={() => !isComingSoon && onClick()} style={{cursor: isComingSoon ? "default" : "pointer"}}>
      <div className="product-img-wrap">
        <img src={product.image} alt={product.name} onError={e => { e.target.src=""; e.target.style.opacity="0.2"; }} />
        {isComingSoon ? (
          <span className="product-tag gold">Coming Soon</span>
        ) : product.tag ? (
          <span className="product-tag">{product.tag}</span>
        ) : null}
        {!isComingSoon && (
          <div className="product-overlay">
            <button className="btn btn-green" style={{fontSize:"0.58rem"}}>View Details</button>
          </div>
        )}
      </div>
      <div className="product-info">
        <div className="product-name">{product.name}</div>
        <div className="product-price">
          {isComingSoon
            ? <span style={{color:"var(--gold)",fontSize:"0.62rem",letterSpacing:"0.15em"}}>COMING SOON</span>
            : fmt(product.price)
          }
        </div>
      </div>
    </div>
  );
}

// ── HOME PAGE ─────────────────────────────────────────────────────────────────
function HomePage({ setPage, setSelectedProduct }) {
  const collections = [
    { key: "vibrant", label: "Vibrant", sub: "Tees & Polos", img: PRODUCTS.find(p=>p.category==="vibrant"&&p.price>0)?.image },
    { key: "girls", label: "Girls Only", sub: "Feminine Drops", img: PRODUCTS.find(p=>p.category==="girls"&&p.price>0)?.image },
    { key: "bottoms", label: "Bottoms", sub: "Sweats & More", img: PRODUCTS.find(p=>p.category==="bottoms")?.image },
    { key: "accessories", label: "Accessories", sub: "Caps, Belts & Socks", img: PRODUCTS.find(p=>p.category==="accessories"&&p.price>0)?.image },
  ];
  const featured = PRODUCTS.filter(p => p.price > 0).slice(0, 4);

  return (
    <div>
      {/* HERO */}
      <section className="hero">
        <video className="hero-video" autoPlay muted loop playsInline poster="">
          <source src="/hero-video.mp4" type="video/mp4" />
        </video>
        <div className="hero-overlay" />
        <div className="hero-content fade-up">
          <div className="hero-eyebrow">EST. MMXXV · SURULERE, LAGOS</div>
          <h1 className="hero-title">
            ON TO<br/><span className="green">GOD</span>
          </h1>
          <p className="hero-sub">Wear the Truth. Live the Culture.</p>
          <div className="hero-btns">
            <button className="btn btn-green" onClick={() => setPage("shop")}>Shop Now →</button>
            <button className="btn btn-outline" onClick={() => setPage("about")}>Our Story</button>
          </div>
        </div>
      </section>

      {/* COLLECTIONS */}
      <div style={{background:"var(--grey2)",padding:"0.5rem 0",textAlign:"center",borderBottom:"1px solid var(--grey3)"}}>
        <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",letterSpacing:"0.5em",color:"var(--green-bright)"}}>
          FREE DELIVERY WITHIN SURULERE · NATIONWIDE SHIPPING AVAILABLE
        </span>
      </div>

      <div style={{background:"var(--black)"}}>
        <div className="section" style={{paddingBottom:"1rem"}}>
          <div className="section-eyebrow">Browse by Category</div>
          <h2 className="section-title">Collections</h2>
          <div className="section-divider" />
        </div>
        <div className="collections-row" style={{maxWidth:"100%"}}>
          {collections.map(col => (
            <div key={col.key} className="collection-card" onClick={() => setPage("shop")}>
              {col.img ? (
                <img src={col.img} alt={col.label} />
              ) : (
                <div style={{width:"100%",height:"100%",background:`linear-gradient(135deg, var(--grey) 0%, var(--green-dim) 100%)`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <span style={{fontFamily:"'Boogaloo',cursive",fontSize:"3rem",opacity:0.2}}>{col.label[0]}</span>
                </div>
              )}
              <div className="collection-card-overlay">
                <div className="collection-card-name">{col.label}</div>
                <div className="collection-card-count">{col.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FEATURED */}
      <div className="section">
        <div className="section-eyebrow">Available Now</div>
        <h2 className="section-title">Featured Pieces</h2>
        <div className="section-divider" />
        <div className="product-grid" style={{gridTemplateColumns:"repeat(4,1fr)"}}>
          {featured.map(p => (
            <ProductCard key={p.id} product={p} onClick={() => { setSelectedProduct(p); setPage("product"); }} />
          ))}
        </div>
        <div style={{textAlign:"center",marginTop:"2.5rem"}}>
          <button className="btn btn-outline" onClick={() => setPage("shop")}>View All Products →</button>
        </div>
      </div>

      {/* MANIFESTO BAND */}
      <div style={{background:"var(--green)",padding:"3rem 2rem",textAlign:"center"}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",letterSpacing:"0.5em",color:"rgba(255,255,255,0.6)",marginBottom:"1rem"}}>OTG MANIFESTO</div>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontStyle:"italic",fontSize:"clamp(1.3rem,3vw,2rem)",color:"var(--white)",maxWidth:"700px",margin:"0 auto",lineHeight:1.5}}>
          "We don't follow trends. We build culture from Surulere to the world — On To God."
        </p>
      </div>

      {/* REFERRAL CTA */}
      <div className="section" style={{textAlign:"center"}}>
        <div className="section-eyebrow">Creators Program</div>
        <h2 className="section-title">Earn With OTG</h2>
        <div className="section-divider" style={{margin:"0 auto 2rem"}} />
        <p style={{color:"var(--text-muted)",fontSize:"1rem",maxWidth:"500px",margin:"0 auto 2rem",lineHeight:1.7}}>
          Share your code. Your people get 5% off, you earn 7% commission on every order. No cap.
        </p>
        <button className="btn btn-green" onClick={() => window.open("https://wa.me/2348136437912?text=Hi+OTG%2C+I+want+to+become+a+creator","_blank")}>
          Become a Creator →
        </button>
      </div>
    </div>
  );
}

// ── SHOP PAGE ─────────────────────────────────────────────────────────────────
function ShopPage({ setPage, setSelectedProduct }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const cats = [
    { key: "all", label: "All Products" },
    { key: "vibrant", label: "Vibrant" },
    { key: "bottoms", label: "Bottoms" },
    { key: "girls", label: "Girls Only" },
    { key: "accessories", label: "Accessories" },
  ];
  const filtered = PRODUCTS
    .filter(p => filter === "all" || p.category === filter)
    .filter(p => p.name.toLowerCase().includes(search.toLowerCase()));
  const available = filtered.filter(p => p.price > 0);
  const comingSoon = filtered.filter(p => p.price === 0);

  return (
    <div style={{paddingTop:"64px",minHeight:"100vh",background:"var(--black)"}}>
      <div style={{padding:"2.5rem 2rem 1rem",borderBottom:"1px solid var(--grey3)",background:"var(--grey)"}}>
        <div className="section-eyebrow">ontogod.xyz</div>
        <h1 className="section-title">The Shop</h1>
      </div>
      <div style={{maxWidth:"1400px",margin:"0 auto",padding:"2rem"}}>
        <div className="shop-layout">
          {/* SIDEBAR */}
          <aside className="shop-sidebar">
            <div className="sidebar-heading">Search</div>
            <input className="search-input" placeholder="Search products..." value={search} onChange={e => setSearch(e.target.value)} />
            <div className="sidebar-heading">Categories</div>
            {cats.map(c => (
              <button key={c.key} className={`sidebar-filter ${filter===c.key?"active":""}`} onClick={() => setFilter(c.key)}>
                {c.label}
                <span style={{float:"right",fontSize:"0.7rem",color:"var(--text-muted)"}}>
                  {c.key === "all" ? PRODUCTS.length : PRODUCTS.filter(p=>p.category===c.key).length}
                </span>
              </button>
            ))}
            <div style={{marginTop:"2rem",padding:"1rem",background:"rgba(26,107,58,0.08)",border:"1px solid rgba(26,107,58,0.2)"}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--green-bright)",letterSpacing:"0.2em",marginBottom:"0.5rem"}}>HAVE A CODE?</div>
              <p style={{fontSize:"0.8rem",color:"var(--text-muted)",lineHeight:1.5}}>Enter your referral code at checkout for 5% off your order.</p>
            </div>
          </aside>

          {/* PRODUCTS */}
          <div>
            {filtered.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">🔍</div>
                <p className="empty-state-text">No products found</p>
              </div>
            ) : (
              <>
                {available.length > 0 && (
                  <>
                    {comingSoon.length > 0 && (
                      <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.3em",color:"var(--green-bright)",marginBottom:"1rem"}}>
                        AVAILABLE NOW — {available.length} PIECES
                      </div>
                    )}
                    <div className="product-grid" style={{marginBottom: comingSoon.length > 0 ? "3rem" : 0}}>
                      {available.map(p => (
                        <ProductCard key={p.id} product={p} onClick={() => { setSelectedProduct(p); setPage("product"); }} />
                      ))}
                    </div>
                  </>
                )}
                {comingSoon.length > 0 && (
                  <>
                    <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.3em",color:"var(--gold)",marginBottom:"1rem",paddingTop:"1rem",borderTop:"1px solid var(--grey3)"}}>
                      COMING SOON — {comingSoon.length} DROPS
                    </div>
                    <div className="product-grid">
                      {comingSoon.map(p => <ProductCard key={p.id} product={p} onClick={() => {}} />)}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── PRODUCT PAGE ──────────────────────────────────────────────────────────────
function ProductPage({ product, addToCart, setPage }) {
  const [activeImg, setActiveImg] = useState(0);
  const [size, setSize] = useState("");
  const [qty, setQty] = useState(1);
  const [stock, setStock] = useState(null);

  useEffect(() => {
    setActiveImg(0); setSize(""); setQty(1);
    fetchStock(product.id).then(s => setStock(s));
  }, [product.id]);

  const imgs = product.images?.length ? product.images : [product.image];
  const sizeStock = (s) => stock ? (stock[s] ?? 10) : 10;

  return (
    <div style={{paddingTop:"64px",background:"var(--black)",minHeight:"100vh"}}>
      <div style={{maxWidth:"1400px",margin:"0 auto",padding:"2rem"}}>
        <button className="btn btn-outline" style={{marginBottom:"2rem",fontSize:"0.58rem",padding:"0.5rem 1rem"}} onClick={() => setPage("shop")}>
          ← Back to Shop
        </button>
        <div className="product-page">
          {/* IMAGES */}
          <div className="product-images">
            <img className="product-main-img" src={imgs[activeImg]} alt={product.name} onError={e => e.target.style.opacity="0.2"} />
            {imgs.length > 1 && (
              <div className="product-thumbs">
                {imgs.map((img, i) => (
                  <img key={i} className={`product-thumb ${activeImg===i?"active":""}`} src={img} alt="" onClick={() => setActiveImg(i)} onError={e => e.target.style.opacity="0.2"} />
                ))}
              </div>
            )}
          </div>

          {/* DETAILS */}
          <div>
            {product.tag && <span className="product-tag" style={{position:"static",display:"inline-block",marginBottom:"1rem"}}>{product.tag}</span>}
            <h1 className="product-detail-name">{product.name}</h1>
            <div className="product-detail-price">{fmt(product.price)}</div>
            <p style={{color:"var(--text-muted)",lineHeight:1.7,marginBottom:"2rem",fontSize:"0.95rem"}}>{product.description}</p>

            {/* COLORS */}
            {product.colors?.length > 0 && (
              <div style={{marginBottom:"1.5rem"}}>
                <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.2em",color:"var(--text-muted)",textTransform:"uppercase",marginBottom:"0.7rem"}}>Colours</div>
                <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
                  {product.colors.map(c => (
                    <span key={c} style={{padding:"0.3rem 0.8rem",border:"1px solid var(--grey3)",fontSize:"0.8rem",color:"var(--text-muted)"}}>{c}</span>
                  ))}
                </div>
              </div>
            )}

            {/* SIZES */}
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.2em",color:"var(--text-muted)",textTransform:"uppercase",marginBottom:"0.7rem"}}>
              Select Size {size && <span style={{color:"var(--green-bright)"}}>{size}</span>}
            </div>
            <div className="size-grid" style={{gridTemplateColumns:`repeat(${Math.min(product.sizes.length,5)},1fr)`}}>
              {product.sizes.map(s => {
                const qty = sizeStock(s);
                return (
                  <button key={s} className={`size-btn ${size===s?"selected":""} ${qty===0?"disabled":""}`} onClick={() => qty > 0 && setSize(s)} disabled={qty === 0}>
                    {s}{qty === 0 && <span style={{display:"block",fontSize:"0.45rem"}}>SOLD</span>}
                  </button>
                );
              })}
            </div>

            {/* QTY */}
            <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.2em",color:"var(--text-muted)",textTransform:"uppercase",marginBottom:"0.7rem",marginTop:"1.5rem"}}>Quantity</div>
            <div className="qty-control">
              <button className="qty-btn" onClick={() => setQty(q => Math.max(1,q-1))}>−</button>
              <span className="qty-num">{qty}</span>
              <button className="qty-btn" onClick={() => setQty(q => q+1)}>+</button>
            </div>

            <button className="btn btn-green" style={{width:"100%",justifyContent:"center",padding:"1.1rem",fontSize:"0.65rem"}} disabled={!size} onClick={() => { if(size) addToCart({ id:product.id, name:product.name, price:product.price, size, qty, image:product.image }); }}>
              {size ? "Add to Bag →" : "Select a Size"}
            </button>

            {/* INFO */}
            <div style={{marginTop:"2rem",padding:"1.2rem",background:"var(--grey)",border:"1px solid var(--grey3)"}}>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.2em",color:"var(--green-bright)",marginBottom:"0.7rem"}}>DELIVERY INFO</div>
              <p style={{fontSize:"0.85rem",color:"var(--text-muted)",lineHeight:1.6}}>
                Surulere delivery from ₦1,500 · Nationwide from ₦2,000.<br/>
                We confirm via WhatsApp within 48 hours.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CHECKOUT PAGE ─────────────────────────────────────────────────────────────
function CheckoutPage({ cart, clearCart, setCart, setPage, setReturnOrder }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ firstName:"", lastName:"", email:"", phone:"", address:"", city:"", state:"" });
  const [deliveryZone, setDeliveryZone] = useState(DELIVERY_ZONES[0]);
  const [payMethod, setPayMethod] = useState("paystack");
  const [referralCode, setReferralCode] = useState("");
  const [referralStatus, setReferralStatus] = useState(null);
  const [referralData, setReferralData] = useState(null);
  const [checkingRef, setCheckingRef] = useState(false);
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => { if (cart.length === 0 && step < 3) setPage("shop"); }, []);

  const subtotal = cart.reduce((s, i) => s + i.price * i.qty, 0);
  const shipping = deliveryZone.price;
  const discount = referralStatus === "valid" ? Math.round(subtotal * 0.05) : 0;
  const finalTotal = subtotal - discount;
  const itemsText = cart.map(i => `${i.name} x${i.qty} (${i.size})`).join(", ");
  const f = (k) => (e) => setForm(p => ({...p,[k]:e.target.value}));
  const formComplete = form.firstName && form.lastName && form.email && form.phone && form.address && deliveryZone.price > 0;

  const checkReferral = async () => {
    if (!referralCode.trim()) return;
    setCheckingRef(true);
    const data = await validateReferralCode(referralCode.trim());
    if (data) { setReferralStatus("valid"); setReferralData(data); }
    else setReferralStatus("invalid");
    setCheckingRef(false);
  };

  const handlePaystackPayment = () => {
    if (!window.PaystackPop) { alert("Paystack not loaded. Check your internet connection."); return; }
    const ref = `OTG-${Date.now()}`;
    const orderData = {
      customer_name: `${form.firstName} ${form.lastName}`,
      customer_email: form.email,
      customer_phone: form.phone,
      customer_address: `${form.address}, ${form.city}, ${form.state}, ${deliveryZone.label}`,
      items: cart, items_text: itemsText,
      total: finalTotal + shipping, payment_ref: ref, status: "paid",
      referral_code: referralCode, referral_status: referralStatus, note,
    };
    function onPaymentSuccess() {
      processOrder(orderData);
      decrementStock(cart);
      if (referralCode && referralStatus === "valid") applyReferralReward(referralCode, finalTotal + shipping, form.email, ref);
      setCart([]); setStep(3);
    }
    const handler = window.PaystackPop.setup({ key: CONFIG.PAYSTACK_KEY, email: form.email, amount: (finalTotal + shipping) * 100, currency: "NGN", ref, callback: onPaymentSuccess, onClose: () => {} });
    handler.openIframe();
  };

  const handleCOD = async () => {
    setLoading(true);
    const ref = `OTG-COD-${Date.now()}`;
    await processOrder({ customer_name: `${form.firstName} ${form.lastName}`, customer_email: form.email, customer_phone: form.phone, customer_address: `${form.address}, ${form.city}, ${form.state}, ${deliveryZone.label}`, items: cart, items_text: itemsText, total: finalTotal + shipping, payment_ref: ref, status: "cash_on_delivery", note });
    decrementStock(cart);
    setLoading(false); setCart([]); setStep(3);
  };

  if (step === 3) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem",textAlign:"center",background:"var(--black)"}}>
      <div className="fade-up">
        <div style={{fontSize:"3rem",marginBottom:"1rem"}}>✦</div>
        <h2 style={{fontFamily:"'Boogaloo',cursive",fontSize:"clamp(2.5rem,8vw,4rem)",color:"var(--green-bright)",marginBottom:"1rem"}}>ORDER PLACED!</h2>
        <p style={{color:"var(--text-muted)",fontSize:"1rem",lineHeight:1.8,marginBottom:"2rem",maxWidth:"400px",margin:"0 auto 2rem"}}>
          We'll pack it with love and get it to you soon.<br/>
          <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.7rem",color:"var(--green-bright)"}}>
            On To God · Wear the Truth ✦
          </span>
        </p>
        <button className="btn btn-green" onClick={() => setPage("shop")}>Back to Shop →</button>
      </div>
    </div>
  );

  return (
    <div className="checkout-page">
      <h1 style={{fontFamily:"'Boogaloo',cursive",fontSize:"2.5rem",marginBottom:"0.5rem"}}>Checkout</h1>
      <div className="stepper">
        {["Shipping","Payment","Done"].map((s,i) => (
          <div key={s} className={`step ${step-1===i?"active":step-1>i?"done":""}`}>{s}</div>
        ))}
      </div>

      <div className="checkout-grid">
        <div>
          {step === 1 && (
            <div className="checkout-card fade-up">
              <div className="checkout-card-title">Shipping Info</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">First Name</label><input className="form-input" value={form.firstName} onChange={f("firstName")} placeholder="John" /></div>
                <div className="form-group"><label className="form-label">Last Name</label><input className="form-input" value={form.lastName} onChange={f("lastName")} placeholder="Doe" /></div>
              </div>
              <div className="form-group"><label className="form-label">Email</label><input className="form-input" type="email" value={form.email} onChange={f("email")} placeholder="your@email.com" /></div>
              <div className="form-group"><label className="form-label">Phone</label><input className="form-input" value={form.phone} onChange={f("phone")} placeholder="+234 800 000 0000" /></div>
              <div className="form-group"><label className="form-label">Delivery Address</label><input className="form-input" value={form.address} onChange={f("address")} placeholder="House number, Street" /></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">City</label><input className="form-input" value={form.city} onChange={f("city")} placeholder="Lagos" /></div>
                <div className="form-group"><label className="form-label">State</label><input className="form-input" value={form.state} onChange={f("state")} placeholder="Lagos State" /></div>
              </div>
              <div className="form-group">
                <label className="form-label">Delivery Zone (LGA)</label>
                <select className="form-select" value={deliveryZone.label} onChange={e => setDeliveryZone(DELIVERY_ZONES.find(z => z.label === e.target.value) || DELIVERY_ZONES[0])}>
                  {DELIVERY_ZONES.map(z => <option key={z.label}>{z.label}{z.price > 0 ? ` — ${fmt(z.price)}` : ""}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Order Note (optional)</label>
                <input className="form-input" value={note} onChange={e => setNote(e.target.value)} placeholder="Special instructions..." />
              </div>
              <button className="btn btn-green" style={{width:"100%",justifyContent:"center",padding:"1rem"}} disabled={!formComplete} onClick={() => setStep(2)}>
                Continue to Payment →
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="checkout-card fade-up">
              <div className="checkout-card-title">Payment Method</div>
              {[{key:"paystack",label:"Pay with Paystack",sub:"Card · Bank Transfer · USSD · QR"},{key:"cash",label:"Cash on Delivery",sub:"Pay when your order arrives"}].map(m => (
                <div key={m.key} className={`pay-option ${payMethod===m.key?"selected":""}`} onClick={() => setPayMethod(m.key)}>
                  <div className="pay-option-radio" />
                  <div>
                    <div style={{fontWeight:700,marginBottom:"0.2rem"}}>{m.label}</div>
                    <div style={{fontSize:"0.8rem",color:"var(--text-muted)",fontFamily:"'Space Mono',monospace"}}>{m.sub}</div>
                  </div>
                </div>
              ))}

              <div style={{marginTop:"1.5rem",paddingTop:"1.5rem",borderTop:"1px solid var(--grey3)"}}>
                <div className="form-label" style={{marginBottom:"0.7rem",display:"block"}}>Referral Code (optional)</div>
                <div className="referral-input-row">
                  <input className="form-input" style={{flex:1}} placeholder="e.g. JOEL10" value={referralCode} onChange={e => { setReferralCode(e.target.value.toUpperCase()); setReferralStatus(null); }} />
                  <button className="btn btn-outline" style={{fontSize:"0.6rem",whiteSpace:"nowrap"}} onClick={checkReferral} disabled={checkingRef}>
                    {checkingRef ? "..." : "Apply"}
                  </button>
                </div>
                {referralStatus === "valid" && <p className="referral-status" style={{color:"var(--green-bright)"}}>✓ Code valid! 5% discount applied → saving {fmt(discount)}</p>}
                {referralStatus === "invalid" && <p className="referral-status" style={{color:"#e55"}}>✗ Code not found. Check and try again.</p>}
              </div>

              <div style={{display:"flex",gap:"1rem",marginTop:"1.5rem"}}>
                <button className="btn btn-outline" style={{flex:"0 0 auto",fontSize:"0.6rem"}} onClick={() => setStep(1)}>← Back</button>
                <button className="btn btn-green" style={{flex:1,justifyContent:"center",padding:"1rem"}} onClick={payMethod==="paystack"?handlePaystackPayment:handleCOD} disabled={loading}>
                  {loading ? "Processing..." : payMethod === "paystack" ? "Pay Now →" : "Place Order →"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ORDER SUMMARY */}
        <div>
          <div className="checkout-card" style={{position:"sticky",top:"80px"}}>
            <div className="checkout-card-title">Order Summary</div>
            {cart.map((item, i) => (
              <div key={i} className="order-summary-item">
                <span style={{flex:1}}>{item.name} <span style={{color:"var(--text-muted)",fontSize:"0.8rem"}}>×{item.qty} ({item.size})</span></span>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.8rem"}}>{fmt(item.price * item.qty)}</span>
              </div>
            ))}
            <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:"1px solid var(--grey3)"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.85rem",marginBottom:"0.5rem",color:"var(--text-muted)"}}>
                <span>Subtotal</span><span style={{fontFamily:"'Space Mono',monospace"}}>{fmt(subtotal)}</span>
              </div>
              {discount > 0 && (
                <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.85rem",marginBottom:"0.5rem",color:"var(--green-bright)"}}>
                  <span>Referral Discount</span><span style={{fontFamily:"'Space Mono',monospace"}}>−{fmt(discount)}</span>
                </div>
              )}
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.85rem",marginBottom:"0.5rem",color:"var(--text-muted)"}}>
                <span>Delivery ({deliveryZone.price > 0 ? deliveryZone.label.split("(")[0].trim() : "Select LGA"})</span>
                <span style={{fontFamily:"'Space Mono',monospace"}}>{shipping > 0 ? fmt(shipping) : "—"}</span>
              </div>
            </div>
            <div className="order-summary-total">
              <span>Total</span>
              <span style={{color:"var(--green-bright)",fontSize:"1.1rem"}}>{fmt(finalTotal + shipping)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CREATORS / INFLUENCER PAGE ────────────────────────────────────────────────
function CreatorsPage({ setPage }) {
  const [pwInput, setPwInput] = useState("");
  const [pwOk, setPwOk] = useState(false);
  const [pwError, setPwError] = useState("");
  const [loginCode, setLoginCode] = useState("");
  const [loginEmail, setLoginEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [loginError, setLoginError] = useState("");
  const [modal, setModal] = useState(null);
  const [wMethod, setWMethod] = useState("bank");
  const [wDetails, setWDetails] = useState("");
  const [productNote, setProductNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const checkPassword = () => {
    if (pwInput === CONFIG.CREATORS_PASSWORD) { setPwOk(true); setPwError(""); }
    else setPwError("Incorrect password. Contact OTG on WhatsApp for access.");
  };

  const handleLogin = async () => {
    if (!loginCode.trim() || !loginEmail.trim()) { setLoginError("Enter both email and promo code."); return; }
    setLoading(true); setLoginError("");
    const result = await fetchInfluencerData(loginCode.trim());
    if (result) {
      const ownerEmail = result.profile?.owner_email || "";
      if (ownerEmail && ownerEmail.toLowerCase() !== loginEmail.trim().toLowerCase()) { setLoginError("Email doesn't match this code."); setLoading(false); return; }
      setData(result);
    } else { setLoginError("Code not found. Check and try again."); }
    setLoading(false);
  };

  const handleWithdraw = async () => {
    if (!wDetails.trim()) { alert("Enter your payment details."); return; }
    setSubmitting(true);
    const ok = await submitWithdrawalRequest(data.profile.owner_email, data.profile.code, data.credit?.credit || 0, wMethod, wDetails);
    setSubmitting(false);
    if (ok) { setSuccessMsg("✦ Withdrawal request submitted! OTG will process within 48 hours."); setModal(null); }
    else alert("Something went wrong. Contact OTG on WhatsApp.");
  };

  const handleRedeem = async () => {
    if (!productNote.trim()) { alert("Describe what you'd like to redeem."); return; }
    setSubmitting(true);
    const ok = await submitRedemptionRequest(data.profile.owner_email, data.profile.code, data.credit?.credit || 0, productNote);
    setSubmitting(false);
    if (ok) { setSuccessMsg("✦ Redemption request submitted! OTG will reach out within 48 hours."); setModal(null); }
    else alert("Something went wrong. Contact OTG on WhatsApp.");
  };

  // STEP 1 — Password gate
  if (!pwOk) return (
    <div className="creators-page" style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div className="creators-login">
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.4em",color:"var(--green-bright)",marginBottom:"0.8rem"}}>CREATORS PORTAL</div>
          <h1 style={{fontFamily:"'Boogaloo',cursive",fontSize:"clamp(3rem,10vw,5rem)",lineHeight:1}}>OTG<br/><span style={{color:"var(--green-bright)"}}>CREATORS</span></h1>
        </div>
        <div className="checkout-card">
          <div className="form-group">
            <label className="form-label">Portal Password</label>
            <input className="form-input" type="password" placeholder="Enter password" value={pwInput} onChange={e => { setPwInput(e.target.value); setPwError(""); }} onKeyDown={e => e.key==="Enter" && checkPassword()} />
          </div>
          {pwError && <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"#e55",marginBottom:"1rem"}}>✗ {pwError}</p>}
          <button className="btn btn-green" style={{width:"100%",justifyContent:"center",padding:"1rem"}} onClick={checkPassword}>
            Enter →
          </button>
        </div>
        <p style={{textAlign:"center",marginTop:"1.5rem",fontFamily:"'Space Mono',monospace",fontSize:"0.55rem",color:"#444"}}>
          No access? <span style={{color:"var(--green-bright)",cursor:"pointer"}} onClick={() => window.open("https://wa.me/2348136437912?text=Hi+OTG%2C+I+want+to+become+a+creator","_blank")}>Contact OTG →</span>
        </p>
      </div>
    </div>
  );

  // STEP 2 — Dashboard login
  if (!data) return (
    <div className="creators-page" style={{display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div className="creators-login">
        <div style={{textAlign:"center",marginBottom:"2.5rem"}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.4em",color:"var(--green-bright)",marginBottom:"0.8rem"}}>YOUR DASHBOARD</div>
          <h1 style={{fontFamily:"'Boogaloo',cursive",fontSize:"clamp(2.5rem,8vw,4rem)",lineHeight:1}}>YOUR<br/><span style={{color:"var(--green-bright)"}}>EARNINGS</span></h1>
        </div>
        <div className="checkout-card">
          <div className="form-group"><label className="form-label">Your Email</label><input className="form-input" type="email" placeholder="your@email.com" value={loginEmail} onChange={e => { setLoginEmail(e.target.value); setLoginError(""); }} /></div>
          <div className="form-group"><label className="form-label">Your Promo Code</label><input className="form-input" placeholder="e.g. JOEL10" style={{textTransform:"uppercase",letterSpacing:"0.2em"}} value={loginCode} onChange={e => { setLoginCode(e.target.value.toUpperCase()); setLoginError(""); }} onKeyDown={e => e.key==="Enter" && handleLogin()} /></div>
          {loginError && <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"#e55",marginBottom:"1rem"}}>✗ {loginError}</p>}
          <button className="btn btn-green" style={{width:"100%",justifyContent:"center",padding:"1rem"}} onClick={handleLogin} disabled={loading}>
            {loading ? "Checking..." : "Access Dashboard →"}
          </button>
        </div>
        <div style={{marginTop:"1.5rem",padding:"1rem",background:"rgba(26,107,58,0.08)",border:"1px solid rgba(26,107,58,0.2)",borderLeft:"3px solid var(--green-bright)"}}>
          <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"#888",lineHeight:1.8}}>
            <span style={{color:"var(--green-bright)",display:"block",marginBottom:"0.4rem"}}>HOW IT WORKS</span>
            Your code → buyer gets <strong style={{color:"var(--white)"}}>5% off</strong>, you earn <strong style={{color:"var(--white)"}}>7% commission</strong>. When balance hits 35% of total earned, withdraw or redeem for OTG clothing.
          </p>
        </div>
      </div>
    </div>
  );

  // STEP 3 — Dashboard
  const credit = data.credit?.credit || 0;
  const totalEarned = data.credit?.total_earned || 0;
  const UNLOCK_THRESHOLD = totalEarned > 0 ? totalEarned * 0.35 : Infinity;
  const unlocked = totalEarned > 0 && credit >= UNLOCK_THRESHOLD;
  const progressPct = totalEarned > 0 ? Math.min(100, Math.round((credit / UNLOCK_THRESHOLD) * 100)) : 0;
  const uses = data.uses || [];

  return (
    <div className="creators-page">
      {modal === "withdraw" && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">WITHDRAW</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--green-bright)",marginBottom:"1.5rem"}}>AVAILABLE: {fmt(credit)}</p>
            <div className="form-group">
              <label className="form-label">Payment Method</label>
              <select className="form-select" value={wMethod} onChange={e => setWMethod(e.target.value)}>
                {["bank","opay","palmpay"].map(m => <option key={m} value={m}>{m.charAt(0).toUpperCase()+m.slice(1)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Account Details</label>
              <input className="form-input" placeholder="Account number · Bank name · Name" value={wDetails} onChange={e => setWDetails(e.target.value)} />
            </div>
            <button className="btn btn-green" style={{width:"100%",justifyContent:"center",padding:"1rem"}} onClick={handleWithdraw} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request →"}
            </button>
          </div>
        </div>
      )}
      {modal === "redeem" && (
        <div className="modal-overlay">
          <div className="modal-box">
            <div className="modal-header">
              <span className="modal-title">REDEEM</span>
              <button className="modal-close" onClick={() => setModal(null)}>✕</button>
            </div>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--green-bright)",marginBottom:"1.5rem"}}>CREDIT: {fmt(credit)}</p>
            <div className="form-group">
              <label className="form-label">What would you like?</label>
              <input className="form-input" placeholder="e.g. Heart Tee in L, Black" value={productNote} onChange={e => setProductNote(e.target.value)} />
            </div>
            <button className="btn btn-green" style={{width:"100%",justifyContent:"center",padding:"1rem"}} onClick={handleRedeem} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Request →"}
            </button>
          </div>
        </div>
      )}

      <div className="creators-dashboard" style={{paddingTop:"5rem"}}>
        <div style={{marginBottom:"2rem"}}>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.3em",color:"var(--green-bright)",marginBottom:"0.5rem"}}>WELCOME BACK</div>
          <h1 style={{fontFamily:"'Boogaloo',cursive",fontSize:"2.5rem"}}>{data.profile.owner_email?.split("@")[0]?.toUpperCase()} <span style={{color:"var(--green-bright)"}}>✦</span></h1>
          <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.7rem",color:"var(--text-muted)",marginTop:"0.3rem"}}>Code: {data.profile.code}</div>
        </div>

        {successMsg && (
          <div style={{background:"rgba(26,107,58,0.15)",border:"1px solid var(--green)",padding:"1rem",marginBottom:"1.5rem",fontFamily:"'Space Mono',monospace",fontSize:"0.65rem",color:"var(--green-bright)"}}>
            {successMsg}
          </div>
        )}

        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1rem",marginBottom:"2rem"}}>
          <div className="stat-card"><div className="stat-value">{fmt(credit)}</div><div className="stat-label">AVAILABLE BALANCE</div></div>
          <div className="stat-card"><div className="stat-value">{fmt(totalEarned)}</div><div className="stat-label">TOTAL EARNED</div></div>
          <div className="stat-card"><div className="stat-value">{uses.length}</div><div className="stat-label">TOTAL REFERRALS</div></div>
        </div>

        {/* PROGRESS */}
        <div className="checkout-card" style={{marginBottom:"1.5rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:"0.8rem"}}>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-muted)"}}>UNLOCK PROGRESS</span>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color: unlocked?"var(--green-bright)":"var(--gold)"}}>{progressPct}%</span>
          </div>
          <div style={{background:"var(--grey3)",height:"6px",borderRadius:"3px",overflow:"hidden"}}>
            <div style={{height:"100%",width:`${progressPct}%`,background: unlocked?"var(--green-bright)":"var(--gold)",transition:"width 0.5s"}} />
          </div>
          {unlocked ? (
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--green-bright)",marginTop:"0.8rem"}}>✦ Unlocked! You can withdraw or redeem now.</p>
          ) : (
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:"0.6rem",color:"var(--text-muted)",marginTop:"0.8rem"}}>
              Earn {fmt(UNLOCK_THRESHOLD - credit)} more to unlock withdrawals
            </p>
          )}
          <div style={{display:"flex",gap:"1rem",marginTop:"1.2rem"}}>
            <button className="btn btn-green" style={{flex:1,justifyContent:"center",padding:"0.8rem",fontSize:"0.58rem"}} disabled={!unlocked} onClick={() => setModal("withdraw")}>
              Withdraw Cash
            </button>
            <button className="btn btn-outline" style={{flex:1,justifyContent:"center",padding:"0.8rem",fontSize:"0.58rem"}} disabled={!unlocked} onClick={() => setModal("redeem")}>
              Redeem Product
            </button>
          </div>
        </div>

        {/* REFERRAL HISTORY */}
        {uses.length > 0 && (
          <div className="checkout-card">
            <div className="checkout-card-title">Recent Referrals</div>
            {uses.map((u, i) => (
              <div key={i} className="order-summary-item">
                <span style={{color:"var(--text-muted)",fontSize:"0.8rem"}}>{new Date(u.used_at).toLocaleDateString()}</span>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.75rem"}}>{fmt(u.order_total)}</span>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:"0.75rem",color:"var(--green-bright)"}}>+{fmt(u.referrer_credit)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── ABOUT PAGE ────────────────────────────────────────────────────────────────
function AboutPage() {
  return (
    <div style={{paddingTop:"64px",background:"var(--black)",minHeight:"100vh"}}>
      <div style={{background:"var(--green)",padding:"5rem 2rem",textAlign:"center"}}>
        <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",letterSpacing:"0.5em",color:"rgba(255,255,255,0.6)",marginBottom:"1rem"}}>EST. MMXXV · SURULERE, LAGOS</div>
        <h1 style={{fontFamily:"'Boogaloo',cursive",fontSize:"clamp(3rem,10vw,7rem)",lineHeight:0.9,marginBottom:"1rem"}}>OUR<br/>STORY</h1>
      </div>
      <div style={{maxWidth:"700px",margin:"0 auto",padding:"5rem 2rem"}}>
        <p style={{fontFamily:"'Cormorant Garamond',serif",fontSize:"1.3rem",lineHeight:1.8,color:"rgba(245,245,245,0.85)",marginBottom:"2rem"}}>
          OTG — On To God — started in Surulere, Lagos in 2025. We build streetwear for people who move with purpose. Every piece is a statement.
        </p>
        <p style={{color:"var(--text-muted)",lineHeight:1.8,marginBottom:"2rem"}}>
          We're not here to follow trends. We paint our culture — Nigerian, proud, moving forward. From Surulere to the world.
        </p>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:"1.5rem",marginTop:"3rem"}}>
          {[["2025","Founded in Surulere"],["100%","Premium fabrics"],["✦","On To God"]].map(([v,l]) => (
            <div key={v} style={{textAlign:"center",padding:"2rem 1rem",background:"var(--grey)",border:"1px solid var(--grey3)"}}>
              <div style={{fontFamily:"'Boogaloo',cursive",fontSize:"2.5rem",color:"var(--green-bright)",marginBottom:"0.5rem"}}>{v}</div>
              <div style={{fontFamily:"'Space Mono',monospace",fontSize:"0.58rem",color:"var(--text-muted)",letterSpacing:"0.1em"}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{marginTop:"3rem",display:"flex",gap:"1rem",flexWrap:"wrap"}}>
          <a className="btn btn-green" href="https://instagram.com/o.t.g_ttw" target="_blank" rel="noopener noreferrer">Instagram →</a>
          <a className="btn btn-outline" href="https://wa.me/2348136437912" target="_blank" rel="noopener noreferrer">WhatsApp Us</a>
        </div>
      </div>
    </div>
  );
}

// ── FOOTER ────────────────────────────────────────────────────────────────────
function Footer({ setPage }) {
  return (
    <footer className="footer">
      <div className="footer-grid">
        <div>
          <div className="footer-brand">OT<span>G</span></div>
          <div className="footer-tagline">Wear the Truth. On To God.</div>
          <p style={{color:"var(--text-muted)",fontSize:"0.85rem",marginTop:"1rem",lineHeight:1.6}}>
            Premium streetwear from Surulere, Lagos.<br/>Est. 2025.
          </p>
        </div>
        <div>
          <div className="footer-col-title">Shop</div>
          {["home","shop","creators"].map(p => (
            <span key={p} className="footer-link" onClick={() => setPage(p)}>
              {p === "creators" ? "Creators ✦" : p.charAt(0).toUpperCase()+p.slice(1)}
            </span>
          ))}
        </div>
        <div>
          <div className="footer-col-title">Connect</div>
          <a className="footer-link" href="https://instagram.com/o.t.g_ttw" target="_blank" rel="noopener noreferrer">Instagram</a>
          <a className="footer-link" href="https://twitter.com/otg_ttw" target="_blank" rel="noopener noreferrer">Twitter / X</a>
          <a className="footer-link" href="https://wa.me/2348136437912" target="_blank" rel="noopener noreferrer">WhatsApp</a>
          <a className="footer-link" href="mailto:otgttw.001@gmail.com" target="_blank" rel="noopener noreferrer">Email</a>
        </div>
        <div>
          <div className="footer-col-title">Support</div>
          <span className="footer-link">Shipping Info</span>
          <span className="footer-link">Returns</span>
          <span className="footer-link">Size Guide</span>
          <span className="footer-link" onClick={() => window.open("https://wa.me/2348136437912","_blank")}>Contact Us</span>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2025–2026 OTG – On To God. All rights reserved.</span>
        <span>Surulere, Lagos, Nigeria 🇳🇬</span>
      </div>
    </footer>
  );
}

// ── APP ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("home");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [returnOrder, setReturnOrder] = useState(null);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2800); };

  const addToCart = (item) => {
    setCart(prev => {
      const idx = prev.findIndex(i => i.id === item.id && i.size === item.size);
      if (idx >= 0) { const n = [...prev]; n[idx] = {...n[idx], qty: n[idx].qty + item.qty}; return n; }
      return [...prev, item];
    });
    showToast(`${item.name} added to bag ✦`);
    setCartOpen(true);
  };

  const removeFromCart = (idx) => setCart(prev => prev.filter((_, i) => i !== idx));
  const clearCart = () => setCart([]);
  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  // Paystack redirect handler
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("paid") === "1") {
      const ref = params.get("ref");
      const name = params.get("name");
      const pending = sessionStorage.getItem("otg_pending_order");
      if (pending) {
        try {
          const orderData = JSON.parse(pending);
          processOrder(orderData).then(() => {
            if (orderData.referral_code && orderData.referral_status === "valid") {
              applyReferralReward(orderData.referral_code, orderData.total, orderData.customer_email, ref);
            }
          });
        } catch(e) {}
        sessionStorage.removeItem("otg_pending_order");
      }
      setCart([]);
      window.history.replaceState({}, "", window.location.pathname);
      window.scrollTo(0, 0);
      setReturnOrder({ ref: ref || "", name: decodeURIComponent(name || "") });
      setPage("home");
    }
  }, []);

  useEffect(() => { window.scrollTo(0, 0); }, [page]);

  const showFooter = !["checkout","product"].includes(page);

  return (
    <>
      <style>{GLOBAL_CSS}</style>
      <script src="https://js.paystack.co/v1/inline.js" async />

      <Nav page={page} setPage={(p) => { setPage(p); setMobileOpen(false); }} cartCount={cartCount} openCart={() => setCartOpen(true)} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <CartDrawer cart={cart} open={cartOpen} onClose={() => setCartOpen(false)} removeFromCart={removeFromCart} setPage={setPage} />

      <main>
        {page === "home" && <HomePage setPage={setPage} setSelectedProduct={setSelectedProduct} />}
        {page === "shop" && <ShopPage setPage={setPage} setSelectedProduct={setSelectedProduct} />}
        {page === "product" && selectedProduct && <ProductPage product={selectedProduct} addToCart={(item) => { addToCart(item); showToast(`${item.name} added to bag ✦`); }} setPage={setPage} />}
        {page === "checkout" && <CheckoutPage cart={cart} clearCart={clearCart} setCart={setCart} setPage={setPage} setReturnOrder={setReturnOrder} />}
        {page === "creators" && <CreatorsPage setPage={setPage} />}
        {page === "about" && <AboutPage />}
      </main>

      {showFooter && <Footer setPage={setPage} />}

      <div className={`toast ${toast?"show":""}`}>{toast}</div>
    </>
  );
}
