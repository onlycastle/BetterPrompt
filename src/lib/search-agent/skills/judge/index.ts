/**
 * Judge Skill
 *
 * Evaluates gathered content for relevance to the NoMoreAISlop project.
 * Scores across multiple dimensions and makes accept/review/reject recommendations.
 */

import { BaseSkill, SkillResult, SkillConfig } from '../base-skill';
import {
  EnhancedSearchResult,
  RelevanceAssessment,
  RelevanceAssessmentSchema,
  JudgmentResult,
  TopicCategory,
  RELEVANCE_THRESHOLDS,
} from '../../models/index';
import { JUDGE_SYSTEM_PROMPT, buildJudgePrompt, JUDGE_TOOL } from './prompts';
import { getInfluencerDetector, DetectionResult } from '../../influencers/index';

/**
 * Judge input - results to evaluate
 */
export interface JudgeInput {
  results: EnhancedSearchResult[];
  existingKnowledge?: string[]; // Summaries of existing knowledge for novelty check
  minScore?: number; // Minimum score threshold (default from RELEVANCE_THRESHOLDS)
}

/**
 * Judge output - scored and filtered results
 */
export interface JudgeOutput {
  judgments: JudgmentResult[];
  accepted: JudgmentResult[];
  forReview: JudgmentResult[];
  rejected: JudgmentResult[];
  stats: {
    totalJudged: number;
    acceptRate: number;
    avgScore: number;
  };
}

/**
 * Judge Skill - Evaluates content relevance
 *
 * Responsibilities:
 * 1. Score each result across multiple dimensions
 * 2. Check novelty against existing knowledge
 * 3. Suggest categorization and tags
 * 4. Make accept/review/reject recommendations
 * 5. Detect and boost scores for tracked influencers
 */
export class JudgeSkill extends BaseSkill<JudgeInput, JudgeOutput> {
  readonly name = 'judge';
  readonly description = 'Evaluates content relevance for the NoMoreAISlop project';
  private influencerDetector = getInfluencerDetector();

  async execute(input: JudgeInput): Promise<SkillResult<JudgeOutput>> {
    const startTime = Date.now();

    try {
      this.ensureLLMClient();

      const judgments: JudgmentResult[] = [];

      // Evaluate each result
      for (const result of input.results) {
        try {
          const judgment = await this.evaluateResult(
            result,
            input.existingKnowledge || []
          );
          judgments.push(judgment);
        } catch (error) {
          // Log error but continue with other results
          console.warn(`Failed to evaluate ${result.url}: ${error}`);
        }

        // Small delay between evaluations
        if (input.results.indexOf(result) < input.results.length - 1) {
          await this.sleep(300);
        }
      }

      // Categorize by recommendation
      const accepted = judgments.filter(
        (j) => j.assessment.recommendation === 'accept'
      );
      const forReview = judgments.filter(
        (j) => j.assessment.recommendation === 'review'
      );
      const rejected = judgments.filter(
        (j) => j.assessment.recommendation === 'reject'
      );

      // Calculate stats
      const avgScore =
        judgments.length > 0
          ? judgments.reduce((sum, j) => sum + j.assessment.overallScore, 0) /
            judgments.length
          : 0;

      return {
        success: true,
        data: {
          judgments,
          accepted,
          forReview,
          rejected,
          stats: {
            totalJudged: judgments.length,
            acceptRate: judgments.length > 0 ? accepted.length / judgments.length : 0,
            avgScore,
          },
        },
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        metadata: { executionTimeMs: Date.now() - startTime },
      };
    }
  }

