import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Script from "next/script";
import "../site.css";
import { isLang, locales } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionary";
import { Header } from "@/components/shell/Header";
import { Footer } from "@/components/shell/Footer";
import { PolicyBanner } from "@/components/shell/PolicyBanner";

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLang(lang)) return {};
  const d = getDictionary(lang);
  return {
    metadataBase: process.env.SITE_URL ? new URL(process.env.SITE_URL) : undefined,
    title: { default: d.meta.title, template: "%s · BPM" },
    description: d.meta.description,
    alternates: { languages: { ko: "/ko", en: "/en" } },
    // Absolute share URLs need SITE_URL; without it the pages keep a text-only preview.
    openGraph: process.env.SITE_URL
      ? { title: d.meta.title, description: d.meta.description, images: [{ url: "/brand/site/og-default.jpg", width: 1200, height: 630, alt: "BanPickMod" }] }
      : undefined,
  };
}

// Applies the saved theme before first paint to avoid a dark/light flash.
const themeInit =
  'try{var t=localStorage.getItem("bpm.theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}';

export default async function RootLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLang(lang)) notFound();
  const d = getDictionary(lang);

  return (
    <html lang={lang} data-theme="dark" data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#07080f" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* App Router root layout: fonts load for every page, so the pages/_document rule does not apply. */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=JetBrains+Mono:wght@400;600;700&display=swap"
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <Script id="theme-init" strategy="beforeInteractive">
          {themeInit}
        </Script>
        <div className="site">
          <a className="skip" href="#main">
            {d.skip}
          </a>
          <Header lang={lang} dict={d} />
          <PolicyBanner lang={lang} />
          <main id="main" className="main">
            {children}
          </main>
          <Footer dict={d} lang={lang} />
        </div>
      </body>
    </html>
  );
}
