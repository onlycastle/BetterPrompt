/**
 * Translation Verifier
 *
 * Pure deterministic module that verifies translated output contains
 * target language characters by checking CJK character ratios.
 *
 * @module analyzer/stages/translation-verifier
 */

import type { SupportedLanguage } from './content-writer-prompts';
import type { TranslatorOutput } from '../../models/translator-output';

// ============================================================================
// Types
// ============================================================================

export interface FieldVerificationResult {
  fieldPath: string;
  priority: 'critical' | 'non-critical';
  passed: boolean;
  cjkRatio: number;
}

export interface TranslationVerificationResult {
  passed: boolean;
  shouldRetry: boolean;
  criticalFailures: FieldVerificationResult[];
  nonCriticalFailures: FieldVerificationResult[];
  summary: string;
}

const CJK_PATTERNS: Record<Exclude<SupportedLanguage, 'en'>, RegExp> = {
  ko: /[\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F]/g,
  ja: /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/g,
  zh: /[\u4E00-\u9FFF\u3400-\u4DBF]/g,
};

const CJK_THRESHOLD = 0.30;
const MIN_TEXT_LENGTH = 10;

interface FieldDef {
  path: string;
  priority: 'critical' | 'non-critical';
  extract: (output: TranslatorOutput) => string | undefined;
}

const VERIFIED_FIELDS: FieldDef[] = [
  {
    path: 'personalitySummary',
    priority: 'critical',
    extract: (o) => o.personalitySummary,
  },
  {
    path: 'promptPatterns[].description',
    priority: 'critical',
    extract: (o) => o.promptPatterns?.map(p => p.description).join(' '),
  },
  {
    path: 'topFocusAreas.areas[].narrative',
    priority: 'critical',
    extract: (o) => o.topFocusAreas?.areas?.map(a => a.narrative).join(' '),
  },
  {
    path: 'weeklyInsights.narrative',
    priority: 'critical',
    extract: (o) => o.weeklyInsights?.narrative,
  },
  {
    path: 'topFocusAreas.summary',
    priority: 'non-critical',
    extract: (o) => o.topFocusAreas?.summary,
  },
  {
    path: 'antiPatternsAnalysis.summary',
    priority: 'non-critical',
    extract: (o) => o.antiPatternsAnalysis?.summary,
  },
  {
    path: 'antiPatternsAnalysis.detected[].displayName',
    priority: 'non-critical',
    extract: (o) => o.antiPatternsAnalysis?.detected?.map(d => d.displayName).join(' '),
  },
  {
    path: 'criticalThinkingAnalysis.summary',
    priority: 'non-critical',
    extract: (o) => o.criticalThinkingAnalysis?.summary,
  },
  {
    path: 'planningAnalysis.summary',
    priority: 'non-critical',
    extract: (o) => o.planningAnalysis?.summary,
  },
  {
    path: 'projectSummaries[].summaryLines',
    priority: 'non-critical',
    extract: (o) => o.projectSummaries?.flatMap(p => p.summaryLines).join(' '),
  },
  // translatedAgentInsights — worker translation verification
  {
    path: 'translatedAgentInsights.thinkingQuality.strengths',
    priority: 'non-critical',
    extract: (o) => o.translatedAgentInsights?.thinkingQuality?.strengths
      ?.map(s => `${s.title} ${s.description}`).join(' '),
  },
  {
    path: 'translatedAgentInsights.communicationPatterns.strengths',
    priority: 'non-critical',
    extract: (o) => o.translatedAgentInsights?.communicationPatterns?.strengths
      ?.map(s => `${s.title} ${s.description}`).join(' '),
  },
  {
    path: 'translatedAgentInsights.learningBehavior.strengths',
    priority: 'non-critical',
    extract: (o) => o.translatedAgentInsights?.learningBehavior?.strengths
      ?.map(s => `${s.title} ${s.description}`).join(' '),
  },
  {
    path: 'translatedAgentInsights.contextEfficiency.strengths',
    priority: 'non-critical',
    extract: (o) => o.translatedAgentInsights?.contextEfficiency?.strengths
      ?.map(s => `${s.title} ${s.description}`).join(' '),
  },
];

/**
 * Calculate CJK character ratio for a given text and target language.
 */
export function calculateCJKRatio(
  text: string,
  targetLanguage: Exclude<SupportedLanguage, 'en'>
): { cjkRatio: number; totalChars: number; targetChars: number } {
  if (!text || text.length === 0) {
    return { cjkRatio: 0, totalChars: 0, targetChars: 0 };
  }

  const pattern = CJK_PATTERNS[targetLanguage];
  pattern.lastIndex = 0;
  const targetChars = text.match(pattern)?.length ?? 0;

  const allCharsPattern = /[a-zA-Z0-9\uAC00-\uD7AF\u1100-\u11FF\u3130-\u318F\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF\u3400-\u4DBF]/g;
  const totalChars = text.match(allCharsPattern)?.length ?? 0;

  const cjkRatio = totalChars > 0 ? targetChars / totalChars : 0;
  return { cjkRatio, totalChars, targetChars };
}

/**
 * Verify a single field's translation quality by CJK ratio.
 */
export function verifyField(
  text: string | undefined,
  fieldPath: string,
  targetLanguage: Exclude<SupportedLanguage, 'en'>,
  priority: 'critical' | 'non-critical'
): FieldVerificationResult {
  if (!text || text.length < MIN_TEXT_LENGTH) {
    return { fieldPath, priority, passed: true, cjkRatio: 0 };
  }

  const { cjkRatio } = calculateCJKRatio(text, targetLanguage);
  return {
    fieldPath,
    priority,
    passed: cjkRatio >= CJK_THRESHOLD,
    cjkRatio,
  };
}

/**
 * Verify an entire TranslatorOutput for translation completeness.
 */
export function verifyTranslation(
  output: TranslatorOutput,
  targetLanguage: Exclude<SupportedLanguage, 'en'>
): TranslationVerificationResult {
  const results: FieldVerificationResult[] = [];

  for (const fieldDef of VERIFIED_FIELDS) {
    const text = fieldDef.extract(output);
    results.push(verifyField(text, fieldDef.path, targetLanguage, fieldDef.priority));
  }

  const criticalFailures = results.filter(r => !r.passed && r.priority === 'critical');
  const nonCriticalFailures = results.filter(r => !r.passed && r.priority === 'non-critical');
  const totalChecked = results.filter(r => r.cjkRatio > 0 || (r.passed && r.cjkRatio === 0)).length;

  const hasCriticalFailures = criticalFailures.length > 0;
  const nonCriticalFailRate = totalChecked > 0
    ? nonCriticalFailures.length / totalChecked
    : 0;

  const shouldRetry = hasCriticalFailures || nonCriticalFailRate > 0.5;
  const passed = !hasCriticalFailures && nonCriticalFailures.length === 0;

  const failedPaths = [...criticalFailures, ...nonCriticalFailures]
    .map(f => `${f.fieldPath}(${(f.cjkRatio * 100).toFixed(0)}%)`)
    .join(', ');

  const summary = passed
    ? `All ${totalChecked} fields passed CJK verification (threshold=${CJK_THRESHOLD * 100}%)`
    : `${criticalFailures.length} critical + ${nonCriticalFailures.length} non-critical failures: ${failedPaths}`;

  return {
    passed,
    shouldRetry,
    criticalFailures,
    nonCriticalFailures,
    summary,
  };
}
