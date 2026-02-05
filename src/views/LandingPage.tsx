import { HeroSection } from '@/components/landing/HeroSection';
import { PhilosophySection } from '@/components/landing/PhilosophySection';
import { ValueStory } from '@/components/landing/ValueStory';
import { AnalysisPreview } from '@/components/landing/AnalysisPreview';
import { TypeShowcase } from '@/components/landing/TypeShowcase';
import { KnowledgeSection } from '@/components/landing/KnowledgeSection';
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
        <PhilosophySection />
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
