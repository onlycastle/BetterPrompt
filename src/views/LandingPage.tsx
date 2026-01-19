import { HeroSection } from '@/components/landing/HeroSection';
import { ValueStory } from '@/components/landing/ValueStory';
import { AnalysisPreview } from '@/components/landing/AnalysisPreview';
import { TypeShowcase } from '@/components/landing/TypeShowcase';
import { KnowledgeSection } from '@/components/landing/KnowledgeSection';
import { DownloadSection } from '@/components/landing/DownloadSection';
import { LandingFooter } from '@/components/landing/LandingFooter';
import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <div className={`${styles.page} graph-paper`}>
      <main className={styles.main}>
        <HeroSection />
        <ValueStory />
        <AnalysisPreview />
        <TypeShowcase />
        <KnowledgeSection />
        <DownloadSection />
      </main>
      <LandingFooter />
    </div>
  );
}
