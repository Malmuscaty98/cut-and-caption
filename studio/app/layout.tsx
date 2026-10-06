import "./globals.css";
import type { ReactNode } from "react";

export const metadata = { title: "قَص ستوديو", description: "محرر الكابشن والقص العربي — محلي" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
