/* Badachuli Rice Mill — /brag scene.
   Markup and class names are lifted from the real app:
   Sidebar.tsx, DashboardPage.tsx, NewBillPage.tsx, PrintReceipt.tsx.
   Styling comes from the app's own compiled CSS (app.css).
   Every frame is a pure function of t — no CSS transitions, no rAF. */

const I = (n, cls, sz) => window.icon(n, cls, sz)

/* ── Sidebar (real .sidebar markup) ───────────────────────── */
const NAV = [
  [null, [['Dashboard', 'layout-dashboard']]],
  ['Sales', [['New Bill', 'receipt-text'], ['Bills', 'clipboard-list'], ['Customers', 'users'], ['Ledger', 'book-open']]],
  ['Inventory', [['Stock In', 'package-plus'], ['Stock', 'boxes'], ['Suppliers', 'truck'], ['Mill Processing', 'cpu']]],
  ['Catalog', [['Items', 'package'], ['Prices', 'tag'], ['Units', 'ruler']]],
  ['Finance', [['Expenses', 'wallet']]],
  ['System', [['Reports', 'chart-column'], ['Settings', 'settings']]],
]
let navIdx = 0
const navRows = []
let sbHtml = `<div class="sidebar-brand">
    <span class="sidebar-brand-name">Badachuli</span>
    <span class="sidebar-brand-sub">Rice Mill</span>
    <button class="sidebar-collapse-btn">${I('chevron-left', '', 15)}</button>
  </div><nav class="sidebar-nav">`
for (const [sec, items] of NAV) {
  sbHtml += '<div>'
  if (sec) sbHtml += `<div class="sidebar-section-label nr" data-i="${navIdx++}">${sec}</div>`
  for (const [label, ic] of items) {
    sbHtml += `<button class="sidebar-btn nr" data-i="${navIdx++}" data-nav="${label}">${I(ic, 'sidebar-icon', 15)}${label}</button>`
  }
  sbHtml += '</div>'
}
sbHtml += `</nav><div class="sidebar-footer">
  <button class="sidebar-lang-toggle">${I('cog', '', 12)}EN → नेपाली</button>
  <div class="sidebar-user">${I('user', 'text-orange-500', 14)}
    <div><div class="sidebar-user-name">owner</div><div class="sidebar-user-role">owner</div></div></div>
  <button class="sidebar-logout">${I('log-out', '', 13)}Lock session</button></div>`
document.getElementById('sb').innerHTML = sbHtml

/* ── Dashboard (real DashboardPage markup) ────────────────── */
const rs = n => 'Rs. ' + n.toLocaleString('en-NP', { minimumFractionDigits: 2 })
const WEEK = [['Sun', 9800], ['Mon', 14200], ['Tue', 11600], ['Wed', 17400], ['Thu', 12900], ['Fri', 21500], ['Sat', 18420]]
const WEEK_TOTAL = WEEK.reduce((s, d) => s + d[1], 0)
const MAXBAR = Math.max(...WEEK.map(d => d[1]))

