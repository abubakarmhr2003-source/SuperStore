import { useEffect, useState, useRef } from "react";
import { api } from "../utils/api";

const fmt = v => Number(v ?? 0).toLocaleString();

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true); setError(null);
    Promise.allSettled([api.getStats(), api.getItems(), api.getSales()])
      .then(res => {
        if (!mounted.current) return;
        const names = ["stats", "items", "sales"];
        const failed = res.map((r, k) => r.status === "rejected" ? `${names[k]}: ${r.reason?.message}` : null).filter(Boolean);
        if (failed.length) return setError(failed.join(" | "));
        const st = res[0].value;
        if (!st || typeof st !== "object" || st.total_revenue === undefined || st.today_revenue === undefined) {
          return setError("stats returned unexpected data: " + JSON.stringify(st).slice(0, 250));
        }
        setStats(st); setItems(res[1].value); setSales(res[2].value);
      })
      .finally(() => { if (mounted.current) setLoading(false); });
    return () => { mounted.current = false; };
  }, []);

  if (loading) return (
    <div className="page">
      <div className="page-header"><h1>Dashboard</h1></div>
      <div className="loading">Loading dashboard...</div>
    </div>
  );
  if (error) return (
    <div className="page">
      <div className="page-header"><h1>Dashboard</h1></div>
      <div className="empty" style={{ color: "var(--red)" }}>❌ Could not connect to backend.<br /><small>{error}</small></div>
    </div>
  );

  const lowStock   = items.filter(i => i.qty < 10 && i.qty > 0);
  const outOfStock = items.filter(i => i.qty === 0);
  const topSelling = [...items].sort((a, b) => b.sold - a.sold).filter(i => i.sold > 0).slice(0, 5);
  const recent5    = sales.slice(0, 5);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <span className="date-badge">{new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>

      <div className="metrics-grid">
        <Metric label="Today's Sales"   value={`Rs. ${fmt(stats.today_revenue)}`}  color="blue"   icon="📈" />
        <Metric label="Today's Profit"  value={`Rs. ${fmt(stats.today_profit)}`}   color="green"  icon="💰" />
        <Metric label="Total Revenue"   value={`Rs. ${fmt(stats.total_revenue)}`}  color="purple" icon="🏦" />
        <Metric label="Net Profit"      value={`Rs. ${fmt(stats.net_profit)}`}     color={stats.net_profit >= 0 ? "teal" : "red"} icon="📊" />
        <Metric label="Stock Value"     value={`Rs. ${fmt(stats.stock_value)}`}    color="amber"  icon="📦" />
        <Metric label="Total Sales"     value={stats.total_sales_count}                        color="blue"   icon="🧾" />
        <Metric label="Low Stock Items" value={stats.low_stock}                                color="orange" icon="⚠️" />
        <Metric label="Out of Stock"    value={stats.out_of_stock}                             color="red"    icon="❌" />
      </div>

      <div className="two-col" style={{ marginBottom: "1rem" }}>
        <div className="card">
          <h2 className="card-title">Recent Sales</h2>
          {recent5.length === 0 ? <p className="empty">No sales yet</p> : (
            <table className="simple-table">
              <thead><tr><th>Customer</th><th>Items</th><th>Total</th><th>Profit</th></tr></thead>
              <tbody>
                {recent5.map(s => (
                  <tr key={s.id}>
                    <td className="bold">{s.customer}</td>
                    <td className="muted">{s.items_json.map(i => i.name).join(", ")}</td>
                    <td className="bold">Rs. {Number(s.total||0).toFixed(0)}</td>
                    <td className="green">Rs. {Number(s.profit||0).toFixed(0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h2 className="card-title">Stock Alerts</h2>
          {outOfStock.length === 0 && lowStock.length === 0
            ? <p className="empty">✅ All stock levels are fine</p>
            : <>
              {outOfStock.map(i => (
                <div key={i.id} className="alert-row">
                  <span className="bold">{i.name}</span>
                  <span className="badge red">Out of Stock</span>
                </div>
              ))}
              {lowStock.map(i => (
                <div key={i.id} className="alert-row">
                  <span>{i.name}</span>
                  <span className="badge orange">{i.qty} left</span>
                </div>
              ))}
            </>}
        </div>
      </div>

      <div className="card">
        <h2 className="card-title">Top Selling Items</h2>
        {topSelling.length === 0
          ? <p className="empty">Make some sales to see top items</p>
          : topSelling.map(i => {
            const pct = Math.min(100, Math.round((i.sold / (i.sold + i.qty + 1)) * 100));
            return (
              <div key={i.id} style={{ marginBottom: "14px" }}>
                <div className="bar-label"><span className="bold">{i.name}</span><span className="muted">{i.sold} pieces sold</span></div>
                <div className="bar-bg"><div className="bar-fill" style={{ width: `${pct}%` }} /></div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

function Metric({ label, value, color, icon }) {
  return (
    <div className={`metric-card metric-${color}`}>
      <span className="metric-icon">{icon}</span>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
    </div>
  );
}
