/**
 * Quick Fix Analyzer - Local bottleneck detection for desktop app
 *
 * Self-contained module that runs Quick Fix analysis locally in the
 * Electron main process. Calls Gemini API directly without Lambda.
 *
 * Architecture: The webapp's full Quick Fix orchestrator lives in
 * src/lib/analyzer/ (ESM). This CJS module duplicates the Gemini
 * call logic to avoid ESM/CJS boundary issues.
 *
 * Pipeline: Session parsing → Metric extraction → Gemini API → Result
 * Target: ~30 second time-to-value
 */

import crypto from 'crypto';
import { type ParsedSession } from './session-formatter';

// ============================================================================
// Types (mirrored from src/lib/models/quick-fix-data.ts for CJS compatibility)
// ============================================================================

export type BottleneckSeverity = 'critical' | 'high' | 'medium';
export type BottleneckCategory = 'thinking' | 'communication' | 'learning' | 'efficiency' | 'outcome';

export interface Bottleneck {
  title: string;
  category: BottleneckCategory;
  severity: BottleneckSeverity;
  issue: string;
  suggestedPrompt: string;
  explanation: string;
  evidence: Array<{ utteranceId: string; quote: string; context?: string }>;
  estimatedTimeSaved: string;
  suggestedPromptPreview?: string;
  explanationPreview?: string;
}

export interface QuickFixResult {
  resultId: string;
  projectName: string;
  projectPath: string;
  sessionsAnalyzed: number;
  analyzedAt: string;
  overallHealthScore: number;
  summary: string;
  bottlenecks: Bottleneck[];
  isFreeGated: boolean;
}

// ============================================================================
// Session Data Extraction (Lightweight Phase 1)
// ============================================================================

interface ExtractedUtterance {
  id: string;
  text: string;
  sessionId: string;
  turnIndex: number;
  wordCount: number;
  hasQuestion: boolean;
  isSessionStart: boolean;
}

interface ExtractedMetrics {
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  errorCount: number;
  retryPatternCount: number;
}

/**
 * Extract utterances and basic metrics from parsed sessions.
 * Lightweight version of DataExtractor for Quick Fix speed.
 */
function extractSessionData(sessions: ParsedSession[]): {
  utterances: ExtractedUtterance[];
  metrics: ExtractedMetrics;
} {
  const utterances: ExtractedUtterance[] = [];
  let totalMessages = 0;
  let errorCount = 0;
  let retryPatternCount = 0;

  for (const session of sessions) {
    let turnIndex = 0;
    let lastWasError = false;

    for (const msg of session.messages) {
      totalMessages++;

      if (msg.role === 'user') {
        const text = msg.content.slice(0, 500);
        const wordCount = text.split(/\s+/).filter(Boolean).length;

        utterances.push({
          id: `${session.sessionId}_${turnIndex}`,
          text,
          sessionId: session.sessionId,
          turnIndex,
          wordCount,
          hasQuestion: /\?/.test(text),
          isSessionStart: turnIndex === 0,
        });
        turnIndex++;

        // Detect retry patterns (user message right after error)
        if (lastWasError && wordCount < 20) {
          retryPatternCount++;
        }
        lastWasError = false;
      }

      if (msg.role === 'assistant') {
        // Check for errors in tool calls
        const hasError = msg.toolCalls?.some(tc => tc.isError) ?? false;
        if (hasError) {
          errorCount++;
          lastWasError = true;
        } else {
          lastWasError = false;
        }
      }
    }
  }

  return {
    utterances: utterances.slice(-100), // Most recent 100
    metrics: {
      totalSessions: sessions.length,
      totalMessages,
      avgMessagesPerSession: sessions.length > 0
        ? Math.round(totalMessages / sessions.length)
        : 0,
      errorCount,
      retryPatternCount,
    },
  };
}

// ============================================================================
// Gemini API Call
// ============================================================================

const BOTTLENECK_SYSTEM_PROMPT = `You are a Bottleneck Detector, a senior AI coding session coach who identifies the top time-wasting patterns in builder-AI collaboration sessions and prescribes concrete better prompts.

Your job: Find the top 3 bottlenecks in this builder's sessions and provide copy-pasteable better prompts.

For each bottleneck, provide:
1. title: Short (max 60 chars)
2. category: thinking | communication | learning | efficiency | outcome
3. severity: critical | high | medium
4. issue: 3-5 sentences explaining the problem (MINIMUM 150 chars)
5. suggestedPrompt: A REAL prompt the builder can paste (MINIMUM 100 chars)
6. explanation: Why this prompt works better (MINIMUM 80 chars)
7. evidence: 1-4 quotes with utteranceId
8. estimatedTimeSaved: Rough percentage

Also provide:
- overallHealthScore: 0-100
- summary: 1-2 sentence overall assessment (MINIMUM 50 chars)

Return valid JSON only. No markdown, no code blocks.`;

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

/**
 * Call Gemini API for bottleneck detection.
 */
