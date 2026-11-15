import { useEffect, useState, useRef } from "react";
import { api } from "../utils/api";

const fmt = v => Number(v ?? 0).toLocaleString();

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    setLoading(true); setError(null);
    Promise.allSettled([api.getStats(), api.getItems()])
      .then(res => {
        if (!mounted.current) return;
        const names = ["stats", "items"];
        const failed = res.map((r, k) => r.status === "rejected" ? `${names[k]}: ${r.reason?.message}` : null).filter(Boolean);
        if (failed.length) return setError(failed.join(" | "));
        const st = res[0].value;
        if (!st || typeof st !== "object" || st.total_revenue === undefined || st.today_revenue === undefined) {
          return setError("stats returned unexpected data: " + JSON.stringify(st).slice(0, 250));
        }
        setStats(st); setItems(res[1].value);
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

  const topSelling = [...items].sort((a, b) => b.sold - a.sold).filter(i => i.sold > 0).slice(0, 5);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Dashboard</h1>
        <span className="date-badge">{new Date().toLocaleDateString("en-PK", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</span>
      </div>

      <WeekChart week={stats.week || []} />

      <div className="metrics-grid five">
        <Metric label="Today's Sales"   value={`Rs. ${fmt(stats.today_revenue)}`}  color="blue"   icon="📈" />
        <Metric label="Today's Profit"  value={`Rs. ${fmt(stats.today_profit)}`}   color="green"  icon="💰" />
        <Metric label="Today's Credit"  value={`Rs. ${fmt(stats.today_credit)}`}  color="red"    icon="📒" />
        <Metric label="Total Credit"    value={`Rs. ${fmt(stats.total_credit)}`}  color="orange" icon="📚" />
        <Metric label="Total Revenue"   value={`Rs. ${fmt(stats.total_revenue)}`}  color="purple" icon="🏦" />
        <Metric label="Net Profit"      value={`Rs. ${fmt(stats.net_profit)}`}     color={stats.net_profit >= 0 ? "teal" : "red"} icon="📊" />
        <Metric label="Stock Value"     value={`Rs. ${fmt(stats.stock_value)}`}    color="amber"  icon="📦" />
        <Metric label="Total Sales"     value={stats.total_sales_count}                        color="blue"   icon="🧾" />
        <Metric label="Low Stock Items" value={stats.low_stock}                                color="orange" icon="⚠️" />
        <Metric label="Out of Stock"    value={stats.out_of_stock}                             color="red"    icon="❌" />
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

const short = v => {
  const n = Number(v || 0);
  return n >= 100000 ? (n / 1000).toFixed(0) + "k" : n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, "") + "k" : String(Math.round(n));
};
const dayLabel = d => new Date(d + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", timeZone: "UTC" });

function WeekChart({ week }) {
  const max = Math.max(1, ...week.map(d => d.revenue));
  const totRev = week.reduce((a, d) => a + d.revenue, 0);
  const totPro = week.reduce((a, d) => a + d.profit, 0);
  return (
    <div className="card week-chart">
      <div className="week-head">
        <h2 className="card-title" style={{ margin: 0 }}>📊 Last 7 Days</h2>
        <div className="week-legend">
          <span><i style={{ background: "var(--blue)" }} />Sales</span>
          <span><i style={{ background: "var(--green)" }} />Profit</span>
        </div>
      </div>
      <div className="week-bars">
        {week.map((d, k) => {
          const isToday = k === week.length - 1;
          return (
            <div key={d.day} className={"week-col" + (isToday ? " today" : "")} title={`${dayLabel(d.day)} — Sales Rs. ${fmt(d.revenue)} | Profit Rs. ${fmt(d.profit)}`}>
              <div className="week-pair">
                <div className="week-bar-wrap"><span className="week-val">{short(d.revenue)}</span><div className="week-bar sales" style={{ height: `${(d.revenue / max) * 100}%` }} /></div>
                <div className="week-bar-wrap"><span className="week-val">{short(d.profit)}</span><div className="week-bar profit" style={{ height: `${(d.profit / max) * 100}%` }} /></div>
              </div>
              <div className="week-label">{isToday ? "Today" : dayLabel(d.day)}</div>
            </div>
          );
        })}
      </div>
      <div className="week-foot">Week total: <strong>Sales Rs. {fmt(totRev)}</strong> · <strong className="green">Profit Rs. {fmt(totPro)}</strong></div>
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