const STAT = [
  ["Today's Sales", rs(18420), '7 bills today', 'trending-up', 'orange'],
  ['Collected Today', rs(16805), 'cash · bank · digital', 'wallet', 'green'],
  ["Today's Outstanding", rs(4260), 'pending udharo', 'circle-alert', 'red'],
  ['Stock Items', '14', 'distinct items', 'package', 'amber'],
]
const SS = {
  orange: ['bg-gradient-to-br from-orange-500 to-orange-600', 'bg-white/20', 'text-white', 'text-orange-100', 'text-orange-100', 'text-white'],
  green: ['bg-white', 'bg-green-100', 'text-stone-800', 'text-stone-400', 'text-stone-500', 'text-green-600'],
  red: ['bg-white', 'bg-red-100', 'text-stone-800', 'text-stone-400', 'text-stone-500', 'text-red-500'],
  amber: ['bg-white', 'bg-amber-100', 'text-stone-800', 'text-stone-400', 'text-stone-500', 'text-amber-600'],
}
const statCard = ([label, value, sub, ic, st], i) => {
  const s = SS[st]
  return `<div class="statc rounded-2xl p-5 ${s[0]} border border-stone-200 shadow-sm flex flex-col gap-3" data-i="${i}">
    <div class="flex items-center justify-between">
      <span class="text-xs font-700 uppercase tracking-widest ${s[4]}">${label}</span>
      <div class="p-2 rounded-xl ${s[1]}">${I(ic, s[5], 16)}</div>
    </div>
    <div><p class="text-2xl font-extrabold leading-tight ${s[2]}">${value}</p>
      <p class="text-xs mt-0.5 ${s[3]}">${sub}</p></div></div>`
}
const glance = (l, v, color, small) =>
  `<div class="flex items-center justify-between py-1.5">
    <span class="text-stone-500 ${small ? 'text-xs' : 'text-sm'}">${l}</span>
    <span class="font-bold ${small ? 'text-xs' : 'text-sm'} ${color || 'text-stone-800'}">${v}</span></div>`
const quick = (l, ic, color) =>
  `<button class="qa flex flex-col items-center gap-2.5 p-4 rounded-xl border border-stone-200 bg-stone-50">
    <div class="p-2.5 rounded-xl ${color} shadow-sm">${I(ic, 'text-white', 17)}</div>
    <span class="text-xs font-semibold text-stone-600">${l}</span></button>`

document.getElementById('dash').innerHTML = `<div class="flex flex-col gap-6">
  <div class="flex items-center justify-between">
    <div><h1 class="text-xl font-bold text-stone-800">Dashboard</h1>
      <div class="flex items-center gap-1.5 mt-0.5 text-stone-500 text-sm">
        ${I('calendar', '', 13)}<span>Monday, October 5, 2026</span></div></div>
    <div class="flex items-center gap-2">
      <span id="offslot"></span>
      <button class="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-orange-500 rounded-lg shadow-sm">
        ${I('ticket', '', 16)}Generate Token</button>
      <button class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-lg">
        ${I('refresh-cw', '', 14)}Refresh</button></div></div>

  <div class="grid grid-cols-4 gap-4">${STAT.map(statCard).join('')}</div>

  <div class="grid grid-cols-3 gap-4">
    <div class="col-span-2 bg-white rounded-2xl border border-stone-200 shadow-sm overflow-hidden" id="chartcard">
      <div class="flex items-center justify-between px-5 pt-5 pb-3">
        <div><h3 class="text-sm font-bold text-stone-800">7-Day Sales Trend</h3>
          <p class="text-xs text-stone-400 mt-0.5">Last 7 days revenue</p></div>
        <div class="px-3 py-1 bg-orange-50 rounded-full border border-orange-200">
          <span class="text-xs font-bold text-orange-600">${rs(WEEK_TOTAL)} this week</span></div></div>
      <div class="px-5 pb-5" style="position:relative">
        <div class="gridl" style="top:22px"></div><div class="gridl" style="top:68px"></div>
        <div class="gridl" style="top:114px"></div><div class="gridl" style="top:160px"></div>
        <div class="bars">${WEEK.map(([d], i) =>
          `<div class="barcol"><div class="bar" data-i="${i}"></div><div class="barlab">${d}</div></div>`).join('')}</div>
      </div></div>
    <div class="bg-white rounded-2xl border border-stone-200 shadow-sm p-5 flex flex-col gap-0" id="glancecard">
      <h3 class="text-sm font-bold text-stone-800 mb-4">Today at a Glance</h3>
      ${glance('Billed', rs(18420))}
      ${glance('Collected', rs(16805), 'text-green-600')}
      ${glance('New Udharo', rs(1615), 'text-red-500')}
      <div class="border-t border-stone-100 my-3"></div>
      ${glance('Bills today', '7', '', true)}
      ${glance('Batches today', '5', '', true)}
      <div class="border-t border-stone-100 my-3"></div>
      <div class="flex items-center justify-between rounded-lg bg-red-50 border border-red-100 px-3 py-2" id="outrow">
        <span class="text-xs font-semibold text-red-600">Total outstanding</span>
        <span class="text-sm font-extrabold text-red-600">${rs(4260)}</span></div></div></div>

  <div class="bg-white rounded-2xl border border-stone-200 shadow-sm p-5" id="qacard">
    <h3 class="text-sm font-bold text-stone-800 mb-4">Quick Actions</h3>
    <div class="grid grid-cols-4 gap-3">
      ${quick('New Bill', 'receipt-text', 'bg-orange-500')}
      ${quick('Stock In', 'package-plus', 'bg-amber-500')}
      ${quick('Mill Processing', 'cpu', 'bg-yellow-500')}
      ${quick('Reports', 'chart-column', 'bg-stone-700')}</div></div></div>`

