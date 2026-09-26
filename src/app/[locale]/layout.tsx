import "@/css/tailwind.css";
import "pliny/search/algolia.css";

import siteMetadata from "@/data/siteMetadata";
import { Metadata } from "next";
import { dir } from "i18next";
import { Noto_Serif_SC } from "next/font/google";
import { locales, LocaleTypes } from "@/i18n/settings";
import Body from "../../templates/humanizeai-pro/Body";

// 标题字：思源宋体，只给品牌名、页面标题与节目名；正文走系统中文黑体（见 tailwind.config.js fontFamily.sans）。
const display = Noto_Serif_SC({
  weight: ["600", "700"],
  subsets: ["latin"],
  display: "swap",
  preload: false,
  variable: "--font-display",
});

export async function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: LocaleTypes }> }): Promise<Metadata> {
  const { locale } = await params
  return {
    metadataBase: new URL(siteMetadata.siteUrl),
    title: {
      default: siteMetadata.title,
      template: `%s | ${siteMetadata.title}`
    },
    description: siteMetadata.description,
    openGraph: {
      title: siteMetadata.title,
      description: siteMetadata.description,
      url: "./",
      siteName: siteMetadata.title,
      images: [siteMetadata.socialBanner],
      locale: locale,
      type: "website"
    },
    alternates: {
      // canonical: './', // 后面会多个 en
      types: {
        "application/rss+xml": `${siteMetadata.siteUrl}/feed.xml`
      }
    },
    robots: {
      index: false,
      follow: false,
      googleBot: {
        index: false,
        follow: false,
        "max-video-preview": -1,
        "max-image-preview": "large",
        "max-snippet": -1
      }
    },
    twitter: {
      title: siteMetadata.title,
      description: siteMetadata.description,
      site: siteMetadata.siteUrl,
      creator: siteMetadata.author,
      card: "summary_large_image",
      images: [siteMetadata.socialBanner]
    }
  };
}

export default async function RootLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: LocaleTypes }>
}) {
  const { locale } = await params
  const body = <Body locale={locale}>{children}</Body>

  const html = (
    <html lang={locale} dir={dir(locale)} className={`scroll-smooth ${display.variable}`} suppressHydrationWarning>
    <head>
      <meta name="msapplication-TileColor" content="#1f5fd6" />
      <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f2f5f4" />
      <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0e171b" />
      <link rel="alternate" type="application/rss+xml" href="/feed.xml" />
      <link rel="icon" type="image/svg+xml" href={siteMetadata.favicon} />
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.1/font/bootstrap-icons.css" integrity="sha384-4LISF5TTJX/fLmGSxO53rV4miRxdg84mZsxmO8Rx5jGtp/LbrixFETvWa5a6sESd" crossOrigin="anonymous" />
      {process.env.NEXT_PUBLIC_GOOGLE_ADS_ID && <script async src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${process.env.NEXT_PUBLIC_GOOGLE_ADS_ID}`} crossOrigin="anonymous"></script>}
    </head>
    {body}
    </html>
  );

  return html;
}
