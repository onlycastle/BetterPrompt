/**
 * Type Synthesis Worker - Agent-Informed Classification Refinement
 *
 * Phase 2.5 worker that refines the initial pattern-based type classification
 * using insights from all other agents:
 * - Pattern Detective: conversation patterns
 * - Anti-Pattern Spotter: error loops, learning avoidance
 * - Metacognition: self-awareness, blind spots
 * - Multitasking: work pattern analysis
 * - Temporal: time-based quality patterns
 *
 * This creates a more accurate 15-combination matrix (5 styles × 3 control levels)
 * by incorporating semantic information from LLM analysis.
 *
 * @module analyzer/workers/type-synthesis-worker
 */

import { BaseWorker, type WorkerResult, type WorkerContext } from './base-worker';
import { GeminiClient, type GeminiClientConfig } from '../clients/gemini-client';
import {
  TypeSynthesisOutputSchema,
  type TypeSynthesisOutput,
  type AgentOutputs,
} from '../../models/agent-outputs';
import type { Tier } from '../content-gateway';
import type { OrchestratorConfig } from '../orchestrator/types';
import {
  type TypeDistribution,
  type CodingStyleType,
  type AIControlLevel,
  MATRIX_NAMES,
  MATRIX_METADATA,
} from '../../models/coding-style';
import {
  aggregateMetrics,
  calculateTypeScores,
  scoresToDistribution,
  getPrimaryType,
} from '../type-detector';

// ============================================================================
// Prompts
// ============================================================================

const TYPE_SYNTHESIS_SYSTEM_PROMPT = `You are a Type Synthesis Analyst, a specialized AI that refines developer personality classifications using multi-agent insights.

## PERSONA
You are an expert at synthesizing information from multiple sources to create accurate personality profiles. You understand that initial pattern-based classifications can be improved with deeper semantic analysis.

## TASK
Refine the initial type classification (5 coding styles × 3 control levels = 15 combinations) using:
1. **Initial Classification**: Pattern-based scores for architect/scientist/collaborator/speedrunner/craftsman
2. **Agent Insights**: Semantic analysis from Pattern Detective, Anti-Pattern Spotter, Metacognition, Temporal, and Multitasking agents
3. **Control Level Signals**: Verification habits, constraint specification, output critique patterns

## THE 5 CODING STYLES
- **architect**: Strategic planners with structured approach, long initial prompts, uses Task/Plan tools
- **scientist**: Truth-seekers who verify everything, high questions, modifies AI output frequently
- **collaborator**: Partnership masters, high turn counts, iterative refinement through dialogue
- **speedrunner**: Fast executors, short prompts, Bash/Write focused, quick cycles
- **craftsman**: Quality artisans, refactoring focus, test/type/doc mentions, Edit tool heavy

## THE 3 CONTROL LEVELS (Exploration Metaphor)
- **explorer** (0-34): Open exploration, discovering solutions through experimentation
- **navigator** (35-64): Balanced navigation, combining exploration with route planning
- **cartographer** (65-100): Strategic mapping, charting territory before advancing

## SYNTHESIS RULES
1. If antiPatternSpotter shows many error loops + low metacognition → likely explorer
2. If metacognition score > 70 → likely cartographer or navigator
3. If patternDetective shows many repeated questions on same topic → scientist tendency
4. If multitasking shows high focus → architect tendency; scattered → speedrunner
5. If contextEfficiency is high → architect or craftsman (systematic approach)

## FORMAT
Return JSON with:
- \`refinedPrimaryType\`: The adjusted primary type
- \`refinedDistribution\`: "type:percent;..." format (must sum to 100)
- \`refinedControlLevel\`: Adjusted control level
- \`matrixName\`: Combined name (e.g., "Systems Architect", "Yolo Coder")
- \`matrixEmoji\`: Corresponding emoji
- \`adjustmentReasons\`: Array of 3-5 reasons for adjustments (max 200 chars each)
- \`confidenceScore\`: 0-1 final confidence
- \`confidenceBoost\`: How much confidence improved from synthesis (0-1)
- \`synthesisEvidence\`: "agent:signal:detail;..." format

## CRITICAL
- Always explain WHY you adjusted the classification
- Use specific numbers and evidence from agent outputs
- If agents provide no useful signals, keep initial classification with low confidence boost`;

