'use strict';

// ── DB ───────────────────────────────────────────────────────────────────────
const DB = {
  KEY: 'et_v3',
  _d: null,
  load() {
    try { this._d = JSON.parse(localStorage.getItem(this.KEY)) || []; }
    catch { this._d = []; }
    if (!this._d.length) this._seed();
    return this._d;
  },
  save() { localStorage.setItem(this.KEY, JSON.stringify(this._d)); },
  all() { return this._d; },
  add(e) { this._d.unshift(e); this.save(); },
  del(id) { this._d = this._d.filter(e => e.id !== id); this.save(); },
  _seed() {
    const rows = [
      ['Lunch', 'Food', 12.5], ['Uber', 'Transport', 8.0], ['Netflix', 'Entertainment', 15.99],
      ['Groceries', 'Groceries', 45.3], ['Pharmacy', 'Health', 22.0], ['Coffee', 'Food', 4.5],
      ['Amazon', 'Shopping', 38.0], ['Electric bill', 'Utilities', 60.0], ['Dinner out', 'Food', 32.0],
      ['Bus pass', 'Transport', 18.0], ['Gym', 'Health', 30.0], ['Books', 'Education', 25.0],
    ];
    const now = new Date();
    rows.forEach(([note, cat, amt], i) => {
      const d = new Date(now);
      d.setDate(d.getDate() - Math.floor(i * 2.3));
      this._d.push({ id: Date.now() - i * 3600000, amount: amt, category: cat, note, date: d.toISOString().split('T')[0] });
    });
    this.save();
  }
};

// ── CATEGORIES ───────────────────────────────────────────────────────────────
const CATS = {
  Food:          { emoji: '🍔', color: '#FF9500' },
  Transport:     { emoji: '🚌', color: '#007AFF' },
  Shopping:      { emoji: '🛍️', color: '#FF2D55' },
  Entertainment: { emoji: '🎬', color: '#AF52DE' },
  Health:        { emoji: '💊', color: '#30D158' },
  Utilities:     { emoji: '💡', color: '#5AC8FA' },
  Education:     { emoji: '📚', color: '#FF6B6B' },
  Travel:        { emoji: '✈️', color: '#5856D6' },
  Groceries:     { emoji: '🛒', color: '#FF9F0A' },
  Other:         { emoji: '📦', color: '#8E8E93' },
};
function ci(name) { return CATS[name] || CATS.Other; }

// ── CURRENCY ─────────────────────────────────────────────────────────────────
const SYMS = { USD:'$', BDT:'৳', EUR:'€', GBP:'£', JPY:'¥', INR:'₹' };
let currency = localStorage.getItem('et_currency') || 'USD';
const sym = () => SYMS[currency] || '$';
const fmt = n => sym() + Number(n).toFixed(2);
const fmtS = n => n >= 1000 ? sym() + (n/1000).toFixed(1) + 'k' : sym() + Math.round(n);

// ── HELPERS ───────────────────────────────────────────────────────────────────
function today() { return new Date().toISOString().split('T')[0]; }
function fmtDate(ds) {
  const t = today();
  const yd = new Date(); yd.setDate(yd.getDate()-1);
  const yds = yd.toISOString().split('T')[0];
  if (ds === t) return 'Today';
  if (ds === yds) return 'Yesterday';
  const d = new Date(ds + 'T12:00:00');
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
}

// ── STATE ─────────────────────────────────────────────────────────────────────
let txnFilter = 'all', searchQ = '';

// ── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  DB.load();
  renderAll();
  bindTabs();
  bindSettings();
  document.getElementById('add-date').value = today();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(()=>{});
});

function renderAll() {
  renderDashboard();
  renderTransactions();
  renderAnalytics();
  updateSymbols();
}

function updateSymbols() {
  document.getElementById('hero-sym').textContent = sym();
}

