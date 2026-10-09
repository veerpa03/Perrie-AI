import type { Metadata } from "next";
import { Fredoka, Nunito } from "next/font/google";
import "./globals.css";

// Rounded, friendly, tactile type to match the Pixar-clay world (the
// claymorphism skill calls for thick rounded fonts). Fredoka = display,
// Nunito = body.
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fredoka",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Perrie — A little help. All around you.",
  description:
    "Meet Perrie, your personal AI assistant. Tell it what you need, and keep your day moving.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    // Font variables live on <html> so the :root theme tokens
    // (--font-heading / --font-body / --font-display) can resolve them.
    <html lang="en" className={`${fredoka.variable} ${nunito.variable}`}>
      <body className="antialiased">
        <a href="#main" className="sr-only-focusable">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
