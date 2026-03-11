import styles from './LandingPage.module.css';

export function LandingPage() {
  return (
    <div className={`${styles.page} graph-paper`}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <div className={styles.eyebrow}>Open Source · Self-Hosted · Gemini Powered</div>
          <h1 className={styles.title}>Analyze AI sessions on your own server.</h1>
          <p className={styles.subtitle}>
            NoMoreAISlop now ships as a self-hosted Next.js server plus CLI. Session discovery
            stays local, analysis runs with your Gemini key, and reports persist in SQLite.
          </p>

          <div className={styles.actions}>
            <a href="#quickstart" className={styles.primaryAction}>
              Quick Start
            </a>
            <a href="/auth/device" className={styles.secondaryAction}>
              Device Login
            </a>
            <a href="/dashboard/analyze" className={styles.secondaryAction}>
              Open Dashboard
            </a>
          </div>

          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <p className={styles.featureLabel}>Server</p>
              <h2 className={styles.featureTitle}>Next.js is the only backend.</h2>
              <p className={styles.featureText}>
                Local auth, analysis execution, report pages, and knowledge APIs all run in one
                self-hosted process.
              </p>
            </article>

            <article className={styles.featureCard}>
              <p className={styles.featureLabel}>CLI</p>
              <h2 className={styles.featureTitle}>CLI remains the local intake path.</h2>
              <p className={styles.featureText}>
                Scan Claude Code and Cursor sessions locally, authenticate with device flow, and
                stream analysis jobs straight to your own server.
              </p>
            </article>

            <article className={styles.featureCard}>
              <p className={styles.featureLabel}>Storage</p>
              <h2 className={styles.featureTitle}>SQLite plus local files.</h2>
              <p className={styles.featureText}>
                Accounts, reports, and CLI tokens live in SQLite. Knowledge items stay under
                <code> ~/.nomoreaislop/knowledge</code>.
              </p>
            </article>
          </div>
        </section>

        <section id="quickstart" className={styles.quickstart}>
          <div className={styles.sectionHeader}>
            <p className={styles.sectionLabel}>Quick Start</p>
            <h2 className={styles.sectionTitle}>Run the self-hosted stack in a few commands.</h2>
          </div>

          <div className={styles.commandBlock}>
            <div className={styles.commandHeader}>
              <span>terminal</span>
              <span>local server + CLI</span>
            </div>
            <pre className={styles.pre}>
{`git clone https://github.com/nomoreaislop/nomoreaislop.git
cd nomoreaislop
npm install
cp .env.example .env

# add GOOGLE_GEMINI_API_KEY to .env
npm run dev

# in another terminal
npx no-ai-slop`}
            </pre>
          </div>

          <div className={styles.detailGrid}>
            <article className={styles.detailCard}>
              <h3>What changed</h3>
              <ul>
                <li>Supabase-backed auth and report storage were moved to local SQLite.</li>
                <li>Hosted report unlocks, payments, waitlists, and survey collection were removed.</li>
                <li>CLI uploads now target your self-hosted analysis route directly.</li>
              </ul>
            </article>

            <article className={styles.detailCard}>
              <h3>Supported runtime</h3>
              <ul>
                <li>Next.js server for auth, API routes, report pages, and local analysis execution.</li>
                <li>CLI for scanning sessions and triggering runs from your workstation.</li>
                <li>SQLite and local files for persistent data.</li>
              </ul>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
