/**
 * AgentInsightsSection Component
 *
 * Displays the 4 Wow-Focused Agent outputs:
 * - Pattern Detective: Conversation patterns
 * - Anti-Pattern Spotter: Bad habits
 * - Knowledge Gap Analyzer: Learning suggestions
 * - Context Efficiency Analyzer: Token efficiency
 *
 * Each agent card shows:
 * - Agent name and icon
 * - Top 3 "Wow" insights
 * - Score gauge
 * - Overall summary
 */

import { useState } from 'react';
import type { AgentOutputs } from '../../types/report';
import styles from './AgentInsightsSection.module.css';

interface AgentInsightsSectionProps {
  agentOutputs: AgentOutputs;
}

interface AgentCardConfig {
  id: keyof AgentOutputs;
  name: string;
  icon: string;
  color: string;
  scoreLabel: string;
  scoreKey: 'confidenceScore' | 'overallHealthScore' | 'overallKnowledgeScore' | 'overallEfficiencyScore';
  scoreMax: number;
}

const AGENT_CONFIGS: AgentCardConfig[] = [
  {
    id: 'patternDetective',
    name: 'Pattern Detective',
    icon: '🔍',
    color: 'purple',
    scoreLabel: 'Confidence',
    scoreKey: 'confidenceScore',
    scoreMax: 1,
  },
  {
    id: 'antiPatternSpotter',
    name: 'Anti-Pattern Spotter',
    icon: '⚠️',
    color: 'red',
    scoreLabel: 'Health Score',
    scoreKey: 'overallHealthScore',
    scoreMax: 100,
  },
  {
    id: 'knowledgeGap',
    name: 'Knowledge Gap Analyzer',
    icon: '📚',
    color: 'cyan',
    scoreLabel: 'Knowledge Score',
    scoreKey: 'overallKnowledgeScore',
    scoreMax: 100,
  },
  {
    id: 'contextEfficiency',
    name: 'Context Efficiency',
    icon: '⚡',
    color: 'yellow',
    scoreLabel: 'Efficiency Score',
    scoreKey: 'overallEfficiencyScore',
    scoreMax: 100,
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

function getScoreColor(value: number, max: number): string {
  const normalized = normalizeScore(value, max);
  if (normalized >= 75) return 'high';
  if (normalized >= 50) return 'medium';
  return 'low';
}

export function AgentInsightsSection({ agentOutputs }: AgentInsightsSectionProps) {
  const [expandedAgent, setExpandedAgent] = useState<keyof AgentOutputs | null>(null);

  // Check if any agent has data
  const hasData = Object.values(agentOutputs).some(Boolean);
  if (!hasData) {
    return null;
  }

  const toggleExpand = (agentId: keyof AgentOutputs) => {
    setExpandedAgent(expandedAgent === agentId ? null : agentId);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.titleRow}>
          <span className={styles.terminalIcon}>{'>'}_</span>
          <h2 className={styles.title}>AI Agent Insights</h2>
        </div>
        <p className={styles.subtitle}>
          4 specialized agents analyzed your coding patterns to discover hidden habits
        </p>
      </div>

      {/* Agent Cards Grid */}
      <div className={styles.agentGrid}>
        {AGENT_CONFIGS.map((config) => {
          const data = agentOutputs[config.id];
          if (!data) return null;

          const score = getScoreValue(data, config.scoreKey);
          const insights = (data as { topInsights?: string[] }).topInsights || [];
          const summary = (data as { overallStyleSummary?: string }).overallStyleSummary;
          const isExpanded = expandedAgent === config.id;

          return (
            <div
              key={config.id}
              className={`${styles.agentCard} ${styles[config.color]}`}
            >
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

              {/* Top Insights - The "Wow" moments */}
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
                </div>
              )}

              {/* Summary (if available) */}
              {summary && (
                <div className={styles.summaryBox}>
                  <p className={styles.summaryText}>{summary}</p>
                </div>
              )}

              {/* Expand/Collapse Button */}
              <button
                className={styles.expandButton}
                onClick={() => toggleExpand(config.id)}
              >
                {isExpanded ? 'Hide Details ▲' : 'Show Details ▼'}
              </button>

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

/**
 * Generic parser for semicolon-separated data strings
 * Splits by semicolon, then by colon, and maps to specified fields
 */
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
