const APP_VERSION = "1.0.0";
const STORAGE_KEY = "facturas-casa-v1";

// ---------- Helpers ----------

const $ = (id) => document.getElementById(id);
const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const monthOf = (date) => date.slice(0, 7);

function monthName(month) {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function dayName(date) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function parseAmount(text) {
  let s = String(text).trim().replace(/[€\s]/g, "");
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

function sum(values) {
  return values.reduce((cents, v) => cents + Math.round(v * 100), 0) / 100;
}

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function todayISO() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ---------- Storage ----------

function loadBills() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return [...SEED_BILLS];
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [...SEED_BILLS];
    return data.filter(isValidBill);
  } catch {
    return [...SEED_BILLS];
  }
}

function saveBills() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
  } catch {
    console.error("localStorage save failed");
  }
}

function isValidBill(b) {
  return b && typeof b.id === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(b.date)
    && typeof b.provider === "string" && b.provider.trim() !== ""
    && typeof b.amount === "number" && Number.isFinite(b.amount);
}

// ---------- State ----------

let bills = loadBills();
let currentMonth = null;

const allMonths = () => [...new Set(bills.map((b) => monthOf(b.date)))].sort();
const billsIn   = (month) => bills.filter((b) => monthOf(b.date) === month);
const totalOf   = (month) => sum(billsIn(month).map((b) => b.amount));

// ---------- Tabs + comparison view toggle ----------

function initUI() {
  $("appVersion").textContent = "v" + APP_VERSION;

  // Main tabs
  const tabs = document.querySelectorAll(".tabs [role=tab]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-selected", "false"));
      tab.setAttribute("aria-selected", "true");
      document.querySelectorAll(".tab-panel").forEach((p) => { p.hidden = true; });
      document.getElementById("panel-" + tab.dataset.tab).hidden = false;
    });
  });

  // Comparison sub-view toggle
  const viewBtns = document.querySelectorAll(".view-toggle [data-view]");
  viewBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      viewBtns.forEach((b) => b.setAttribute("aria-pressed", "false"));
      btn.setAttribute("aria-pressed", "true");
      document.querySelectorAll(".comparison-view").forEach((v) => { v.hidden = true; });
      document.getElementById("view-" + btn.dataset.view).hidden = false;
    });
  });
}

// ---------- Render ----------

function render() {
  const months = allMonths();
  if (!months.includes(currentMonth)) currentMonth = months[months.length - 1] ?? null;

  renderMonthPicker(months);
  renderSummary();
  renderLedger();
  renderTotalChart(months);
  renderProviderChart(months);
  renderNumbers(months);
  renderGrid(months);
}

function renderMonthPicker(months) {
  $("months").replaceChildren(...months.map((m) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = monthName(m);
    btn.setAttribute("aria-pressed", String(m === currentMonth));
    btn.addEventListener("click", () => { currentMonth = m; render(); });
    return btn;
  }));
}

function renderSummary() {
  if (!currentMonth) {
    $("sumMonth").textContent = "";
    $("sumTotal").textContent = "—";
    $("sumCount").textContent = "0";
    return;
  }
  $("sumMonth").textContent = monthName(currentMonth);
  $("sumTotal").textContent = eur.format(totalOf(currentMonth));
  $("sumCount").textContent = billsIn(currentMonth).length;
}

function renderLedger() {
  const list = $("ledger");

  if (!currentMonth) {
    $("ledgerTitle").textContent = "Receipts";
    list.innerHTML = '<li class="empty">No bills yet. Add your first one below.</li>';
    return;
  }

  $("ledgerTitle").textContent = "Receipts · " + monthName(currentMonth);

  const rows = billsIn(currentMonth).sort(
    (a, b) => a.date.localeCompare(b.date) || a.provider.localeCompare(b.provider)
  );

  if (rows.length === 0) {
    list.innerHTML = '<li class="empty">No bills for this month.</li>';
    return;
  }

  list.replaceChildren(...rows.map((bill) => {
    const li   = document.createElement("li");
    const who  = document.createElement("div");
    who.className = "who";
    const name = document.createElement("strong");
    name.textContent = bill.provider;
    const meta = document.createElement("span");
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = bill.category || "Other";
    meta.append(chip, dayName(bill.date) + (bill.note ? " · " + bill.note : ""));
    who.append(name, meta);
    const amount = document.createElement("div");
    amount.className = "num";
    amount.textContent = eur.format(bill.amount);
    li.append(who, amount, deleteButton(bill));
    return li;
  }));
}

