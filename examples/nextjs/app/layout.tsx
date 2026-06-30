import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SparrowDesk Chat — Next.js example",
  description: "Minimal SparrowDesk chat widget integration with Next.js.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
