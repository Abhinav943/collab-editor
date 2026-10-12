import "./globals.css";
import Backdrop from "@/components/Backdrop";

export const metadata = {
  title: "AI Collab Editor",
  description: "A collaborative, AI-assisted code editor.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Backdrop />
        <div className="app-layer">{children}</div>
      </body>
    </html>
  );
}
