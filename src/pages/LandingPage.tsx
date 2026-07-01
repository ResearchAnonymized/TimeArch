import LandingNav from "@/components/landing/LandingNav";
import HeroSection from "@/components/landing/HeroSection";
import AgentsShowcase from "@/components/landing/AgentsShowcase";
import LifecycleSection from "@/components/landing/LifecycleSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import VerificationSection from "@/components/landing/VerificationSection";
import UseCasesSection from "@/components/landing/UseCasesSection";
import LandingFooter from "@/components/landing/LandingFooter";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />
      <HeroSection />
      <AgentsShowcase />
      <FeaturesSection />
      <HowItWorksSection />
      <VerificationSection />
      <LifecycleSection />
      <UseCasesSection />
      <LandingFooter />
    </div>
  );
}
