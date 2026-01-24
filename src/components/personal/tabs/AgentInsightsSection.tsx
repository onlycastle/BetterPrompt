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
import {
  parseStrengthsData,
  parseGrowthAreasData,
  parseRecommendedResourcesData,
  type AgentStrength,
  type AgentGrowthArea,
  type ParsedResource,
} from '../../../lib/models/agent-outputs';
import { AGENT_CONFIGS, type AgentConfig } from '../../../lib/domain/models';
import { ResourceBubble } from './ResourceBubble';
import { calculateSeverity, getSeverityBadge, type SeverityLevel } from './GrowthInsightsSection';
import styles from './AgentInsightsSection.module.css';

interface AgentInsightsSectionProps {
  agentOutputs: AgentOutputs;
  isPaid?: boolean;
}

function getScoreValue(data: unknown, key: string): number {
  if (typeof data !== 'object' || data === null) return 0;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : 0;
}

function normalizeScore(value: number, max: number): number {
  return max === 1 ? value * 100 : value;
}

function formatScore(value: number, max: number): string {
  const normalized = max === 1 ? Math.round(value * 100) : Math.round(value);
  return `${normalized}/100`;
}

function getScoreColor(value: number, max: number): 'high' | 'medium' | 'low' {
  const normalized = normalizeScore(value, max);
  if (normalized >= 75) return 'high';
  if (normalized >= 50) return 'medium';
  return 'low';
}

/**
 * Check if agent has detail data to show
 * Returns false for teaser data (premium agents in free tier have empty data fields)
 */
function hasDetailData(agentId: keyof AgentOutputs, data: unknown): boolean {
  if (!data) return false;

  switch (agentId) {
    case 'patternDetective': {
      const d = data as AgentOutputs['patternDetective'];
      return !!(d?.repeatedQuestionsData || d?.requestStartPatternsData);
    }
    case 'antiPatternSpotter': {
      const d = data as AgentOutputs['antiPatternSpotter'];
      return !!(d?.errorLoopsData || d?.repeatedMistakesData);
    }
    case 'knowledgeGap': {
      const d = data as AgentOutputs['knowledgeGap'];
      return !!(d?.knowledgeGapsData || d?.recommendedResourcesData);
    }
    case 'contextEfficiency': {
      const d = data as AgentOutputs['contextEfficiency'];
      return !!(d?.inefficiencyPatternsData || d?.redundantInfoData);
    }
    case 'metacognition': {
      const d = data as AgentOutputs['metacognition'];
      return !!(d?.awarenessInstancesData || d?.blindSpotsData);
    }
    case 'temporalAnalysis': {
      const d = data as AgentOutputs['temporalAnalysis'];
      // Temporal always has metrics, so check if there's meaningful data
      return !!(d?.metrics?.activityHeatmap?.totalMessages);
    }
    case 'multitasking': {
      const d = data as AgentOutputs['multitasking'];
      return !!(d?.strategyEvaluationData || d?.contextSwitchCountMin);
    }
    default:
      return false;
  }
}

/**
 * Check if agent card has any visible content beyond just the score header
 * Used to hide empty teaser cards for premium agents in free tier
 */
