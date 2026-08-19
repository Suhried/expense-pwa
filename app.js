'use strict';

// ── DB ────────────────────────────────────────────────────────────────────────
const DB={
  KEY:'et_v4',_d:null,
  load(){try{this._d=JSON.parse(localStorage.getItem(this.KEY))||[];}catch{this._d=[];}if(!this._d.length)this._seed();},
  save(){localStorage.setItem(this.KEY,JSON.stringify(this._d));},
  all(){return this._d;},
  add(e){this._d.unshift(e);this.save();},
  del(id){this._d=this._d.filter(e=>e.id!==id);this.save();},
  _seed(){
    const rows=[['Lunch',12.5],['Uber',8.0],['Netflix',15.99],['Groceries',45.3],
      ['Pharmacy',22.0],['Coffee',4.5],['Amazon',38.0],['Electric bill',60.0],
      ['Dinner out',32.0],['Bus pass',18.0],['Gym',30.0],['Books',25.0]];
    const now=new Date();
    rows.forEach(([note,amt],i)=>{
      const d=new Date(now);d.setDate(d.getDate()-Math.floor(i*2.3));
      this._d.push({id:Date.now()-i*3600000,amount:amt,note,date:d.toISOString().split('T')[0]});
    });
    this.save();
  }
};

// ── CURRENCY ──────────────────────────────────────────────────────────────────
const SYMS={USD:'$',BDT:'৳',EUR:'€',GBP:'£',JPY:'¥',INR:'₹'};
let currency=localStorage.getItem('et_cur')||'USD';
const sym=()=>SYMS[currency]||'$';
const fmt=n=>sym()+Number(n).toFixed(2);
const fmtS=n=>n>=1000?sym()+(n/1000).toFixed(1)+'k':sym()+Math.round(n);
function today(){return new Date().toISOString().split('T')[0];}
function fmtDate(ds){
  const t=today();
  const yd=new Date();yd.setDate(yd.getDate()-1);
  const yds=yd.toISOString().split('T')[0];
  if(ds===t)return'Today';
  if(ds===yds)return'Yesterday';
  return new Date(ds+'T12:00:00').toLocaleDateString('en-US',{day:'numeric',month:'short',year:'numeric'});
}

let filter='all',search='';

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded',()=>{
  DB.load();
  document.getElementById('f-date').value=today();
  document.getElementById('cur-sel').value=currency;

  // Currency change
  document.getElementById('cur-sel').addEventListener('change',e=>{
    currency=e.target.value;localStorage.setItem('et_cur',currency);renderAll();toast('Currency updated');
  });

  // Toggles
  document.querySelectorAll('.tog').forEach(t=>{
    t.addEventListener('click',()=>{t.classList.toggle('on');t.classList.toggle('off');});
  });

  // Tabs
  document.querySelectorAll('.ti').forEach(el=>{
    el.addEventListener('click',()=>switchTab(+el.dataset.tab));
  });

  // Scroll-linked FAB hide/show
  ['scr0','scr1'].forEach(id=>{
    const el=document.getElementById(id);
    if(!el)return;
    let lastY=0;
    el.addEventListener('scroll',()=>{
      const fab=document.getElementById('fab');
      const dy=el.scrollTop-lastY;
      lastY=el.scrollTop;
      if(dy>10){fab.style.transform='scale(0) translateY(20px)';fab.style.opacity='0';}
      else if(dy<-5){fab.style.transform='scale(1) translateY(0)';fab.style.opacity='1';}
    },{passive:true});
  });

  renderAll();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
});

function renderAll(){renderDash();renderTxns();renderAnalytics();}

