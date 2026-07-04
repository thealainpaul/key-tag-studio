import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Key Tag Studio",
  description: "Design custom key tags",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