document.getElementById('offslot').innerHTML =
  `<span id="offpill">${I('wifi-off')}Offline</span>`

/* ── Receipt (real PrintReceipt.tsx markup) ───────────────── */
const NE = ['०','१','२','३','४','५','६','७','८','९']
const nep = s => String(s).replace(/[0-9]/g, d => NE[+d])
const rsNe = n => {
  const p = Math.abs(n).toFixed(2).split('.')
  return 'रु.' + nep(parseInt(p[0]).toLocaleString('en-NP')) + '.' + nep(p[1])
}
const RECEIPT = `<div class="receipt">
  <div class="receipt-header-top"><span>प्यान नं : ३०९८७६५४३</span>
    <span class="receipt-type-badge">बिक्री / प्रशोधन</span></div>
  <div class="receipt-center">
    <div class="receipt-mill-name">बडचुली राइस मिल</div>
    <div class="receipt-detail">कावासोती - १, नमुनाचोक, नवलपुर</div></div>
  <div class="receipt-divider"></div>
  <div class="receipt-bill-meta"><span>बिल नं : <strong>BC-2083-00142</strong></span>
    <span>मिति : १९ असोज २०८३</span></div>
  <div class="receipt-detail" style="padding:1px 0">श्री हरि प्रसाद</div>
  <div class="receipt-line-header"><span class="receipt-col-item">वस्तु</span>
    <span class="receipt-col-qty">परिमाण</span><span class="receipt-col-rate">दर</span>
    <span class="receipt-col-total">जम्मा</span></div>
  <div class="receipt-section-label">बिक्री</div>
  <div class="receipt-line"><span class="receipt-col-item">चामल</span>
    <span class="receipt-col-qty">${nep(25)}kg</span><span class="receipt-col-rate">${rsNe(75)}</span>
    <span class="receipt-col-total">${rsNe(1875)}</span></div>
  <div class="receipt-section-label">प्रशोधन</div>
  <div class="receipt-line"><span class="receipt-col-item">धान</span>
    <span class="receipt-col-qty">${nep(120)}kg</span><span class="receipt-col-rate">${rsNe(2)}</span>
    <span class="receipt-col-total">${rsNe(240)}</span></div>
  <div class="receipt-row receipt-row-total"><span>जम्मा</span><span>${rsNe(2115)}</span></div>
  <div class="receipt-row"><span>तिरेको</span><span>${rsNe(1500)}</span></div>
  <div class="receipt-row receipt-row-due"><span>बाँकी</span><span>${rsNe(615)}</span></div>
  <div class="receipt-divider"></div>
  <div class="receipt-center receipt-footer">धन्यवाद — माथि उल्लेखित रकम बाँकी छ</div></div>`
document.getElementById('paper1in').innerHTML = RECEIPT
document.getElementById('paper2in').innerHTML = RECEIPT