// ── TABS ──────────────────────────────────────────────────────────────────────
let currentTab=0;
function switchTab(n){
  const screens=document.querySelectorAll('.screen');
  screens.forEach((s,i)=>{
    s.classList.remove('active','left');
    if(i===n)s.classList.add('active');
    else if(i<n)s.classList.add('left');
  });
  document.querySelectorAll('.ti').forEach((t,i)=>t.classList.toggle('active',i===n));
  // Show/hide FAB — hide on settings
  const fab=document.getElementById('fab');
  fab.style.display=n===3?'none':'flex';
  fab.style.transform='scale(1) translateY(0)';
  fab.style.opacity='1';
  currentTab=n;
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function renderDash(){
  const exps=DB.all();
  document.getElementById('d-sym').textContent=sym();

  const DAY=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const todayD=new Date(today()+'T12:00:00');
  const dow=todayD.getDay();
  const week=[];
  for(let i=0;i<7;i++){
    const d=new Date(todayD);d.setDate(d.getDate()-dow+i);
    const ds=d.toISOString().split('T')[0];
    week.push({ds,lbl:DAY[i],total:exps.filter(e=>e.date===ds).reduce((s,e)=>s+e.amount,0),isT:ds===today()});
  }
  const wTotal=week.reduce((s,d)=>s+d.total,0);
  document.getElementById('d-amt').textContent=wTotal.toFixed(2);

  const mx=Math.max(...week.map(d=>d.total),1);
  document.getElementById('d-bars').innerHTML=week.map(({total,isT})=>{
    const h=Math.max(4,Math.round(total/mx*84));
    return`<div class="bc"><div class="bf ${isT?'t':'o'}" style="height:${h}px"></div></div>`;
  }).join('');
  document.getElementById('d-days').innerHTML=week.map(({lbl})=>`<div class="dl">${lbl}</div>`).join('');

  const sorted=[...exps].sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  if(!sorted.length){
    document.getElementById('d-groups').innerHTML='<div class="empty"><div class="ei">💸</div><p>Tap + to add your first expense</p></div>';
    return;
  }
  const groups={};
  sorted.slice(0,30).forEach(e=>{(groups[e.date]||(groups[e.date]=[])).push(e);});
  document.getElementById('d-groups').innerHTML=Object.entries(groups)
    .sort((a,b)=>b[0].localeCompare(a[0]))
    .map(([ds,items])=>`<div class="grp">${fmtDate(ds)}</div>${items.map((e,i)=>eHTML(e,i)).join('')}`)
    .join('');
}

function eHTML(e,i=0){
  return`<div class="er" style="animation-delay:${i*40}ms">
    <div class="eico">💳</div>
    <div class="einf">
      <div class="etitle">${e.note||'Expense'}</div>
      <div class="esub">${fmtDate(e.date)}</div>
    </div>
    <div class="eright">
      <div class="eamt">${fmt(e.amount)}</div>
      <button class="dbtn" onclick="delExp(${e.id})">✕</button>
    </div>
  </div>`;
}

function delExp(id){DB.del(id);renderAll();toast('Deleted');}

// ── TRANSACTIONS ──────────────────────────────────────────────────────────────
function renderTxns(){
  let exps=[...DB.all()];
  const now=new Date();
  if(filter==='week'){const wk=new Date();wk.setDate(wk.getDate()-7);exps=exps.filter(e=>new Date(e.date+'T12:00:00')>=wk);}
  else if(filter==='month'){exps=exps.filter(e=>{const d=new Date(e.date+'T12:00:00');return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();});}
  if(search){const q=search.toLowerCase();exps=exps.filter(e=>(e.note||'').toLowerCase().includes(q));}
  exps.sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id);
  const groups={};
  exps.forEach(e=>{(groups[e.date]||(groups[e.date]=[])).push(e);});
  const el=document.getElementById('t-groups');
  if(!exps.length){el.innerHTML='<div class="empty"><div class="ei">🗂️</div><p>No expenses found</p></div>';return;}
  el.innerHTML=Object.entries(groups).sort((a,b)=>b[0].localeCompare(a[0]))
    .map(([ds,items])=>`<div class="grp">${fmtDate(ds)}</div>${items.map((e,i)=>eHTML(e,i)).join('')}`).join('');
}

function setFil(f,btn){
  filter=f;
  document.querySelectorAll('.fpill').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderTxns();
}
function onSearch(v){search=v;renderTxns();}

// ── ANALYTICS ─────────────────────────────────────────────────────────────────
const CLRS=['#FF9500','#007AFF','#FF2D55','#AF52DE','#30D158','#5AC8FA','#FF6B6B','#5856D6'];

