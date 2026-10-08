import Navbar from "@/components/Navbar";
import { AudioProvider } from "@/components/AudioProvider";
import JourneySection from "@/components/JourneySection";
import FAQSection from "@/components/FAQSection";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <AudioProvider>
      <Navbar />
      <main id="main">
        <JourneySection />
        <FAQSection />
      </main>
      <Footer />
    </AudioProvider>
  );
}