function deleteButton(bill) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "del";
  btn.textContent = "✕";
  btn.setAttribute("aria-label", `Remove ${bill.provider} ${eur.format(bill.amount)}`);

  let timer = null;
  btn.addEventListener("click", () => {
    if (!btn.classList.contains("armed")) {
      btn.classList.add("armed");
      btn.textContent = "Remove?";
      timer = setTimeout(() => { btn.classList.remove("armed"); btn.textContent = "✕"; }, 3000);
      return;
    }
    clearTimeout(timer);
    bills = bills.filter((b) => b.id !== bill.id);
    saveBills();
    render();
  });
  return btn;
}

// ---------- Total spending bar chart ----------

function renderTotalChart(months) {
  const wrap = $("chartWrap");
  wrap.innerHTML = "";
  if (months.length === 0) return;

  const totals = months.map(totalOf);
  const maxVal = Math.max(...totals, 1);
  const avgVal = sum(totals) / totals.length;

  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };

  const cs      = getComputedStyle(document.documentElement);
  const cUp     = cs.getPropertyValue("--up").trim();
  const cDown   = cs.getPropertyValue("--down").trim();
  const cAccent = cs.getPropertyValue("--accent").trim();
  const cMuted  = cs.getPropertyValue("--muted").trim();
  const cInk    = cs.getPropertyValue("--ink").trim();

  const BAR_W = 44, BAR_GAP = 20, PAD_L = 12, PAD_R = 12, PAD_T = 34, PAD_B = 40, CHART_H = 140;
  const totalW = PAD_L + months.length * (BAR_W + BAR_GAP) - BAR_GAP + PAD_R;
  const SVG_H  = PAD_T + CHART_H + PAD_B;

  const svg = el("svg", { viewBox: `0 0 ${totalW} ${SVG_H}`, width: totalW, height: SVG_H, role: "img", "aria-label": "Monthly spending chart" });

  const avgY = PAD_T + CHART_H - (avgVal / maxVal) * CHART_H;
  svg.append(el("line", { x1: PAD_L, y1: avgY, x2: totalW - PAD_R, y2: avgY, stroke: cMuted, "stroke-width": "1", "stroke-dasharray": "4 3" }));
  const avgLbl = el("text", { x: totalW - PAD_R, y: avgY - 5, "text-anchor": "end", "font-size": "10", fill: cMuted, "font-family": "IBM Plex Mono, monospace" });
  avgLbl.textContent = "avg " + eur.format(Math.round(avgVal * 100) / 100);
  svg.append(avgLbl);

  months.forEach((m, i) => {
    const total = totals[i];
    const barH  = Math.max(4, (total / maxVal) * CHART_H);
    const x     = PAD_L + i * (BAR_W + BAR_GAP);
    const y     = PAD_T + CHART_H - barH;
    const isCur = m === currentMonth;

    let color = cAccent;
    if (i > 0) color = total > totals[i - 1] ? cUp : cDown;

    svg.append(el("rect", { x, y, width: BAR_W, height: barH, rx: 5, fill: color, opacity: isCur ? "1" : "0.60" }));

    const amtLbl = el("text", { x: x + BAR_W / 2, y: y - 6, "text-anchor": "middle", "font-size": "10", fill: cInk, "font-family": "IBM Plex Mono, monospace", "font-weight": isCur ? "500" : "400" });
    amtLbl.textContent = eur.format(total);
    svg.append(amtLbl);

    const mLbl = el("text", { x: x + BAR_W / 2, y: PAD_T + CHART_H + 17, "text-anchor": "middle", "font-size": "11", fill: isCur ? cAccent : cMuted, "font-family": "IBM Plex Sans, sans-serif", "font-weight": isCur ? "600" : "400" });
    mLbl.textContent = monthName(m);
    svg.append(mLbl);

    if (isCur) svg.append(el("circle", { cx: x + BAR_W / 2, cy: PAD_T + CHART_H + 30, r: "3", fill: cAccent }));
  });

  wrap.append(svg);
}

