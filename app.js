/* Ahluwalia Farm shared shop logic: cart, test login, saved addresses, delivery estimate.
   DEMO MODE: the OTP is checked in the browser. Replace verifyOtp() and sendOtp() with a real SMS service (Firebase, MSG91) before launch. */
(() => {
  'use strict';
  const CFG = {
    discount: 0.10,
    freeDeliveryAt: 1000,
    demoOtp: '123456',
    packagingGrams: 350, // glass jar + box, added to each jar for shipping weight
    /* Placeholder courier rates by pincode zone. Replace with your courier's rate card or API (Shiprocket, Delhivery). */
    zones: [
      { name: 'Punjab, Haryana, Chandigarh, HP, J&K', prefixes: ['12', '13', '14', '15', '16', '17', '18', '19'], base: 50, perHalfKg: 15 },
      { name: 'Delhi, UP, Uttarakhand, Rajasthan', prefixes: ['11', '20', '21', '22', '23', '24', '25', '26', '27', '28', '30', '31', '32', '33', '34'], base: 70, perHalfKg: 20 },
      { name: 'Rest of India', prefixes: [], base: 100, perHalfKg: 30 }
    ]
  };
  const get = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return (window.__af || {})[k] ?? d; } };
  const set = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { (window.__af = window.__af || {})[k] = v; } };
  const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const listeners = [];
  const emit = () => listeners.forEach(f => f());

  /* ---------- cart ---------- */
  const cart = {
    items: () => get('af-cart', []),
    count: () => cart.items().reduce((t, i) => t + i.qty, 0),
    add(item) {
      const items = cart.items(), f = items.find(i => i.id === item.id);
      if (f) f.qty += 1; else items.push({ ...item, qty: 1 });
      set('af-cart', items); emit();
    },
    save(items) { set('af-cart', items); emit(); },
    clear() { set('af-cart', []); emit(); },
    subtotal: () => cart.items().reduce((t, i) => t + i.price * i.qty, 0),
    mrpTotal: () => cart.items().reduce((t, i) => t + (i.mrp || i.price) * i.qty, 0),
    weightKg: () => cart.items().reduce((t, i) => t + i.qty * ((i.grams || 500) + CFG.packagingGrams), 0) / 1000
  };

  /* ---------- user ---------- */
  const auth = {
    user: () => get('af-user', null),
    logout() { set('af-user', null); emit(); },
    addresses() { const u = auth.user(); return u ? (get('af-addrs', {})[u.phone] || []) : []; },
    saveAddresses(list) { const u = auth.user(); if (!u) return; const all = get('af-addrs', {}); all[u.phone] = list; set('af-addrs', all); emit(); }
  };

  /* ---------- delivery ---------- */
  const delivery = {
    validPin: p => /^[1-8]\d{5}$/.test(String(p).trim()),
    zone(pin) { const p = String(pin).trim(); return CFG.zones.find(z => z.prefixes.some(x => p.startsWith(x))) || CFG.zones[CFG.zones.length - 1]; },
    quote(pin, subtotal, weightKg) {
      if (!delivery.validPin(pin)) return null;
      const z = delivery.zone(pin);
      const slabs = Math.max(0, Math.ceil((weightKg - 1) / 0.5));
      const charge = z.base + slabs * z.perHalfKg;
      return { zone: z.name, charge, free: subtotal >= CFG.freeDeliveryAt, pay: subtotal >= CFG.freeDeliveryAt ? 0 : charge };
    }
  };

  /* ---------- login modal ---------- */
  const css = `
  .af-modal{position:fixed;inset:0;z-index:100;display:grid;place-items:center;padding:16px;background:rgb(10 14 8 / .72);font-family:"Asta Sans","Noto Sans Gurmukhi",Arial,sans-serif}
  .af-modal[hidden],.af-modal [hidden]{display:none!important}
  .af-card{width:min(100%,420px);background:#1f3f2a;color:#fbf6e9;border:1px solid rgb(251 246 233 / .22);border-radius:22px;padding:26px;display:grid;gap:14px;box-shadow:0 24px 60px rgb(0 0 0 / .45)}
  .af-card h2{margin:0;font-size:28px;font-weight:500;letter-spacing:-.03em;line-height:1.05}
  .af-card p{margin:0;color:#d8d2bd;font-size:15px}
  .af-card label{display:grid;gap:6px;font-size:14px;color:#d8d2bd}
  .af-card input{min-height:50px;padding:0 14px;border-radius:12px;border:1px solid rgb(251 246 233 / .28);background:rgb(0 0 0 / .25);color:#fbf6e9;font:400 18px "Asta Sans",Arial,sans-serif;width:100%}
  .af-card input:focus-visible,.af-card button:focus-visible{outline:2px solid #f4b630;outline-offset:2px}
  .af-row{display:flex;gap:10px}
  .af-cc{display:grid;place-items:center;min-width:58px;border-radius:12px;border:1px solid rgb(251 246 233 / .28);background:rgb(0 0 0 / .25);font-size:18px}
  .af-go{min-height:52px;border:0;border-radius:999px;background:#f4b630;color:#120d05;font:600 17px "Asta Sans",Arial,sans-serif;cursor:pointer}
  .af-go:hover{background:#ffc94f}
  .af-link{background:none;border:0;color:#d8d2bd;text-decoration:underline;text-underline-offset:3px;font:400 14px "Asta Sans",Arial,sans-serif;cursor:pointer;justify-self:start;min-height:36px;padding:0}
  .af-err{color:#ffb4a2;font-size:14px;min-height:0}
  .af-demo{font-size:13px;background:rgb(244 182 48 / .14);border:1px dashed rgb(244 182 48 / .6);border-radius:10px;padding:8px 10px;color:#ffe3a1}
  .af-x{justify-self:end;width:40px;height:40px;border-radius:50%;border:1px solid rgb(251 246 233 / .3);background:transparent;color:#fbf6e9;font-size:20px;cursor:pointer;margin:-8px -8px -6px 0}
  .nav__profile{position:relative;display:inline-grid;place-items:center;width:44px;height:44px;border:1px solid currentColor;border-radius:50%;background:transparent;color:#fbf6e9;cursor:pointer;font:600 17px "Asta Sans",Arial,sans-serif;margin-left:8px;flex:none;text-transform:uppercase}
  .nav__profile svg{width:20px;height:20px;fill:none;stroke:currentColor;stroke-width:1.5}
  .nav__profile.is-in{background:#f4b630;color:#120d05;border-color:#f4b630}
  .af-menu{position:fixed;top:62px;right:max(16px,env(safe-area-inset-right,0px));z-index:90;background:#1f3f2a;color:#fbf6e9;border:1px solid rgb(251 246 233 / .25);border-radius:16px;padding:16px;display:grid;gap:8px;min-width:220px;font:400 15px "Asta Sans",Arial,sans-serif;box-shadow:0 16px 40px rgb(0 0 0 / .4)}
  .af-menu[hidden]{display:none}
  .af-menu a{color:#fbf6e9}
  .af-menu b{font-weight:600;font-size:17px}
  `;
  const style = document.createElement('style'); style.textContent = css; document.head.appendChild(style);

  const modal = document.createElement('div');
  modal.className = 'af-modal'; modal.hidden = true;
  modal.innerHTML = `<div class="af-card" role="dialog" aria-modal="true" aria-labelledby="af-title">
    <button class="af-x" type="button" aria-label="Close">×</button>
    <h2 id="af-title">Log in or sign up</h2>
    <p id="af-sub">Enter your mobile number. We will send you a one-time code.</p>
    <form id="af-f1" novalidate class="af-card" style="padding:0;border:0;background:none;box-shadow:none;width:auto">
      <label for="af-phone">Mobile number<span class="af-row"><span class="af-cc">+91</span><input id="af-phone" type="tel" inputmode="numeric" maxlength="10" autocomplete="tel-national" placeholder="98765 43210"></span></label>
      <p class="af-err" id="af-e1" role="alert"></p>
      <button class="af-go" type="submit">Send code</button>
    </form>
    <form id="af-f2" novalidate hidden class="af-card" style="padding:0;border:0;background:none;box-shadow:none;width:auto">
      <p class="af-demo">Test mode: use code <b>${CFG.demoOtp}</b>. Real SMS codes are switched on at launch.</p>
      <label for="af-otp">6-digit code<input id="af-otp" type="text" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="123456"></label>
      <label for="af-name" id="af-namewrap" hidden>Your name<input id="af-name" type="text" autocomplete="name" placeholder="Full name"></label>
      <p class="af-err" id="af-e2" role="alert"></p>
      <button class="af-go" type="submit">Verify and continue</button>
      <button class="af-link" id="af-back" type="button">Use a different number</button>
    </form>
  </div>`;
  document.body.appendChild(modal);
  const $ = id => modal.querySelector('#' + id);
  let pending = null, phone = '';

  const known = p => get('af-known', {})[p];
  function open(cb, msg) {
    pending = cb || null;
    $('af-f1').hidden = false; $('af-f2').hidden = true; $('af-e1').textContent = ''; $('af-e2').textContent = '';
    $('af-sub').textContent = msg || 'Enter your mobile number. We will send you a one-time code.';
    modal.hidden = false; setTimeout(() => $('af-phone').focus(), 30);
  }
  function close() { modal.hidden = true; pending = null; }
  modal.querySelector('.af-x').onclick = close;
  modal.addEventListener('click', e => { if (e.target === modal) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !modal.hidden) close(); });
  $('af-f1').addEventListener('submit', e => {
    e.preventDefault();
    phone = $('af-phone').value.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(phone)) { $('af-e1').textContent = 'Enter a valid 10-digit Indian mobile number.'; return; }
    $('af-e1').textContent = '';
    $('af-f1').hidden = true; $('af-f2').hidden = false;
    $('af-namewrap').hidden = !!known(phone);
    $('af-sub').textContent = 'Code sent to +91 ' + phone + '.';
    setTimeout(() => $('af-otp').focus(), 30);
  });
  $('af-back').onclick = () => open(pending);
  $('af-f2').addEventListener('submit', e => {
    e.preventDefault();
    if ($('af-otp').value.trim() !== CFG.demoOtp) { $('af-e2').textContent = 'That code is not right. Try again.'; return; }
    let name = known(phone);
    if (!name) {
      name = $('af-name').value.trim();
      if (name.length < 2) { $('af-e2').textContent = 'Please enter your name.'; $('af-name').focus(); return; }
      const k = get('af-known', {}); k[phone] = name; set('af-known', k);
    }
    set('af-user', { phone, name });
    const cb = pending; modal.hidden = true; pending = null; emit();
    if (cb) cb();
  });
  const requireLogin = (cb, msg) => { if (auth.user()) { cb(); } else open(cb, msg); };

  /* ---------- header profile button ---------- */
  const header = document.getElementById('navigation');
  let menu = null;
  if (header) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'nav__profile'; btn.setAttribute('aria-haspopup', 'true');
    const cartLink = header.querySelector('.nav__cart');
    if (cartLink) cartLink.insertAdjacentElement('beforebegin', btn); else header.appendChild(btn);
    menu = document.createElement('div'); menu.className = 'af-menu'; menu.hidden = true; document.body.appendChild(menu);
    const paintBtn = () => {
      const u = auth.user();
      btn.classList.toggle('is-in', !!u);
      btn.innerHTML = u ? '' : '<svg aria-hidden="true" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></svg>';
      if (u) btn.textContent = u.name.trim()[0] || 'A';
      btn.setAttribute('aria-label', u ? 'Profile of ' + u.name : 'Log in or sign up');
    };
    btn.onclick = () => {
      const u = auth.user();
      if (!u) { open(); return; }
      menu.innerHTML = '<b></b><span></span><a href="orders.html">Cart and checkout</a><button class="af-link" type="button">Log out</button>';
      menu.querySelector('b').textContent = u.name; menu.querySelector('span').textContent = '+91 ' + u.phone;
      menu.querySelector('button').onclick = () => { auth.logout(); menu.hidden = true; };
      menu.hidden = !menu.hidden;
    };
    document.addEventListener('click', e => { if (menu && !menu.hidden && !menu.contains(e.target) && e.target !== btn && !btn.contains(e.target)) menu.hidden = true; });
    listeners.push(paintBtn); paintBtn();
  }
  addEventListener('storage', emit);

  window.AF = { CFG, cart, auth, delivery, fmt, requireLogin, openLogin: open, onChange: f => listeners.push(f) };
})();