  /**
   * Evaluate a single search result
   */
  private async evaluateResult(
    result: EnhancedSearchResult,
    existingKnowledge: string[]
  ): Promise<JudgmentResult> {
    // Detect if this is from a tracked influencer (async)
    const influencerResult = await this.influencerDetector.detect(
      result.url,
      undefined,
      undefined,
      result.platform
    );

    const response = await this.callLLM(
      JUDGE_SYSTEM_PROMPT,
      buildJudgePrompt(result, existingKnowledge),
      {
        temperature: 0.2,
        maxTokens: 2000,
        tools: [JUDGE_TOOL],
        toolChoice: { type: 'tool', name: JUDGE_TOOL.name },
      }
    );

    const toolUse = this.extractToolUse(response);
    const rawAssessment = toolUse.input as Record<string, unknown>;

    // Validate and parse assessment
    let assessment = RelevanceAssessmentSchema.parse(rawAssessment);

    // Apply influencer credibility boost
    if (influencerResult.found && influencerResult.credibilityBoost > 0) {
      assessment = this.applyInfluencerBoost(assessment, influencerResult);
    }

    return {
      sourceUrl: result.url,
      assessment,
      suggestedCategory: this.mapTopicToCategory(result.extracted.mainTopic),
      suggestedTags: this.generateTags(result, assessment, influencerResult),
      extractedInsights: result.extracted.keyInsights.slice(0, 5),
      judgedAt: new Date().toISOString(),
      influencerMatch: influencerResult.found ? {
        influencerId: influencerResult.influencer!.id,
        influencerName: influencerResult.influencer!.name,
        credibilityTier: influencerResult.influencer!.credibilityTier,
        boostApplied: influencerResult.credibilityBoost,
      } : undefined,
    };
  }

  /**
   * Apply credibility boost from tracked influencer
   */
  private applyInfluencerBoost(
    assessment: RelevanceAssessment,
    influencerResult: DetectionResult
  ): RelevanceAssessment {
    const boost = influencerResult.credibilityBoost;

    // Boost credibility score specifically
    const boostedCredibility = Math.min(1, assessment.credibility.score + boost);

    // Recalculate overall score with boosted credibility
    const weights = {
      topicRelevance: 0.25,
      projectFit: 0.25,
      actionability: 0.20,
      novelty: 0.15,
      credibility: 0.15,
    };

    const newOverallScore =
      assessment.topicRelevance.score * weights.topicRelevance +
      assessment.projectFit.score * weights.projectFit +
      assessment.actionability.score * weights.actionability +
      assessment.novelty.score * weights.novelty +
      boostedCredibility * weights.credibility;

    // Determine new recommendation based on boosted score
    let recommendation: 'accept' | 'review' | 'reject' = 'reject';
    if (newOverallScore >= RELEVANCE_THRESHOLDS.accept) {
      recommendation = 'accept';
    } else if (newOverallScore >= RELEVANCE_THRESHOLDS.review) {
      recommendation = 'review';
    }

    return {
      ...assessment,
      credibility: {
        ...assessment.credibility,
        score: boostedCredibility,
      },
      overallScore: newOverallScore,
      recommendation,
    };
  }

  /**
   * Map extracted topic to category enum
   */
  private mapTopicToCategory(topic: string): TopicCategory {
    const mapping: Record<string, TopicCategory> = {
      'context-engineering': 'context-engineering',
      'claude-code-skills': 'claude-code-skills',
      subagents: 'subagents',
      'memory-management': 'memory-management',
      'prompt-engineering': 'prompt-engineering',
      'tool-use': 'tool-use',
      'workflow-automation': 'workflow-automation',
      'best-practices': 'best-practices',
    };
    return mapping[topic] || 'other';
  }

  /**
   * Generate tags based on content and assessment
   */
  private generateTags(
    result: EnhancedSearchResult,
    assessment: RelevanceAssessment,
    influencerResult?: DetectionResult
  ): string[] {
    const tags = new Set<string>();

    // Add referenced tools as tags
    result.extracted.referencedTools.forEach((tool) =>
      tags.add(tool.toLowerCase().replace(/\s+/g, '-'))
    );

    // Add platform as tag
    tags.add(result.platform);

    // Add content-based tags
    if (result.extracted.codeSnippets.length > 0) {
      tags.add('has-code');
    }

    // Add quality indicator
    if (assessment.overallScore >= RELEVANCE_THRESHOLDS.accept) {
      tags.add('high-quality');
    }

    // Add topic-based tags from main topic
    tags.add(result.extracted.mainTopic);

    // Add influencer tag if from tracked influencer
    if (influencerResult?.found) {
      tags.add('influencer-content');
      tags.add(`tier-${influencerResult.influencer!.credibilityTier}`);
    }

    return Array.from(tags).slice(0, 10);
  }
}

/**
 * Factory function
 */
export function createJudge(config?: SkillConfig): JudgeSkill {
  return new JudgeSkill(config);
}
