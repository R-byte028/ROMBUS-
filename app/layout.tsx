import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ROMBUS — Move value. Without boundaries.",
  description: "Intent-powered cross-chain payment requests and checkout.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}