"use client";
import dynamic from "next/dynamic";

// The whole app (Login, Dashboard, Billing, etc.) is loaded client-side only —
// same as before under Vite, where none of this ever ran on a server.
const App = dynamic(() => import("../components/App"), { ssr: false });

export default function Home() {
  return <App />;
}
