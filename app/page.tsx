import SiteProviders from "@/components/SiteProviders";
import Navbar from "@/components/Navbar";
import JourneySection from "@/components/JourneySection";
import { CapabilitiesSection, HowItWorksSection, FinalCTA } from "@/components/ExperienceSections";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <SiteProviders>
      <Navbar />
      <main id="main">
        {/* The page's single, persistent h1. Visible chapter headings in the
            cinematic overlay cross-fade and are inerted as you scroll, so the
            document keeps one stable top-level heading here. */}
        <h1 className="sr-only">Perrie — your personal AI assistant</h1>
        <JourneySection />
        <CapabilitiesSection />
        <HowItWorksSection />
        <FAQSection />
        <FinalCTA />
      </main>
      <Footer />
    </SiteProviders>
  );
}