// ── TABS ─────────────────────────────────────────────────────────────────────
function bindTabs() {
  document.querySelectorAll('.tab-item').forEach(el => {
    el.addEventListener('click', () => switchTab(+el.dataset.tab));
  });
}
function switchTab(n) {
  document.querySelectorAll('.screen').forEach((s,i) => s.classList.toggle('active', i===n));
  document.querySelectorAll('.tab-item').forEach((t,i) => t.classList.toggle('active', i===n));
  // hide FAB on settings
  document.querySelector('.fab').style.display = n === 3 ? 'none' : 'flex';
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDashboard() {
  const exps = DB.all();
  const DAY_MS = 86400000;
  const now = new Date();
  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Build 7-day data starting from Sunday of this week
  const todayD = new Date(today() + 'T12:00:00');
  const dayOfWeek = todayD.getDay(); // 0=Sun
  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayD);
    d.setDate(d.getDate() - dayOfWeek + i);
    const ds = d.toISOString().split('T')[0];
    const total = exps.filter(e => e.date === ds).reduce((s,e)=>s+e.amount, 0);
    weekDays.push({ ds, label: dayNames[d.getDay()], total, isToday: ds === today() });
  }

  const weekTotal = weekDays.reduce((s,d)=>s+d.total, 0);
  document.getElementById('hero-val').textContent = weekTotal.toFixed(2);

  // Chart grid lines
  const mx = Math.max(...weekDays.map(d=>d.total), 1);
  const gridSteps = [0, Math.round(mx*0.5/10)*10, Math.round(mx/10)*10].filter((v,i,a)=>a.indexOf(v)===i);
  document.getElementById('chart-grid').innerHTML = '';

  // Bars
  document.getElementById('bars-row').innerHTML = weekDays.map(({ total, isToday }) => {
    const h = mx > 0 ? Math.max(3, Math.round(total/mx * 130)) : 3;
    return `<div class="bar-col">
      <div class="bar-fill ${isToday?'today':'other'}" style="height:${h}px"></div>
    </div>`;
  }).join('');

  // Day labels
  document.getElementById('days-row').innerHTML = weekDays.map(({ label }) =>
    `<div class="day-lbl">${label}</div>`
  ).join('');

  // Group recent expenses by date
  const sorted = [...exps].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  const groups = {};
  sorted.slice(0, 15).forEach(e => { (groups[e.date]||(groups[e.date]=[])).push(e); });

  const el = document.getElementById('dash-groups');
  if (!sorted.length) {
    el.innerHTML = '<div style="text-align:center;padding:30px 20px;color:var(--text2)"><div style="font-size:40px;margin-bottom:8px">💸</div><p style="font-size:15px">No expenses yet — tap + to add</p></div>';
    return;
  }
  el.innerHTML = Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([ds, items]) => `
    <div class="section-title">${fmtDate(ds)}</div>
    ${items.map(e => expRowHTML(e)).join('')}
  `).join('');

  // Bind delete buttons
  bindDeleteBtns();
}

function expRowHTML(e) {
  const { emoji, color } = ci(e.category);
  return `<div class="exp-row" id="row-${e.id}">
    <div class="exp-icon">
      <svg width="22" height="16" fill="none" viewBox="0 0 24 18">
        <rect x="1" y="3" width="22" height="14" rx="3" stroke="white" stroke-width="1.5"/>
        <path d="M1 7h22" stroke="white" stroke-width="1.5"/>
        <rect x="4" y="11" width="4" height="2" rx="1" fill="white"/>
      </svg>
    </div>
    <div class="exp-info">
      <div class="exp-title">${e.note || e.category}</div>
      <div class="exp-date">${fmtDate(e.date)}</div>
    </div>
    <div style="display:flex;align-items:center;gap:10px">
      <div class="exp-amount">${fmt(e.amount)}</div>
      <button onclick="delExp(${e.id})" style="width:26px;height:26px;border-radius:50%;border:none;background:rgba(255,68,58,0.2);color:#FF453A;cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;flex-shrink:0">✕</button>
    </div>
  </div>`;
}

