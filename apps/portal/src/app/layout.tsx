import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Internal Apps Platform",
  description: "Internal business applications portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
