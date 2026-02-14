import {
  HeroSection,
  SocialProofBar,
  ProblemValidation,
  SolutionSection,
  AnalysisShowcase,
  EnterprisePreview,
  DownloadSection,
  TrustPrivacy,
  LandingFooter,
  SectionNav,
} from '@/components/landing';
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
