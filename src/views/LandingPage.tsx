import {
  HeroSection,
  SocialProofBar,
  TeamSection,
  ProductPreviewSection,
  TrustPrivacy,
  LandingFooter,
  LandingHeader,
} from '@/components/landing';
import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <div className={`${styles.page} graph-paper`}>
      <LandingHeader />
      <main className={styles.main}>
        <HeroSection />
        <ProductPreviewSection />
        <SocialProofBar />
        <TeamSection />
        <TrustPrivacy />
      </main>
      <LandingFooter />
    </div>
  );
}
