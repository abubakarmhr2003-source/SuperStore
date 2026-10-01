import "../components/App.css";

export const metadata = {
  title: "General Store Management",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
