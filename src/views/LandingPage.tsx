import { HeroSection } from '@/components/landing/HeroSection';
import { ValueStory } from '@/components/landing/ValueStory';
import { AnalysisShowcase } from '@/components/landing/AnalysisShowcase';
import { KnowledgeSection } from '@/components/landing/KnowledgeSection';
import { EnterprisePreview } from '@/components/landing/EnterprisePreview';
import { DownloadSection } from '@/components/landing/DownloadSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { SectionNav } from '@/components/landing/SectionNav';
import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <div className={`${styles.page} graph-paper`}>
      <SectionNav />
      <main className={styles.main}>
        <HeroSection />
        <AnalysisShowcase />
        <ValueStory />
        <KnowledgeSection />
        <EnterprisePreview />
        <DownloadSection />
      </main>
      <LandingFooter />
    </div>
  );
}
