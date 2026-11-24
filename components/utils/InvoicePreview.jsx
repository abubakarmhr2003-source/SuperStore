import { useEffect, useRef, useState } from "react";

// Shows the A4 invoice html (from buildInvoiceHtml) scaled down to fit its card,
// so the on-screen preview is always exactly what gets printed.
const PAGE_W = 794;   // A4 width at 96dpi
const PAGE_H = 1123;  // A4 height

export default function InvoicePreview({ html }) {
  const box = useRef(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(Math.min(1, el.clientWidth / PAGE_W));
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    window.addEventListener("resize", fit);
    return () => { ro?.disconnect(); window.removeEventListener("resize", fit); };
  }, []);

  return (
    <div ref={box} style={{ width: "100%", height: PAGE_H * scale, overflow: "hidden", borderRadius: 8, background: "#fff", border: "1px solid var(--border)" }}>
      <iframe
        title="Invoice preview"
        srcDoc={html}
        sandbox=""
        scrolling="no"
        style={{ width: PAGE_W, height: PAGE_H, border: 0, transform: `scale(${scale})`, transformOrigin: "top left", pointerEvents: "none", background: "#fff" }}
      />
    </div>
  );
}
