/**
 * Benchmark & Percentile Types
 *
 * Shared types for the social comparison / benchmarking feature.
 * Used by useGrowthData hook, TabbedReportContainer, and benchmark API routes.
 */

/** Percentile ranks for each worker domain (from /api/benchmarks/personal) */
export interface BenchmarkPercentiles {
  thinkingQuality: number | null;
  communicationPatterns: number | null;
  learningBehavior: number | null;
  contextEfficiency: number | null;
  sessionOutcome: number | null;
}
