'use strict';

// ── DB ──────────────────────────────────────────────────────────────────────
const DB = {
  _data: null,
  KEY: 'et_expenses_v2',
  load() {
    try { this._data = JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { this._data = []; }
    if (!this._data.length) this._seed();
    return this._data;
  },
  save() { localStorage.setItem(this.KEY, JSON.stringify(this._data)); },
  all() { return this._data; },
  add(exp) { this._data.unshift(exp); this.save(); },
  remove(id) { this._data = this._data.filter(e => e.id !== id); this.save(); },
  _seed() {
    const cats = ['Food','Food','Transport','Shopping','Entertainment','Health','Utilities','Food','Shopping','Transport'];
    const notes = ['Lunch','Morning coffee','Uber ride','Groceries','Netflix','Pharmacy','Electric bill','Dinner','Amazon','Gas'];
    const now = new Date();
    for (let i = 0; i < 20; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.floor(Math.random() * 28));
      this._data.push({
        id: Date.now() - i * 1000,
        amount: parseFloat((Math.random() * 90 + 5).toFixed(2)),
        category: cats[i % cats.length],
        note: notes[i % notes.length],
        date: d.toISOString().split('T')[0]
      });
    }
    this._data.sort((a, b) => b.date.localeCompare(a.date));
    this.save();
  }
};

// ── CATEGORIES ───────────────────────────────────────────────────────────────
const CATS = {
  Food:          { emoji: '🍔', color: '#FF9500' },
  Transport:     { emoji: '🚌', color: '#007AFF' },
  Shopping:      { emoji: '🛍️',  color: '#FF2D55' },
  Entertainment: { emoji: '🎬', color: '#AF52DE' },
  Health:        { emoji: '💊', color: '#34C759' },
  Utilities:     { emoji: '💡', color: '#5AC8FA' },
  Education:     { emoji: '📚', color: '#FF6B6B' },
  Travel:        { emoji: '✈️',  color: '#5856D6' },
  Groceries:     { emoji: '🛒', color: '#FF9500' },
  Other:         { emoji: '📦', color: '#8E8E93' },
};
function catInfo(name) { return CATS[name] || CATS.Other; }

// ── CURRENCY ─────────────────────────────────────────────────────────────────
const CURRENCIES = { USD:'$', BDT:'৳', EUR:'€', GBP:'£', JPY:'¥', INR:'₹' };
let currency = localStorage.getItem('et_currency') || 'USD';
function sym() { return CURRENCIES[currency] || '$'; }
function fmt(n) { return sym() + Number(n).toFixed(2); }
function fmtS(n) { return n >= 1000 ? sym() + (n/1000).toFixed(1) + 'k' : sym() + Math.round(n); }

// ── STATE ────────────────────────────────────────────────────────────────────
let currentTab = 0;
let txnFilter = 'all';
let searchQ = '';
let amtStr = '';
let addDate = today();

function today() { return new Date().toISOString().split('T')[0]; }

// ── INIT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  DB.load();
  updateClock();
  setInterval(updateClock, 15000);
  renderAll();
  bindTabs();
  buildKeypad();
  bindAdd();
  bindSettings();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
});

function updateClock() {
  const d = new Date();
  const h = d.getHours() % 12 || 12;
  const m = String(d.getMinutes()).padStart(2, '0');
  document.getElementById('clock').textContent = `${h}:${m}`;
}

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderAnalytics();
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll('.tab-item').forEach(el => {
    el.addEventListener('click', () => switchTab(+el.dataset.tab));
  });
}

