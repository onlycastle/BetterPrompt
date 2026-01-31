import styles from './PromptPatterns.module.css';

type Frequency = 'frequent' | 'occasional' | 'rare';
type Effectiveness = 'highly_effective' | 'effective' | 'could_improve';

interface PromptPatternExample {
  quote: string;
  analysis: string;
  /** Optional preceding AI snippet for context (from utterance lookup) */
  precedingAISnippet?: string;
}

interface PromptPattern {
  patternName: string;
  description: string;
  frequency: Frequency;
  examples: PromptPatternExample[];
  effectiveness: Effectiveness;
  tip?: string;
}

interface UtteranceLookupEntry {
  id: string;
  text: string;
  precedingAISnippet?: string;
}

interface PromptPatternsProps {
  promptPatterns: PromptPattern[];
  /** Optional utterance lookup for AI context display */
  utteranceLookup?: UtteranceLookupEntry[];
}

const FREQUENCY_COLORS: Record<Frequency, string> = {
  frequent: 'var(--neon-green)',
  occasional: 'var(--neon-cyan)',
  rare: 'var(--text-muted)',
};

const EFFECTIVENESS_COLORS: Record<Effectiveness, string> = {
  highly_effective: 'var(--neon-green)',
  effective: 'var(--neon-cyan)',
  could_improve: 'var(--neon-yellow)',
};

function formatEffectiveness(effectiveness: Effectiveness): string {
  return effectiveness.replaceAll('_', ' ');
}

/**
 * Prompt patterns analysis component
 * Shows detected patterns with frequency, effectiveness badges, and examples
 *
 * When utteranceLookup is provided, displays AI context for each example,
 * showing what the AI said before the developer's message.
 */
export function PromptPatterns({ promptPatterns, utteranceLookup }: PromptPatternsProps) {
  // Build a map for quick lookup of AI context by quote text
  // This is a best-effort match since we don't have utteranceId in the example
  const aiContextMap = new Map<string, string>();
  if (utteranceLookup) {
    for (const entry of utteranceLookup) {
      if (entry.precedingAISnippet) {
        // Store by text for lookup
        aiContextMap.set(entry.text, entry.precedingAISnippet);
      }
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.title}>Your Prompt Patterns</div>
      {promptPatterns.map((pattern, idx) => (
        <div key={idx} className={styles.patternCard}>
          <div className={styles.patternHeader}>
            <h4 className={styles.patternName}>{pattern.patternName}</h4>
            <div className={styles.badges}>
              <span
                className={styles.badge}
                style={{
                  '--badge-color': FREQUENCY_COLORS[pattern.frequency],
                } as React.CSSProperties}
              >
                {pattern.frequency}
              </span>
              <span
                className={`${styles.badge} ${styles.effectivenessBadge}`}
                style={{
                  '--badge-color': EFFECTIVENESS_COLORS[pattern.effectiveness],
                } as React.CSSProperties}
              >
                {formatEffectiveness(pattern.effectiveness)}
              </span>
            </div>
          </div>
          <p className={styles.patternDescription}>{pattern.description}</p>
          <div className={styles.examplesSection}>
            <div className={styles.examplesLabel}>Examples:</div>
            {pattern.examples.map((ex, exIdx) => {
              // Try to find AI context for this quote
              const aiContext = ex.precedingAISnippet || aiContextMap.get(ex.quote);

              return (
                <div key={exIdx} className={styles.example}>
                  {aiContext && (
                    <div className={styles.aiContext}>
                      <span className={styles.aiLabel}>AI:</span> {aiContext}
                    </div>
                  )}
                  <div className={styles.exampleQuote}>
                    {aiContext && <span className={styles.userLabel}>You:</span>}
                    "{ex.quote}"
                  </div>
                  <div className={styles.exampleAnalysis}>{ex.analysis}</div>
                </div>
              );
            })}
          </div>
          {pattern.tip && (
            <div className={styles.tipBox}>
              <div className={styles.tipLabel}>Tip:</div>
              <div className={styles.tipText}>{pattern.tip}</div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
