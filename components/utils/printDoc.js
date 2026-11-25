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

// Developer credit printed at the bottom of every bill. Put the phone number in DEVELOPER_PHONE.
export const DEVELOPER_NAME = "Abu Bakar";
export const DEVELOPER_PHONE = "03096149644";
export const developerLine = () => `Software by ${DEVELOPER_NAME}${DEVELOPER_PHONE ? " — " + DEVELOPER_PHONE : ""}`;

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
export function buildBillHtml({ shop, billNo, date, customer, phone, address = "", items, prevBalance = 0 }) {
  const cur = esc(shop.currency_symbol);
  const lineAmt = billLineAmt;
  const prev = Math.max(0, Number(prevBalance) || 0);
  const subtotal = items.reduce((a, b) => a + lineAmt(b), 0);
  const total = subtotal + prev;

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(billNo)}</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial,Helvetica,sans-serif;font-size:15px;font-weight:600;width:360px;max-width:100%;margin:auto;padding:14px;background:#fff;color:#000}
  .shop{text-align:center;font-size:26px;font-weight:800;letter-spacing:.5px}.sub{text-align:center;font-size:13px;color:#222;margin-bottom:4px}
  hr{border:none;border-top:1.5px dashed #000;margin:9px 0}.hr2{border-top:2.5px solid #000}
  .row{display:flex;justify-content:space-between;gap:10px;font-size:15px;margin:4px 0}.row.addr span:last-child{text-align:right}.muted{color:#222;font-weight:500}
  table{width:100%;border-collapse:collapse}th{padding:5px 3px;font-size:13px;font-weight:800;text-align:left;border-bottom:2px solid #000}
  td{padding:6px 3px;font-size:15px;border-bottom:1px dotted #555}.right{text-align:right}.center{text-align:center}
  .total{display:flex;justify-content:space-between;font-size:22px;font-weight:800;padding:7px 0}
  .footer{text-align:center;font-size:13px;color:#222;margin-top:10px;line-height:1.8}
  .ur{font-family:'Jameel Noori Nastaleeq','Noto Nastaliq Urdu','Urdu Typesetting','Noto Naskh Arabic','Segoe UI',Tahoma,Arial,sans-serif;font-size:22px;font-weight:700;color:#000;line-height:2;direction:rtl}
  .dev{text-align:center;font-size:12px;font-weight:700;color:#000;padding-bottom:6px}
  @media print{@page{size:80mm auto;margin:0}body{width:100%;padding:4mm;-webkit-print-color-adjust:exact;print-color-adjust:exact}}</style></head><body>
  <div class="shop">🏪 ${esc(shop.shop_name.toUpperCase())}</div><div class="sub">${esc(shop.shop_tagline)}</div>
  ${shop.shop_phone ? `<div class="sub">📞 ${esc(shop.shop_phone)}</div>` : ""}
  ${shop.shop_address ? `<div class="sub">📍 ${esc(shop.shop_address)}</div>` : ""}
  <hr class="hr2"><div class="row"><span class="muted">Customer:</span><strong>${esc(customer || "Walk-in")}</strong></div>
  ${phone ? `<div class="row"><span class="muted">Phone:</span><span>${esc(phone)}</span></div>` : ""}
  ${address ? `<div class="row addr"><span class="muted">Address:</span><span>${esc(address)}</span></div>` : ""}
  <hr><table><thead><tr><th>#</th><th>Item</th><th class="center">Qty</th><th class="right">Rate</th><th class="right">Amt</th></tr></thead>
  <tbody>${items.map((b, i) => `<tr><td style="color:#999">${i + 1}</td><td>${esc(b.name)}</td><td class="center">${b.qty}</td><td class="right">${cur}${billRate(b)}</td><td class="right"><b>${cur}${lineAmt(b).toFixed(0)}</b></td></tr>`).join("")}</tbody></table>
  <hr>
  ${prev > 0 ? `<div class="row"><span class="muted">Subtotal:</span><span>${cur} ${subtotal.toFixed(0)}</span></div><div class="row"><span class="muted">Previous Balance:</span><span>${cur} ${prev.toFixed(0)}</span></div>` : ""}
  <div class="total"><span>TOTAL</span><span>${cur} ${total.toFixed(0)}</span></div><hr class="hr2">
  <div class="footer"><div class="ur" dir="rtl" lang="ur">آپ کی محبتوں کا شکریہ</div>Please visit again<br>${esc(date.toLocaleString())}</div>
  <hr><div class="dev">${esc(developerLine())}</div>
  </body></html>`;
}


// Plain-text version of the bill, used for Share / WhatsApp.
export function buildBillText({ shop, billNo, date, customer, address = "", items, prevBalance = 0 }) {
  const cur = shop.currency_symbol;
  const lineAmt = billLineAmt;
  const prev = Math.max(0, Number(prevBalance) || 0);
  const subtotal = items.reduce((a, b) => a + lineAmt(b), 0);
  const total = subtotal + prev;
  const lines = items.map((b) => `• ${b.name} x${b.qty} = ${cur}${lineAmt(b).toFixed(0)}`);
  return [
    `🏪 ${shop.shop_name}`,
    shop.shop_phone ? `📞 ${shop.shop_phone}` : null,
    `Customer: ${customer || "Walk-in"}`,
    address ? `Address: ${address}` : null,
    "",
    ...lines,
    "",
    ...(prev > 0 ? [`Subtotal: ${cur} ${subtotal.toFixed(0)}`, `Previous Balance: ${cur} ${prev.toFixed(0)}`] : []),
    `TOTAL: ${cur} ${total.toFixed(0)}`,
    "",
    "آپ کی محبتوں کا شکریہ",
  ].filter((l) => l !== null).join("\n");
}

/* Shows `html` in a full-screen in-page overlay with Print / Save
   / Close buttons. Safe to call from anywhere (even after an await) because
   it never opens a popup. */
export function openDocument({ html, title = "Document", shareText = "", phone = "" }) {
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

  const doPrint = () => {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
    } catch {
      window.print();
    }
  };

  btn("🖨️ Print", doPrint, "#16a34a");

  // Save = the same print dialog, where "Save as PDF" is picked as the printer.
  const hint = document.createElement("div");
  hint.style.cssText = "width:100%;text-align:center;color:#fbbf24;font-size:12px;display:none";
  hint.textContent = "Print window mein Printer / Destination ki jagah \"Save as PDF\" chunein";
  btn("💾 Save", () => {
    hint.style.display = "block";
    setTimeout(() => { hint.style.display = "none"; }, 7000);
    doPrint();
  }, "#2563eb");

  btn("✖ Close", close, "#dc2626");

  bar.appendChild(hint);
  overlay.appendChild(bar);
  overlay.appendChild(iframe);
  document.body.appendChild(overlay);
}

// One-call helper used by Billing (new sale / preview) and History (reprint).
export function showBill({ shop, billNo, date, customer, phone, address = "", items, prevBalance = 0 }) {
  const d = date ? new Date(date) : new Date();
  const args = { shop, billNo, date: d, customer, phone, address, items, prevBalance };
  openDocument({
    html: buildBillHtml(args),
    title: `Bill ${billNo}`,
    shareText: buildBillText(args),
    phone,
  });
}