function bindDeleteBtns() {} // inline onclick handles it

function delExp(id) {
  DB.del(id);
  renderAll();
  toast('Deleted');
}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
function renderTransactions() {
  let exps = [...DB.all()];
  const now = new Date();
  if (txnFilter === 'week') {
    const wk = new Date(); wk.setDate(wk.getDate()-7);
    exps = exps.filter(e => new Date(e.date+'T12:00:00') >= wk);
  } else if (txnFilter === 'month') {
    exps = exps.filter(e => {
      const d = new Date(e.date+'T12:00:00');
      return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
    });
  }
  if (searchQ) {
    const q = searchQ.toLowerCase();
    exps = exps.filter(e => (e.note||'').toLowerCase().includes(q) || e.category.toLowerCase().includes(q));
  }
  exps.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);

  const groups = {};
  exps.forEach(e => { (groups[e.date]||(groups[e.date]=[])).push(e); });

  const el = document.getElementById('txn-groups');
  if (!exps.length) {
    el.innerHTML = '<div class="empty"><div class="empty-icon">🗂️</div><p>No expenses found</p></div>';
    return;
  }
  el.innerHTML = Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0])).map(([ds, items]) => `
    <div class="day-group-title">${fmtDate(ds)}</div>
    ${items.map(e => expRowHTML(e)).join('')}
  `).join('');
}

function setFilter(f, btn) {
  txnFilter = f;
  document.querySelectorAll('.filter-pill').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderTransactions();
}

