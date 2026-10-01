import { useEffect, useState } from "react";
import { api } from "../utils/api";
import { getShopInfo } from "../utils/shopInfo";
import { showBill } from "../utils/printDoc";
function openBill(s) {
  showBill({
    shop: getShopInfo(),
    billNo: `#${s.id}`,
    date: s.sale_date,
    customer: s.customer,
    items: s.items_json,
  });
}
export default function History() {
  const [sales, setSales] = useState([]);
  const [filter, setFilter] = useState("all");
  const [msg, setMsg] = useState("");
  const load = () => api.getSales().then(setSales);
  useEffect(() => { load(); }, []);
  const notify = m => { setMsg(m); setTimeout(()=>setMsg(""),3000); };
  const del = async id => {
    if(!confirm("Delete this sale? Stock will be restored.")) return;
    await api.deleteSale(id); load(); notify("🗑️ Sale deleted, stock restored");
  };
  const today = new Date().toDateString();
  const thisMonth = new Date().toISOString().slice(0,7);
  const filtered = sales.filter(s => {
    if(filter==="today") return new Date(s.sale_date).toDateString()===today;
    if(filter==="month") return s.sale_date.startsWith(thisMonth);
    return true;
  });
  const totalRev = filtered.reduce((a,s)=>a+s.total,0);
  const totalPro = filtered.reduce((a,s)=>a+s.profit,0);
  return (
    <div className="page">
      {msg&&<div className="toast">{msg}</div>}
      <div className="page-header"><h1>Sales History</h1></div>
      <div className="metrics-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:"1rem"}}>
        <div className="metric-card metric-blue"><span className="metric-icon">🧾</span><div className="metric-label">Transactions</div><div className="metric-value">{filtered.length}</div></div>
        <div className="metric-card metric-purple"><span className="metric-icon">💵</span><div className="metric-label">Revenue</div><div className="metric-value">Rs. {totalRev.toLocaleString()}</div></div>
        <div className="metric-card metric-green"><span className="metric-icon">💰</span><div className="metric-label">Profit</div><div className="metric-value">Rs. {totalPro.toLocaleString()}</div></div>
      </div>
      <div className="card">
        <div className="filter-row">
          {["all","today","month"].map(f=><button key={f} className={filter===f?"btn-filter active":"btn-filter"} onClick={()=>setFilter(f)}>{f==="all"?"All Time":f==="today"?"Today":"This Month"}</button>)}
        </div>
        {filtered.length===0?<div className="empty">No sales in this period</div>:
          filtered.map(s=>(
            <div key={s.id} className="sale-card">
              <div className="sale-header">
                <div>
                  <span className="sale-customer">{s.customer}</span>
                  <span className="sale-date">{new Date(s.sale_date).toLocaleString()}</span>
                  {s.sold_by && <span className="item-pill" style={{ marginLeft: "6px", fontSize: "10px" }}>👤 {s.sold_by}</span>}
                </div>
                <div style={{display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
                  <span className="bold">Rs. {s.total.toFixed(0)}</span>
                  <span className="green">+Rs. {s.profit.toFixed(0)}</span>
                  <button className="btn-sm" onClick={()=>openBill(s)}>🖨️ Reprint</button>
                  <button className="btn-sm btn-danger" onClick={()=>del(s.id)}>Delete</button>
                </div>
              </div>
              <div className="sale-items">{s.items_json.map((i,idx)=><span key={idx} className="item-pill">{i.name} ×{i.qty}{i.discount>0?` (−Rs.${i.discount.toFixed(0)})`:""}</span>)}</div>
            </div>
          ))}
      </div>
    </div>
  );
}
