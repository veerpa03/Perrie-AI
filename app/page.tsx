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
