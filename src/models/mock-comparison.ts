/**
 * Mock Comparison Data
 *
 * Provides mock average values for comparative insights until real user data is collected.
 * These values represent typical developer patterns based on initial observations.
 */

/**
 * Mock metric statistics (mean and standard deviation)
 */
export const MOCK_COMPARISON_DATA: Record<
  string,
  { mean: number; stdDev: number; unit: string; higherIsBetter: boolean }
> = {
  // Prompt characteristics
  avgPromptLength: {
    mean: 250,
    stdDev: 100,
    unit: 'characters',
    higherIsBetter: true, // Longer = more context
  },
  avgFirstPromptLength: {
    mean: 350,
    stdDev: 150,
    unit: 'characters',
    higherIsBetter: true,
  },

  // Turn patterns
  avgTurnsPerSession: {
    mean: 15,
    stdDev: 8,
    unit: 'turns',
    higherIsBetter: false, // Fewer = more efficient
  },

  // Question patterns
  questionFrequency: {
    mean: 0.25,
    stdDev: 0.15,
    unit: 'per turn',
    higherIsBetter: true, // More questions = critical thinking
  },

  // Modification patterns
  modificationRate: {
    mean: 0.35,
    stdDev: 0.15,
    unit: '%',
    higherIsBetter: true, // Higher = more critical
  },

  // Tool usage
  toolDiversity: {
    mean: 5,
    stdDev: 2,
    unit: 'unique tools',
    higherIsBetter: true,
  },
  readToolUsageRate: {
    mean: 0.3,
    stdDev: 0.1,
    unit: '%',
    higherIsBetter: true,
  },
  taskToolUsageRate: {
    mean: 0.05,
    stdDev: 0.03,
    unit: '%',
    higherIsBetter: true, // Using Task = advanced
  },

  // Quality signals
  planningScore: {
    mean: 55,
    stdDev: 20,
    unit: 'points',
    higherIsBetter: true,
  },
  criticalThinkingScore: {
    mean: 50,
    stdDev: 18,
    unit: 'points',
    higherIsBetter: true,
  },
  codeUnderstandingScore: {
    mean: 52,
    stdDev: 22,
    unit: 'points',
    higherIsBetter: true,
  },

  // AI Control
  aiControlScore: {
    mean: 48,
    stdDev: 20,
    unit: 'points',
    higherIsBetter: true,
  },
  verificationRate: {
    mean: 0.25,
    stdDev: 0.12,
    unit: '%',
    higherIsBetter: true,
  },

  // Session patterns
  avgSessionDuration: {
    mean: 25,
    stdDev: 15,
    unit: 'minutes',
    higherIsBetter: false, // Neutral
  },

  // Token efficiency
  tokensPerMessage: {
    mean: 450,
    stdDev: 200,
    unit: 'tokens',
    higherIsBetter: false, // Lower = more efficient
  },
};

/**
 * Calculate percentile for a given value using normal distribution approximation
 *
 * @param value - The user's value
 * @param metricKey - The metric key from MOCK_COMPARISON_DATA
 * @returns Percentile (0-100)
 */
export function calculatePercentile(value: number, metricKey: string): number {
  const metric = MOCK_COMPARISON_DATA[metricKey];
  if (!metric) {
    return 50; // Default to median if metric not found
  }

  // Calculate z-score
  const zScore = (value - metric.mean) / metric.stdDev;

  // Convert z-score to percentile using standard normal distribution approximation
  // Using approximation: Φ(z) ≈ 0.5 * (1 + erf(z / sqrt(2)))
  const percentile = 0.5 * (1 + erf(zScore / Math.sqrt(2)));

  // If higher is better, use percentile directly; otherwise, invert
  const rawPercentile = Math.round(percentile * 100);
  const adjustedPercentile = metric.higherIsBetter
    ? rawPercentile
    : 100 - rawPercentile;

  // Clamp to 1-99 range (avoid 0% or 100%)
  return Math.max(1, Math.min(99, adjustedPercentile));
}

/**
 * Error function approximation for normal distribution
 */
function erf(x: number): number {
  // Constants for Horner form
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  // Save the sign of x
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  // A&S formula 7.1.26
  const t = 1.0 / (1.0 + p * x);
  const y =
    1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Get interpretation text for a percentile value
 */
export function getPercentileInterpretation(
  percentile: number,
  metricKey: string
): string {
  const metric = MOCK_COMPARISON_DATA[metricKey];
  const isGood = metric?.higherIsBetter ?? true;

  if (percentile >= 90) {
    return isGood ? 'Top 10% - Exceptional' : 'Needs attention';
  } else if (percentile >= 75) {
    return isGood ? 'Top 25% - Above average' : 'Room for improvement';
  } else if (percentile >= 50) {
    return 'Average range';
  } else if (percentile >= 25) {
    return isGood ? 'Below average' : 'Above average efficiency';
  } else {
    return isGood ? 'Needs improvement' : 'Top 25% - Highly efficient';
  }
}

/**
 * Generate comparative insights for multiple metrics
 */
export function generateComparativeInsights(
  userMetrics: Record<string, number>
): Array<{
  metric: string;
  yourValue: number;
  averageValue: number;
  percentile: number;
  interpretation: string;
}> {
  const insights: Array<{
    metric: string;
    yourValue: number;
    averageValue: number;
    percentile: number;
    interpretation: string;
  }> = [];

  for (const [key, value] of Object.entries(userMetrics)) {
    const mockData = MOCK_COMPARISON_DATA[key];
    if (mockData) {
      const percentile = calculatePercentile(value, key);
      insights.push({
        metric: formatMetricName(key),
        yourValue: value,
        averageValue: mockData.mean,
        percentile,
        interpretation: getPercentileInterpretation(percentile, key),
      });
    }
  }

  // Sort by most notable (furthest from 50th percentile)
  insights.sort(
    (a, b) => Math.abs(b.percentile - 50) - Math.abs(a.percentile - 50)
  );

  return insights;
}

/**
 * Format metric key to human-readable name
 */
function formatMetricName(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
}