// ---------- Per-provider line chart ----------

function renderProviderChart(months) {
  const wrap = $("provChartWrap");
  wrap.innerHTML = "";
  if (months.length === 0) return;

  if (months.length < 2) {
    const msg = document.createElement("p");
    msg.className = "note";
    msg.style.padding = "10px 0";
    msg.textContent = "Add bills for at least 2 months to see the per-provider trend.";
    wrap.append(msg);
    return;
  }

  const providers = [...new Set(bills.map((b) => b.provider))].sort();
  if (providers.length === 0) return;

  const PALETTE = ["#2563eb","#d97706","#16a34a","#dc2626","#9333ea","#0891b2","#c2410c","#4f46e5"];

  const ns = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}) => {
    const e = document.createElementNS(ns, tag);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  };

  const cs   = getComputedStyle(document.documentElement);
  const cMut = cs.getPropertyValue("--muted").trim();
  const cLn  = cs.getPropertyValue("--line").trim();
  const cSrf = cs.getPropertyValue("--surface").trim();

  const PAD_L = 62, PAD_R = 16, PAD_T = 16, PAD_B = 44, CHART_H = 160, COL_W = 80;
  const totalW = PAD_L + months.length * COL_W + PAD_R;
  const SVG_H  = PAD_T + CHART_H + PAD_B;

  const provData = providers.map((p) => ({
    name: p,
    vals: months.map((m) => sum(billsIn(m).filter((b) => b.provider === p).map((b) => b.amount))),
  }));

  const maxVal = Math.max(...provData.flatMap((d) => d.vals), 1);

  const svg = el("svg", { viewBox: `0 0 ${totalW} ${SVG_H}`, width: totalW, height: SVG_H, role: "img", "aria-label": "Per-provider spending trend" });

  [0, 0.25, 0.5, 0.75, 1].forEach((t) => {
    const y   = PAD_T + CHART_H * (1 - t);
    const val = Math.round(t * maxVal * 100) / 100;
    svg.append(el("line", { x1: PAD_L, y1: y, x2: totalW - PAD_R, y2: y, stroke: cLn, "stroke-width": "1" }));
    const lbl = el("text", { x: PAD_L - 6, y: y + 4, "text-anchor": "end", "font-size": "10", fill: cMut, "font-family": "IBM Plex Mono, monospace" });
    lbl.textContent = val === 0 ? "€0" : eur.format(val);
    svg.append(lbl);
  });

  months.forEach((m, i) => {
    const x   = PAD_L + i * COL_W + COL_W / 2;
    const lbl = el("text", { x, y: PAD_T + CHART_H + 18, "text-anchor": "middle", "font-size": "11", fill: cMut, "font-family": "IBM Plex Sans, sans-serif" });
    lbl.textContent = monthName(m);
    svg.append(lbl);
  });

  provData.forEach(({ vals }, pi) => {
    const color = PALETTE[pi % PALETTE.length];
    const pts   = vals.map((v, i) => ({ x: PAD_L + i * COL_W + COL_W / 2, y: PAD_T + CHART_H - (v / maxVal) * CHART_H, v }));
    svg.append(el("polyline", { points: pts.map((p) => `${p.x},${p.y}`).join(" "), fill: "none", stroke: color, "stroke-width": "2.5", "stroke-linejoin": "round", "stroke-linecap": "round", opacity: "0.85" }));
    pts.forEach((pt) => {
      if (pt.v > 0) svg.append(el("circle", { cx: pt.x, cy: pt.y, r: "5", fill: color, stroke: cSrf, "stroke-width": "2" }));
    });
  });

  wrap.append(svg);

  const legend = document.createElement("div");
  legend.className = "chart-legend";
  legend.style.marginTop = "10px";
  provData.forEach(({ name }, pi) => {
    const item = document.createElement("span");
    const dot  = document.createElement("span");
    dot.className = "legend-dot";
    dot.style.background = PALETTE[pi % PALETTE.length];
    item.append(dot, name);
    legend.append(item);
  });
  wrap.append(legend);
}

