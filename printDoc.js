/* Shared helpers for showing / printing / sharing bills and statements.

   WHY THIS EXISTS
   The old code did `window.open("", "_blank")` + `document.write(...)` and
   auto-called `window.print()`. That works on a desktop with a mouse, but on
   mobile it fails: browsers block popups that are opened after an `await`
   (the tap "gesture" is already gone once the sale request finishes), and
   printing from a popup is unreliable on phones anyway.

   Now the bill opens in a full-screen overlay INSIDE the page (no popup, so
   nothing to block). From there the user can Print / Save as PDF, Share, or
   share it. It works with tap and mouse alike. */

import { pkDay } from "../../lib/pkTime";

export function esc(v) {
  return String(v ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// Pakistani number -> WhatsApp international format (0300... -> 92300...)
export function waNumber(phone) {
  let n = String(phone || "").replace(/\D/g, "");
  if (!n) return "";
  if (n.startsWith("00")) n = n.slice(2);
  else if (n.startsWith("0")) n = "92" + n.slice(1);
  else if (n.length === 10 && n.startsWith("3")) n = "92" + n;
  return n;
}

// Amount of one bill line AFTER discount.
export function billLineAmt(b) {
  return b.line_total != null ? Number(b.line_total) : b.qty * b.sale_price - (b.discount || 0);
}

// Rate shown on the bill. The discount is NOT printed on the bill, so the rate
// is the effective (discounted) price per piece: Rate x Qty always = Amt.
export function billRate(b) {
  const r = b.qty > 0 ? billLineAmt(b) / b.qty : Number(b.sale_price);
  const rounded = Math.round(r * 100) / 100;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2);
}

/* items: [{ name, qty, sale_price, discount?, line_total? }]
   prevBalance: customer's old unpaid (udhaar) balance, added to the bill total. */
export function buildBillHtml({ shop, billNo, date, customer, phone, items, prevBalance = 0 }) {
  const cur = esc(shop.currency_symbol);
  const lineAmt = billLineAmt;
  const prev = Math.max(0, Number(prevBalance) || 0);
  const subtotal = items.reduce((a, b) => a + lineAmt(b), 0);
  const total = subtotal + prev;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(billNo)}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Courier New',monospace;font-size:12px;width:320px;max-width:100%;margin:auto;padding:14px;background:#fff;color:#000}
  .shop{text-align:center;font-size:20px;font-weight:bold;letter-spacing:1px}.sub{text-align:center;font-size:10px;color:#666;margin-bottom:4px}
  hr{border:none;border-top:1px dashed #000;margin:8px 0}.hr2{border-top:2px solid #000}
  .row{display:flex;justify-content:space-between;font-size:11px;margin:3px 0}.muted{color:#666}
  table{width:100%;border-collapse:collapse}th{padding:4px 3px;font-size:10px;text-align:left;border-bottom:1px solid #000}
  td{padding:4px 3px;font-size:11px;border-bottom:1px dotted #ccc}.right{text-align:right}.center{text-align:center}
  .disc{color:#c00}
  .total{display:flex;justify-content:space-between;font-size:16px;font-weight:bold;padding:6px 0}
  .footer{text-align:center;font-size:10px;color:#666;margin-top:10px;line-height:1.8}
  @media print{@page{size:80mm auto;margin:0}body{width:100%;padding:4mm}}</style></head><body>
  <div class="shop">🏪 ${esc(shop.shop_name.toUpperCase())}</div><div class="sub">${esc(shop.shop_tagline)}</div>
  ${shop.shop_phone ? `<div class="sub">📞 ${esc(shop.shop_phone)}</div>` : ""}
  ${shop.shop_address ? `<div class="sub">📍 ${esc(shop.shop_address)}</div>` : ""}
  <hr class="hr2"><div class="row"><span class="muted">Invoice:</span><strong>${esc(billNo)}</strong></div>
  <div class="row"><span class="muted">Date:</span><span>${esc(date.toLocaleDateString())}</span></div>
  <div class="row"><span class="muted">Time:</span><span>${esc(date.toLocaleTimeString())}</span></div>
  <div class="row"><span class="muted">Customer:</span><strong>${esc(customer || "Walk-in")}</strong></div>
  ${phone ? `<div class="row"><span class="muted">Phone:</span><span>${esc(phone)}</span></div>` : ""}
  <hr><table><thead><tr><th>#</th><th>Item</th><th class="center">Qty</th><th class="right">Rate</th><th class="right">Amt</th></tr></thead>
  <tbody>${items.map((b, i) => `<tr><td style="color:#999">${i + 1}</td><td>${esc(b.name)}</td><td class="center">${b.qty}</td><td class="right">${cur}${billRate(b)}</td><td class="right"><b>${cur}${lineAmt(b).toFixed(0)}</b></td></tr>`).join("")}</tbody></table>
  <hr>
  ${prev > 0 ? `<div class="row"><span class="muted">Subtotal:</span><span>${cur} ${subtotal.toFixed(0)}</span></div><div class="row"><span class="muted">Previous Balance:</span><span>${cur} ${prev.toFixed(0)}</span></div>` : ""}
  <div class="total"><span>TOTAL</span><span>${cur} ${total.toFixed(0)}</span></div><hr class="hr2">
  <div class="footer">★ Thank you for your purchase! ★<br>Please visit again<br>${esc(date.toLocaleString())}</div>
  </body></html>`;
}


const money = (n) => Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
// Cartons = pieces / pieces-per-carton (e.g. 4 pcs of a 40-pc carton = 0.10). Blank if no carton size is set.
const ctn = (b) => { const per = +b.pieces_per_box; return per > 1 ? (b.qty / per).toFixed(2) : ""; };
const ddmmyyyy = (d) => pkDay(d).split("-").reverse().join("/");

/* A4 invoice layout (distributor style): shop header, two phone boxes,
   customer box + invoice box, ruled item table, Amount / Balance / Subtotal /
   Paid / Amount Due block. Discount is intentionally NOT printed.
   paid: amount received now. null/undefined = unknown (old bills) -> Paid/Due rows hidden. */
export function buildInvoiceHtml({ shop, billNo, date, customer, phone, items, prevBalance = 0, paid = null }) {
  const prev = Math.max(0, Number(prevBalance) || 0);
  const amount = items.reduce((a, b) => a + billLineAmt(b), 0);
  const subtotal = amount + prev;
  const hasPaid = paid !== null && paid !== undefined && !isNaN(+paid);
  const paidAmt = hasPaid ? Math.max(0, +paid) : 0;
  const due = Math.max(0, subtotal - paidAmt);
  // Top boxes: name above number, one box per contact (Settings -> Invoice top box 1 / 2).
  // If none are filled in, the shop phone field (up to two numbers) is used with no name.
  let contacts = [
    { name: shop.contact1_name, phone: shop.contact1_phone },
    { name: shop.contact2_name, phone: shop.contact2_phone },
  ].filter(c => (c.name || "").trim() || (c.phone || "").trim());
  if (!contacts.length) {
    contacts = String(shop.shop_phone || "").split(/[,/&|\n]+/).map(s => s.trim()).filter(Boolean).slice(0, 2).map(t => ({ name: "", phone: t }));
  }

  const rows = items.map((b, i) => `<div class="r"><div class="c1">${esc(b.name)}</div><div class="c2">${ctn(b)}</div><div class="c3">${b.qty}</div><div class="c4">${money(billRate(b))}</div><div class="c5">${money(billLineAmt(b))}</div></div>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(billNo)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:13px;color:#000;background:#fff;max-width:210mm;margin:auto;padding:10mm}
.title{text-align:center;font-size:30px;font-weight:800;letter-spacing:.5px;text-transform:uppercase}
.addr{text-align:center;font-size:14px;margin:3px 0 10px}
.two{display:flex;gap:16px;justify-content:space-between;margin-bottom:8px}
.box{border:1.5px solid #000;padding:8px 12px;flex:1}
.pbox{text-align:center}.pbox .pn{font-size:18px;font-weight:700;text-transform:uppercase}.pbox .pp{font-size:17px;font-weight:500;margin-top:2px}
.info{display:flex;gap:16px;margin-bottom:6px}
.cust{border:1.5px solid #000;padding:8px 12px;flex:1.2;min-height:82px}
.cust .n{font-size:17px;font-weight:700}
.inv{border:1.5px solid #000;padding:8px 12px;flex:1;min-height:82px}
.inv h3{text-align:center;font-size:19px;margin-bottom:6px}
.inv .l{display:flex;justify-content:space-between;font-size:15px;margin:3px 0}
.th,.r{display:grid;grid-template-columns:42% 12% 12% 16% 18%}
.th{background:#7a7a7a;color:#fff;font-weight:600;border:1.5px solid #000;font-size:13px}
.th div{padding:5px 8px}.th .c2,.th .c3,.th .c4,.th .c5,.r .c2,.r .c3,.r .c4,.r .c5{text-align:right}
.body{border:1.5px solid #000;border-top:0;min-height:120mm;
 background:linear-gradient(#000,#000) 42% 0/1px 100% no-repeat,linear-gradient(#000,#000) 54% 0/1px 100% no-repeat,linear-gradient(#000,#000) 66% 0/1px 100% no-repeat,linear-gradient(#000,#000) 82% 0/1px 100% no-repeat}
.r div{padding:5px 8px;font-size:14px}
.bottom{display:flex;gap:16px;margin-top:6px;align-items:flex-start}
.note{flex:1.2;font-size:13px;line-height:1.6}.note b{font-size:20px;display:block;margin-bottom:6px}
.sum{flex:1}.sum .s{display:flex;justify-content:space-between;border:1.5px solid #000;padding:6px 10px;font-size:15px;margin-bottom:5px}
.sum .s.big{font-size:17px;font-weight:800;border-width:2.5px}
.sum .s span:last-child{font-weight:700}
.foot{text-align:center;font-size:11px;color:#444;margin-top:14px}
@media print{@page{size:A4;margin:8mm}body{padding:0}.th{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style></head><body>
<div class="title">${esc(shop.shop_name)}</div>
<div class="addr">${esc(shop.shop_address || shop.shop_tagline || "")}</div>
${contacts.length ? `<div class="two">${contacts.map(c => `<div class="box pbox">${c.name ? `<div class="pn">${esc(c.name)}</div>` : ""}${c.phone ? `<div class="pp">${esc(c.phone)}</div>` : ""}</div>`).join("")}</div>` : ""}
<div class="info">
  <div class="cust"><div class="n">${esc(customer || "Walk-in Customer")}</div>${phone ? `<div style="margin-top:4px">${esc(phone)}</div>` : ""}</div>
  <div class="inv"><h3>Invoice</h3>
    <div class="l"><span>Date:</span><b>${ddmmyyyy(date)}</b></div>
    <div class="l"><span>Invoice #</span><b>${esc(billNo)}</b></div>
  </div>
</div>
<div class="th"><div class="c1">Item Details</div><div class="c2">Ctn</div><div class="c3">Qty</div><div class="c4">Rate</div><div class="c5">Total Rs</div></div>
<div class="body">${rows}</div>
<div class="bottom">
  <div class="note"><b>NOTE</b>Thanks for choosing ${esc(shop.shop_name)}.<br>Please inform three months before expiry for exchange or return, otherwise we will not accept the product.<br>Thank you.</div>
  <div class="sum">
    <div class="s"><span>Amount Rs :</span><span>${money(amount)}</span></div>
    <div class="s"><span>Previous Balance Rs :</span><span>${money(prev)}</span></div>
    <div class="s"><span>Subtotal Rs :</span><span>${money(subtotal)}</span></div>
    ${hasPaid ? `<div class="s"><span>Paid Rs :</span><span>${money(paidAmt)}</span></div><div class="s big"><span>Amount Due Rs</span><span>${money(due)}</span></div>` : `<div class="s big"><span>Total Rs</span><span>${money(subtotal)}</span></div>`}
  </div>
</div>
<div class="foot">${esc(new Date(date).toLocaleString())}</div>
</body></html>`;
}

// Plain-text version of the bill, used for Share / WhatsApp.
export function buildBillText({ shop, billNo, date, customer, items, prevBalance = 0, paid = null }) {
  const cur = shop.currency_symbol;
  const lineAmt = billLineAmt;
  const prev = Math.max(0, Number(prevBalance) || 0);
  const subtotal = items.reduce((a, b) => a + lineAmt(b), 0);
  const total = subtotal + prev;
  const lines = items.map((b) => `• ${b.name} x${b.qty} = ${cur}${lineAmt(b).toFixed(0)}`);
  return [
    `🏪 ${shop.shop_name}`,
    shop.shop_phone ? `📞 ${shop.shop_phone}` : null,
    `Invoice: ${billNo}`,
    `Date: ${date.toLocaleString()}`,
    `Customer: ${customer || "Walk-in"}`,
    "",
    ...lines,
    "",
    ...(prev > 0 ? [`Subtotal: ${cur} ${subtotal.toFixed(0)}`, `Previous Balance: ${cur} ${prev.toFixed(0)}`] : []),
    `TOTAL: ${cur} ${total.toFixed(0)}`,
    ...(paid !== null && paid !== undefined && !isNaN(+paid) ? [`Paid: ${cur} ${(+paid).toFixed(0)}`, `Amount Due: ${cur} ${Math.max(0, total - paid).toFixed(0)}`] : []),
    "",
    "Thank you for your purchase! Please visit again.",
  ].filter((l) => l !== null).join("\n");
}

/* Shows `html` in a full-screen in-page overlay with Print / Share
   / Close buttons. Safe to call from anywhere (even after an await) because
   it never opens a popup. */
export function openDocument({ html, title = "Document", shareText = "", phone = "", variants = null }) {
  // Remove any overlay that is already open.
  document.getElementById("gs-doc-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "gs-doc-overlay";
  overlay.style.cssText =
    "position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,.7);display:flex;flex-direction:column;" +
    "height:100vh;height:100dvh;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)";

  const bar = document.createElement("div");
  bar.style.cssText =
    "display:flex;gap:8px;flex-wrap:wrap;align-items:center;justify-content:center;padding:10px;background:#1f2937";

  const iframe = document.createElement("iframe");
  iframe.title = title;
  iframe.srcdoc = html;
  iframe.style.cssText = "flex:1;width:100%;border:0;background:#fff";

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", onKey);
  };
  const onKey = (e) => { if (e.key === "Escape") close(); };
  document.addEventListener("keydown", onKey);

  const btn = (label, onClick, bg = "#374151") => {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText =
      `background:${bg};color:#fff;border:0;border-radius:8px;padding:10px 14px;font-size:14px;font-weight:600;cursor:pointer;touch-action:manipulation`;
    b.addEventListener("click", onClick);
    bar.appendChild(b);
    return b;
  };

  btn("🖨️ Print / Save PDF", () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.print();
    }
  }, "#16a34a");

  if (shareText) {
    if (navigator.share) {
      btn("📤 Share", () => {
        navigator.share({ title, text: shareText }).catch(() => {}); // user cancelled = fine
      });
    }
  }

  // Optional layouts (e.g. A4 Invoice / 80mm Receipt): button switches between them.
  if (variants && variants.length > 1) {
    let cur = Math.max(0, variants.findIndex(v => v.html === html));
    const sw = btn("", () => {
      cur = (cur + 1) % variants.length;
      iframe.srcdoc = variants[cur].html;
      sw.textContent = "🔁 " + variants[(cur + 1) % variants.length].label;
      try { localStorage.setItem("bill_layout", variants[cur].key); } catch {}
    }, "#2563eb");
    sw.textContent = "🔁 " + variants[(cur + 1) % variants.length].label;
  }

  btn("✖ Close", close, "#dc2626");

  overlay.appendChild(bar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

// One-call helper used by Billing (new sale / preview) and History (reprint).
// Opens the A4 invoice layout by default; the toolbar can switch to the 80mm receipt
// (the last choice is remembered).
export function showBill({ shop, billNo, date, customer, phone, items, prevBalance = 0, paid = null }) {
  const d = date ? new Date(date) : new Date();
  const args = { shop, billNo, date: d, customer, phone, items, prevBalance, paid };
  const invoice = { key: "invoice", label: "Receipt 80mm", html: buildInvoiceHtml(args) };
  const receipt = { key: "receipt", label: "Invoice A4", html: buildBillHtml(args) };
  let pref = "invoice";
  try { pref = localStorage.getItem("bill_layout") || "invoice"; } catch {}
  const variants = pref === "receipt" ? [receipt, invoice] : [invoice, receipt];
  openDocument({
    html: variants[0].html,
    title: `Bill ${billNo}`,
    shareText: buildBillText(args),
    phone,
    variants,
  });
}
