import styles from './SamplePreviewFrame.module.css';

interface SamplePreviewFrameProps {
  children: React.ReactNode;
}

export function SamplePreviewFrame({ children }: SamplePreviewFrameProps) {
  return (
    <div className={styles.frame}>
      {/* Title Bar with traffic lights */}
      <div className={styles.titleBar}>
        <div className={styles.trafficLights}>
          <span className={`${styles.light} ${styles.red}`} />
          <span className={`${styles.light} ${styles.yellow}`} />
          <span className={`${styles.light} ${styles.green}`} />
        </div>
        <span className={styles.filename}>sample_report.json</span>
        <div className={styles.titleBarSpacer} />
      </div>

      {/* Sample Banner */}
      <div className={styles.banner}>
        <span className={styles.badge}>SAMPLE</span>
        <span className={styles.bannerText}>
          Example analysis from a real developer&apos;s session
        </span>
      </div>

      {/* Content */}
      <div className={styles.content}>{children}</div>

      {/* Footer with CLI CTA */}
      <div className={styles.footer}>
        <span className={styles.prompt}>$</span>
        <span className={styles.command}>
          Run <code className={styles.code}>npx no-ai-slop</code> to generate YOUR report
        </span>
        <span className={styles.arrow}>→</span>
      </div>
    </div>
  );
}