/* ── New Bill pane (real NewBillPage markup), driven by t ──── */
const cl = x => x < 0 ? 0 : x > 1 ? 1 : x
const seg = (t, a, b) => cl((t - a) / (b - a))
const eo = p => 1 - Math.pow(1 - p, 3)
const ei = p => p * p * p
const lerp = (a, b, p) => a + (b - a) * p
const vis = (t, i0, i1, o0, o1) => Math.min(seg(t, i0, i1), 1 - seg(t, o0, o1))
const typed = (s, t, a, b) => s.slice(0, Math.round(lerp(0, s.length, seg(t, a, b))))
const blink = t => Math.floor(t / 0.53) % 2 === 0 ? '' : ';opacity:0'

const L1 = { name: 'धान', kind: 'processing', qty: 120, rate: 2, total: 240 }
const L2 = { name: 'चामल', kind: 'sale', qty: 25, rate: 75, total: 1875 }

function renderBill(t) {
  // phase A: first line (धान, processing) · phase B: second line (चामल, sale)
  const phase2 = t >= 11.15
  const target = phase2 ? L2 : L1
  const typeStart = phase2 ? 11.20 : 9.55, typeEnd = phase2 ? 11.60 : 9.90
  const picked = phase2 ? t >= 11.60 : t >= 10.10
  const qStart = phase2 ? 11.80 : 10.40, qEnd = phase2 ? 11.98 : 10.72
  const dropOp = phase2 ? 0 : vis(t, 9.78, 9.92, 10.02, 10.12)
  const itemTxt = picked ? target.name : typed(target.name, t, typeStart, typeEnd)
  const qtyTxt = picked ? typed(String(target.qty), t, qStart, qEnd) : ''
  const amtTxt = (picked && t >= qEnd + 0.02) ? (target.qty * target.rate).toFixed(2) : ''
  const rowOps = [vis(t, 10.88, 11.14, 1e9, 1e9), vis(t, 12.08, 12.34, 1e9, 1e9)]
  const gt = 240 * eo(seg(t, 10.88, 11.10)) + 1875 * eo(seg(t, 12.08, 12.38))
  const payOp = vis(t, 12.38, 12.58, 1e9, 1e9)
  const press = seg(t, 12.60, 12.70) - seg(t, 12.70, 12.80)

  const row = (l, n, op) => op <= 0.001 ? '' : `<tr style="opacity:${op};transform:translateY(${lerp(-7,0,eo(op))}px)">
    <td class="text-muted">${n}</td>
    <td>${l.name}<span style="margin-left:.4rem;font-size:.68rem;padding:1px 5px;border-radius:3px;background:${l.kind === 'processing' ? '#a16207' : '#f97316'};color:#fff;vertical-align:middle">${l.kind === 'processing' ? 'Processing' : 'Sale'}</span></td>
    <td style="text-align:right">${l.qty} kg</td>
    <td style="text-align:right">${rs(l.rate)}</td>
    <td style="text-align:right;font-weight:700">${rs(l.total)}</td>
    <td><button class="btn-ghost btn-sm">${I('x', '', 13)}</button></td></tr>`

  const sline = (l, op) => op <= 0.001 ? '' : `<div class="bill-summary-line" style="opacity:${op}">
    <span class="bill-summary-line-name">${l.name} × ${l.qty}kg</span><span>${rs(l.total)}</span></div>`

  document.getElementById('billpane').innerHTML = `<div class="bill-entry-page">
   <div class="bill-entry-topbar">
     <button class="bill-back-btn">${I('chevron-left', '', 14)}Go Back</button>
     <span class="bill-number-badge">BC-2083-00142</span></div>
   <div class="bill-entry-body">
    <div class="bill-entry-left">
     <section class="bill-section"><div class="bill-section-title">Payment Mode</div>
      <div class="pay-toggle"><button class="pay-toggle-btn">Pay Now</button>
       <button class="pay-toggle-btn pay-toggle-active">Credit (Udharo)</button></div></section>

     <section class="bill-section"><div class="bill-section-title">Customer</div>
      <div class="customer-card"><div class="customer-card-name">श्री हरि प्रसाद</div>
       <div class="customer-card-meta">Kawasoti · regular</div></div></section>

     <section class="bill-section">
      <div class="bill-section-title" style="display:flex;align-items:center;gap:.75rem">Items
       <div class="pay-toggle" style="margin-left:auto">
        <button class="pay-toggle-btn${phase2 ? ' pay-toggle-active' : ''}">Sale</button>
        <button class="pay-toggle-btn${phase2 ? '' : ' pay-toggle-active'}">Processing</button></div></div>
      <div class="bill-item-entry">
       <div style="position:relative;flex:2">
        <div class="bill-input${picked ? '' : ' bill-input--focus'}">${itemTxt || '<span style="color:#a8a29e">Search item…</span>'}${picked ? '' : `<span class="caret" style="background:#1c1917${blink(t)}"></span>`}</div>
        ${dropOp > 0.001 ? `<ul class="dropdown-list" style="opacity:${dropOp}">
          <li><span>धान</span><span class="text-muted">kg</span></li>
          <li><span>धान (मोटो)</span><span class="text-muted">kg</span></li>
          <li><span>गहु</span><span class="text-muted">kg</span></li></ul>` : ''}</div>
       ${picked ? `<div class="bill-rate-display"><span class="bill-rate-label">Rate</span>
         <div class="bill-input bill-input-sm" style="width:80px">${target.rate}</div></div>
        <div class="bill-qty-amount-row">
         <div class="bill-input${qtyTxt.length < String(target.qty).length ? ' bill-input--focus' : ''}" style="flex:1">${qtyTxt || `<span style="color:#a8a29e">Qty (kg)</span>`}${qtyTxt.length < String(target.qty).length ? `<span class="caret" style="background:#1c1917${blink(t)}"></span>` : ''}</div>
         <div class="bill-input" style="flex:1">${amtTxt || '<span style="color:#a8a29e">Amount</span>'}</div>
         <button class="btn-primary btn-sm">${I('plus', '', 14)}</button></div>` : ''}
      </div>
      ${rowOps[0] > 0.001 ? `<table class="data-table" style="margin-top:.75rem">
        <thead><tr><th>#</th><th>Item</th><th style="text-align:right">Qty</th>
          <th style="text-align:right">Rate</th><th style="text-align:right">Total</th><th></th></tr></thead>
        <tbody>${row(L1, 1, rowOps[0])}${row(L2, 2, rowOps[1])}</tbody></table>`
       : `<div class="empty-state" style="padding:1rem">No items added yet</div>`}
     </section>

     <section class="bill-section"><div class="bill-section-title">Payment</div>
      <div class="bill-payment-row">
       <div class="bill-udharo-note">Full amount goes to credit account (Udharo)</div>
       <div class="bill-field-label" style="margin-top:.75rem;margin-bottom:.5rem">Payment Method</div>
       <div class="bill-method-pills">
        <button class="bill-method-pill bill-method-active">Cash</button>
        <button class="bill-method-pill">Bank Transfer</button>
        <button class="bill-method-pill">Digital (eSewa/IME)</button></div>
       <div style="margin-top:.75rem">
        <div class="bill-field-label">Collect partial payment now? (optional)</div>
        <div class="bill-input bill-input-sm" style="margin-top:.3rem">1500.00</div></div>
       ${payOp > 0.001 ? `<div class="bill-partial-note" style="opacity:${payOp}">Rs. 1,500.00 collected now · Rs. 615.00 going to credit</div>` : ''}
      </div></section></div>

    <div class="bill-summary"><div class="bill-summary-title">Summary</div>
     <div class="bill-summary-lines">${sline(L1, rowOps[0])}${sline(L2, rowOps[1])}</div>
     <div class="bill-summary-divider"></div>
     <div class="bill-summary-row"><span>Grand Total</span>
      <span class="bill-summary-total">${rs(Math.round(gt * 100) / 100)}</span></div>
     <div class="bill-summary-row" style="opacity:${payOp}"><span>Collected now</span>
      <span style="color:#15803d;font-weight:700">${rs(1500)}</span></div>
     <div class="bill-summary-row" style="opacity:${payOp}"><span>Credit (Due)</span>
      <span style="color:#dc2626;font-weight:700">${rs(615)}</span></div>
     <div class="bill-summary-divider"></div>
     <button class="btn-primary" style="width:100%;padding:.7rem;transform:scale(${1 - press * 0.02});filter:brightness(${1 - press * 0.08})">Review &amp; Save →</button>
    </div></div></div>`
}

