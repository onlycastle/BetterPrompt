/**
 * BenchmarksContent - Client Component
 *
 * Fetches global benchmark data from /api/benchmarks/global and renders
 * type distributions, domain score percentiles, and aggregate statistics.
 * Public page - no authentication required.
 */

'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ReportLoadingSpinner } from '@/components/report/ReportLoadingSpinner';
import styles from './page.module.css';

interface DomainPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  count: number;
}

interface BenchmarkData {
  period: string;
  totalAnalyses: number;
  totalShares: number;
  typeDistribution: Record<string, number>;
  domainPercentiles: {
    thinkingQuality: DomainPercentiles;
    communicationPatterns: DomainPercentiles;
    learningBehavior: DomainPercentiles;
    contextEfficiency: DomainPercentiles;
    sessionOutcome: DomainPercentiles;
  };
  updatedAt: string;
}

interface BenchmarkResponse {
  benchmarks: BenchmarkData | null;
  message?: string;
}

const TYPE_META: Record<string, { emoji: string; label: string; color: string }> = {
  architect: { emoji: '\u{1F3D7}\uFE0F', label: 'Architect', color: 'var(--sketch-cyan)' },
  analyst: { emoji: '\u{1F52C}', label: 'Analyst', color: 'var(--sketch-purple)' },
  conductor: { emoji: '\u{1F3BC}', label: 'Conductor', color: 'var(--sketch-orange)' },
  speedrunner: { emoji: '\u26A1', label: 'Speedrunner', color: 'var(--sketch-yellow)' },
  trendsetter: { emoji: '\u{1F680}', label: 'Trendsetter', color: 'var(--sketch-blue)' },
};

const DOMAIN_LABELS: Record<string, { label: string; icon: string }> = {
  thinkingQuality: { label: 'Thinking Quality', icon: '\u{1F9E0}' },
  communicationPatterns: { label: 'Communication', icon: '\u{1F4AC}' },
  learningBehavior: { label: 'Learning Behavior', icon: '\u{1F4C8}' },
  contextEfficiency: { label: 'Context Efficiency', icon: '\u26A1' },
  sessionOutcome: { label: 'Session Success', icon: '\u{1F3AF}' },
};

/** Colors for domain range bars */
const DOMAIN_COLORS: Record<string, string> = {
  thinkingQuality: 'var(--sketch-cyan)',
  communicationPatterns: 'var(--sketch-purple)',
  learningBehavior: 'var(--sketch-green)',
  contextEfficiency: 'var(--sketch-orange)',
  sessionOutcome: 'var(--sketch-blue)',
};

async function fetchBenchmarks(): Promise<BenchmarkResponse> {
  const res = await fetch('/api/benchmarks/global');

  if (!res.ok) {
    throw new Error('Failed to fetch benchmark data');
  }

  return res.json();
}

