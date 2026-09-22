import type { Metadata } from "next";
import { Geist, Geist_Mono, Bodoni_Moda } from "next/font/google";
import "./globals.css";
import ClickSounds from "@/components/ClickSounds";
import GlassFilter from "@/components/GlassFilter";
import SmoothScroll from "@/components/SmoothScroll";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/**
 * Display serif, for Selected Work only.
 *
 * The reference sets its section head and its project titles in Editorial
 * Old - a Didone, with the extreme stroke contrast and the thin flat serifs
 * that go with one - against an otherwise entirely sans page. That contrast
 * is most of what makes the section read as a showcase rather than a list.
 *
 * Editorial Old is licensed, so this is Bodoni Moda: the same genre, the
 * same contrast, and near enough at display size that the difference is a
 * matter for a type designer. A humanist serif is not - swapping this for
 * one loses the look entirely.
 */
const displaySerif = Bodoni_Moda({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "folio",
  description: "Portfolio",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${displaySerif.variable} antialiased`}
    >
      <body>
        {/* A filter definition, referenced by the glass surfaces. Renders
            nothing and costs nothing until something points at it. */}
        <GlassFilter />
        <SmoothScroll />
        {children}
        <ClickSounds />
      </body>
    </html>
  );
}
