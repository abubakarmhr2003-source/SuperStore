import { useEffect, useState } from "react";
import { api } from "../utils/api";
const CATS = ["Biscuits & Snacks","Beverages","Dairy","Dry Fruits","Atta & Rice","Kiryana","Manyari","Stationery","Household","Personal Care","Medicines","Other"];

export default function Stock() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({ name:"", category:"Biscuits & Snacks", boxes:1, pieces_per_box:1, cost_price:"", sale_price:"" });
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const load = () => api.getItems().then(setItems);
  useEffect(() => { load(); }, []);
  const notify = m => { setMsg(m); setTimeout(() => setMsg(""), 3000); };
  const handleAdd = async () => {
    if (!form.name.trim()) return notify("❌ Item name is required");
    if (!form.cost_price || !form.sale_price) return notify("❌ Please enter both prices");
    try {
      await api.addItem({ ...form, boxes:+form.boxes, pieces_per_box:+form.pieces_per_box, cost_price:+form.cost_price, sale_price:+form.sale_price });
      setForm({ name:"", category:"Biscuits & Snacks", boxes:1, pieces_per_box:1, cost_price:"", sale_price:"" });
      load(); notify(`✅ ${form.name} added to stock!`);
    } catch(e) { notify("❌ "+e.message); }
  };
  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"?`)) return;
    await api.deleteItem(id); load(); notify(`🗑️ ${name} removed`);
  };
  const saveEdit = async id => {
    try { await api.updateItem(id, { cost_price:+editData.cost_price, sale_price:+editData.sale_price, qty:+editData.qty }); setEditId(null); load(); notify("✅ Updated!"); }
    catch(e) { notify("❌ "+e.message); }
  };
  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || i.category.toLowerCase().includes(search.toLowerCase()));
  const totalPcs = items.reduce((a,i)=>a+i.qty,0);
  const totalVal = items.reduce((a,i)=>a+i.qty*i.cost_price,0);
  return (
    <div className="page">
      {msg && <div className="toast">{msg}</div>}
      <div className="page-header"><h1>Stock Management</h1></div>
      <div className="metrics-grid" style={{gridTemplateColumns:"repeat(3,1fr)",marginBottom:"1rem"}}>
        <div className="metric-card metric-blue"><span className="metric-icon">📦</span><div className="metric-label">Total Items</div><div className="metric-value">{items.length}</div></div>
        <div className="metric-card metric-green"><span className="metric-icon">🔢</span><div className="metric-label">Total Pieces</div><div className="metric-value">{totalPcs.toLocaleString()}</div></div>
        <div className="metric-card metric-amber"><span className="metric-icon">💵</span><div className="metric-label">Stock Value</div><div className="metric-value">Rs. {totalVal.toLocaleString()}</div></div>
      </div>
      <div className="two-col" style={{marginBottom:"1rem"}}>
        <div className="card">
          <h2 className="card-title">➕ Add Item / Restock</h2>
          <label>Item Name</label>
          <input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="e.g. Peek Freans Cookies" />
          <label>Category</label>
          <select value={form.category} onChange={e=>setForm({...form,category:e.target.value})}>{CATS.map(c=><option key={c}>{c}</option>)}</select>
          <div className="row-2">
            <div><label>Boxes / Packs</label><input type="number" min="1" value={form.boxes} onChange={e=>setForm({...form,boxes:e.target.value})} /></div>
            <div><label>Pieces per Box</label><input type="number" min="1" value={form.pieces_per_box} onChange={e=>setForm({...form,pieces_per_box:e.target.value})} /></div>
          </div>
          <div className="calc-box">Total pieces: <strong>{(+form.boxes||0)*(+form.pieces_per_box||0)}</strong></div>
          <div className="row-2">
            <div><label>Cost Price (Rs.)</label><input type="number" min="0" value={form.cost_price} onChange={e=>setForm({...form,cost_price:e.target.value})} placeholder="Purchase price" /></div>
            <div><label>Sale Price (Rs.)</label><input type="number" min="0" value={form.sale_price} onChange={e=>setForm({...form,sale_price:e.target.value})} placeholder="Selling price" /></div>
          </div>
          {form.cost_price&&form.sale_price&&<div className="calc-box">Profit per piece: <strong className="green">Rs. {(+form.sale_price-+form.cost_price).toFixed(0)}</strong> ({((+form.sale_price-+form.cost_price)/+form.cost_price*100).toFixed(0)}%)</div>}
          <button className="btn-primary full-width" onClick={handleAdd}>Add to Stock</button>
        </div>
        <div className="card">
          <h2 className="card-title">🔍 Search Stock</h2>
          <input placeholder="Search by name or category..." value={search} onChange={e=>setSearch(e.target.value)} />
          <div style={{marginTop:"8px",fontSize:"12px",color:"var(--text2)"}}>{filtered.length} items found</div>
        </div>
      </div>
      <div className="card">
        <h2 className="card-title">📦 All Stock</h2>
        <div className="table-wrap">
          <table className="main-table">
            <thead><tr><th>Item</th><th>Category</th><th>Stock</th><th>Cost</th><th>Sale Price</th><th>Profit</th><th>Value</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {filtered.length===0&&<tr><td colSpan={9} className="empty">No items found</td></tr>}
              {filtered.map(item=>(
                <tr key={item.id}>
                  <td className="bold">{item.name}</td>
                  <td className="muted">{item.category}</td>
                  <td>{editId===item.id?<input type="number" value={editData.qty} onChange={e=>setEditData({...editData,qty:e.target.value})} style={{width:"70px"}} />:`${item.qty} pcs`}</td>
                  <td>{editId===item.id?<input type="number" value={editData.cost_price} onChange={e=>setEditData({...editData,cost_price:e.target.value})} style={{width:"80px"}} />:`Rs. ${item.cost_price}`}</td>
                  <td>{editId===item.id?<input type="number" value={editData.sale_price} onChange={e=>setEditData({...editData,sale_price:e.target.value})} style={{width:"80px"}} />:`Rs. ${item.sale_price}`}</td>
                  <td className="green">Rs. {(item.sale_price-item.cost_price).toFixed(0)}</td>
                  <td>Rs. {(item.qty*item.cost_price).toFixed(0)}</td>
                  <td><span className={`badge ${item.qty===0?"red":item.qty<10?"orange":"green"}`}>{item.qty===0?"Out":item.qty<10?"Low":"OK"}</span></td>
                  <td>{editId===item.id
                    ?<><button className="btn-sm btn-success" onClick={()=>saveEdit(item.id)}>Save</button><button className="btn-sm" onClick={()=>setEditId(null)}>Cancel</button></>
                    :<><button className="btn-sm btn-edit" onClick={()=>{setEditId(item.id);setEditData({cost_price:item.cost_price,sale_price:item.sale_price,qty:item.qty})}}>Edit</button><button className="btn-sm btn-danger" onClick={()=>handleDelete(item.id,item.name)}>Delete</button></>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