function formatNumber(n: number): string {
  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1)}M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1)}K`;
  }
  return n.toLocaleString();
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function PageHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoIcon}>{'\u{1F4CA}'}</span>
        <span className={styles.logoText}>BetterPrompt</span>
      </Link>
    </header>
  );
}

function StatsRow({ data }: { data: BenchmarkData }) {
  const uniqueTypes = Object.keys(data.typeDistribution).length;

  return (
    <div className={styles.statsRow}>
      <div className={styles.statCard}>
        <p className={styles.statValue}>{formatNumber(data.totalAnalyses)}</p>
        <p className={styles.statLabel}>Total Analyses</p>
      </div>
      <div className={styles.statCard}>
        <p className={styles.statValue}>{uniqueTypes}</p>
        <p className={styles.statLabel}>Unique Types</p>
      </div>
      <div className={styles.statCard}>
        <p className={styles.statValue}>{formatNumber(data.totalShares)}</p>
        <p className={styles.statLabel}>Shared Reports</p>
      </div>
    </div>
  );
}

/**
 * Extract primary type from composite type keys.
 * Types can be simple ("architect") or composite ("architect-navigator").
 * We use the first segment to look up TYPE_META.
 */
function getTypeMeta(type: string) {
  // Direct match first
  if (TYPE_META[type]) return TYPE_META[type];
  // Try first segment of composite type (e.g., "architect" from "architect-navigator")
  const primary = type.split('-')[0];
  return TYPE_META[primary] || null;
}

function TypeDistribution({ distribution }: { distribution: Record<string, number> }) {
  // Sort by count descending
  const sorted = Object.entries(distribution).sort(([, a], [, b]) => b - a);
  const maxCount = sorted.length > 0 ? sorted[0][1] : 1;
  const total = sorted.reduce((sum, [, count]) => sum + count, 0);

  return (
    <section className={styles.typeDistributionSection}>
      <h2 className={styles.sectionTitle}>Builder Type Distribution</h2>
      <div className={styles.typeList}>
        {sorted.map(([type, count]) => {
          const meta = getTypeMeta(type);
          const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0';
          const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

          // Use meta color or fall back to a default
          const barColor = meta?.color || 'var(--ink-muted)';
          const displayLabel = meta?.label || type.charAt(0).toUpperCase() + type.slice(1);
          const emoji = meta?.emoji || '\u{1F464}';

          return (
            <div key={type} className={styles.typeRow}>
              <div className={styles.typeLabel}>
                <span className={styles.typeEmoji}>{emoji}</span>
                <span>{displayLabel}</span>
              </div>
              <div className={styles.barContainer}>
                <div
                  className={styles.bar}
                  style={{
                    width: `${barWidth}%`,
                    backgroundColor: barColor,
                  }}
                />
                <span className={styles.barLabel}>{percentage}%</span>
              </div>
              <span className={styles.typeCount}>{formatNumber(count)}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function DomainScoreCard({
  domainKey,
  percentiles,
}: {
  domainKey: string;
  percentiles: DomainPercentiles;
}) {
  const meta = DOMAIN_LABELS[domainKey];
  const color = DOMAIN_COLORS[domainKey] || 'var(--sketch-cyan)';

  if (!meta) return null;

  return (
    <div className={styles.domainCard}>
      <div className={styles.domainHeader}>
        <span className={styles.domainIcon}>{meta.icon}</span>
        <h3 className={styles.domainName}>{meta.label}</h3>
      </div>

      {/* Range bar: shows p25-p75 range with p50 median marker */}
      <div className={styles.rangeBarWrapper}>
        <div className={styles.rangeBarTrack}>
          {/* Filled range from p25 to p75 */}
          <div
            className={styles.rangeBarFill}
            style={{
              left: `${percentiles.p25}%`,
              width: `${percentiles.p75 - percentiles.p25}%`,
              backgroundColor: color,
            }}
          />
          {/* Median marker */}
          <div
            className={styles.rangeBarMedian}
            style={{
              left: `${percentiles.p50}%`,
              backgroundColor: color,
            }}
          />
        </div>

        {/* Percentile labels */}
        <div className={styles.percentileMarkers}>
          <span
            className={styles.percentileMarker}
            style={{ left: `${percentiles.p25}%` }}
          >
            p25: {percentiles.p25}
          </span>
          <span
            className={styles.percentileMarker}
            style={{ left: `${percentiles.p50}%` }}
          >
            p50: {percentiles.p50}
          </span>
          <span
            className={styles.percentileMarker}
            style={{ left: `${percentiles.p75}%` }}
          >
            p75: {percentiles.p75}
          </span>
        </div>
      </div>

      <p className={styles.domainDescription}>
        Most builders score between <strong>{percentiles.p25}</strong> and{' '}
        <strong>{percentiles.p75}</strong>
      </p>
      <p className={styles.domainCount}>
        Based on {formatNumber(percentiles.count)} analyses
      </p>
    </div>
  );
}

function DomainScores({
  domainPercentiles,
}: {
  domainPercentiles: BenchmarkData['domainPercentiles'];
}) {
  const domainKeys = Object.keys(DOMAIN_LABELS) as Array<keyof typeof DOMAIN_LABELS>;

  return (
    <section className={styles.domainSection}>
      <h2 className={styles.sectionTitle}>Score Distributions by Domain</h2>
      <div className={styles.domainGrid}>
        {domainKeys.map((key) => {
          const percentiles =
            domainPercentiles[key as keyof typeof domainPercentiles];
          if (!percentiles) return null;

          return (
            <DomainScoreCard
              key={key}
              domainKey={key}
              percentiles={percentiles}
            />
          );
        })}
      </div>
    </section>
  );
}

function CTASection() {
  return (
    <section className={styles.ctaSection}>
      <h2 className={styles.ctaTitle}>Discover your AI builder profile</h2>
      <p className={styles.ctaDescription}>
        Run a free analysis of your Claude Code sessions and see where you stand
        among thousands of builders.
      </p>
      <Link href="/" className={styles.ctaButton}>
        Get Started
      </Link>
    </section>
  );
}

function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <span className={styles.emptyIcon}>{'\u{1F4CA}'}</span>
      <h2 className={styles.emptyTitle}>No Benchmark Data Yet</h2>
      <p className={styles.emptyDescription}>
        Benchmark data is generated from builder analyses. Be one of the first
        to contribute by running an analysis with the CLI.
      </p>
      <Link href="/" className={styles.ctaButton}>
        Get Started
      </Link>
    </div>
  );
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className={styles.errorContainer}>
      <span className={styles.errorIcon}>{'\u26A0\uFE0F'}</span>
      <h2 className={styles.errorTitle}>Failed to Load Benchmarks</h2>
      <p className={styles.errorDescription}>
        Something went wrong while fetching benchmark data. Please try again.
      </p>
      <button onClick={onRetry} className={styles.retryButton}>
        Try Again
      </button>
    </div>
  );
}

export function BenchmarksContent() {
  const { data, isLoading, error, refetch } = useQuery<BenchmarkResponse>({
    queryKey: ['global-benchmarks'],
    queryFn: fetchBenchmarks,
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: 2,
  });

  const benchmarks = data?.benchmarks;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <PageHeader />

        {isLoading ? (
          <div className={styles.loadingContainer}>
            <ReportLoadingSpinner text="Loading benchmark data..." />
          </div>
        ) : error ? (
          <ErrorState onRetry={() => refetch()} />
        ) : !benchmarks ? (
          <>
            <div className={styles.titleSection}>
              <h1 className={styles.pageTitle}>Global AI Collaboration Benchmarks</h1>
              <p className={styles.pageSubtitle}>
                How does your AI collaboration style compare?
              </p>
            </div>
            <EmptyState />
          </>
        ) : (
          <>
            <div className={styles.titleSection}>
              <h1 className={styles.pageTitle}>Global AI Collaboration Benchmarks</h1>
              <p className={styles.pageSubtitle}>
                How does your AI collaboration style compare?
              </p>
            </div>

            <StatsRow data={benchmarks} />
            <TypeDistribution distribution={benchmarks.typeDistribution} />
            <DomainScores domainPercentiles={benchmarks.domainPercentiles} />
            <CTASection />

            <footer className={styles.footer}>
              <p className={styles.footerText}>
                Updated {formatDate(benchmarks.updatedAt)} &middot; Data from{' '}
                {formatNumber(benchmarks.totalAnalyses)} analyses
              </p>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