function hasVisibleContent(agentId: keyof AgentOutputs, data: unknown): boolean {
  if (!data) return false;

  // 1. Check for strengths/growth areas data
  const strengths = getAgentStrengths(data);
  const growthAreas = getAgentGrowthAreas(data);
  const hasStrengthsOrGrowth = strengths.length > 0 || growthAreas.length > 0;

  // 2. Check for summary
  const summary = (data as { overallStyleSummary?: string }).overallStyleSummary;
  const hasSummary = !!summary;

  // 3. Check for detail data
  const hasDetails = hasDetailData(agentId, data);

  return hasStrengthsOrGrowth || hasSummary || hasDetails;
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

  // Count how many agents have visible content to show (not just scores)
  const activeAgents = AGENT_CONFIGS.filter(c => {
    const data = agentOutputs[c.id];
    return data && hasVisibleContent(c.id, data);
  });

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

      {/* Agent Cards - 1 Column Layout - Only show cards with visible content */}
      <div className={styles.agentGrid}>
        {AGENT_CONFIGS.map((config) => {
          const data = agentOutputs[config.id];
          if (!data) return null;

          // Skip cards that only have a score but no content (teaser cards)
          if (!hasVisibleContent(config.id, data)) return null;

          const score = getScoreValue(data, config.scoreKey);
          const summary = (data as { overallStyleSummary?: string }).overallStyleSummary;
          const isExpanded = expandedAgent === config.id;

          // Extract resources for Knowledge Gap agent
          const knowledgeGapResources =
            config.id === 'knowledgeGap' && data
              ? parseRecommendedResourcesData(
                  (data as AgentOutputs['knowledgeGap'])?.recommendedResourcesData
                )
              : [];

          return (
            <div key={config.id} className={styles.agentCard}>
              {/* Card Header */}
              <div className={styles.cardHeader}>
                <div className={styles.agentInfo}>
                  <span className={styles.agentIcon}>{config.icon}</span>
                  <h3 className={styles.agentName}>{config.name}</h3>
                </div>
                <div className={`${styles.scoreGauge} ${styles[getScoreColor(score, config.scoreMax)]}`}>
                  <span className={styles.scoreValue}>
                    {formatScore(score, config.scoreMax)}
                  </span>
                  <span className={styles.scoreLabel}>{config.scoreLabel}</span>
                </div>
              </div>

              {/* Strengths & Growth Areas - recommendations locked for free users */}
              <AgentStrengthsGrowthAreas
                data={data}
                isPaid={isPaid}
                agentId={config.id}
                resources={knowledgeGapResources}
              />

              {/* Summary */}
              {summary && (
                <div className={styles.summaryBox}>
                  <p className={styles.summaryText}>{summary}</p>
                </div>
              )}

              {/* Expand/Collapse Button - only show if there's detail data */}
              {hasDetailData(config.id, data) && (
                <button
                  className={styles.expandButton}
                  onClick={() => toggleExpand(config.id)}
                >
                  {isExpanded ? 'Hide Details ▲' : 'Show Details ▼'}
                </button>
              )}

              {/* Expanded Details */}
              {isExpanded && (
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

// ============================================================================
// Strengths & Growth Areas Derivation
// ============================================================================

interface AgentInsightsData {
  strengthsData?: string;
  growthAreasData?: string;
  kptKeep?: string[];
  kptProblem?: string[];
  kptTry?: string[];
}

/**
 * Get strengths from agent data
 * Priority: new strengthsData > fallback from kptKeep
 */
function getAgentStrengths(data: unknown): AgentStrength[] {
  const d = data as AgentInsightsData;

  // 1. Use new strengthsData if available
  if (d.strengthsData) {
    const parsed = parseStrengthsData(d.strengthsData);
    if (parsed.length > 0) return parsed;
  }

  // 2. Fallback: derive from kptKeep (backward compatibility)
  const keepItems = d.kptKeep || [];
  if (keepItems.length > 0) {
    return keepItems.slice(0, 2).map(text => ({
      title: extractTitleFromText(text),
      description: text,
      evidence: [],
    }));
  }

  return [];
}

/**
 * Get growth areas from agent data
 * Priority: new growthAreasData > fallback from kptProblem+kptTry
 */
function getAgentGrowthAreas(data: unknown): AgentGrowthArea[] {
  const d = data as AgentInsightsData;

  // 1. Use new growthAreasData if available
  if (d.growthAreasData) {
    const parsed = parseGrowthAreasData(d.growthAreasData);
    if (parsed.length > 0) return parsed;
  }

  // 2. Fallback: derive from kptProblem/kptTry (backward compatibility)
  const problemItems = d.kptProblem || [];
  const tryItems = d.kptTry || [];

  // Combine problems with try items as recommendations
  const result: AgentGrowthArea[] = [];

  problemItems.forEach((problem, idx) => {
    result.push({
      title: extractTitleFromText(problem),
      description: problem,
      evidence: [],
      recommendation: tryItems[idx] || '',
    });
  });

  // Add remaining try items as growth areas
  const remainingTry = tryItems.slice(problemItems.length);
  remainingTry.forEach(item => {
    result.push({
      title: extractTitleFromText(item),
      description: item,
      evidence: [],
      recommendation: '',
    });
  });

  return result.slice(0, 3);
}

/**
 * Extract a short title from a longer text
 * Looks for patterns like "**text**" or takes first few words
 */
function extractTitleFromText(text: string): string {
  // Try to extract bold text first
  const boldMatch = text.match(/\*\*([^*]+)\*\*/);
  if (boldMatch) {
    return boldMatch[1].slice(0, 50);
  }

  // Otherwise take first few words (up to 5 or 50 chars)
  const words = text.split(/\s+/).slice(0, 5);
  let title = words.join(' ');
  if (title.length > 50) {
    title = title.slice(0, 47) + '...';
  }
  return title;
}

/**
 * Find matching resources for a growth area title
 * Uses fuzzy matching - checks if topic appears in title or vice versa
 */
function findMatchingResourcesForTitle(
  title: string,
  resources: ParsedResource[]
): ParsedResource[] {
  if (resources.length === 0) return [];

  const titleLower = title.toLowerCase();
  return resources.filter((resource) => {
    const topicLower = resource.topic.toLowerCase();
    return titleLower.includes(topicLower) || topicLower.includes(titleLower);
  });
}

interface AgentStrengthsGrowthAreasProps {
  data: unknown;
  isPaid: boolean;
  agentId: keyof AgentOutputs;
  /** Resources for Knowledge Gap agent to show inline */
  resources?: ParsedResource[];
}

/**
 * Agent Strengths & Growth Areas Component
 * All content visible, only recommendations locked for free users
 *
 * Special handling for Knowledge Gap:
 * - Free users see first recommendation unlocked with matching Learning Resource
 */
function AgentStrengthsGrowthAreas({
  data,
  isPaid,
  agentId,
  resources = [],
}: AgentStrengthsGrowthAreasProps) {
  const strengths = getAgentStrengths(data);
  const growthAreas = getAgentGrowthAreas(data);

  // Don't render if no data
  if (strengths.length === 0 && growthAreas.length === 0) {
    return null;
  }

  // Special handling for Knowledge Gap: show first recommendation for free users
  const isKnowledgeGap = agentId === 'knowledgeGap';

  // Count recommendations for teaser (excluding the free one for Knowledge Gap)
  const recommendationCount = growthAreas.filter(g => g.recommendation).length;
  const teaserCount = isKnowledgeGap && !isPaid ? recommendationCount - 1 : recommendationCount;

  return (
    <div className={styles.strengthsGrowthContainer}>
      {/* Strengths Section - always fully visible */}
      {strengths.length > 0 && (
        <div className={styles.strengthsSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.strengthIcon}>💪</span>
            <span className={styles.sectionLabel}>Strengths</span>
          </div>
          {strengths.map((s, idx) => (
            <div key={idx} className={styles.insightCard}>
              <h4 className={styles.insightTitle}>{s.title}</h4>
              <p className={styles.insightDescription}>{s.description}</p>
              {s.evidence.length > 0 && (
                <div className={styles.evidenceList}>
                  {s.evidence.slice(0, 2).map((quote, i) => (
                    <blockquote key={i} className={styles.evidenceQuote}>
                      &ldquo;{quote}&rdquo;
                    </blockquote>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Growth Areas Section - recommendations locked for free users */}
      {growthAreas.length > 0 && (
        <div className={styles.growthSection}>
          <div className={styles.sectionHeader}>
            <span className={styles.growthIcon}>🌱</span>
            <span className={styles.sectionLabel}>Growth Areas</span>
          </div>
          {growthAreas.map((g, idx) => {
            // For Knowledge Gap free users: first item shows recommendation unlocked
            const isFirstKnowledgeGapItem = isKnowledgeGap && idx === 0;
            const showRecommendation = isPaid || isFirstKnowledgeGapItem;

            // Find matching resources for this growth area (Knowledge Gap only)
            const matchingResources = isKnowledgeGap
              ? findMatchingResourcesForTitle(g.title, resources)
              : [];

            // Calculate severity based on evidence count (or frequency if available)
            const severity = calculateSeverity(g.frequency, g.evidence.length);
            const severityBadge = getSeverityBadge(severity);

            return (
              <div key={idx} className={styles.insightCard}>
                <div className={styles.titleWithSeverity}>
                  <span className={`${styles.severityBadge} ${severityBadge.className}`}>
                    {severityBadge.emoji}
                  </span>
                  <h4 className={styles.insightTitle}>{g.title}</h4>
                </div>
                <p className={styles.insightDescription}>{g.description}</p>
                {g.evidence.length > 0 && (
                  <div className={styles.evidenceList}>
                    {g.evidence.slice(0, 2).map((quote, i) => (
                      <blockquote key={i} className={styles.evidenceQuote}>
                        &ldquo;{quote}&rdquo;
                      </blockquote>
                    ))}
                  </div>
                )}
                {g.recommendation && (
                  <div className={`${styles.recommendation} ${!showRecommendation ? styles.recommendationLocked : ''}`}>
                    <span className={styles.recLabel}>💡 Recommendation:</span>
                    {showRecommendation ? (
                      <span className={styles.recText}>{g.recommendation}</span>
                    ) : (
                      <span className={styles.recLockedContent}>
                        <span className={styles.blurredText}>{g.recommendation.slice(0, 20)}...</span>
                        <span className={styles.unlockBadge}>🔒 See recommendation</span>
                      </span>
                    )}
                  </div>
                )}

                {/* Inline Learning Resource for Knowledge Gap (first item only for free users) */}
                {isKnowledgeGap && matchingResources.length > 0 && (isPaid || isFirstKnowledgeGapItem) && (
                  <div className={styles.inlineResource}>
                    <ResourceBubble resources={matchingResources} isPaid={true} />
                  </div>
                )}
              </div>
            );
          })}

          {/* Teaser for free users */}
          {!isPaid && teaserCount > 0 && (
            <div className={styles.teaserMore}>
              <span className={styles.unlockIcon}>🔓</span>
              <span className={styles.teaserMoreText}>
                {teaserCount} more personalized recommendations
              </span>
            </div>
          )}
        </div>
      )}
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

/**
 * TemporalAnalysisDetails - REDESIGNED for metrics + insights structure
 *
 * Displays:
 * - Activity patterns (deterministic metrics)
 * - Session statistics
 * - Engagement signals
 * - LLM-generated insights
 */
function TemporalAnalysisDetails({ data }: { data: AgentOutputs['temporalAnalysis'] }) {
  if (!data) return null;

  const { metrics, insights } = data;

  // Format peak hours (e.g., [10, 11, 14] -> "10 AM, 11 AM, 2 PM")
  const formatHour = (hour: number): string => {
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    if (hour < 12) return `${hour} AM`;
    return `${hour - 12} PM`;
  };

  const peakHoursFormatted = metrics.activityHeatmap.peakHours
    .map(formatHour)
    .join(', ') || 'No clear pattern';

  // Format engagement percentages
  const questionRatePercent = Math.round(metrics.engagementSignals.questionRate * 100);
  const deepSessionRatePercent = Math.round(metrics.engagementSignals.deepSessionRate * 100);
  const shortResponseRatePercent = Math.round(metrics.engagementSignals.shortResponseRate * 100);

  return (
    <div className={styles.detailsContent}>
      {/* Activity Summary (from metrics) */}
      <DetailSection title="Activity Patterns" icon="📊">
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Peak Hours</span>
          <span className={styles.detailValue}>{peakHoursFormatted}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Total Messages</span>
          <span className={styles.detailValue}>{metrics.activityHeatmap.totalMessages.toLocaleString()}</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Total Sessions</span>
          <span className={styles.detailValue}>{metrics.sessionPatterns.totalSessions}</span>
        </div>
      </DetailSection>

      {/* Session Statistics (from metrics) */}
      <DetailSection title="Session Style" icon="⏱️">
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Avg Duration</span>
          <span className={styles.detailValue}>{Math.round(metrics.sessionPatterns.avgSessionDurationMinutes)} min</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Avg Turns/Session</span>
          <span className={styles.detailValue}>{Math.round(metrics.sessionPatterns.avgMessagesPerSession)}</span>
        </div>
        {metrics.sessionPatterns.avgToolCallsPerSession > 0 && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Avg Tool Calls</span>
            <span className={styles.detailValue}>{Math.round(metrics.sessionPatterns.avgToolCallsPerSession)}</span>
          </div>
        )}
      </DetailSection>

      {/* Engagement Signals (from metrics) */}
      <DetailSection title="Engagement Signals" icon="💬">
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Question Rate</span>
          <span className={styles.detailValue}>{questionRatePercent}%</span>
        </div>
        <div className={styles.detailItem}>
          <span className={styles.detailLabel}>Deep Sessions (5+ turns)</span>
          <span className={styles.detailValue}>{deepSessionRatePercent}%</span>
        </div>
        {shortResponseRatePercent > 10 && (
          <div className={styles.detailItem}>
            <span className={styles.detailLabel}>Brief Responses</span>
            <span className={styles.detailValue}>{shortResponseRatePercent}%</span>
          </div>
        )}
      </DetailSection>

      {/* LLM Insights (from insights) */}
      {insights.activityPatternSummary && (
        <DetailSection title="Pattern Summary" icon="📝">
          <div className={styles.detailItem}>
            <span className={styles.detailExample}>{insights.activityPatternSummary}</span>
          </div>
          {insights.sessionStyleSummary && (
            <div className={styles.detailItem}>
              <span className={styles.detailExample}>{insights.sessionStyleSummary}</span>
            </div>
          )}
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

  // Time-based metrics (research-backed)
  const hasTimeMetrics = data.contextSwitchCountMin !== undefined || data.contextSwitchCountMax !== undefined;
  const switchMin = data.contextSwitchCountMin ?? 0;
  const switchMax = data.contextSwitchCountMax ?? 0;
  const recoveryMin = data.estimatedRecoveryTimeLostMinutesMin ?? (switchMin * 23);
  const recoveryMax = data.estimatedRecoveryTimeLostMinutesMax ?? (switchMax * 23);
  const deepWorkBlocks = data.deepWorkBlockCount ?? 0;
  const longestFocus = data.longestFocusBlockMinutes ?? 0;
  const avgDuration = data.avgSessionDurationMinutes ?? 0;

  // Format recovery time as hours
  const formatRecoveryTime = (min: number, max: number): string => {
    const minHours = min / 60;
    const maxHours = max / 60;
    if (minHours === maxHours) {
      return minHours < 1 ? `~${min} min` : `~${minHours.toFixed(1)} hours`;
    }
    if (minHours < 1 && maxHours < 1) {
      return `${min}-${max} min`;
    }
    return `${minHours.toFixed(1)}-${maxHours.toFixed(1)} hours`;
  };

  // Format context switch count
  const formatSwitchCount = (min: number, max: number): string => {
    if (min === max) return `${min}`;
    return `${min}-${max}`;
  };

  return (
    <div className={styles.detailsContent}>
      {/* Time-Based Metrics (Research-Backed) - Show prominently if available */}
      {hasTimeMetrics && (switchMin > 0 || switchMax > 0) && (
        <DetailSection title="Time Impact Analysis" icon="⏱️">
          <div className={styles.timeMetricHighlight}>
            <div className={styles.recoveryTimeBox}>
              <span className={styles.recoveryTimeValue}>
                {formatRecoveryTime(recoveryMin, recoveryMax)}
              </span>
              <span className={styles.recoveryTimeLabel}>
                estimated recovery time lost
              </span>
              <span className={styles.recoveryTimeDetail}>
                ({formatSwitchCount(switchMin, switchMax)} context switches × 23min research-based recovery)
              </span>
            </div>
          </div>
        </DetailSection>
      )}

      {/* Deep Work & Focus Metrics */}
      {(deepWorkBlocks > 0 || longestFocus > 0) && (
        <DetailSection title="Focus Quality" icon="🎯">
          {deepWorkBlocks > 0 && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Deep work blocks (60+ min)</span>
              <span className={styles.detailValue}>{deepWorkBlocks} achieved</span>
            </div>
          )}
          {longestFocus > 0 && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Longest focus session</span>
              <span className={styles.detailValue}>{longestFocus} min</span>
            </div>
          )}
          {avgDuration > 0 && (
            <div className={styles.detailItem}>
              <span className={styles.detailLabel}>Average session duration</span>
              <span className={styles.detailValue}>{Math.round(avgDuration)} min</span>
            </div>
          )}
        </DetailSection>
      )}

      {/* Traditional Metrics - Now as secondary details */}
      <DetailSection title="Session Metrics" icon="📊">
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
      </DetailSection>

      {strategies.length > 0 && (
        <DetailSection title="Strategy Evaluation" icon="📋">
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

export default AgentInsightsSection;
