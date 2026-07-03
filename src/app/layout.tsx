import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Concert Ticket Practice",
  description: "AI seat-map analysis and concert ticketing practice MVP",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
