import { useEffect, useState } from "react";
import { api, returnsApi } from "../utils/api";
import { getShopInfo } from "../utils/shopInfo";

export default function Returns() {
  const [items, setItems]       = useState([]);
  const [returns, setReturns]   = useState([]);
  const [summary, setSummary]   = useState({ total_refund: 0, total_qty: 0, count: 0, today_refund: 0 });
  const [msg, setMsg]           = useState("");
  const [loading, setLoading]   = useState(false);
  const [filter, setFilter]     = useState("all");
  const currency = getShopInfo().currency_symbol;

  const [form, setForm] = useState({
    item_id: "", qty: 1, refund_amount: "", reason: "", customer: "", restock: true,
  });

  const load = () => {
    api.getItems().then(setItems);
    returnsApi.list().then(setReturns);
    returnsApi.summary().then(setSummary);
  };
  useEffect(() => { load(); }, []);
  const notify = m => { setMsg(m); setTimeout(() => setMsg(""), 4000); };

  const selectedItem = items.find(i => i.id === +form.item_id);

  const onItemChange = (id) => {
    const it = items.find(i => i.id === +id);
    setForm({
      ...form,
      item_id: id,
      refund_amount: it ? (it.sale_price * (form.qty || 1)).toFixed(0) : "",
    });
  };

  const onQtyChange = (qty) => {
    qty = Math.max(1, +qty || 1);
    setForm({
      ...form,
      qty,
      refund_amount: selectedItem ? (selectedItem.sale_price * qty).toFixed(0) : form.refund_amount,
    });
  };

  const submit = async () => {
    if (!form.item_id) return notify("❌ Please select an item");
    if (!form.qty || form.qty < 1) return notify("❌ Quantity must be at least 1");
    setLoading(true);
    try {
      await returnsApi.create({
        item_id: +form.item_id,
        qty: +form.qty,
        refund_amount: +form.refund_amount || 0,
        reason: form.reason,
        customer: form.customer,
        restock: form.restock,
      });
      notify("✅ Return recorded" + (form.restock ? " & stock updated" : ""));
      setForm({ item_id: "", qty: 1, refund_amount: "", reason: "", customer: "", restock: true });
      load();
    } catch (e) { notify("❌ " + e.message); }
    finally { setLoading(false); }
  };

  const del = async (id) => {
    if (!confirm("Delete this return record? Stock adjustment will be reversed if it was restocked.")) return;
    await returnsApi.remove(id);
    notify("🗑️ Return record deleted");
    load();
  };

  const today = new Date().toDateString();
  const thisMonth = new Date().toISOString().slice(0, 7);
  const filtered = returns.filter(r => {
    if (filter === "today") return new Date(r.return_date).toDateString() === today;
    if (filter === "month") return r.return_date.startsWith(thisMonth);
    return true;
  });

  return (
    <div className="page">
      {msg && <div className="toast">{msg}</div>}
      <div className="page-header"><h1>Returns / Claims</h1></div>

      <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(3,1fr)", marginBottom: "1rem" }}>
        <div className="metric-card metric-blue">
          <span className="metric-icon">↩️</span>
          <div className="metric-label">Total Returns</div>
          <div className="metric-value">{summary.count}</div>
        </div>
        <div className="metric-card metric-red">
          <span className="metric-icon">💸</span>
          <div className="metric-label">Total Refunded</div>
          <div className="metric-value">{currency} {summary.total_refund.toLocaleString()}</div>
        </div>
        <div className="metric-card metric-purple">
          <span className="metric-icon">📦</span>
          <div className="metric-label">Items Returned</div>
          <div className="metric-value">{summary.total_qty}</div>
        </div>
      </div>

      <div className="two-col">
        <div className="card">
          <h2 className="card-title">↩️ Record a Return / Claim</h2>

          <label>Item *</label>
          <select value={form.item_id} onChange={e => onItemChange(e.target.value)}>
            <option value="">-- Choose an item --</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name} — {currency}{i.sale_price}</option>)}
          </select>

          <div className="row-2">
            <div>
              <label>Quantity Returned *</label>
              <input type="number" min="1" value={form.qty} onChange={e => onQtyChange(e.target.value)} />
            </div>
            <div>
              <label>Refund Amount</label>
              <input type="number" min="0" value={form.refund_amount}
                onChange={e => setForm({ ...form, refund_amount: e.target.value })}
                placeholder="0" />
            </div>
          </div>

          <label>Customer Name (optional)</label>
          <input value={form.customer} onChange={e => setForm({ ...form, customer: e.target.value })} placeholder="Walk-in Customer" />

          <label>Reason (optional)</label>
          <input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} placeholder="e.g. Damaged, wrong item, expired" />

          <label style={{ display: "flex", alignItems: "center", gap: "9px", cursor: "pointer", marginTop: "10px" }}>
            <input type="checkbox" checked={form.restock} onChange={e => setForm({ ...form, restock: e.target.checked })}
              style={{ width: "16px", height: "16px", cursor: "pointer", marginBottom: 0 }} />
            📦 Add item back to stock
          </label>
          <div className="login-hint" style={{ marginTop: "2px" }}>
            Uncheck this if the item is damaged/unsellable and shouldn't go back on the shelf.
          </div>

          <button className="btn-primary full-width" style={{ marginTop: "1rem" }} onClick={submit} disabled={loading}>
            {loading ? "Saving..." : "✅ Record Return"}
          </button>
        </div>

        <div className="card">
          <h2 className="card-title">📋 Return History</h2>
          <div className="filter-row">
            {["all", "today", "month"].map(f => (
              <button key={f} className={filter === f ? "btn-filter active" : "btn-filter"} onClick={() => setFilter(f)}>
                {f === "all" ? "All Time" : f === "today" ? "Today" : "This Month"}
              </button>
            ))}
          </div>
          {filtered.length === 0
            ? <div className="empty">No returns in this period</div>
            : filtered.map(r => (
              <div key={r.id} className="sale-card">
                <div className="sale-header">
                  <div>
                    <span className="sale-customer">{r.item_name} ×{r.qty}</span>
                    <span className="sale-date">{new Date(r.return_date).toLocaleString()}</span>
                    {r.customer && <span className="item-pill" style={{ marginLeft: "6px", fontSize: "10px" }}>👤 {r.customer}</span>}
                    {r.processed_by && <span className="item-pill" style={{ marginLeft: "6px", fontSize: "10px" }}>🧑‍💼 {r.processed_by}</span>}
                  </div>
                  <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
                    <span className="bold" style={{ color: "var(--red)" }}>−{currency} {r.refund_amount.toFixed(0)}</span>
                    <button className="btn-sm btn-danger" onClick={() => del(r.id)}>Delete</button>
                  </div>
                </div>
                {(r.reason || !r.restocked) && (
                  <div className="sale-items">
                    {r.reason && <span className="item-pill">📝 {r.reason}</span>}
                    <span className="item-pill">{r.restocked ? "📦 Restocked" : "🚫 Not restocked"}</span>
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
