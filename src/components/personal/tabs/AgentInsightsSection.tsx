/**
 * AgentInsightsSection Component (Web App Version)
 *
 * Displays the Wow-Focused Agent outputs in a 1-column layout:
 * - Pattern Detective: Conversation patterns
 * - Anti-Pattern Spotter: Bad habits
 * - Knowledge Gap Analyzer: Learning suggestions
 * - Context Efficiency Analyzer: Token efficiency
 * - Metacognition: Self-awareness patterns
 * - Temporal Analysis: Time-based patterns
 * - Multitasking: Session management patterns
 *
 * Ported from desktop with unified cyan color scheme.
 */

import { useState } from 'react';
import type { AgentOutputs } from '../../../lib/models/agent-outputs';
import styles from './AgentInsightsSection.module.css';

interface AgentInsightsSectionProps {
  agentOutputs: AgentOutputs;
  isPaid?: boolean;
}

type AgentTier = 'free' | 'premium';

interface AgentCardConfig {
  id: keyof AgentOutputs;
  name: string;
  icon: string;
  scoreLabel: string;
  scoreKey: string;
  scoreMax: number;
  tier: AgentTier;
}

const AGENT_CONFIGS: AgentCardConfig[] = [
  // FREE tier agents
  {
    id: 'patternDetective',
    name: 'Pattern Detective',
    icon: '🔍',
    scoreLabel: 'Confidence',
    scoreKey: 'confidenceScore',
    scoreMax: 1,
    tier: 'free',
  },
  {
    id: 'metacognition',
    name: 'Metacognition',
    icon: '🧠',
    scoreLabel: 'Awareness',
    scoreKey: 'metacognitiveAwarenessScore',
    scoreMax: 100,
    tier: 'free',
  },

  // PREMIUM tier agents
  {
    id: 'antiPatternSpotter',
    name: 'Anti-Pattern Spotter',
    icon: '⚠️',
    scoreLabel: 'Health Score',
    scoreKey: 'overallHealthScore',
    scoreMax: 100,
    tier: 'premium',
  },
  {
    id: 'knowledgeGap',
    name: 'Knowledge Gap',
    icon: '📚',
    scoreLabel: 'Knowledge Score',
    scoreKey: 'overallKnowledgeScore',
    scoreMax: 100,
    tier: 'premium',
  },
  {
    id: 'contextEfficiency',
    name: 'Context Efficiency',
    icon: '⚡',
    scoreLabel: 'Efficiency Score',
    scoreKey: 'overallEfficiencyScore',
    scoreMax: 100,
    tier: 'premium',
  },
  {
    id: 'temporalAnalysis',
    name: 'Temporal Analysis',
    icon: '⏱️',
    scoreLabel: 'Confidence',
    scoreKey: 'confidenceScore',
    scoreMax: 1,
    tier: 'premium',
  },
  {
    id: 'multitasking',
    name: 'Multitasking',
    icon: '🔄',
    scoreLabel: 'Efficiency',
    scoreKey: 'multitaskingEfficiencyScore',
    scoreMax: 100,
    tier: 'premium',
  },
];

function getScoreValue(data: unknown, key: string): number {
  if (typeof data !== 'object' || data === null) return 0;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : 0;
}

function normalizeScore(value: number, max: number): number {
  return max === 1 ? value * 100 : value;
}

function formatScore(value: number, max: number): string {
  return max === 1 ? `${Math.round(value * 100)}%` : `${Math.round(value)}/100`;
}

function getScoreColor(value: number, max: number): 'high' | 'medium' | 'low' {
  const normalized = normalizeScore(value, max);
  if (normalized >= 75) return 'high';
  if (normalized >= 50) return 'medium';
  return 'low';
}

