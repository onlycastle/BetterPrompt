import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProofBar } from '@/components/landing/SocialProofBar';
import { ProblemValidation } from '@/components/landing/ProblemValidation';
import { SolutionSection } from '@/components/landing/SolutionSection';
import { AnalysisShowcase } from '@/components/landing/AnalysisShowcase';
import { EnterprisePreview } from '@/components/landing/EnterprisePreview';
import { DownloadSection } from '@/components/landing/DownloadSection';
import { TrustPrivacy } from '@/components/landing/TrustPrivacy';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { SectionNav } from '@/components/landing/SectionNav';
import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <div className={`${styles.page} graph-paper`}>
      <SectionNav />
      <main className={styles.main}>
        <HeroSection />
        <SocialProofBar />
        <ProblemValidation />
        <SolutionSection />
        <AnalysisShowcase />
        <EnterprisePreview />
        <DownloadSection />
        <TrustPrivacy />
      </main>
      <LandingFooter />
    </div>
  );
}