// ---------- Numbers comparison ----------

function renderNumbers(months) {
  const wrap = $("numbersWrap");
  if (!wrap) return;
  wrap.innerHTML = "";

  if (months.length === 0) {
    wrap.innerHTML = '<p class="note" style="padding:10px 0">No data yet.</p>';
    return;
  }

  const scrollDiv = document.createElement("div");
  scrollDiv.className = "scroll";
  const table = document.createElement("table");

  const thead = document.createElement("thead");
  const hrow  = document.createElement("tr");
  [["Month", false], ["Total", true], ["Bills", true], ["vs Prior Month", true], ["Avg / Bill", true]].forEach(([h, right]) => {
    const th = document.createElement("th");
    th.textContent = h;
    if (right) th.style.textAlign = "right";
    hrow.append(th);
  });
  thead.append(hrow);
  table.append(thead);

  const tbody = document.createElement("tbody");
  months.forEach((m, i) => {
    const total = totalOf(m);
    const count = billsIn(m).length;
    const avg   = count ? Math.round(total / count * 100) / 100 : 0;

    let changeTxt = "—";
    let changeCls = "zero";
    if (i > 0) {
      const prev  = totalOf(months[i - 1]);
      const diff  = Math.round((total - prev) * 100) / 100;
      const pct   = prev ? ` (${diff >= 0 ? "+" : ""}${((diff / prev) * 100).toFixed(1)}%)` : "";
      const arrow = diff > 0 ? "▲ +" : diff < 0 ? "▼ " : "";
      changeTxt   = (arrow + eur.format(diff) + pct).trim();
      changeCls   = diff > 0 ? "delta-up" : diff < 0 ? "delta-down" : "";
    }

    const tr = document.createElement("tr");
    if (m === currentMonth) tr.classList.add("cur-row");

    [
      { text: monthName(m), cls: "",              right: false },
      { text: eur.format(total), cls: "num",      right: true  },
      { text: String(count), cls: "",             right: true  },
      { text: changeTxt, cls: "num " + changeCls, right: true  },
      { text: eur.format(avg), cls: "num",        right: true  },
    ].forEach(({ text, cls, right }) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (cls.trim()) td.className = cls.trim();
      if (right) td.style.textAlign = "right";
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(tbody);
  scrollDiv.append(table);
  wrap.append(scrollDiv);
}

// ---------- Provider breakdown table ----------

function renderGrid(months) {
  const thead = document.querySelector("#grid thead");
  const tbody = document.querySelector("#grid tbody");
  const tfoot = document.querySelector("#grid tfoot");
  thead.replaceChildren();
  tbody.replaceChildren();
  tfoot.replaceChildren();
  if (!months.length) return;

  const providers = [...new Set(bills.map((b) => b.provider))].sort();

  const cell = (tag, text, { current = false, cls = "" } = {}) => {
    const el = document.createElement(tag);
    if (current) el.classList.add("cur");
    if (cls) {
      const span = document.createElement("span");
      span.className = cls;
      span.textContent = text;
      el.append(span);
    } else {
      el.textContent = text;
    }
    return el;
  };

  const head = document.createElement("tr");
  head.append(cell("th", "Provider"), ...months.map((m) => cell("th", monthName(m), { current: m === currentMonth })));
  thead.append(head);

  for (const p of providers) {
    const tr = document.createElement("tr");
    tr.append(cell("td", p));
    for (const m of months) {
      const value = sum(billsIn(m).filter((b) => b.provider === p).map((b) => b.amount));
      tr.append(cell("td", value ? eur.format(value) : "–", { current: m === currentMonth, cls: value ? "num" : "num zero" }));
    }
    tbody.append(tr);
  }

  const foot = document.createElement("tr");
  foot.append(cell("td", "Total"), ...months.map((m) =>
    cell("td", eur.format(totalOf(m)), { current: m === currentMonth, cls: "num" })
  ));
  tfoot.append(foot);

  $("provList").replaceChildren(...providers.map((p) => {
    const opt = document.createElement("option");
    opt.value = p;
    return opt;
  }));
}

// ---------- PDF export ----------

function exportPDF() {
  if (!window.jspdf) {
    $("dataNote").textContent = "PDF library not loaded — check your internet connection.";
    return;
  }
  if (!currentMonth) {
    $("dataNote").textContent = "Select a month first using the month buttons at the top.";
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF({ unit: "mm", format: "a4" });
  const W    = 210;
  const mar  = 20;
  const rows = billsIn(currentMonth).sort(
    (a, b) => a.date.localeCompare(b.date) || a.provider.localeCompare(b.provider)
  );
  const total = totalOf(currentMonth);

  // Header band
  doc.setFillColor(29, 106, 131);
  doc.rect(0, 0, W, 32, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("FACTURAS DE CASA", mar, 14);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Monthly Statement  ·  " + monthName(currentMonth), mar, 24);

  // Column headers
  doc.setTextColor(93, 108, 118);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  let y = 44;
  doc.text("DATE",     mar,      y);
  doc.text("PROVIDER", mar + 24, y);
  doc.text("CATEGORY", mar + 90, y);
  doc.text("AMOUNT",   W - mar,  y, { align: "right" });
  doc.setDrawColor(221, 227, 231);
  doc.setLineWidth(0.3);
  doc.line(mar, y + 2, W - mar, y + 2);
  y += 9;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(23, 35, 43);

  rows.forEach((bill, i) => {
    if (y > 265) { doc.addPage(); y = 20; }

    if (i % 2 === 0) {
      doc.setFillColor(243, 245, 246);
      doc.rect(mar - 2, y - 5.5, W - mar * 2 + 4, 8, "F");
    }

    doc.text(dayName(bill.date),                       mar,      y);
    doc.text(bill.provider.substring(0, 30),           mar + 24, y);
    doc.text((bill.category || "").substring(0, 18),   mar + 90, y);
    doc.text(eur.format(bill.amount),                  W - mar,  y, { align: "right" });

    if (bill.note) {
      y += 5;
      doc.setFontSize(8);
      doc.setTextColor(93, 108, 118);
      doc.text(bill.note.substring(0, 60), mar + 24, y);
      doc.setFontSize(9.5);
      doc.setTextColor(23, 35, 43);
    }
    y += 9;
  });

  // Total
  y += 2;
  doc.setDrawColor(23, 35, 43);
  doc.setLineWidth(0.5);
  doc.line(mar, y, W - mar, y);
  y += 7;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(23, 35, 43);
  doc.text("TOTAL", mar, y);
  doc.text(eur.format(total), W - mar, y, { align: "right" });

  // Footer
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(150);
  doc.text("Facturas de Casa  ·  Generated " + todayISO(), mar, 287);
  doc.text(`${rows.length} bill${rows.length === 1 ? "" : "s"}`, W - mar, 287, { align: "right" });

  doc.save(`facturas-casa-${currentMonth}.pdf`);
  $("dataNote").textContent = `PDF saved: facturas-casa-${currentMonth}.pdf`;
}

// ---------- Add a bill ----------

$("fDate").value = todayISO();

$("addForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const note = $("formNote");

  const amount = parseAmount($("fAmt").value);
  if (!(amount > 0)) {
    note.textContent = "Enter the amount as a number, like 59,05.";
    $("fAmt").focus();
    return;
  }

  const bill = {
    id: newId(),
    date: $("fDate").value,
    provider: $("fProv").value.trim(),
    category: $("fCat").value,
    amount,
    note: $("fNote").value.trim(),
  };

  if (!isValidBill(bill)) {
    note.textContent = "Fill in the date and provider.";
    return;
  }

  bills.push(bill);
  saveBills();
  currentMonth = monthOf(bill.date);
  render();

  note.textContent = `Added ${bill.provider} · ${eur.format(bill.amount)}.`;
  $("fAmt").value = "";
  $("fNote").value = "";
  $("fProv").focus();
});

$("pdfBtn").addEventListener("click", exportPDF);

// ---------- Start ----------

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}

saveBills();
initUI();
render();
