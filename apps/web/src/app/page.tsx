import { Nav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Coverage, Cta, Faq, Footer, HowItWorks, Merchants, Pricing, QuoteSection, Ticker } from "@/components/landing/sections";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Ticker />
        <HowItWorks />
        <QuoteSection />
        <Coverage />
        <Pricing />
        <Merchants />
        <Faq />
        <Cta />
      </main>
      <Footer />
    </>
  );
}
