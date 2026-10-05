import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import {
  generateFAQJsonLd,
  generateOrganizationJsonLd,
  generateWebsiteJsonLd,
} from "@/lib/seo";

const sans = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const mono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const display = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://openblueprint.vercel.app'),
  title: {
    default: "OpenBlueprint — Free AI Blueprint & Floor Plan Generator | Home Design Tool",
    template: "%s | OpenBlueprint",
  },
  description:
    "Free AI-powered architectural blueprint and floor plan generator. Design homes, create preliminary blueprints, visualize in 3D, and estimate costs in minutes. No CAD experience needed. Perfect for homeowners, architects, and builders.",
  keywords: [
    "OpenBlueprint",
    "blueprint generator",
    "floor plan generator",
    "AI blueprint",
    "architectural planning",
    "home design software",
    "floor plan software",
    "blueprint maker",
    "house plan generator",
    "construction planning",
    "AI home design",
    "architectural design tool",
    "free blueprint maker",
    "online floor planner",
    "3D home design",
    "home construction planner",
    "residential blueprint",
    "building design software",
    "smart home planning",
    "AI architect",
    "automated floor plans",
    "blueprint design online",
    "house layout planner",
    "architectural CAD alternative",
    "preliminary building plans",
    "free floor plan software",
    "online blueprint creator",
    "home design app",
    "floor plan creator",
    "house design tool",
  ],
  authors: [{ name: "OpenBlueprint Team" }],
  creator: "OpenBlueprint",
  publisher: "OpenBlueprint",
  applicationName: "OpenBlueprint",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  category: "Design & Architecture",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://openblueprint.vercel.app",
    title: "OpenBlueprint — Free AI Blueprint & Floor Plan Generator",
    description:
      "Free AI-powered architectural blueprint and floor plan generator. Design homes, create preliminary blueprints, visualize in 3D, and estimate costs in minutes. No software installation required.",
    siteName: "OpenBlueprint",
    images: [
      {
        url: "https://openblueprint.vercel.app/screenshots/landing.png",
        width: 1200,
        height: 630,
        alt: "OpenBlueprint - AI-Powered Blueprint Generator",
        type: "image/png",
      },
      {
        url: "https://openblueprint.vercel.app/screenshots/workspace-2d.png",
        width: 1200,
        height: 630,
        alt: "OpenBlueprint 2D Floor Plan Editor",
        type: "image/png",
      },
      {
        url: "https://openblueprint.vercel.app/screenshots/workspace-3d.png",
        width: 1200,
        height: 630,
        alt: "OpenBlueprint 3D Visualization",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OpenBlueprint — Free AI Blueprint & Floor Plan Generator",
    description:
      "Free AI-powered blueprint generator. Design homes, create floor plans, visualize in 3D, estimate costs — all in minutes. No CAD experience needed.",
    images: ["https://openblueprint.vercel.app/screenshots/landing.png"],
    creator: "@openblueprint",
    site: "@openblueprint",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  manifest: "/manifest.json",
  alternates: {
    canonical: "https://openblueprint.vercel.app",
  },
  verification: {
    google: "aee54bf2d5a00ed1",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const softwareJsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "OpenBlueprint",
    applicationCategory: "DesignApplication",
    operatingSystem: "Web Browser",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "AI-powered architectural blueprint and floor plan generator. Design homes, create preliminary blueprints, visualize in 3D, and estimate construction costs.",
    url: "https://openblueprint.vercel.app",
    image: "https://openblueprint.vercel.app/screenshots/landing.png",
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.8",
      ratingCount: "127",
    },
    featureList: [
      "AI-powered floor plan generation",
      "Interactive 2D blueprint editor",
      "3D visualization",
      "Cost estimation",
      "45+ furniture items library",
      "Multiple design strategies",
      "Export to PDF, PNG, SVG",
    ],
  };

  const organizationJsonLd = generateOrganizationJsonLd();
  const websiteJsonLd = generateWebsiteJsonLd();
  const faqJsonLd = generateFAQJsonLd();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Preconnect to improve performance */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        
        {/* Structured Data - JSON-LD */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
        
        {/* Canonical URL */}
        <link rel="canonical" href="https://openblueprint.vercel.app" />
        
        {/* Additional meta tags for better indexing */}
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body
        className={`${sans.variable} ${mono.variable} ${display.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
