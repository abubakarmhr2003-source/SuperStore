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
  const [search, setSearch] = useState("");
  const [allItems, setAllItems] = useState([]);
  const [editing, setEditing] = useState(null);   // sale being edited
  const [eCustomer, setECustomer] = useState("");
  const [eItems, setEItems] = useState([]);
  const [addSearch, setAddSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editErr, setEditErr] = useState("");
  const [msg, setMsg] = useState("");
  const load = () => api.getSales().then(setSales);
  useEffect(() => { load(); }, []);
  const notify = m => { setMsg(m); setTimeout(()=>setMsg(""),3000); };
  const del = async id => {
    if(!confirm("Delete this sale? Stock will be restored.")) return;
    await api.deleteSale(id); load(); notify("🗑️ Sale deleted, stock restored");
  };
  const startEdit = s => {
    setEditing(s); setECustomer(s.customer); setEditErr(""); setAddSearch("");
    setEItems(s.items_json.map(i => ({ ...i })));
    api.getItems().then(setAllItems).catch(()=>{});
  };
  const closeEdit = () => { setEditing(null); setEItems([]); };
  const setLine = (id, patch) => setEItems(list => list.map(i => {
    if (i.id !== id) return i;
    const n = { ...i, ...patch };
    const gross = n.qty * n.sale_price;
    n.discount = Math.max(0, Math.min(gross, +n.discount || 0));
    return n;
  }));
  const addLine = it => {
    if (eItems.some(i => i.id === it.id)) return setAddSearch("");
    setEItems([...eItems, { id: it.id, name: it.name, qty: 1, sale_price: it.sale_price, cost_price: it.cost_price, discount: 0 }]);
    setAddSearch("");
  };
  const eTotal  = eItems.reduce((a,i)=>a+i.qty*i.sale_price-(i.discount||0),0);
  const eProfit = eItems.reduce((a,i)=>a+(i.sale_price-i.cost_price)*i.qty-(i.discount||0),0);
  const saveEdit = async () => {
    if(!eItems.length) return setEditErr("Add at least one item (or delete the sale)");
    setSaving(true); setEditErr("");
    try {
      await api.updateSale(editing.id, {
        customer: eCustomer,
        items: eItems.map(i => ({ id:i.id, qty:i.qty, discount:i.discount||0 })),
      });
      closeEdit(); load(); notify("✅ Sale updated, stock adjusted");
    } catch(e) { setEditErr(e.message); }
    finally { setSaving(false); }
  };
  const addQ = addSearch.trim().toLowerCase();
  const addMatches = addQ ? allItems.filter(i => i.name.toLowerCase().includes(addQ) && i.qty>0 && !eItems.some(x=>x.id===i.id)).slice(0,6) : [];

  const today = new Date().toDateString();
  const thisMonth = new Date().toISOString().slice(0,7);
  const q = search.trim().toLowerCase();
  const matchesSearch = s => {
    if(!q) return true;
    const hay = [
      s.customer, s.sold_by, `#${s.id}`, String(s.id),
      new Date(s.sale_date).toLocaleString(), s.sale_date,
      ...(s.items_json||[]).map(i=>i.name),
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(q);
  };
  const filtered = sales.filter(s => {
    if(filter==="today" && new Date(s.sale_date).toDateString()!==today) return false;
    if(filter==="month" && !s.sale_date.startsWith(thisMonth)) return false;
    return matchesSearch(s);
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
        <input
          value={search}
          onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Search by customer, item, bill no. or date..."
          style={{marginBottom:"12px"}}
        />
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
                  <button className="btn-sm" onClick={()=>startEdit(s)}>✏️ Edit</button>
                  <button className="btn-sm btn-danger" onClick={()=>del(s.id)}>Delete</button>
                </div>
              </div>
              <div className="sale-items">{s.items_json.map((i,idx)=><span key={idx} className="item-pill">{i.name} ×{i.qty}{i.discount>0?` (−Rs.${i.discount.toFixed(0)})`:""}</span>)}</div>
            </div>
          ))}
      </div>
      {editing && (
        <div className="edit-overlay" onMouseDown={e=>{ if(e.target===e.currentTarget) closeEdit(); }}>
          <div className="edit-modal">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"10px"}}>
              <h2 className="card-title" style={{margin:0}}>✏️ Edit Sale #{editing.id}</h2>
              <button className="btn-sm" onClick={closeEdit}>✕</button>
            </div>
            {editErr && <div className="toast" style={{position:"static",marginBottom:"10px"}}>❌ {editErr}</div>}

            <label>Customer Name</label>
            <input value={eCustomer} onChange={e=>setECustomer(e.target.value)} placeholder="Walk-in Customer" />

            <label>Items</label>
            {eItems.map(i=>(
              <div key={i.id} className="bill-row" style={{flexWrap:"wrap",gap:"6px"}}>
                <span className="bill-name" style={{flex:"1 1 120px"}}>{i.name} <small style={{color:"var(--text2)"}}>@ Rs.{i.sale_price}</small></span>
                <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                  <span style={{fontSize:"10px",color:"var(--text2)"}}>Qty</span>
                  <input type="number" min="1" value={i.qty}
                    onChange={e=>setLine(i.id,{qty:Math.max(1,Math.floor(+e.target.value)||1)})}
                    style={{width:"60px",padding:"4px 6px",fontSize:"12px",marginBottom:0}} />
                </div>
                <div style={{display:"flex",alignItems:"center",gap:"4px"}}>
                  <span style={{fontSize:"10px",color:"var(--text2)"}}>Disc</span>
                  <input type="number" min="0" value={i.discount||""} placeholder="0"
                    onChange={e=>setLine(i.id,{discount:e.target.value})}
                    style={{width:"64px",padding:"4px 6px",fontSize:"12px",marginBottom:0}} />
                </div>
                <span className="bill-amount">Rs. {(i.qty*i.sale_price-(i.discount||0)).toFixed(0)}</span>
                <button className="btn-sm btn-danger" onClick={()=>setEItems(eItems.filter(x=>x.id!==i.id))}>×</button>
              </div>
            ))}

            <label>Add another item</label>
            <div className="item-search">
              <input value={addSearch} onChange={e=>setAddSearch(e.target.value)} placeholder="🔍 Search item to add..." autoComplete="off" />
              {addQ && (
                <div className="item-search-list">
                  {addMatches.length===0
                    ? <div className="item-search-empty">No item found</div>
                    : addMatches.map(it=>(
                      <div key={it.id} className="item-search-opt" onMouseDown={e=>{e.preventDefault();addLine(it);}}>
                        <span>{it.name}</span><small>{it.qty} in stock · Rs.{it.sale_price}</small>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="bill-summary">
              <div className="bill-total-row"><span>New Total</span><span>Rs. {eTotal.toFixed(0)}</span></div>
              <div className="bill-profit-row"><span>Profit</span><span className="green">Rs. {eProfit.toFixed(0)}</span></div>
            </div>
            <div style={{display:"flex",gap:"8px",marginTop:"10px"}}>
              <button className="btn-outline" style={{flex:1}} onClick={closeEdit}>Cancel</button>
              <button className="btn-success" style={{flex:2}} onClick={saveEdit} disabled={saving}>{saving?"Saving...":"💾 Save Changes"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