function onSearch(v) { searchQ = v; renderTransactions(); }

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
function renderAnalytics() {
  const exps = DB.all();
  const now = new Date();
  const monthExps = exps.filter(e => {
    const d = new Date(e.date+'T12:00:00');
    return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
  });
  const monthAmt = monthExps.reduce((s,e)=>s+e.amount, 0);

  const days7 = [];
  for (let i=6;i>=0;i--) {
    const d=new Date(); d.setDate(d.getDate()-i);
    const ds=d.toISOString().split('T')[0];
    days7.push(exps.filter(e=>e.date===ds).reduce((s,e)=>s+e.amount,0));
  }
  const avgD = days7.reduce((s,v)=>s+v,0)/7;
  const highD = Math.max(...days7,0);

  const catTotals = {};
  exps.forEach(e => { catTotals[e.category]=(catTotals[e.category]||0)+e.amount; });
  const sortedCats = Object.entries(catTotals).sort((a,b)=>b[1]-a[1]);
  const topCat = sortedCats[0] ? `${ci(sortedCats[0][0]).emoji} ${sortedCats[0][0]}` : '—';

  document.getElementById('stat-grid').innerHTML = [
    ['Avg Daily', fmtS(avgD)],
    ['Highest Day', fmtS(highD)],
    ['This Month', fmtS(monthAmt)],
    ['Top Category', topCat],
  ].map(([l,v]) => `<div class="stat-box"><div class="stat-box-label">${l}</div><div class="stat-box-val" style="font-size:${v.length>8?'16px':'22px'}">${v}</div></div>`).join('');

  // Donut
  drawDonut(sortedCats);
  const total = sortedCats.reduce((s,[,v])=>s+v,0)||1;
  document.getElementById('legend').innerHTML = sortedCats.map(([cat,amt])=>{
    const { emoji, color } = ci(cat);
    return `<div class="legend-row">
      <div class="legend-dot" style="background:${color}"></div>
      <div style="flex:1;font-size:14px">${emoji} ${cat}</div>
      <div style="font-size:12px;color:var(--text2);margin-right:10px">${Math.round(amt/total*100)}%</div>
      <div style="font-size:14px;font-weight:600">${fmt(amt)}</div>
    </div>`;
  }).join('');

  // Monthly
  const mNames=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const months5 = [];
  for(let i=4;i>=0;i--){
    const d=new Date(); d.setMonth(d.getMonth()-i);
    const mE=exps.filter(e=>{const ed=new Date(e.date+'T12:00:00');return ed.getFullYear()===d.getFullYear()&&ed.getMonth()===d.getMonth();});
    months5.push({label:mNames[d.getMonth()],total:mE.reduce((s,e)=>s+e.amount,0)});
  }
  const mMax=Math.max(...months5.map(m=>m.total),1);
  document.getElementById('monthly-chart').innerHTML=months5.map(({label,total})=>{
    const h=Math.max(4,Math.round(total/mMax*80));
    return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;justify-content:flex-end;height:100%">
      <div style="font-size:9px;color:var(--text2)">${total>0?fmtS(total):''}</div>
      <div style="width:100%;height:${h}px;border-radius:4px 4px 0 0;background:rgba(48,209,88,0.5)"></div>
      <div style="font-size:10px;color:var(--text2)">${label}</div>
    </div>`;
  }).join('');
}

function drawDonut(sortedCats) {
  const canvas = document.getElementById('donut');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W=160, cx=80, cy=80, r=62, ir=42;
  ctx.clearRect(0,0,W,W);
  const total=sortedCats.reduce((s,[,v])=>s+v,0)||1;
  let angle=-Math.PI/2;
  if (!sortedCats.length) {
    ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle='#3A3A3C';ctx.fill();
  } else {
    sortedCats.forEach(([cat,amt])=>{
      const sweep=(amt/total)*Math.PI*2;
      ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,angle,angle+sweep);ctx.closePath();
      ctx.fillStyle=ci(cat).color;ctx.fill();
      angle+=sweep;
    });
  }
  ctx.beginPath();ctx.arc(cx,cy,ir,0,Math.PI*2);ctx.fillStyle='#1C1C1E';ctx.fill();
}

// ── ADD EXPENSE ───────────────────────────────────────────────────────────────
function openAdd() {
  document.getElementById('add-title').value = '';
  document.getElementById('add-amount').value = '';
  document.getElementById('add-cat').value = 'Food';
  document.getElementById('add-date').value = today();
  document.getElementById('add-modal').classList.add('open');
  setTimeout(() => document.getElementById('add-title').focus(), 350);
}

function closeAdd() {
  document.getElementById('add-modal').classList.remove('open');
}

function saveExpense() {
  const title = document.getElementById('add-title').value.trim();
  const amt = parseFloat(document.getElementById('add-amount').value);
  const cat = 'Other';
  const date = document.getElementById('add-date').value || today();

  if (!title) {
    document.getElementById('add-title').style.borderBottom = '1px solid #FF453A';
    setTimeout(()=>document.getElementById('add-title').style.borderBottom='',1500);
    return;
  }
  if (!amt || amt <= 0) {
    document.getElementById('add-amount').style.color = '#FF453A';
    setTimeout(()=>document.getElementById('add-amount').style.color='',1500);
    return;
  }

  DB.add({ id: Date.now(), amount: amt, category: cat, note: title, date });
  closeAdd();
  renderAll();
  toast('Expense added ✓');
}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function bindSettings() {
  const sel = document.getElementById('currency-select');
  sel.value = currency;
  sel.addEventListener('change', e => {
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
  const rows = ['Date,Amount,Category,Title',
    ...DB.all().map(e=>`${e.date},${e.amount},${e.category},"${(e.note||'').replace(/"/g,'""')}"`)
  ];
  const blob = new Blob([rows.join('\n')], {type:'text/csv'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `expenses_${today()}.csv`;
  a.click();
  toast('CSV exported ✓');
}

function clearAllData() {
  if (!confirm('Delete all expense data? This cannot be undone.')) return;
  localStorage.removeItem('et_v3');
  DB._d = [];
  renderAll();
  toast('All data cleared');
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let _tt;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove('show'), 2200);
}