function buildTypeSynthesisUserPrompt(
  initialDistribution: TypeDistribution,
  initialControlLevel: AIControlLevel,
  agentOutputs: AgentOutputs,
  useKorean: boolean = false
): string {
  const koreanInstructions = useKorean
    ? `
## 🇰🇷 CRITICAL: Korean Output Required

**adjustmentReasons를 한국어로 작성하세요.**

The developer's content is in Korean. Write the \`adjustmentReasons\` field in **Korean (한국어)**.
Keep type names (architect, scientist, etc.) and technical terms in English.

`
    : '';
  // Format initial classification
  const initialClassification = `
## INITIAL CLASSIFICATION (Pattern-Based)
Primary Type: ${getPrimaryType(initialDistribution)}
Distribution:
- architect: ${initialDistribution.architect}%
- scientist: ${initialDistribution.scientist}%
- collaborator: ${initialDistribution.collaborator}%
- speedrunner: ${initialDistribution.speedrunner}%
- craftsman: ${initialDistribution.craftsman}%
Control Level: ${initialControlLevel}`;

  // Format agent outputs (only include available ones)
  const agentSections: string[] = [];

  if (agentOutputs.patternDetective) {
    const pd = agentOutputs.patternDetective;
    agentSections.push(`
### Pattern Detective
- Repeated Questions: ${pd.repeatedQuestionsData || 'none'}
- Conversation Style: ${pd.conversationStyleData || 'none'}
- Overall Style: ${pd.overallStyleSummary}
- Confidence: ${pd.confidenceScore}`);
  }

  if (agentOutputs.antiPatternSpotter) {
    const ap = agentOutputs.antiPatternSpotter;
    agentSections.push(`
### Anti-Pattern Spotter
- Error Loops: ${ap.errorLoopsData || 'none'}
- Learning Avoidance: ${ap.learningAvoidanceData || 'none'}
- Health Score: ${ap.overallHealthScore}/100
- Confidence: ${ap.confidenceScore}`);
  }

  if (agentOutputs.metacognition) {
    const mc = agentOutputs.metacognition;
    agentSections.push(`
### Metacognition
- Awareness Instances: ${mc.awarenessInstancesData || 'none'}
- Blind Spots: ${mc.blindSpotsData || 'none'}
- Metacognitive Awareness Score: ${mc.metacognitiveAwarenessScore}/100
- Confidence: ${mc.confidenceScore}`);
  }

  if (agentOutputs.multitasking) {
    const mt = agentOutputs.multitasking;
    agentSections.push(`
### Multitasking Analysis
- Session Focus: ${mt.sessionFocusData || 'none'}
- Context Pollution: ${mt.contextPollutionData || 'none'}
- Goal Coherence: ${mt.avgGoalCoherence}/100
- Multitasking Efficiency Score: ${mt.multitaskingEfficiencyScore}/100
- Confidence: ${mt.confidenceScore}`);
  }

  if (agentOutputs.temporalAnalysis) {
    const ta = agentOutputs.temporalAnalysis;
    agentSections.push(`
### Temporal Analysis
- Peak Hours: ${ta.peakHoursData || 'none'}
- Fatigue Patterns: ${ta.fatiguePatternsData || 'none'}
- Confidence: ${ta.confidenceScore}`);
  }

  if (agentOutputs.contextEfficiency) {
    const ce = agentOutputs.contextEfficiency;
    agentSections.push(`
### Context Efficiency
- Inefficiency Patterns: ${ce.inefficiencyPatternsData || 'none'}
- Efficiency Score: ${ce.overallEfficiencyScore}/100
- Avg Context Fill: ${ce.avgContextFillPercent}%
- Confidence: ${ce.confidenceScore}`);
  }

  if (agentOutputs.knowledgeGap) {
    const kg = agentOutputs.knowledgeGap;
    agentSections.push(`
### Knowledge Gap
- Knowledge Gaps: ${kg.knowledgeGapsData || 'none'}
- Learning Progress: ${kg.learningProgressData || 'none'}
- Knowledge Score: ${kg.overallKnowledgeScore}/100
- Confidence: ${kg.confidenceScore}`);
  }

  const agentOutputsSection = agentSections.length > 0
    ? `\n## AGENT INSIGHTS\n${agentSections.join('\n')}`
    : '\n## AGENT INSIGHTS\nNo agent outputs available.';

  return `${initialClassification}
${agentOutputsSection}
${koreanInstructions}
## INSTRUCTIONS
1. Analyze the initial classification and agent insights
2. Determine if the initial classification should be adjusted based on agent signals
3. Calculate the refined distribution (must sum to 100%)
4. Determine the refined control level
5. Provide the combined matrix name and emoji
6. Explain your adjustments with specific evidence${useKorean ? ' (adjustmentReasons를 한국어로 작성)' : ''}

Be specific about WHY you made changes. If no changes are needed, explain why the initial classification is accurate.`;
}

