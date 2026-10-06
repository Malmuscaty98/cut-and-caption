import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "Cut & Caption · قص وكابشن", description: "Local editor for silence cuts, captions and zooms" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