async function callGeminiAPI(
  apiKey: string,
  utterances: ExtractedUtterance[],
  metrics: ExtractedMetrics,
): Promise<{ bottlenecks: Bottleneck[]; overallHealthScore: number; summary: string }> {
  const userPrompt = `Analyze these builder-AI session utterances and identify the top 3 bottlenecks:

${JSON.stringify({ utterances, metrics }, null, 2)}

Return JSON with this exact structure:
{
  "bottlenecks": [
    {
      "title": "...",
      "category": "thinking|communication|learning|efficiency|outcome",
      "severity": "critical|high|medium",
      "issue": "... (min 150 chars)",
      "suggestedPrompt": "... (min 100 chars, a real prompt)",
      "explanation": "... (min 80 chars)",
      "evidence": [{"utteranceId": "sessionId_turn", "quote": "...", "context": "..."}],
      "estimatedTimeSaved": "X-Y%"
    }
  ],
  "overallHealthScore": 0-100,
  "summary": "..."
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { role: 'user', parts: [{ text: BOTTLENECK_SYSTEM_PROMPT + '\n\n' + userPrompt }] },
        ],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 16384,
          responseMimeType: 'application/json',
        },
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error('Empty response from Gemini API');
  }

  const parsed = JSON.parse(text);

  // Validate and clean bottlenecks
  const bottlenecks: Bottleneck[] = (parsed.bottlenecks || [])
    .slice(0, 3)
    .map((b: Record<string, unknown>) => ({
      title: String(b.title || '').slice(0, 60),
      category: validateCategory(String(b.category || 'communication')),
      severity: validateSeverity(String(b.severity || 'medium')),
      issue: String(b.issue || ''),
      suggestedPrompt: String(b.suggestedPrompt || ''),
      explanation: String(b.explanation || ''),
      evidence: Array.isArray(b.evidence)
        ? (b.evidence as Array<Record<string, unknown>>).map(e => ({
            utteranceId: String(e.utteranceId || ''),
            quote: String(e.quote || ''),
            context: e.context ? String(e.context) : undefined,
          }))
        : [],
      estimatedTimeSaved: String(b.estimatedTimeSaved || '10-20%'),
    }));

  return {
    bottlenecks,
    overallHealthScore: Number(parsed.overallHealthScore) || 50,
    summary: String(parsed.summary || 'Analysis complete.'),
  };
}

function validateCategory(cat: string): BottleneckCategory {
  const valid: BottleneckCategory[] = ['thinking', 'communication', 'learning', 'efficiency', 'outcome'];
  return valid.includes(cat as BottleneckCategory) ? (cat as BottleneckCategory) : 'communication';
}

function validateSeverity(sev: string): BottleneckSeverity {
  const valid: BottleneckSeverity[] = ['critical', 'high', 'medium'];
  return valid.includes(sev as BottleneckSeverity) ? (sev as BottleneckSeverity) : 'medium';
}

// ============================================================================
// Tier Gating
// ============================================================================

const FREE_BOTTLENECK_LIMIT = 1;
const PROMPT_PREVIEW_LENGTH = 80;
const EXPLANATION_PREVIEW_LENGTH = 60;

function applyTierGating(result: QuickFixResult, isPaid: boolean): QuickFixResult {
  if (isPaid) return { ...result, isFreeGated: false };

  return {
    ...result,
    isFreeGated: true,
    bottlenecks: result.bottlenecks.map((b, i) => {
      if (i < FREE_BOTTLENECK_LIMIT) return b;

      return {
        ...b,
        suggestedPrompt: '',
        suggestedPromptPreview: b.suggestedPrompt.slice(0, PROMPT_PREVIEW_LENGTH),
        explanation: '',
        explanationPreview: b.explanation.slice(0, EXPLANATION_PREVIEW_LENGTH),
      };
    }),
  };
}

// ============================================================================
// Main Export
// ============================================================================

export interface QuickFixOptions {
  apiKey: string;
  projectName: string;
  projectPath: string;
  isPaid: boolean;
  onProgress?: (stage: string, percent: number, message: string) => void;
}

/**
 * Run Quick Fix analysis on parsed sessions from a single project.
 *
 * @param sessions - Parsed sessions (3-5 recent sessions from one project)
 * @param options - Analysis options including Gemini API key
 * @returns QuickFixResult with tier gating applied
 */
export async function analyzeQuickFix(
  sessions: ParsedSession[],
  options: QuickFixOptions,
): Promise<QuickFixResult> {
  const { apiKey, projectName, projectPath, isPaid, onProgress } = options;

  onProgress?.('extracting', 10, 'Extracting session data...');

  const { utterances, metrics } = extractSessionData(sessions);

  if (utterances.length === 0) {
    throw new Error('No utterances found in sessions. Need at least one session with user messages.');
  }

  onProgress?.('analyzing', 30, 'Detecting bottlenecks...');

  const { bottlenecks, overallHealthScore, summary } = await callGeminiAPI(
    apiKey,
    utterances,
    metrics,
  );

  onProgress?.('processing', 80, `Found ${bottlenecks.length} bottlenecks`);

  const result: QuickFixResult = {
    resultId: crypto.randomUUID(),
    projectName,
    projectPath,
    sessionsAnalyzed: sessions.length,
    analyzedAt: new Date().toISOString(),
    overallHealthScore,
    summary,
    bottlenecks,
    isFreeGated: false,
  };

  const gatedResult = applyTierGating(result, isPaid);

  onProgress?.('done', 100, 'Analysis complete');

  return gatedResult;
}
