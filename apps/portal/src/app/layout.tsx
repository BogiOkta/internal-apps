import type { Metadata } from "next";
import Script from "next/script";
import { AppearanceProvider } from "@/components/appearance-provider";
import { AuthProvider } from "@/components/auth-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { defaultLocale, translations } from "@/i18n/translations";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/forma/theme.css";
import "@fullcalendar/react/themes/forma/palettes/blue.css";
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
    <html lang="sr-Latn" suppressHydrationWarning>
      <body>
        <Script id="portal-appearance" strategy="beforeInteractive">
          {`(function(){try{var a=localStorage.getItem("internal-apps.appearance");if(!["light","dark","system"].includes(a)){a="system"}var r=a==="system"?(matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"):a;document.documentElement.dataset.appearance=a;document.documentElement.dataset.theme=r;document.documentElement.style.colorScheme=r}catch(e){}})();`}
        </Script>
        <AppearanceProvider>
          <LocaleProvider>
            <AuthProvider>{children}</AuthProvider>
          </LocaleProvider>
        </AppearanceProvider>
      </body>
    </html>
  );
}
