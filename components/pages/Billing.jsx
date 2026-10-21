import { useEffect, useState } from "react";
import { api, creditApi } from "../utils/api";
import { getShopInfo } from "../utils/shopInfo";
import { showBill } from "../utils/printDoc";

// Opens the bill in an in-page overlay (works on mobile — no popup needed).
function openBill({ billItems, customer, phone, billNo, saleDate }) {
  showBill({ shop: getShopInfo(), billNo, date: saleDate, customer, phone, items: billItems });
}

function genBillNo() {
  const n = new Date();
  return "INV-"+n.getFullYear().toString().slice(2)+String(n.getMonth()+1).padStart(2,"0")+String(n.getDate()).padStart(2,"0")+"-"+String(Math.floor(Math.random()*9000)+1000);
}

export default function Billing() {
  const [items, setItems] = useState([]);
  const [billItems, setBillItems] = useState([]);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [selItem, setSelItem] = useState("");
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);
  const [qty, setQty] = useState(1);
  const [msg, setMsg] = useState("");
  const [billNo, setBillNo] = useState(genBillNo());
  const [loading, setLoading] = useState(false);
  const [creditCustomers, setCreditCustomers] = useState([]);
  const [isUdhaar, setIsUdhaar] = useState(false);
  const [udhaarCustId, setUdhaarCustId] = useState("");
  const [shopBrand] = useState(getShopInfo());

  const load = () => {
    api.getItems().then(d=>setItems(d.filter(i=>i.qty>0)));
    creditApi.getCustomers().then(setCreditCustomers);
  };
  useEffect(()=>{load();},[]);
  const notify = m => { setMsg(m); setTimeout(()=>setMsg(""),4000); };

  const addToBill = () => {
    if(!selItem) return notify("❌ Please select an item");
    const item = items.find(i=>i.id===+selItem);
    if(!item) return;
    const existing = billItems.find(b=>b.id===item.id);
    const already = existing?existing.qty:0;
    if(already+qty>item.qty) return notify(`❌ Only ${item.qty-already} piece(s) available`);
    if(existing) setBillItems(billItems.map(b=>b.id===item.id?{...b,qty:b.qty+qty}:b));
    else setBillItems([...billItems,{id:item.id,name:item.name,sale_price:item.sale_price,cost_price:item.cost_price,qty,discount:0}]);
    setSelItem(""); setSearch(""); setShowList(false); setQty(1);
  };

  const q = search.trim().toLowerCase();
  const matches = items.filter(i => !q || i.name.toLowerCase().includes(q));
  const pickItem = i => { setSelItem(String(i.id)); setSearch(i.name); setShowList(false); setQty(1); };

  const setDiscount = (id, value) => {
    setBillItems(billItems.map(b=>{
      if(b.id!==id) return b;
      const gross = b.qty*b.sale_price;
      const disc = Math.max(0, Math.min(gross, +value || 0));
      return {...b, discount: disc};
    }));
  };

  const subtotal      = billItems.reduce((a,b)=>a+b.sale_price*b.qty,0);
  const totalDiscount = billItems.reduce((a,b)=>a+(b.discount||0),0);
  const total  = subtotal - totalDiscount;
  const profit = billItems.reduce((a,b)=>a+(b.sale_price-b.cost_price)*b.qty-(b.discount||0),0);

  const confirmSale = async () => {
    if(!billItems.length) return notify("❌ Please add at least one item");
    if(isUdhaar&&!udhaarCustId) return notify("❌ Please select a credit customer");
    setLoading(true);
    try {
      const sale = await api.createSale({ customer:customer||"Walk-in Customer", items:billItems.map(b=>({item_id:b.id,qty:b.qty,discount:b.discount||0})) });
      if(isUdhaar&&udhaarCustId) {
        await creditApi.addEntry({ customer_id:+udhaarCustId, type:"debit", amount:total, description:`Credit sale - ${billNo}`, sale_id:sale.id }).catch(()=>{});
      }
      openBill({ billItems, customer:customer||"Walk-in Customer", phone, total, billNo, saleDate:sale.sale_date });
      notify(`✅ Sale confirmed! Total: Rs.${total.toFixed(0)} | Profit: Rs.${profit.toFixed(0)}${isUdhaar?" | Added to credit book":""}`);
      setBillItems([]); setCustomer(""); setPhone(""); setBillNo(genBillNo()); setIsUdhaar(false); setUdhaarCustId(""); load();
    } catch(e) { notify("❌ "+e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="page">
      <div className="page-header"><h1>Billing</h1><span className="date-badge">{billNo}</span></div>
      {msg&&<div className="toast">{msg}</div>}
      <div className="two-col">
        <div className="card">
          <h2 className="card-title">🛍️ Add Items to Invoice</h2>
          <div className="row-2">
            <div><label>Customer Name</label><input value={customer} onChange={e=>setCustomer(e.target.value)} placeholder="Walk-in Customer" /></div>
            <div><label>Phone No.</label><input value={phone} onChange={e=>setPhone(e.target.value)} placeholder="Optional" /></div>
          </div>
          <label>Select Item</label>
          <div className="item-search">
            <input
              value={search}
              placeholder="🔍 Type to search item..."
              autoComplete="off"
              onChange={e=>{setSearch(e.target.value); setSelItem(""); setShowList(true);}}
              onFocus={()=>setShowList(true)}
              onBlur={()=>setShowList(false)}
              onKeyDown={e=>{
                if(e.key==="Enter"){ e.preventDefault(); if(showList && matches.length) pickItem(matches[0]); else addToBill(); }
                if(e.key==="Escape") setShowList(false);
              }}
            />
            {selItem && <button type="button" className="item-search-clear" onMouseDown={e=>{e.preventDefault(); setSelItem(""); setSearch(""); setShowList(true);}}>×</button>}
            {showList && (
              <div className="item-search-list">
                {matches.length===0
                  ? <div className="item-search-empty">No item found</div>
                  : matches.map(i=>(
                    <div key={i.id} className={"item-search-opt"+(String(i.id)===selItem?" active":"")}
                      onMouseDown={e=>{e.preventDefault(); pickItem(i);}}>
                      <span>{i.name}</span>
                      <small>{i.qty} in stock · Rs.{i.sale_price}</small>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <label>Quantity</label>
          <input type="number" min="1" value={qty} onChange={e=>setQty(Math.max(1,+e.target.value))} />
          <button className="btn-primary full-width" onClick={addToBill}>+ Add to Bill</button>

          {billItems.length>0&&<>
            <div style={{marginTop:"1.25rem"}}>
              <div style={{fontSize:"11px",fontWeight:700,color:"var(--text2)",letterSpacing:"0.06em",textTransform:"uppercase",marginBottom:"8px"}}>Bill Items ({billItems.length})</div>
              {billItems.map(b=>{
                const gross = b.qty*b.sale_price;
                return (
                <div key={b.id} className="bill-row" style={{flexWrap:"wrap"}}>
                  <span className="bill-name">{b.name}</span>
                  <div className="bill-qty-ctrl">
                    <button className="qty-btn" onClick={()=>{if(b.qty>1){const newQty=b.qty-1;const newGross=newQty*b.sale_price;setBillItems(billItems.map(x=>x.id===b.id?{...x,qty:newQty,discount:Math.min(x.discount||0,newGross)}:x));}}}>−</button>
                    <span style={{minWidth:"22px",textAlign:"center",fontWeight:700}}>{b.qty}</span>
                    <button className="qty-btn" onClick={()=>{const item=items.find(i=>i.id===b.id);if(!item||b.qty<item.qty)setBillItems(billItems.map(x=>x.id===b.id?{...x,qty:x.qty+1}:x));}}>+</button>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:"4px",flexShrink:0}}>
                    <span style={{fontSize:"10px",color:"var(--text2)"}}>Disc {shopBrand.currency_symbol}</span>
                    <input type="number" min="0" max={gross} value={b.discount||""} placeholder="0"
                      onChange={e=>setDiscount(b.id,e.target.value)}
                      style={{width:"58px",padding:"4px 6px",fontSize:"11px",marginBottom:0}} />
                  </div>
                  <span className="bill-amount">Rs. {(gross-(b.discount||0)).toFixed(0)}</span>
                  <button className="btn-sm btn-danger" onClick={()=>setBillItems(billItems.filter(x=>x.id!==b.id))}>×</button>
                </div>
              );})}
            </div>
            <div className="bill-summary">
              {totalDiscount>0 && <div className="bill-profit-row"><span>Subtotal</span><span>Rs. {subtotal.toFixed(0)}</span></div>}
              {totalDiscount>0 && <div className="bill-profit-row"><span>Discount</span><span style={{color:"var(--red)"}}>− Rs. {totalDiscount.toFixed(0)}</span></div>}
              <div className="bill-total-row"><span>Total</span><span>Rs. {total.toFixed(0)}</span></div>
              <div className="bill-profit-row"><span>Profit</span><span className="green">Rs. {profit.toFixed(0)}</span></div>
            </div>
            <div className="udhaar-toggle-box">
              <label style={{marginTop:0,display:"flex",alignItems:"center",gap:"9px",cursor:"pointer",fontSize:"13px",fontWeight:700,color:isUdhaar?"var(--red)":"var(--text2)"}}>
                <input type="checkbox" checked={isUdhaar} onChange={e=>setIsUdhaar(e.target.checked)} style={{width:"16px",height:"16px",cursor:"pointer",marginBottom:0,accentColor:"var(--red)"}} />
                📒 This is a Credit Sale (Udhaar)
              </label>
              {isUdhaar&&<div style={{marginTop:"10px"}}>
                <select value={udhaarCustId} onChange={e=>setUdhaarCustId(e.target.value)} style={{marginBottom:0}}>
                  <option value="">-- Select credit customer --</option>
                  {creditCustomers.map(c=><option key={c.id} value={c.id}>{c.name} {c.phone?`(${c.phone})`:""} — Balance: Rs.{c.balance.toFixed(0)}</option>)}
                </select>
                {!creditCustomers.length&&<div style={{fontSize:"11px",color:"var(--red)",marginTop:"4px"}}>No credit customers. Add one in Credit Book first.</div>}
              </div>}
            </div>
            <button className="btn-success full-width" style={{fontSize:"14px",padding:"13px",letterSpacing:"0.02em"}} onClick={confirmSale} disabled={loading}>
              {loading?"Processing...":isUdhaar?"📒 Confirm Credit Sale & Print Bill":"✅ Confirm Sale & Generate Bill"}
            </button>
            <button className="btn-outline full-width" style={{marginTop:"6px"}} onClick={()=>{if(billItems.length)openBill({billItems,customer:customer||"Walk-in Customer",phone,total,billNo});}}>🖨️ Preview Bill</button>
            <button className="btn-sm btn-danger" style={{marginTop:"8px",width:"100%",padding:"8px"}} onClick={()=>{if(confirm("Clear all items?"))setBillItems([]);}}>🗑️ Clear Bill</button>
          </>}
        </div>

        <div className="card">
          <h2 className="card-title">🧾 Live Invoice Preview</h2>
          {billItems.length===0
            ?<div className="empty"><div style={{fontSize:"48px",marginBottom:"12px"}}>🧾</div>Add items to see preview</div>
            :<div className="receipt">
              <div className="receipt-header">
                <div className="receipt-shop">🏪 {shopBrand.shop_name.toUpperCase()}</div>
                <div className="receipt-meta" style={{fontSize:"10px",marginBottom:"8px"}}>{shopBrand.shop_tagline}</div>
                <div style={{borderTop:"2px solid var(--border2)",margin:"8px 0"}}/>
                {[["Invoice",billNo],["Date",new Date().toLocaleDateString()],["Customer",customer||"Walk-in Customer"],...(phone?[["Phone",phone]]:[])].map(([l,v])=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",fontSize:"11px",marginBottom:"2px"}}>
                    <span style={{color:"var(--text2)"}}>{l}:</span><strong>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="receipt-divider"/>
              <table className="receipt-table">
                <thead><tr><th style={{width:"38%"}}>Item</th><th style={{textAlign:"center"}}>Qty</th><th style={{textAlign:"right"}}>Rate</th><th style={{textAlign:"right"}}>Amt</th></tr></thead>
                <tbody>{billItems.map(b=><tr key={b.id}><td>{b.name}{b.discount>0 && <div style={{fontSize:"9px",color:"var(--red)"}}>− {shopBrand.currency_symbol}{b.discount.toFixed(0)} off</div>}</td><td style={{textAlign:"center"}}>{b.qty}</td><td style={{textAlign:"right"}}>{shopBrand.currency_symbol}{b.sale_price}</td><td style={{textAlign:"right"}}><strong>{shopBrand.currency_symbol}{(b.qty*b.sale_price-(b.discount||0)).toFixed(0)}</strong></td></tr>)}</tbody>
              </table>
              <div className="receipt-divider"/>
              {totalDiscount>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"var(--text2)",marginBottom:"2px"}}><span>Subtotal</span><span>{shopBrand.currency_symbol} {subtotal.toFixed(0)}</span></div>}
              {totalDiscount>0 && <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"var(--red)",marginBottom:"6px"}}><span>Discount</span><span>− {shopBrand.currency_symbol} {totalDiscount.toFixed(0)}</span></div>}
              <div className="receipt-total"><span>TOTAL</span><span>{shopBrand.currency_symbol} {total.toFixed(0)}</span></div>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"11px",color:"var(--green)",marginTop:"4px",fontStyle:"italic"}}><span>(Profit — not printed)</span><span>{shopBrand.currency_symbol} {profit.toFixed(0)}</span></div>
              <div className="receipt-footer">★ Thank you for your purchase! ★<br/><span style={{fontSize:"10px"}}>Please visit again</span></div>
            </div>}
        </div>
      </div>
    </div>
  );
}
