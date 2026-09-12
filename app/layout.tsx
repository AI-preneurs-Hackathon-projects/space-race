import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Space Race · Cargo Run",
  description: "Choose your ship. Protect the cargo. Make the delivery. A playable 3D space run.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