export function AgentInsightsSection({ agentOutputs, isPaid = false }: AgentInsightsSectionProps) {
  const [expandedAgent, setExpandedAgent] = useState<keyof AgentOutputs | null>(null);

  // Check if any agent has data
  const hasData = Object.values(agentOutputs).some(Boolean);
  if (!hasData) {
    return null;
  }

  const toggleExpand = (agentId: keyof AgentOutputs) => {
    setExpandedAgent(expandedAgent === agentId ? null : agentId);
  };

  // Count how many agents have data to show
  const activeAgents = AGENT_CONFIGS.filter(c => agentOutputs[c.id]);

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.terminalIcon}>{'>'}_</span>
          <h2 className={styles.title}>AI Agent Insights</h2>
        </div>
        <p className={styles.subtitle}>
          {activeAgents.length} specialized agents analyzed your coding patterns to discover hidden habits
        </p>
      </div>

      {/* Agent Cards - 1 Column Layout */}
      <div className={styles.agentGrid}>
        {AGENT_CONFIGS.map((config) => {
          const data = agentOutputs[config.id];
          if (!data) return null;

          const score = getScoreValue(data, config.scoreKey);
          const insights = (data as { topInsights?: string[] }).topInsights || [];
          const summary = (data as { overallStyleSummary?: string }).overallStyleSummary;
          const isExpanded = expandedAgent === config.id;

          const FULL_INSIGHTS_COUNT = 3;
          const hasFullData = insights.length >= FULL_INSIGHTS_COUNT;
          const isTeaser = config.tier === 'premium' && !isPaid && !hasFullData;
          const hiddenInsightsCount = isTeaser ? Math.max(0, FULL_INSIGHTS_COUNT - insights.length) : 0;

          return (
            <div
              key={config.id}
              className={`${styles.agentCard} ${isTeaser ? styles.teaser : ''}`}
            >
              {/* Card Header */}
              <div className={styles.cardHeader}>
                <div className={styles.agentInfo}>
                  <span className={styles.agentIcon}>{config.icon}</span>
                  <h3 className={styles.agentName}>{config.name}</h3>
                  {isTeaser && <span className={styles.lockIcon}>🔒</span>}
                </div>
                <div className={`${styles.scoreGauge} ${styles[getScoreColor(score, config.scoreMax)]}`}>
                  <span className={styles.scoreValue}>
                    {formatScore(score, config.scoreMax)}
                  </span>
                  <span className={styles.scoreLabel}>{config.scoreLabel}</span>
                </div>
              </div>

              {/* Top Insights */}
              {insights.length > 0 && (
                <div className={styles.insightsBox}>
                  <div className={styles.insightsHeader}>
                    <span className={styles.sparkle}>✨</span>
                    <span className={styles.insightsLabel}>Key Discoveries</span>
                  </div>
                  <ul className={styles.insightsList}>
                    {insights.map((insight, idx) => (
                      <li key={idx} className={styles.insightItem}>
                        <span className={styles.bullet}>•</span>
                        <span className={styles.insightText}>{insight}</span>
                      </li>
                    ))}
                  </ul>

                  {isTeaser && hiddenInsightsCount > 0 && (
                    <div className={styles.teaserMore}>
                      <span className={styles.unlockIcon}>🔓</span>
                      <span className={styles.teaserMoreText}>
                        +{hiddenInsightsCount} more insights (unlock to see)
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Summary */}
              {summary && (
                <div className={styles.summaryBox}>
                  <p className={styles.summaryText}>{summary}</p>
                </div>
              )}

              {/* Expand/Collapse Button */}
              {!isTeaser && (
                <button
                  className={styles.expandButton}
                  onClick={() => toggleExpand(config.id)}
                >
                  {isExpanded ? 'Hide Details ▲' : 'Show Details ▼'}
                </button>
              )}

              {/* Expanded Details */}
              {!isTeaser && isExpanded && (
                <div className={styles.detailsBox}>
                  <AgentDetails agentId={config.id} data={data} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * KPT Analysis derivation helpers
 * Classifies insights into Keep/Problem/Try based on keywords
 */
const POSITIVE_KEYWORDS = ['well', 'good', 'efficient', 'consistent', 'strong', 'clear', 'effective', 'proficient', 'successfully', 'excellent'];
const PROBLEM_KEYWORDS = ['struggle', 'lack', 'miss', 'error', 'loop', 'repeat', 'fail', 'weak', 'poor', 'confus', 'unclear', 'inefficient', 'forgot'];
const SUGGESTION_KEYWORDS = ['try', 'consider', 'could', 'should', 'recommend', 'suggest', 'would benefit', 'might', 'may want'];

function hasAnyKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some(kw => lower.includes(kw));
}

function isPositiveInsight(insight: string): boolean {
  return hasAnyKeyword(insight, POSITIVE_KEYWORDS) && !hasAnyKeyword(insight, PROBLEM_KEYWORDS);
}

function isProblemInsight(insight: string): boolean {
  return hasAnyKeyword(insight, PROBLEM_KEYWORDS);
}

function isSuggestionInsight(insight: string): boolean {
  return hasAnyKeyword(insight, SUGGESTION_KEYWORDS);
}

interface KPTResult {
  keep: string[];
  problem: string[];
  try: string[];
}

function deriveAgentKPT(data: unknown): KPTResult {
  const insights = (data as { topInsights?: string[] }).topInsights || [];

  return {
    keep: insights.filter(i => isPositiveInsight(i)).slice(0, 2),
    problem: insights.filter(i => isProblemInsight(i)).slice(0, 2),
    try: insights.filter(i => isSuggestionInsight(i)).slice(0, 2),
  };
}

/**
 * Agent KPT Summary Component
 */
function AgentKPTSummary({ data }: { data: unknown }) {
  const kpt = deriveAgentKPT(data);

  // Don't render if no KPT items found
  if (kpt.keep.length === 0 && kpt.problem.length === 0 && kpt.try.length === 0) {
    return null;
  }

  return (
    <div className={styles.kptSection}>
      <div className={styles.kptHeader}>
        <span className={styles.kptIcon}>📋</span>
        <span className={styles.kptTitle}>KPT Analysis</span>
      </div>
      <div className={styles.kptGrid}>
        {kpt.keep.length > 0 && (
          <div className={styles.kptColumn}>
            <span className={styles.kptLabelKeep}>K - Keep</span>
            <ul className={styles.kptList}>
              {kpt.keep.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
        {kpt.problem.length > 0 && (
          <div className={styles.kptColumn}>
            <span className={styles.kptLabelProblem}>P - Problem</span>
            <ul className={styles.kptList}>
              {kpt.problem.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
        {kpt.try.length > 0 && (
          <div className={styles.kptColumn}>
            <span className={styles.kptLabelTry}>T - Try</span>
            <ul className={styles.kptList}>
              {kpt.try.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

// Sub-component for expanded details
interface AgentDetailsProps {
  agentId: keyof AgentOutputs;
  data: NonNullable<AgentOutputs[keyof AgentOutputs]>;
}

function AgentDetails({ agentId, data }: AgentDetailsProps) {
  switch (agentId) {
    case 'patternDetective':
      return <PatternDetectiveDetails data={data as AgentOutputs['patternDetective']} />;
    case 'antiPatternSpotter':
      return <AntiPatternDetails data={data as AgentOutputs['antiPatternSpotter']} />;
    case 'knowledgeGap':
      return <KnowledgeGapDetails data={data as AgentOutputs['knowledgeGap']} />;
    case 'contextEfficiency':
      return <ContextEfficiencyDetails data={data as AgentOutputs['contextEfficiency']} />;
    case 'metacognition':
      return <MetacognitionDetails data={data as AgentOutputs['metacognition']} />;
    case 'temporalAnalysis':
      return <TemporalAnalysisDetails data={data as AgentOutputs['temporalAnalysis']} />;
    case 'multitasking':
      return <MultitaskingDetails data={data as AgentOutputs['multitasking']} />;
    default:
      return null;
  }
}

function PatternDetectiveDetails({ data }: { data: AgentOutputs['patternDetective'] }) {
  if (!data) return null;

  const repeatedQuestions = parseDataString(data.repeatedQuestionsData);
  const requestPatterns = parseSimpleDataString(data.requestStartPatternsData);

  return (
    <div className={styles.detailsContent}>
      {/* KPT Analysis */}
      <AgentKPTSummary data={data} />
      {repeatedQuestions.length > 0 && (
        <DetailSection title="Repeated Questions" icon="🔁">
          {repeatedQuestions.map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.topic}</span>
              <span className={styles.detailValue}>{item.count}x</span>
              {item.example && <span className={styles.detailExample}>{item.example}</span>}
            </div>
          ))}
        </DetailSection>
      )}
      {requestPatterns.length > 0 && (
        <DetailSection title="Request Start Patterns" icon="💬">
          {requestPatterns.map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <code className={styles.detailCode}>{item.key}</code>
              <span className={styles.detailValue}>{item.value}x</span>
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

function AntiPatternDetails({ data }: { data: AgentOutputs['antiPatternSpotter'] }) {
  if (!data) return null;

  const errorLoops = parseErrorLoopData(data.errorLoopsData);
  const mistakes = parseDataString(data.repeatedMistakesData);

  return (
    <div className={styles.detailsContent}>
      {/* KPT Analysis */}
      <AgentKPTSummary data={data} />
      {errorLoops.length > 0 && (
        <DetailSection title="Error Loops Detected" icon="🔄">
          {errorLoops.map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.type}</span>
              <span className={styles.detailValue}>
                {item.count}x ({item.avgTurns} turns avg)
              </span>
            </div>
          ))}
        </DetailSection>
      )}
      {mistakes.length > 0 && (
        <DetailSection title="Repeated Mistakes" icon="⚠️">
          {mistakes.map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.topic}</span>
              <span className={styles.detailValue}>{item.count}x</span>
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

function KnowledgeGapDetails({ data }: { data: AgentOutputs['knowledgeGap'] }) {
  if (!data) return null;

  const gaps = parseKnowledgeGapData(data.knowledgeGapsData);
  const resources = parseResourceData(data.recommendedResourcesData);

  return (
    <div className={styles.detailsContent}>
      {/* KPT Analysis */}
      <AgentKPTSummary data={data} />
      {gaps.length > 0 && (
        <DetailSection title="Knowledge Gaps" icon="📖">
          {gaps.map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.topic}</span>
              <span className={`${styles.depthBadge} ${styles[item.depth || 'shallow']}`}>
                {item.depth || 'shallow'}
              </span>
              <span className={styles.detailValue}>{item.count} questions</span>
            </div>
          ))}
        </DetailSection>
      )}
      {resources.length > 0 && (
        <DetailSection title="Recommended Resources" icon="📚">
          {resources.map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.topic}</span>
              <span className={styles.resourceType}>{item.type}</span>
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

function ContextEfficiencyDetails({ data }: { data: AgentOutputs['contextEfficiency'] }) {
  if (!data) return null;

  const inefficiencies = parseInefficiencyData(data.inefficiencyPatternsData);
  const redundant = parseSimpleDataString(data.redundantInfoData);

  return (
    <div className={styles.detailsContent}>
      {/* KPT Analysis */}
      <AgentKPTSummary data={data} />

      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Avg Context Fill</span>
        <span className={styles.metricValue}>{data.avgContextFillPercent}%</span>
      </div>
      {inefficiencies.length > 0 && (
        <DetailSection title="Inefficiency Patterns" icon="📉">
          {inefficiencies.map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.pattern}</span>
              <span className={`${styles.impactBadge} ${styles[item.impact || 'medium']}`}>
                {item.impact || 'medium'}
              </span>
            </div>
          ))}
        </DetailSection>
      )}
      {redundant.length > 0 && (
        <DetailSection title="Redundant Information" icon="🔁">
          {redundant.map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.key}</span>
              <span className={styles.detailValue}>{item.value}x repeated</span>
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

function MetacognitionDetails({ data }: { data: AgentOutputs['metacognition'] }) {
  if (!data) return null;

  const awarenessInstances = parsePipeDelimitedData<{ type: string; quote: string; context: string }>(
    data.awarenessInstancesData,
    ['type', 'quote', 'context']
  );

  const blindSpots = parsePipeDelimitedData<{ pattern: string; frequency: string }>(
    data.blindSpotsData,
    ['pattern', 'frequency']
  );

  return (
    <div className={styles.detailsContent}>
      {/* KPT Analysis */}
      <AgentKPTSummary data={data} />

      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Awareness Score</span>
        <span className={styles.metricValue}>{data.metacognitiveAwarenessScore}/100</span>
      </div>
      {awarenessInstances.length > 0 && (
        <DetailSection title="Self-Awareness Moments" icon="🔍">
          {awarenessInstances.slice(0, 3).map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.type}</span>
              {item.quote && <span className={styles.detailExample}>"{item.quote}"</span>}
            </div>
          ))}
        </DetailSection>
      )}
      {blindSpots.length > 0 && (
        <DetailSection title="Blind Spots" icon="👁️">
          {blindSpots.slice(0, 3).map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.pattern}</span>
              <span className={styles.detailValue}>{item.frequency}x</span>
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

function TemporalAnalysisDetails({ data }: { data: AgentOutputs['temporalAnalysis'] }) {
  if (!data) return null;

  const peakHoursParts = parseSinglePipeEntry(data.peakHoursData);
  const peakHours = peakHoursParts[0] || '';
  const peakCharacteristics = peakHoursParts[1] || '';

  const cautionHoursParts = parseSinglePipeEntry(data.cautionHoursData);
  const cautionHours = cautionHoursParts[0] || '';
  const cautionCharacteristics = cautionHoursParts[1] || '';

  const fatiguePatterns = parsePipeDelimitedData<{ type: string; hours: string; evidence: string; recommendation: string }>(
    data.fatiguePatternsData,
    ['type', 'hours', 'evidence', 'recommendation']
  );

  return (
    <div className={styles.detailsContent}>
      {/* KPT Analysis */}
      <AgentKPTSummary data={data} />
      {peakHours && (
        <DetailSection title="Peak Performance Hours" icon="🌟">
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Hours: {peakHours}</span>
            {peakCharacteristics && <span className={styles.detailExample}>{peakCharacteristics}</span>}
          </div>
        </DetailSection>
      )}
      {cautionHours && (
        <DetailSection title="Caution Hours" icon="⚠️">
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Hours: {cautionHours}</span>
            {cautionCharacteristics && <span className={styles.detailExample}>{cautionCharacteristics}</span>}
          </div>
        </DetailSection>
      )}
      {fatiguePatterns.length > 0 && (
        <DetailSection title="Fatigue Patterns" icon="😴">
          {fatiguePatterns.slice(0, 3).map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.type}</span>
              <span className={styles.detailValue}>@ {item.hours}</span>
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

function MultitaskingDetails({ data }: { data: AgentOutputs['multitasking'] }) {
  if (!data) return null;

  const strategies = parsePipeDelimitedData<{ type: string; evidence: string; recommendation: string }>(
    data.strategyEvaluationData,
    ['type', 'evidence', 'recommendation']
  );

  return (
    <div className={styles.detailsContent}>
      {/* KPT Analysis */}
      <AgentKPTSummary data={data} />

      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Goal Coherence</span>
        <span className={styles.metricValue}>{data.avgGoalCoherence}%</span>
      </div>
      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Context Pollution</span>
        <span className={styles.metricValue}>{data.avgContextPollutionScore}%</span>
      </div>
      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Work Unit Separation</span>
        <span className={styles.metricValue}>{data.workUnitSeparationScore}%</span>
      </div>
      <div className={styles.metricRow}>
        <span className={styles.metricLabel}>Sessions Analyzed</span>
        <span className={styles.metricValue}>{data.totalSessionsAnalyzed}</span>
      </div>
      {strategies.length > 0 && (
        <DetailSection title="Strategy Evaluation" icon="📊">
          {strategies.slice(0, 2).map((item, i) => (
            <div key={i} className={styles.detailItem}>
              <span className={styles.detailLabel}>{item.type}</span>
              {item.evidence && <span className={styles.detailExample}>{item.evidence}</span>}
            </div>
          ))}
        </DetailSection>
      )}
    </div>
  );
}

// Helper component for detail sections
interface DetailSectionProps {
  title: string;
  icon: string;
  children: React.ReactNode;
}

function DetailSection({ title, icon, children }: DetailSectionProps) {
  return (
    <div className={styles.detailSection}>
      <div className={styles.detailSectionHeader}>
        <span className={styles.detailIcon}>{icon}</span>
        <span className={styles.detailTitle}>{title}</span>
      </div>
      <div className={styles.detailSectionContent}>{children}</div>
    </div>
  );
}

// Data parsing helpers for semicolon-separated strings

function parseDelimitedData<T extends Record<string, string | undefined>>(
  data: string,
  fieldNames: (keyof T)[],
  defaults?: Partial<T>
): T[] {
  if (!data || data.trim() === '') return [];

  return data.split(';').filter(Boolean).map((item) => {
    const parts = item.split(':');
    const result = { ...defaults } as T;

    fieldNames.forEach((field, index) => {
      const value = parts[index];
      (result as Record<string, string | undefined>)[field as string] =
        value !== undefined ? value : (defaults?.[field] as string | undefined);
    });

    return result;
  });
}

function parseDataString(data: string) {
  return parseDelimitedData<{ topic: string; count: string; example?: string }>(
    data,
    ['topic', 'count', 'example'],
    { topic: '', count: '0' }
  );
}

function parseSimpleDataString(data: string) {
  return parseDelimitedData<{ key: string; value: string }>(
    data,
    ['key', 'value'],
    { key: '', value: '0' }
  );
}

function parseErrorLoopData(data: string) {
  return parseDelimitedData<{ type: string; count: string; avgTurns: string }>(
    data,
    ['type', 'count', 'avgTurns'],
    { type: '', count: '0', avgTurns: '0' }
  );
}

function parseKnowledgeGapData(data: string) {
  return parseDelimitedData<{ topic: string; count: string; depth?: string }>(
    data,
    ['topic', 'count', 'depth'],
    { topic: '', count: '0' }
  );
}

function parseResourceData(data: string) {
  return parseDelimitedData<{ topic: string; type: string }>(
    data,
    ['topic', 'type'],
    { topic: '', type: 'resource' }
  );
}

function parseInefficiencyData(data: string) {
  return parseDelimitedData<{ pattern: string; frequency?: string; impact?: string }>(
    data,
    ['pattern', 'frequency', 'impact'],
    { pattern: '' }
  );
}

// Pipe-delimited data parsing helpers

function parsePipeDelimitedData<T extends Record<string, string>>(
  data: string | undefined,
  fieldNames: (keyof T)[]
): T[] {
  if (!data || data.trim() === '') return [];

  return data.split(';').filter(Boolean).map((entry) => {
    const parts = entry.split('|');
    const result = {} as T;

    fieldNames.forEach((field, index) => {
      (result as Record<string, string>)[field as string] = parts[index] || '';
    });

    return result;
  });
}

function parseSinglePipeEntry(data: string | undefined): string[] {
  if (!data) return [];
  return data.split('|');
}

export default AgentInsightsSection;