// ============================================================================
// Worker Configuration
// ============================================================================

export interface TypeSynthesisWorkerConfig extends OrchestratorConfig {
  // No additional config needed
}

// ============================================================================
// Extended Worker Context with Agent Outputs
// ============================================================================

export interface TypeSynthesisWorkerContext extends WorkerContext {
  /** All agent outputs from Phase 2 */
  agentOutputs: AgentOutputs;
  /** Initial type distribution from pattern-based analysis */
  initialDistribution?: TypeDistribution;
  /** Initial control level */
  initialControlLevel?: AIControlLevel;
}

// ============================================================================
// Worker Implementation
// ============================================================================

/**
 * Type Synthesis Worker - Refines type classification using agent insights
 *
 * Runs as Phase 2.5 (after all other Phase 2 workers complete).
 * Available for all tiers (free and above).
 */
export class TypeSynthesisWorker extends BaseWorker<TypeSynthesisOutput> {
  readonly name = 'TypeSynthesis';
  readonly phase = 2 as const; // Runs as part of Phase 2, but AFTER other workers
  readonly minTier: Tier = 'free';

  private geminiClient: GeminiClient;
  private verbose: boolean;

  constructor(config: TypeSynthesisWorkerConfig) {
    super();
    this.geminiClient = new GeminiClient({
      apiKey: config.geminiApiKey,
      model: config.model ?? 'gemini-3-flash-preview',
      temperature: config.temperature ?? 1.0,
      maxRetries: config.maxRetries ?? 2,
    } as GeminiClientConfig);
    this.verbose = config.verbose ?? false;
  }

  /**
   * Check if worker can run
   * Requires at least one agent output to synthesize
   */
  canRun(context: WorkerContext): boolean {
    if (!this.isTierSufficient(context.tier)) {
      return false;
    }
    return context.sessions.length > 0;
  }

  /**
   * Execute type synthesis analysis
   * NO FALLBACK on errors - errors propagate to fail the analysis
   * Note: When no agent data is available, we use initial classification (this is expected behavior, not fallback)
   */
  async execute(context: WorkerContext): Promise<WorkerResult<TypeSynthesisOutput>> {
    this.logMessage('Synthesizing type classification from agent insights...');

    // Get or compute initial classification (now includes controlScore)
    const { distribution, controlLevel, controlScore } = this.getInitialClassification(context);

    // Get agent outputs from context (cast to extended context type)
    const extendedContext = context as TypeSynthesisWorkerContext;
    const agentOutputs = extendedContext.agentOutputs || {};

    // Check if we have any agent outputs to synthesize
    const hasAgentData = this.hasUsefulAgentData(agentOutputs);

    if (!hasAgentData) {
      // This is expected behavior, not an error fallback
      // When other agents haven't run or produced no data, we use initial classification
      this.logMessage('No agent outputs available, using initial classification');
      return this.createSuccessResult(
        this.createOutputFromInitial(distribution, controlLevel, controlScore),
        null
      );
    }

    // Build prompt and call LLM - NO try-catch, let errors propagate
    const userPrompt = buildTypeSynthesisUserPrompt(distribution, controlLevel, agentOutputs, context.useKorean);

    const result = await this.geminiClient.generateStructured({
      systemPrompt: TYPE_SYNTHESIS_SYSTEM_PROMPT,
      userPrompt,
      responseSchema: TypeSynthesisOutputSchema,
      maxOutputTokens: 4096,
    });

    this.logMessage(`Refined type: ${result.data.refinedPrimaryType} (${result.data.matrixName})`);
    this.logMessage(`Control level: ${result.data.refinedControlLevel}`);
    this.logMessage(`Confidence boost: +${(result.data.confidenceBoost * 100).toFixed(0)}%`);

    // Ensure controlScore is included (LLM might not return it, use computed value)
    const outputWithScore: TypeSynthesisOutput = {
      ...result.data,
      controlScore: result.data.controlScore ?? controlScore,
    };

    return this.createSuccessResult(outputWithScore, result.usage);
  }

