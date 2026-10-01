import { useEffect, useState, useRef } from "react";
import { creditApi } from "../utils/api";
import { getShopInfo } from "../utils/shopInfo";
import { openDocument, esc } from "../utils/printDoc";

export default function Udhaar() {
  const [customers, setCustomers] = useState([]);
  const [summary, setSummary]     = useState(null);
  const [selected, setSelected]   = useState(null);
  const [ledger, setLedger]       = useState([]);
  const [view, setView]           = useState("list");
  const [msg, setMsg]             = useState("");
  const [cForm, setCForm]         = useState({ name: "", phone: "", address: "", notes: "" });
  const [eForm, setEForm]         = useState({ type: "debit", amount: "", description: "" });
  const [search, setSearch]       = useState("");
  const mounted = useRef(true);

  const notify = (m) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const loadAll = () =>
    Promise.all([creditApi.getCustomers(), creditApi.getSummary()])
      .then(([c, s]) => { if (mounted.current) { setCustomers(c); setSummary(s); } });

  const loadLedger = (cid) =>
    creditApi.getLedger(cid).then(l => { if (mounted.current) setLedger(l); });

  useEffect(() => { mounted.current = true; loadAll(); return () => { mounted.current = false; }; }, []);

  const handleAddCustomer = async () => {
    if (!cForm.name.trim()) return notify("❌ Customer name is required");
    try {
      await creditApi.addCustomer(cForm);
      setCForm({ name: "", phone: "", address: "", notes: "" });
      loadAll(); setView("list");
      notify("✅ Customer added successfully!");
    } catch (e) { notify("❌ " + e.message); }
  };

  const handleDeleteCustomer = async (c) => {
    if (!confirm(`Delete "${c.name}" and all their records?`)) return;
    await creditApi.deleteCustomer(c.id);
    loadAll(); setView("list");
    notify("🗑️ Customer deleted");
  };

  const openDetail = (c) => {
    setSelected(c);
    setEForm({ type: "debit", amount: "", description: "" });
    loadLedger(c.id); setView("detail");
  };

  const handleAddEntry = async () => {
    if (!eForm.amount || +eForm.amount <= 0) return notify("❌ Enter a valid amount");
    try {
      await creditApi.addEntry({ customer_id: selected.id, type: eForm.type, amount: +eForm.amount, description: eForm.description });
      setEForm({ type: "debit", amount: "", description: "" });
      loadLedger(selected.id);
      creditApi.getCustomers().then(c => { setCustomers(c); const u = c.find(x => x.id === selected.id); if (u) setSelected(u); });
      creditApi.getSummary().then(setSummary);
      notify(eForm.type === "debit" ? "✅ Credit (Udhaar) recorded" : "✅ Payment recorded");
    } catch (e) { notify("❌ " + e.message); }
  };

  const handleDeleteEntry = async (id) => {
    if (!confirm("Delete this entry?")) return;
    await creditApi.deleteEntry(id);
    loadLedger(selected.id); loadAll();
    notify("🗑️ Entry deleted");
  };

  const printStatement = () => {
    const rows = ledger.map(e => `
      <tr>
        <td>${new Date(e.entry_date).toLocaleDateString()}</td>
        <td>${esc(e.description || (e.type === "debit" ? "Credit given" : "Payment received"))}</td>
        <td class="${e.type === "debit" ? "debit" : ""}">${e.type === "debit" ? "Rs. " + e.amount.toFixed(0) : "—"}</td>
        <td class="${e.type === "payment" ? "credit" : ""}">${e.type === "payment" ? "Rs. " + e.amount.toFixed(0) : "—"}</td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Statement - ${esc(selected.name)}</title>
    <style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px;color:#000;}h2{font-size:18px;margin-bottom:4px;}.meta{color:#555;font-size:11px;margin-bottom:16px;}table{width:100%;border-collapse:collapse;}th{background:#f0f0f0;padding:7px 8px;text-align:left;font-size:11px;border:1px solid #ddd;}td{padding:6px 8px;border:1px solid #ddd;font-size:11px;}.debit{color:#c0392b;font-weight:bold;}.credit{color:#1a6e43;font-weight:bold;}.summary{margin-top:16px;background:#f9f9f9;padding:12px;border-radius:6px;}.summary table{width:auto;}.summary td{border:none;padding:3px 12px;}@media print{@page{margin:10mm;}}</style>
    </head><body>
    <h2>🏪 ${esc(getShopInfo().shop_name)} — Credit Statement</h2>
    <div class="meta">Customer: <strong>${esc(selected.name)}</strong> &nbsp;|&nbsp; Phone: ${esc(selected.phone || "N/A")} &nbsp;|&nbsp; Date: ${new Date().toLocaleDateString()}</div>
    <table><thead><tr><th>Date</th><th>Description</th><th>Debit (Given)</th><th>Payment (Received)</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="summary"><table>
      <tr><td>Total Credit Given:</td><td class="debit">Rs. ${(selected.total_debit||0).toFixed(0)}</td></tr>
      <tr><td>Total Payments Received:</td><td class="credit">Rs. ${(selected.total_payment||0).toFixed(0)}</td></tr>
      <tr><td><strong>Outstanding Balance:</strong></td><td class="${selected.balance>0?"debit":"credit"}"><strong>Rs. ${(selected.balance||0).toFixed(0)}</strong></td></tr>
    </table></div>
    </body></html>`;
    const shareText = `${getShopInfo().shop_name} — Credit Statement\nCustomer: ${selected.name}\nOutstanding Balance: Rs. ${(selected.balance||0).toFixed(0)}`;
    openDocument({ html, title: `Statement - ${selected.name}`, shareText, phone: selected.phone });
  };

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone||"").includes(search)
  );

  return (
    <div className="page">
      {msg && <div className="toast">{msg}</div>}

      {/* LIST VIEW */}
      {view === "list" && (<>
        <div className="page-header">
          <h1>📒 Credit (Udhaar) Book</h1>
          <button className="btn-primary" onClick={() => setView("add-customer")}>+ Add Customer</button>
        </div>
        {summary && (
          <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(4,1fr)", marginBottom: "1.25rem" }}>
            <div className="metric-card metric-red"><div className="metric-icon">📤</div><div className="metric-label">Total Given</div><div className="metric-value">Rs. {summary.total_udhaar.toLocaleString()}</div></div>
            <div className="metric-card metric-green"><div className="metric-icon">📥</div><div className="metric-label">Recovered</div><div className="metric-value">Rs. {summary.total_recovered.toLocaleString()}</div></div>
            <div className="metric-card metric-amber"><div className="metric-icon">⏳</div><div className="metric-label">Outstanding</div><div className="metric-value">Rs. {summary.outstanding.toLocaleString()}</div></div>
            <div className="metric-card metric-blue"><div className="metric-icon">👥</div><div className="metric-label">Customers</div><div className="metric-value">{summary.total_customers}</div></div>
          </div>
        )}
        <div className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
          <input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        {filtered.length === 0 ? (
          <div className="card"><div className="empty"><div style={{ fontSize: "48px", marginBottom: "12px" }}>📒</div>{search ? "No customers found" : "No credit customers yet. Click '+ Add Customer' to start."}</div></div>
        ) : (
          <div className="customer-grid">
            {filtered.map((c, i) => (
              <div key={c.id} className={`customer-card ${c.balance > 0 ? "has-balance" : "clear"}`} style={{ animationDelay: `${i * 0.05}s` }} onClick={() => openDetail(c)}>
                <div className="customer-card-top">
                  <div className="customer-avatar">{c.name[0].toUpperCase()}</div>
                  <div className="customer-info">
                    <div className="customer-name">{c.name}</div>
                    {c.phone && <div className="customer-phone">📞 {c.phone}</div>}
                  </div>
                  <div className={`balance-badge ${c.balance > 0 ? "owed" : "clear"}`}>
                    {c.balance > 0 ? `Rs. ${c.balance.toFixed(0)} owed` : "✅ Clear"}
                  </div>
                </div>
                {c.balance > 0 && (
                  <div className="customer-card-footer">
                    <span>Given: Rs. {c.total_debit.toFixed(0)}</span>
                    <span>Recovered: Rs. {c.total_payment.toFixed(0)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>)}

      {/* ADD CUSTOMER */}
      {view === "add-customer" && (<>
        <div className="page-header">
          <h1>Add Credit Customer</h1>
          <button className="btn-outline" onClick={() => setView("list")}>← Back</button>
        </div>
        <div className="card" style={{ maxWidth: "480px" }}>
          <h2 className="card-title">Customer Details</h2>
          <label>Full Name *</label>
          <input value={cForm.name} onChange={e => setCForm({...cForm, name: e.target.value})} placeholder="e.g. Ahmed Khan" autoFocus />
          <label>Phone Number</label>
          <input value={cForm.phone} onChange={e => setCForm({...cForm, phone: e.target.value})} placeholder="03xx-xxxxxxx" />
          <label>Address</label>
          <input value={cForm.address} onChange={e => setCForm({...cForm, address: e.target.value})} placeholder="House / Street (optional)" />
          <label>Notes</label>
          <input value={cForm.notes} onChange={e => setCForm({...cForm, notes: e.target.value})} placeholder="Any notes (optional)" />
          <div style={{ display: "flex", gap: "8px", marginTop: "14px" }}>
            <button className="btn-primary" style={{ flex: 1 }} onClick={handleAddCustomer}>Add Customer</button>
            <button className="btn-outline" onClick={() => setView("list")}>Cancel</button>
          </div>
        </div>
      </>)}

      {/* DETAIL / LEDGER */}
      {view === "detail" && selected && (<>
        <div className="page-header">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <button className="btn-outline" style={{ padding: "7px 12px" }} onClick={() => { setView("list"); loadAll(); }}>← Back</button>
            <h1>{selected.name}</h1>
            <span className={`badge ${selected.balance > 0 ? "red" : "green"}`}>
              {selected.balance > 0 ? `Rs. ${selected.balance.toFixed(0)} outstanding` : "✅ All clear"}
            </span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button className="btn-outline" onClick={printStatement}>🖨️ Print Statement</button>
            <button className="btn-sm btn-danger" onClick={() => handleDeleteCustomer(selected)}>Delete</button>
          </div>
        </div>

        {(selected.phone || selected.address || selected.notes) && (
          <div className="card" style={{ marginBottom: "1rem", padding: "0.9rem 1.25rem" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", fontSize: "13px", color: "var(--text2)" }}>
              {selected.phone   && <span>📞 {selected.phone}</span>}
              {selected.address && <span>📍 {selected.address}</span>}
              {selected.notes   && <span>📝 {selected.notes}</span>}
            </div>
          </div>
        )}

        <div className="two-col" style={{ alignItems: "start" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
              <div className="metric-card metric-red"><div className="metric-label">Total Given</div><div className="metric-value" style={{ fontSize: "15px" }}>Rs. {(selected.total_debit||0).toFixed(0)}</div></div>
              <div className="metric-card metric-green"><div className="metric-label">Recovered</div><div className="metric-value" style={{ fontSize: "15px" }}>Rs. {(selected.total_payment||0).toFixed(0)}</div></div>
              <div className={`metric-card ${(selected.balance||0) > 0 ? "metric-amber" : "metric-green"}`}><div className="metric-label">Balance Due</div><div className="metric-value" style={{ fontSize: "15px" }}>Rs. {(selected.balance||0).toFixed(0)}</div></div>
            </div>
            <div className="card">
              <h2 className="card-title">➕ Add Entry</h2>
              <label>Entry Type</label>
              <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                <button className={eForm.type === "debit" ? "type-btn active-debit" : "type-btn"} onClick={() => setEForm({...eForm, type: "debit"})}>📤 Credit Given</button>
                <button className={eForm.type === "payment" ? "type-btn active-payment" : "type-btn"} onClick={() => setEForm({...eForm, type: "payment"})}>📥 Payment Received</button>
              </div>
              <label>Amount (Rs.)</label>
              <input type="number" min="1" value={eForm.amount} onChange={e => setEForm({...eForm, amount: e.target.value})} placeholder="e.g. 500" />
              <label>Description (optional)</label>
              <input value={eForm.description} onChange={e => setEForm({...eForm, description: e.target.value})} placeholder={eForm.type === "debit" ? "e.g. Groceries on 15 April" : "e.g. Cash payment"} />
              <button
                className="full-width"
                style={{ padding: "12px", fontSize: "13px", fontWeight: 700, border: "none", borderRadius: "var(--radius)", cursor: "pointer", marginTop: "12px", background: eForm.type === "debit" ? "linear-gradient(135deg,#ff4757,#ff6b7a)" : "linear-gradient(135deg,#00b894,#00d68f)", color: "#fff", boxShadow: eForm.type === "debit" ? "0 4px 16px rgba(255,71,87,0.35)" : "0 4px 16px rgba(0,214,143,0.3)" }}
                onClick={handleAddEntry}
              >
                {eForm.type === "debit" ? "📤 Record Credit (Udhaar)" : "📥 Record Payment"}
              </button>
            </div>
          </div>

          <div className="card">
            <h2 className="card-title">📒 Account Ledger</h2>
            {ledger.length === 0 ? <div className="empty">No entries yet</div> : (
              <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                <table className="ledger-table">
                  <thead><tr><th>Date</th><th>Description</th><th style={{ textAlign: "right", color: "var(--red)" }}>Debit</th><th style={{ textAlign: "right", color: "var(--green)" }}>Payment</th><th></th></tr></thead>
                  <tbody>
                    {ledger.map(e => (
                      <tr key={e.id} className={e.type === "debit" ? "debit-row" : "payment-row"}>
                        <td style={{ fontSize: "11px", color: "var(--muted)", whiteSpace: "nowrap" }}>{new Date(e.entry_date).toLocaleDateString()}</td>
                        <td style={{ fontSize: "12px" }}>{e.description || (e.type === "debit" ? "Credit given" : "Payment received")}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--red)" }}>{e.type === "debit" ? `Rs. ${e.amount.toFixed(0)}` : "—"}</td>
                        <td style={{ textAlign: "right", fontWeight: 700, color: "var(--green)" }}>{e.type === "payment" ? `Rs. ${e.amount.toFixed(0)}` : "—"}</td>
                        <td><button className="btn-sm btn-danger" onClick={() => handleDeleteEntry(e.id)}>×</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </>)}
    </div>
  );
}
