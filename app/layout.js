import "../components/App.css";

export const metadata = {
  title: "General Store Management",
  // Stop Chrome / Google Translate from "translating" item and customer names
  // (Roman-Urdu names like "Tasadaq" were being changed to random English words).
  other: { google: "notranslate" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" translate="no" className="notranslate">
      <body className="notranslate">{children}</body>
    </html>
  );
}