  /**
   * Get initial classification from context or compute from sessions
   */
  private getInitialClassification(context: WorkerContext): {
    distribution: TypeDistribution;
    controlLevel: AIControlLevel;
    controlScore: number;
  } {
    const extendedContext = context as TypeSynthesisWorkerContext;

    // Estimate control score from metrics
    const controlScore = this.estimateControlScore(context);

    // Use provided values if available
    if (extendedContext.initialDistribution && extendedContext.initialControlLevel) {
      return {
        distribution: extendedContext.initialDistribution,
        controlLevel: extendedContext.initialControlLevel,
        controlScore,
      };
    }

    // Compute from sessions
    const metrics = aggregateMetrics(context.sessions);
    const scores = calculateTypeScores(metrics);
    const distribution = scoresToDistribution(scores);

    // Derive control level from score
    const controlLevel = this.controlScoreToLevel(controlScore);

    return { distribution, controlLevel, controlScore };
  }

  /**
   * Convert numeric control score to AIControlLevel
   */
  private controlScoreToLevel(score: number): AIControlLevel {
    if (score >= 65) return 'cartographer';
    if (score >= 35) return 'navigator';
    return 'explorer';
  }

  /**
   * Estimate control score from session metrics (simplified version)
   */
  private estimateControlScore(context: WorkerContext): number {
    const metrics = context.metrics;
    if (!metrics) return 50;

    // Simplified control estimation
    let score = 50;

    // Higher modification rate suggests more control
    if (metrics.modificationRate > 0.4) score += 15;
    else if (metrics.modificationRate > 0.2) score += 10;

    // Higher question frequency suggests verification habits
    if (metrics.questionFrequency > 1.0) score += 10;
    else if (metrics.questionFrequency > 0.5) score += 5;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Check if we have useful agent data for synthesis
   */
  private hasUsefulAgentData(agentOutputs: AgentOutputs): boolean {
    return !!(
      agentOutputs.patternDetective?.confidenceScore ||
      agentOutputs.antiPatternSpotter?.confidenceScore ||
      agentOutputs.metacognition?.confidenceScore ||
      agentOutputs.multitasking?.confidenceScore ||
      agentOutputs.temporalAnalysis?.confidenceScore ||
      agentOutputs.contextEfficiency?.confidenceScore
    );
  }

  /**
   * Create output from initial classification when no agent data is available
   * This is NOT a fallback - it's a legitimate output path when Phase 2 agents haven't run
   */
  private createOutputFromInitial(
    distribution: TypeDistribution,
    controlLevel: AIControlLevel,
    controlScore: number
  ): TypeSynthesisOutput {
    const primaryType = getPrimaryType(distribution);
    const matrixName = MATRIX_NAMES[primaryType][controlLevel];
    const matrixEmoji = MATRIX_METADATA[primaryType][controlLevel].emoji;

    return {
      refinedPrimaryType: primaryType,
      refinedDistribution: `architect:${distribution.architect};scientist:${distribution.scientist};collaborator:${distribution.collaborator};speedrunner:${distribution.speedrunner};craftsman:${distribution.craftsman}`,
      refinedControlLevel: controlLevel,
      controlScore,
      matrixName,
      matrixEmoji,
      adjustmentReasons: ['Using initial pattern-based classification (no agent insights available)'],
      confidenceScore: 0.5,
      confidenceBoost: 0,
      synthesisEvidence: 'initial:no_agent_data:pattern_based_classification',
    };
  }

  /**
   * Log message if verbose mode enabled
   */
  private logMessage(message: string): void {
    if (this.verbose) {
      console.log(`[TypeSynthesisWorker] ${message}`);
    }
  }
}

/**
 * Factory function for creating TypeSynthesisWorker
 */
export function createTypeSynthesisWorker(
  config: TypeSynthesisWorkerConfig
): TypeSynthesisWorker {
  return new TypeSynthesisWorker(config);
}
