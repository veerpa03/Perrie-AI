import SiteProviders from "@/components/SiteProviders";
import JourneySection from "@/components/JourneySection";
import PerrieOrbitSection from "@/components/PerrieOrbitSection";
import FinalCTA from "@/components/FinalCTA";
import Footer from "@/components/Footer";
import AnimatedSignInButton from "@/components/AnimatedSignInButton";
import FloatingSoundToggle from "@/components/FloatingSoundToggle";
import { LiquidGlassDefs } from "@/components/ui/liquid-glass";

export default function Home() {
  return (
    <SiteProviders>
      <LiquidGlassDefs />
      {/* The landing page's only chrome: one Sign-in control (upper-right) and
          a small sound toggle (lower-left). No navbar, links, or wordmark. */}
      <AnimatedSignInButton />
      <FloatingSoundToggle />
      <main id="main">
        {/* Single persistent page heading (cinematic/overlay headings are h2s). */}
        <h1 className="sr-only">Perrie — your personal AI assistant</h1>
        {/* 1–2. Cinematic descent → tree landing (unchanged flight experience). */}
        <JourneySection />
        {/* 3–5. Full-viewport orbit carousel around the hovering Perrie. */}
        <PerrieOrbitSection />
        {/* 6. Minimal closing call to action. */}
        <FinalCTA />
      </main>
      <Footer />
    </SiteProviders>
  );
}
