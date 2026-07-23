import type { Metadata } from "next";
import { AuthProvider } from "@/components/auth-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { defaultLocale, translations } from "@/i18n/translations";
import "./globals.css";

export const metadata: Metadata = {
  title: translations[defaultLocale]["common.productName"],
  description: translations[defaultLocale]["common.metaDescription"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="sr-Latn">
      <body>
        <LocaleProvider>
          <AuthProvider>{children}</AuthProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
