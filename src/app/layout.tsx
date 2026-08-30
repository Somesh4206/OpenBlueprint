import type { Metadata } from "next";
import { Inter, JetBrains_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

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
  title: "OpenBlueprint — From Measurements to Intelligent Blueprints",
  description:
    "AI-powered architectural planning and preliminary blueprint generation. Enter your plot dimensions, define requirements, and generate editable preliminary floor plans in minutes.",
  keywords: [
    "OpenBlueprint",
    "floor plan",
    "blueprint",
    "architectural planning",
    "AI design",
    "home design",
    "construction planning",
  ],
  authors: [{ name: "OpenBlueprint" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${sans.variable} ${mono.variable} ${display.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
