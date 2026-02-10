import { Layers, GitFork, Fingerprint, ShieldCheck } from 'lucide-react';
import styles from './ValueStory.module.css';

const PIPELINE_STATS = [
  { number: '11', label: 'LLM calls' },
  { number: '5', label: 'parallel workers' },
  { number: '4', label: 'phases' },
];

const PIPELINE_PHASES = ['Extract', 'Summarize', 'Analyze', 'Verify', 'Write'];

const WORKERS = [
  { name: 'Thinking Quality', desc: 'planning, verification, anti-patterns' },
  { name: 'Communication', desc: 'prompt patterns, signature style' },
  { name: 'Learning Behavior', desc: 'knowledge gaps, growth trajectory' },
  { name: 'Context Efficiency', desc: 'token usage, session optimization' },
  { name: 'Session Outcomes', desc: 'goals, friction, success rates' },
];

const TYPE_EXAMPLES = ['Systems Architect', 'Maestro', 'Quality Sentinel'];

const values = [
  {
    icon: Layers,
    title: '4-Phase Pipeline',
    subtitle: '11 LLM calls analyzing your actual sessions',
    renderExtra: () => (
      <>
        <div className={styles.statRow}>
          {PIPELINE_STATS.map((s) => (
            <div key={s.label} className={styles.statItem}>
              <span className={styles.statNumber}>{s.number}</span>
              <span className={styles.statLabel}>{s.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.tagStrip}>
          {PIPELINE_PHASES.map((phase) => (
            <span key={phase} className={styles.tag}>{phase}</span>
          ))}
        </div>
      </>
    ),
  },
  {
    icon: GitFork,
    title: '5 Parallel Workers',
    subtitle: 'Each analyzing a different dimension of your AI collaboration',
    renderExtra: () => (
      <div className={styles.workerList}>
        {WORKERS.map((w) => (
          <div key={w.name} className={styles.workerItem}>
            <span className={styles.workerDot} />
            <span className={styles.workerName}>{w.name}</span>
            <span className={styles.workerDesc}>— {w.desc}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    icon: Fingerprint,
    title: 'Your Unique Profile',
    subtitle: '5 coding styles × 3 AI control levels = 15 personality types',
    renderExtra: () => (
      <>
        <div className={styles.tagStrip}>
          {TYPE_EXAMPLES.map((t) => (
            <span key={t} className={styles.tag}>{t}</span>
          ))}
        </div>
        <div className={styles.badge}>
          <ShieldCheck className={styles.badgeIcon} />
          <span className={styles.badgeText}>Every insight backed by verified evidence</span>
        </div>
      </>
    ),
  },
];

export function ValueStory() {
  return (
    <section id="value" className={styles.section}>
      <blockquote className={styles.philosophyQuote}>
        AI isn&apos;t the problem. Unconscious dependency is.
      </blockquote>

      <h2 className={styles.headline}>
        We don&apos;t guess. We show you.
      </h2>

      <div className={styles.grid}>
        {values.map((value) => (
          <div key={value.title} className={styles.card}>
            <div className={styles.iconWrapper}>
              <value.icon size={24} />
            </div>
            <h3 className={styles.title}>{value.title}</h3>
            <p className={styles.subtitle}>{value.subtitle}</p>
            {value.renderExtra()}
          </div>
        ))}
      </div>
    </section>
  );
}
