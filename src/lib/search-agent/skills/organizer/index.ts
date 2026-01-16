/**
 * Organizer Skill
 *
 * Transforms judged content into structured knowledge items and persists them.
 */

import { randomUUID } from 'node:crypto';
import { BaseSkill, SkillResult, SkillConfig } from '../base-skill';
import {
  JudgmentResult,
  KnowledgeItem,
  KnowledgeItemSchema,
  TopicCategory,
  ContentType,
  SourcePlatform,
  detectPlatformFromUrl,
} from '../../models/index';
import { knowledgeDb } from '../../db/index';
import { ORGANIZER_SYSTEM_PROMPT, buildOrganizePrompt, ORGANIZE_TOOL } from './prompts';

/**
 * Raw content map for organization
 */
export interface RawContent {
  title: string;
  content: string;
}

/**
 * Organizer input - judged results to organize
 */
export interface OrganizerInput {
  judgments: JudgmentResult[];
  rawContents: Map<string, RawContent>; // URL -> content
}

/**
 * Organizer output - structured knowledge items
 */
export interface OrganizerOutput {
  items: KnowledgeItem[];
  duplicatesSkipped: number;
  errors: Array<{ url: string; error: string }>;
  categoryCounts: Partial<Record<TopicCategory, number>>;
}

/**
 * Organized content from LLM
 */
interface OrganizedContent {
  title: string;
  summary: string;
  content: string;
  category: TopicCategory;
  contentType: ContentType;
  tags: string[];
}

/**
 * Organizer Skill - Structures and stores knowledge
 *
 * Responsibilities:
 * 1. Transform judged content into structured knowledge items
 * 2. Use taxonomy for categorization
 * 3. Detect and skip duplicates
 * 4. Persist to knowledge store
 */
export class OrganizerSkill extends BaseSkill<OrganizerInput, OrganizerOutput> {
  readonly name = 'organizer';
  readonly description = 'Organizes and stores curated knowledge items';

  async execute(input: OrganizerInput): Promise<SkillResult<OrganizerOutput>> {
    const startTime = Date.now();

    try {
      this.ensureLLMClient();

      const items: KnowledgeItem[] = [];
      const errors: Array<{ url: string; error: string }> = [];
      let duplicatesSkipped = 0;
      const categoryCounts: Partial<Record<TopicCategory, number>> = {};

      for (const judgment of input.judgments) {
        // Skip if already exists
        if (await knowledgeDb.hasItemByUrl(judgment.sourceUrl)) {
          duplicatesSkipped++;
          continue;
        }

        // Get raw content
        const rawContent = input.rawContents.get(judgment.sourceUrl);
        if (!rawContent) {
          errors.push({
            url: judgment.sourceUrl,
            error: 'No raw content found',
          });
          continue;
        }

        try {
          // Transform to knowledge item
          const item = await this.transformToKnowledgeItem(
            judgment,
            rawContent
          );

          // Validate
          const validated = KnowledgeItemSchema.safeParse(item);
          if (!validated.success) {
            errors.push({
              url: judgment.sourceUrl,
              error: `Validation failed: ${validated.error.message}`,
            });
            continue;
          }

          // Save
          await knowledgeDb.save(validated.data);
          items.push(validated.data);

          // Update counts
          categoryCounts[validated.data.category] =
            (categoryCounts[validated.data.category] || 0) + 1;
        } catch (error) {
          errors.push({
            url: judgment.sourceUrl,
            error: error instanceof Error ? error.message : String(error),
          });
        }

        // Small delay between items
        if (input.judgments.indexOf(judgment) < input.judgments.length - 1) {
          await this.sleep(300);
        }
      }

      return {
        success: true,
        data: {
          items,
          duplicatesSkipped,
          errors,
          categoryCounts,
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
   * Transform a judgment into a knowledge item using LLM
   */
  private async transformToKnowledgeItem(
    judgment: JudgmentResult,
    rawContent: RawContent
  ): Promise<KnowledgeItem> {
    const response = await this.callLLM(
      ORGANIZER_SYSTEM_PROMPT,
      buildOrganizePrompt(rawContent.title, rawContent.content, judgment),
      {
        temperature: 0.2,
        maxTokens: 3000,
        tools: [ORGANIZE_TOOL],
        toolChoice: { type: 'tool', name: ORGANIZE_TOOL.name },
      }
    );

    const toolUse = this.extractToolUse(response);
    const organized = toolUse.input as OrganizedContent;

    const now = new Date().toISOString();

    return {
      id: randomUUID(),
      version: '1.0.0',
      title: organized.title,
      summary: organized.summary,
      content: organized.content,
      category: organized.category,
      contentType: organized.contentType,
      tags: organized.tags,
      source: {
        platform: this.detectPlatform(judgment.sourceUrl),
        url: judgment.sourceUrl,
        fetchedAt: judgment.judgedAt,
      },
      relevance: {
        score: judgment.assessment.overallScore,
        confidence: judgment.assessment.confidence,
        reasoning: judgment.assessment.reasoning,
      },
      createdAt: now,
      updatedAt: now,
      status: 'draft',
    };
  }

  /**
   * Detect platform from URL
   */
  private detectPlatform(url: string): SourcePlatform {
    return detectPlatformFromUrl(url);
  }
}

/**
 * Factory function
 */
export function createOrganizer(config?: SkillConfig): OrganizerSkill {
  return new OrganizerSkill(config);
}