/* ── Timeline ─────────────────────────────────────────────── */
const $ = id => document.getElementById(id)
const win_ = $('win'), dash = $('dash'), billpane = $('billpane')
const navEls = [...document.querySelectorAll('#sb .nr')]
const navBtns = [...document.querySelectorAll('#sb [data-nav]')]
const statEls = [...document.querySelectorAll('.statc')]
const barEls = [...document.querySelectorAll('.bar')]
const chartcard = $('chartcard'), glancecard = $('glancecard'), qacard = $('qacard')
const offpill = $('offpill'), outrow = $('outrow')
const p1 = $('paper1'), p2 = $('paper2')
const brand = $('brand'), scrim = $('scrim')
const caps = { c1: $('cap1'), c3: $('cap3'), c4: $('cap4'), c5: $('cap5'), c6: $('cap6') }

/* paper geometry — measured, so the receipt always fits the frame */
const PW = 272
const pH = $('paper1in').offsetHeight
const PS = Math.min(2.25, 740 / pH)
const PTOP = (1080 - pH * PS) / 2 - 80
for (const w of [p1, p2]) { w.style.width = PW + 'px'; w.style.marginLeft = (-PW / 2) + 'px' }

const op = (el, o) => { el.style.opacity = o; el.style.visibility = o <= 0.002 ? 'hidden' : 'visible' }