function switchTab(n) {
  currentTab = n;
  document.querySelectorAll('.screen').forEach((s, i) => s.classList.toggle('active', i === n));
  document.querySelectorAll('.tab-item').forEach((t, i) => t.classList.toggle('active', i === n));
  if (n === 0) renderDashboard();
  if (n === 1) renderTransactions();
  if (n === 2) renderAnalytics();
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const exps = DB.all();
  const now = new Date();
  const t = today();
  const todayAmt = exps.filter(e => e.date === t).reduce((s, e) => s + e.amount, 0);
  const monthExps = exps.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthAmt = monthExps.reduce((s, e) => s + e.amount, 0);

  document.getElementById('hero-month').textContent = fmt(monthAmt);
  document.getElementById('hero-today').textContent = fmt(todayAmt);
  document.getElementById('hero-count').textContent = exps.length;

  // Sparkline
  const bars = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    bars.push(exps.filter(e => e.date === ds).reduce((s, e) => s + e.amount, 0));
  }
  const mx = Math.max(...bars, 1);
  document.getElementById('sparkline').innerHTML = bars
    .map(v => `<div class="spark-bar" style="height:${Math.max(3, Math.round(v/mx*32))}px"></div>`).join('');

  // Categories
  const catTotals = {};
  monthExps.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const sorted = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const catEl = document.getElementById('cat-list');
  if (!sorted.length) {
    catEl.innerHTML = '<div class="list-row" style="color:var(--label2)">No expenses this month</div>';
  } else {
    catEl.innerHTML = sorted.map(([cat, amt]) => {
      const { emoji, color } = catInfo(cat);
      const pct = monthAmt > 0 ? Math.round(amt / monthAmt * 100) : 0;
      return `<div class="list-row">
        <div class="cat-icon" style="background:${color}22">${emoji}</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:16px;font-weight:500">${cat}</div>
          <div class="prog-wrap"><div class="prog-fill" style="width:${pct}%;background:${color}"></div></div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:16px;font-weight:500">${fmt(amt)}</div>
          <div style="font-size:12px;color:var(--label2)">${pct}%</div>
        </div>
      </div>`;
    }).join('');
  }

  // Recent
  const recent = [...exps].sort((a, b) => b.id - a.id).slice(0, 5);
  const recEl = document.getElementById('recent-list');
  if (!recent.length) {
    recEl.innerHTML = '<div class="list-row" style="color:var(--label2)">No expenses yet — tap + to add</div>';
  } else {
    recEl.innerHTML = recent.map(e => expRow(e)).join('');
  }
}

function expRow(e) {
  const { emoji, color } = catInfo(e.category);
  return `<div class="list-row">
    <div class="cat-icon" style="background:${color}22">${emoji}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.note || e.category}</div>
      <div style="font-size:13px;color:var(--label2)">${e.category} · ${fmtDate(e.date)}</div>
    </div>
    <div style="font-size:16px;font-weight:600;flex-shrink:0">${fmt(e.amount)}</div>
  </div>`;
}

