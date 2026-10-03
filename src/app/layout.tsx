import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

const display = Instrument_Serif({ variable: "--font-instrument-serif", weight: "400", subsets: ["latin"], display: "swap" });
const sans = IBM_Plex_Sans({ variable: "--font-plex-sans", weight: ["400", "500", "600", "700"], subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Unmask — Is this message a scam?",
  description:
    "Paste a suspicious text, email, link or screenshot. Unmask explains the red flags, shows how to verify safely, and what to do if you already clicked or paid.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3eee2" },
    { media: "(prefers-color-scheme: dark)", color: "#15140f" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