function caption(el, t, i0, i1, o0, o1) {
  const o = vis(t, i0, i1, o0, o1), p = eo(seg(t, i0, i1))
  op(el, o)
  el.style.transform = `translateY(${lerp(24, 0, p)}px)`
  const r = el.querySelector('.rule')
  r.style.transformOrigin = 'left center'
  r.style.transform = `scaleX(${eo(seg(t, i0, i0 + (i1 - i0) * 1.3))})`
}

window.setT = function (t) {
  /* ── app window ── */
  const wop = Math.max(vis(t, 5.60, 6.18, 12.92, 13.42), vis(t, 16.80, 17.28, 20.00, 20.40))
  let wy, wsc
  if (t < 15.0) {
    const p = eo(seg(t, 5.60, 6.18)), q = ei(seg(t, 12.92, 13.42))
    wy = lerp(26, 0, p) + 72 * q; wsc = lerp(0.955, 1, p) - 0.022 * q
  } else {
    const p = eo(seg(t, 16.80, 17.28)), q = ei(seg(t, 20.00, 20.40))
    wy = lerp(34, 0, p) - 26 * q; wsc = lerp(0.978, 1, p) - 0.012 * q
  }
  op(win_, wop)
  win_.style.transform = `translateY(${wy}px) scale(${wsc})`

  /* ── sidebar ── */
  navEls.forEach((el, i) => {
    const st = 5.95 + i * 0.032, p = eo(seg(t, st, st + 0.30))
    el.style.opacity = p
    el.style.transform = `translateX(${lerp(-14, 0, p)}px)`
  })
  const activeNav = (t >= 8.80 && t < 16.80) ? 'New Bill' : 'Dashboard'
  navBtns.forEach(b => b.classList.toggle('sidebar-btn-active', b.dataset.nav === activeNav))

  /* ── panes ── */
  const dOp = Math.max(vis(t, 5.60, 6.00, 8.80, 9.02), vis(t, 16.80, 17.10, 1e9, 1e9))
  op(dash, dOp)
  dash.style.transform = `translateY(${-16 * ei(seg(t, 8.80, 9.02))}px)`
  const bOp = vis(t, 9.02, 9.42, 13.30, 13.48)
  op(billpane, bOp)
  billpane.style.transform = `translateY(${lerp(14, 0, eo(seg(t, 9.02, 9.42)))}px)`
  renderBill(t)

  /* ── dashboard reveal ── */
  statEls.forEach((el, i) => {
    const p = eo(seg(t, 6.30 + i * 0.10, 6.66 + i * 0.10))
    el.style.opacity = p
    el.style.transform = `translateY(${lerp(18, 0, p)}px) scale(${lerp(0.985, 1, p)})`
  })
  barEls.forEach((el, i) => {
    const p = eo(seg(t, 6.95 + i * 0.045, 7.50 + i * 0.045))
    el.style.height = (WEEK[i][1] / MAXBAR * 158 * p) + 'px'
  })
  const grow = (el, st) => {
    const p = eo(seg(t, st, st + 0.40))
    el.style.opacity = p
    el.style.transform = `translateY(${lerp(22, 0, p)}px)`
  }
  grow(chartcard, 6.72); grow(glancecard, 6.86); grow(qacard, 7.12)

  /* ── scene 6: offline + ledger emphasis ── */
  const pillP = eo(vis(t, 17.52, 17.92, 1e9, 1e9))
  op(offpill, pillP)
  offpill.style.transform = `scale(${lerp(0.88, 1, pillP)})`
  const lift = eo(seg(t, 17.90, 18.40))
  outrow.style.transform = `scale(${1 + 0.022 * lift})`
  outrow.style.boxShadow = `0 ${7 * lift}px ${20 * lift}px rgba(220,38,38,${0.17 * lift})`

  /* ── paper 1 (hook) ── */
  const o1 = vis(t, 0.10, 0.72, 2.86, 3.18)
  op(p1, o1)
  const y1 = lerp(96, -22, eo(seg(t, 0, 3.0))) - 240 * ei(seg(t, 2.86, 3.20))
  p1.style.transform = `translateY(${PTOP + y1}px) scale(${PS})`

  /* ── paper 2 (printing) ── */
  const o2 = vis(t, 13.02, 13.22, 16.46, 16.80)
  op(p2, o2)
  const feed = eo(seg(t, 13.05, 14.35))
  const y2 = lerp(20, 0, feed) - 11 * eo(seg(t, 14.35, 16.45)) - 170 * ei(seg(t, 16.46, 16.80))
  p2.style.transform = `translateY(${PTOP + y2}px) scale(${PS})`
  p2.style.clipPath = `inset(0 0 ${(1 - feed) * 100}% 0)`

  /* ── brand (title + outro) ── */
  const isOutro = t >= 18.0
  $('thanks').style.display = isOutro ? 'block' : 'none'
  $('bsub').style.display = isOutro ? 'block' : 'none'
  document.querySelector('#brand .wmne').style.display = isOutro ? 'none' : 'block'
  const bop = Math.max(vis(t, 3.26, 3.92, 5.28, 5.60), vis(t, 20.30, 20.95, 1e9, 1e9))
  op(brand, bop)
  const bp = isOutro ? eo(seg(t, 20.30, 20.95)) : eo(seg(t, 3.26, 3.92))
  const by = lerp(22, 0, bp) - (isOutro ? 0 : 14 * ei(seg(t, 5.28, 5.60)))
  brand.style.transform = `translateY(calc(-50% + ${by}px)) scale(${lerp(0.978, 1, bp)})`

  /* ── scrim + captions ── */
  op(scrim, Math.max(vis(t, 0.08, 0.45, 2.92, 3.22), vis(t, 5.85, 6.30, 19.78, 20.10)))
  caption(caps.c1, t, 0.30, 0.95, 2.90, 3.20)
  caption(caps.c3, t, 6.10, 6.70, 8.55, 8.80)
  caption(caps.c4, t, 9.10, 9.65, 12.55, 12.80)
  caption(caps.c5, t, 13.20, 13.80, 16.55, 16.80)
  caption(caps.c6, t, 17.10, 17.70, 19.75, 20.00)
}
window.setT(0)