function fmtDate(ds) {
  const t = today();
  const yd = new Date(); yd.setDate(yd.getDate() - 1);
  const yds = yd.toISOString().split('T')[0];
  if (ds === t) return 'Today';
  if (ds === yds) return 'Yesterday';
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
function renderTransactions() {
  let exps = [...DB.all()];
  const now = new Date();
  if (txnFilter === 'week') {
    const wk = new Date(); wk.setDate(wk.getDate() - 7);
    exps = exps.filter(e => new Date(e.date + 'T12:00:00') >= wk);
  } else if (txnFilter === 'month') {
    exps = exps.filter(e => {
      const d = new Date(e.date + 'T12:00:00');
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
  }
  if (searchQ) {
    const q = searchQ.toLowerCase();
    exps = exps.filter(e => (e.note || '').toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  }
  exps.sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  // Group by date
  const groups = {};
  exps.forEach(e => { (groups[e.date] || (groups[e.date] = [])).push(e); });

  const el = document.getElementById('txn-groups');
  if (!exps.length) {
    el.innerHTML = `<div class="empty"><div class="empty-icon">🗂️</div><p>${searchQ ? 'No results found' : 'No expenses yet'}</p></div>`;
    return;
  }

  el.innerHTML = Object.entries(groups)
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([ds, items]) => {
      const dayTotal = items.reduce((s, e) => s + e.amount, 0);
      return `<div class="day-hdr"><span>${fmtDate(ds).toUpperCase()}</span><span>${fmt(dayTotal)}</span></div>
      <div class="card" style="margin-bottom:4px">
        ${items.map(e => txnRow(e)).join('')}
      </div>`;
    }).join('');
}

function txnRow(e) {
  const { emoji, color } = catInfo(e.category);
  return `<div class="list-row" id="row-${e.id}">
    <div class="cat-icon" style="background:${color}22">${emoji}</div>
    <div style="flex:1;min-width:0">
      <div style="font-size:16px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${e.note || e.category}</div>
      <div style="font-size:13px;color:var(--label2)">${e.category}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px;flex-shrink:0">
      <span style="font-size:16px;font-weight:600">${fmt(e.amount)}</span>
      <button onclick="deleteExp(${e.id})" style="width:28px;height:28px;border-radius:50%;border:none;background:var(--red);color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
    </div>
  </div>`;
}

function deleteExp(id) {
  DB.remove(id);
  renderAll();
  toast('Expense deleted');
}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
function renderAnalytics() {
  const exps = DB.all();
  const now = new Date();

  // Daily 7
  const days7 = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    days7.push({ date: d, ds, total: exps.filter(e => e.date === ds).reduce((s, e) => s + e.amount, 0) });
  }
  const mx7 = Math.max(...days7.map(d => d.total), 1);
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const t = today();

  document.getElementById('bar-chart').innerHTML = days7.map(({ date, ds, total }) => {
    const h = Math.max(8, Math.round(total / mx7 * 100));
    const isToday = ds === t;
    return `<div class="bar-col">
      <div class="bar-val">${total > 0 ? fmtS(total) : ''}</div>
      <div class="bar-fill" style="height:${h}px;background:${isToday ? '#007AFF' : '#007AFF44'}"></div>
      <div class="bar-day">${days[date.getDay()]}</div>
    </div>`;
  }).join('');

  // Stats
  const monthExps = exps.filter(e => {
    const d = new Date(e.date + 'T12:00:00');
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const monthAmt = monthExps.reduce((s, e) => s + e.amount, 0);
  const avgD = days7.reduce((s, d) => s + d.total, 0) / 7;
  const highD = Math.max(...days7.map(d => d.total), 0);
  const catTotals = {};
  exps.forEach(e => { catTotals[e.category] = (catTotals[e.category] || 0) + e.amount; });
  const sortedCats = Object.entries(catTotals).sort((a, b) => b[1] - a[1]);
  const topCat = sortedCats[0] ? `${catInfo(sortedCats[0][0]).emoji} ${sortedCats[0][0]}` : '—';

  document.getElementById('stat-avg').textContent = fmtS(avgD);
  document.getElementById('stat-high').textContent = fmtS(highD);
  document.getElementById('stat-month').textContent = fmtS(monthAmt);
  document.getElementById('stat-top').textContent = topCat;

  // Donut
  drawDonut(sortedCats);

  // Legend
  const total = sortedCats.reduce((s, [, v]) => s + v, 0) || 1;
  document.getElementById('legend').innerHTML = sortedCats.map(([cat, amt]) => {
    const { emoji, color } = catInfo(cat);
    return `<div class="legend-row">
      <div class="legend-dot" style="background:${color}"></div>
      <div style="flex:1;font-size:14px">${emoji} ${cat}</div>
      <div style="font-size:13px;color:var(--label2);margin-right:10px">${Math.round(amt/total*100)}%</div>
      <div style="font-size:14px;font-weight:500">${fmt(amt)}</div>
    </div>`;
  }).join('');

  // Monthly trend
  const months5 = [];
  const mNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  for (let i = 4; i >= 0; i--) {
    const d = new Date(); d.setMonth(d.getMonth() - i);
    const mExps = exps.filter(e => {
      const ed = new Date(e.date + 'T12:00:00');
      return ed.getFullYear() === d.getFullYear() && ed.getMonth() === d.getMonth();
    });
    months5.push({ label: mNames[d.getMonth()], total: mExps.reduce((s, e) => s + e.amount, 0) });
  }
  const mMax = Math.max(...months5.map(m => m.total), 1);
  document.getElementById('monthly-chart').innerHTML = months5.map(({ label, total }) => {
    const h = Math.max(4, Math.round(total / mMax * 70));
    return `<div class="m-col">
      <div class="m-val">${total > 0 ? fmtS(total) : ''}</div>
      <div class="m-fill" style="height:${h}px"></div>
      <div class="m-label">${label}</div>
    </div>`;
  }).join('');
}

function drawDonut(sortedCats) {
  const canvas = document.getElementById('donut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = 160, cx = 80, cy = 80, r = 62, ir = 40;
  ctx.clearRect(0, 0, W, W);
  const total = sortedCats.reduce((s, [, v]) => s + v, 0) || 1;
  let angle = -Math.PI / 2;
  if (!sortedCats.length) {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = '#E5E5EA'; ctx.fill();
  } else {
    sortedCats.forEach(([cat, amt]) => {
      const sweep = (amt / total) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, angle, angle + sweep);
      ctx.closePath();
      ctx.fillStyle = catInfo(cat).color;
      ctx.fill();
      angle += sweep;
    });
  }
  // Detect dark mode for inner circle
  const dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI*2);
  ctx.fillStyle = dark ? '#2C2C2E' : '#FFFFFF';
  ctx.fill();
}

// ── ADD EXPENSE ───────────────────────────────────────────────────────────────
function buildKeypad() {
  const keys = [['1','2','3'],['4','5','6'],['7','8','9'],['.','0','⌫']];
  document.getElementById('keypad').innerHTML = keys.flat().map(k =>
    `<button class="key${k==='⌫'||k==='.'?` op`:''}" onclick="keyPress('${k}')">${k}</button>`
  ).join('');
}

function keyPress(k) {
  if (k === '⌫') { amtStr = amtStr.slice(0, -1); }
  else if (k === '.') { if (!amtStr.includes('.')) amtStr += amtStr === '' ? '0.' : '.'; }
  else { if (amtStr.length < 9) amtStr += k; }
  updateAmtDisplay();
}

function updateAmtDisplay() {
  const v = amtStr || '0';
  document.getElementById('amt-disp').textContent = v;
}

function bindAdd() {
  document.getElementById('add-sheet').addEventListener('click', e => {
    if (e.target === document.getElementById('add-sheet')) closeAdd();
  });
  // date default
  document.getElementById('add-date').value = today();
}

function openAdd() {
  amtStr = '';
  updateAmtDisplay();
  document.getElementById('add-note').value = '';
  document.getElementById('add-cat').value = 'Food';
  document.getElementById('add-date').value = today();
  document.getElementById('add-sheet').classList.add('open');
}

function closeAdd() {
  document.getElementById('add-sheet').classList.remove('open');
}

function saveExpense() {
  const amt = parseFloat(amtStr);
  if (!amt || amt <= 0) {
    document.getElementById('amt-disp').style.color = 'var(--red)';
    setTimeout(() => document.getElementById('amt-disp').style.color = '', 600);
    return;
  }
  const cat = document.getElementById('add-cat').value || 'Other';
  const note = document.getElementById('add-note').value.trim() || cat;
  const date = document.getElementById('add-date').value || today();
  DB.add({ id: Date.now(), amount: amt, category: cat, note, date });
  closeAdd();
  renderAll();
  toast('Expense added ✓');
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function bindSettings() {
  document.getElementById('currency-select').value = currency;
  document.getElementById('currency-select').addEventListener('change', e => {
    currency = e.target.value;
    localStorage.setItem('et_currency', currency);
    renderAll();
    toast('Currency updated');
  });
  document.querySelectorAll('.toggle').forEach(t => {
    t.addEventListener('click', () => { t.classList.toggle('on'); t.classList.toggle('off'); });
  });
}

function exportCSV() {
  const rows = ['Date,Amount,Category,Note',
    ...DB.all().map(e => `${e.date},${e.amount},${e.category},"${(e.note||'').replace(/"/g,'""')}"`)
  ];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `expenses_${today()}.csv`;
  a.click();
  toast('CSV exported ✓');
}

function clearAllData() {
  if (!confirm('Delete all expense data? This cannot be undone.')) return;
  localStorage.removeItem('et_expenses_v2');
  DB._data = [];
  renderAll();
  toast('All data cleared');
}

// ── SEARCH / FILTER ───────────────────────────────────────────────────────────
function setFilter(f, btn) {
  txnFilter = f;
  document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTransactions();
}

function onSearch(val) {
  searchQ = val;
  renderTransactions();
}

// ── TOAST ────────────────────────────────────────────────────────────────────
let _toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}
