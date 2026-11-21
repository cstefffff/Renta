import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SidebarRail } from "@/components/layout/SidebarRail";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { CookieConsentBanner } from "@/components/layout/CookieConsentBanner";

/**
 * Configurarea fonturilor locale self-hosted prin `next/font/local`.
 *
 * Avantaje pentru producție & GDPR:
 * - Fonturile (`Archivo`, `JetBrains Mono`, `Inter` cu suport complet pentru
 *   diacriticele românești `latin-ext`) sunt incluse direct în pachetul aplicației
 *   (zero cereri către Google Fonts API în runtime sau la build-time).
 */
const archivo = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/archivo/files/archivo-latin-standard-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource-variable/archivo/files/archivo-latin-ext-standard-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-display",
  display: "swap",
});

const jetbrainsMono = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2",
      weight: "100 800",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-ext-wght-normal.woff2",
      weight: "100 800",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
});

const inter = localFont({
  src: [
    {
      path: "../node_modules/@fontsource-variable/inter/files/inter-latin-standard-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource-variable/inter/files/inter-latin-ext-standard-normal.woff2",
      weight: "100 900",
      style: "normal",
    },
  ],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "RentA Store — Catalog & Închirieri (Peer-to-Peer & Firme Locale)",
  description:
    "Platformă modernă de închirieri obiecte, unelte și echipamente în București, Cluj-Napoca, Timișoara, Iași și Brașov.",
};

/**
 * RootLayout este șablonul părinte care învelește toate paginile aplicației.
 * În noul design Storefront Dashboard, afișează `SidebarRail` în stânga și
 * coloana principală (`Header` + `main` + `Footer`) în dreapta.
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ro"
      className={`${archivo.variable} ${jetbrainsMono.variable} ${inter.variable}`}
    >
      <body className="bg-cream text-ink font-sans antialiased selection:bg-ochre selection:text-cream-light">
        <div className="min-h-dvh flex bg-cream text-ink">
          <SidebarRail />
          <div className="flex-1 flex flex-col min-w-0">
            <Header />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </div>
        <CookieConsentBanner />
      </body>
    </html>
  );
}
