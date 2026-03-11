import { NextResponse } from 'next/server';
import { listAllAnalysisRecords } from '@/lib/local/analysis-store';
import { getWorkerDomainScores } from '@/lib/local/reporting';

export const dynamic = 'force-dynamic';

interface DomainPercentiles {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  count: number;
}

const DOMAIN_KEYS = [
  'thinkingQuality',
  'communicationPatterns',
  'learningBehavior',
  'contextEfficiency',
  'sessionOutcome',
] as const;

function percentile(values: number[], pct: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.round((pct / 100) * (sorted.length - 1)))
  );
  return Math.round(sorted[index]);
}

function buildPercentiles(values: number[]): DomainPercentiles {
  return {
    p10: percentile(values, 10),
    p25: percentile(values, 25),
    p50: percentile(values, 50),
    p75: percentile(values, 75),
    p90: percentile(values, 90),
    p95: percentile(values, 95),
    count: values.length,
  };
}

export async function GET() {
  try {
    const records = listAllAnalysisRecords();
    if (records.length === 0) {
      return NextResponse.json({
        benchmarks: null,
        message: 'No benchmark data available yet',
      });
    }

    const typeDistribution: Record<string, number> = {};
    const domainBuckets: Record<string, number[]> = Object.fromEntries(
      DOMAIN_KEYS.map((key) => [key, []])
    ) as Record<string, number[]>;

    let totalShares = 0;
    let updatedAt = records[0].updatedAt;

    for (const record of records) {
      typeDistribution[record.evaluation.primaryType] =
        (typeDistribution[record.evaluation.primaryType] ?? 0) + 1;
      totalShares += record.shareCount;

      if (record.updatedAt > updatedAt) {
        updatedAt = record.updatedAt;
      }

      const scores = getWorkerDomainScores(record.evaluation);
      for (const key of DOMAIN_KEYS) {
        const value = scores?.[key]?.domainScore;
        if (typeof value === 'number' && Number.isFinite(value)) {
          domainBuckets[key].push(value);
        }
      }
    }

    return NextResponse.json({
      benchmarks: {
        period: records[records.length - 1]?.createdAt ?? updatedAt,
        totalAnalyses: records.length,
        totalShares,
        typeDistribution,
        domainPercentiles: {
          thinkingQuality: buildPercentiles(domainBuckets.thinkingQuality),
          communicationPatterns: buildPercentiles(domainBuckets.communicationPatterns),
          learningBehavior: buildPercentiles(domainBuckets.learningBehavior),
          contextEfficiency: buildPercentiles(domainBuckets.contextEfficiency),
          sessionOutcome: buildPercentiles(domainBuckets.sessionOutcome),
        },
        updatedAt,
      },
    });
  } catch (error) {
    console.error('[benchmarks/global] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
