import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Inter, Anton } from "next/font/google";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-jakarta",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

// Oversized display type for the redesigned sections (TOONHUB direction).
// Anton ships a single 400 weight — never synthesize bold.
const anton = Anton({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-anton",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Perrie — Less busywork. More room for life.",
  description:
    "Meet Perrie, your personal AI assistant. Tell it what you need, and keep your day moving.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${jakarta.variable} ${inter.variable} ${anton.variable} antialiased`}>
        <a href="#main" className="sr-only-focusable">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