function renderAnalytics(){
  const exps=DB.all();
  const now=new Date();
  const mE=exps.filter(e=>{const d=new Date(e.date+'T12:00:00');return d.getFullYear()===now.getFullYear()&&d.getMonth()===now.getMonth();});
  const mAmt=mE.reduce((s,e)=>s+e.amount,0);
  const days7=[];
  for(let i=6;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);const ds=d.toISOString().split('T')[0];days7.push(exps.filter(e=>e.date===ds).reduce((s,e)=>s+e.amount,0));}
  const avgD=days7.reduce((s,v)=>s+v,0)/7;
  const highD=Math.max(...days7,0);

  document.getElementById('a-stats').innerHTML=[
    ['Avg Daily',fmtS(avgD)],['Highest Day',fmtS(highD)],
    ['This Month',fmtS(mAmt)],['Total',exps.length+''],
  ].map(([l,v])=>`<div class="sbox"><div class="slbl">${l}</div><div class="sval" style="font-size:${v.length>7?'16px':'22px'}">${v}</div></div>`).join('');

  const cats={};
  exps.forEach(e=>{const c=(e.note||'Other').split(' ')[0];cats[c]=(cats[c]||0)+e.amount;});
  const sc=Object.entries(cats).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const total=sc.reduce((s,[,v])=>s+v,0)||1;

  // Donut
  const canvas=document.getElementById('donut');
  const ctx=canvas.getContext('2d');
  const W=160,cx=80,cy=80,r=64,ir=42;
  ctx.clearRect(0,0,W,W);
  if(!sc.length){ctx.beginPath();ctx.arc(cx,cy,r,0,Math.PI*2);ctx.fillStyle='#3A3A3C';ctx.fill();}
  else{let a=-Math.PI/2;sc.forEach(([,amt],i)=>{const sw=(amt/total)*Math.PI*2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.arc(cx,cy,r,a,a+sw);ctx.closePath();ctx.fillStyle=CLRS[i%CLRS.length];ctx.fill();a+=sw;});}
  ctx.beginPath();ctx.arc(cx,cy,ir,0,Math.PI*2);ctx.fillStyle='#1C1C1E';ctx.fill();

  document.getElementById('a-leg').innerHTML=sc.map(([cat,amt],i)=>`
    <div class="legrow">
      <div class="legdot" style="background:${CLRS[i%CLRS.length]}"></div>
      <div style="flex:1;font-size:15px">${cat}</div>
      <div style="font-size:13px;color:var(--text2);margin-right:8px">${Math.round(amt/total*100)}%</div>
      <div style="font-size:14px;font-weight:600">${fmt(amt)}</div>
    </div>`).join('');

  const MN=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const m5=[];
  for(let i=4;i>=0;i--){const d=new Date();d.setMonth(d.getMonth()-i);m5.push({lbl:MN[d.getMonth()],total:exps.filter(e=>{const ed=new Date(e.date+'T12:00:00');return ed.getFullYear()===d.getFullYear()&&ed.getMonth()===d.getMonth();}).reduce((s,e)=>s+e.amount,0)});}
  const mMx=Math.max(...m5.map(m=>m.total),1);
  document.getElementById('a-mon').innerHTML=m5.map(({lbl,total})=>{
    const h=Math.max(4,Math.round(total/mMx*85));
    return`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;justify-content:flex-end;height:100%"><div style="font-size:9px;color:var(--text2)">${total>0?fmtS(total):''}</div><div style="width:100%;height:${h}px;border-radius:5px 5px 0 0;background:rgba(48,209,88,.45)"></div><div style="font-size:11px;color:var(--text2)">${lbl}</div></div>`;
  }).join('');
}

// ── ADD ───────────────────────────────────────────────────────────────────────
function openAdd(){
  document.getElementById('f-title').value='';
  document.getElementById('f-amt').value='';
  document.getElementById('f-date').value=today();
  document.getElementById('modal').classList.add('open');
  setTimeout(()=>document.getElementById('f-title').focus(),340);
}
function closeAdd(){document.getElementById('modal').classList.remove('open');}
function saveExp(){
  const title=document.getElementById('f-title').value.trim();
  const amt=parseFloat(document.getElementById('f-amt').value);
  const date=document.getElementById('f-date').value||today();
  if(!title){flash('f-title');return;}
  if(!amt||amt<=0){flash('f-amt');return;}
  DB.add({id:Date.now(),amount:amt,note:title,date});
  closeAdd();renderAll();toast('Expense added ✓');
}
function flash(id){const el=document.getElementById(id);el.style.color='#FF453A';setTimeout(()=>el.style.color='',1200);}

// ── SETTINGS ─────────────────────────────────────────────────────────────────
function exportCSV(){
  const rows=['Date,Amount,Title',...DB.all().map(e=>`${e.date},${e.amount},"${(e.note||'').replace(/"/g,'""')}"`)];
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.join('\n')],{type:'text/csv'}));a.download=`expenses_${today()}.csv`;a.click();
  toast('CSV exported ✓');
}
function clearAll(){
  if(!confirm('Delete all expense data? Cannot be undone.'))return;
  localStorage.removeItem('et_v4');DB._d=[];renderAll();toast('Cleared');
}

// ── TOAST ─────────────────────────────────────────────────────────────────────
let _tt;
function toast(msg){const el=document.getElementById('toast');el.textContent=msg;el.classList.add('show');clearTimeout(_tt);_tt=setTimeout(()=>el.classList.remove('show'),2200);}
