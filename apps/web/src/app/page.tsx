import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Comparison, Cta, Faq, Footer, HowItWorks, QuoteSection, Roadmap, Security, Ticker } from "@/components/landing/sections";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <QuoteSection />
        <HowItWorks />
        <Security />
        <Comparison />
        <Roadmap />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
