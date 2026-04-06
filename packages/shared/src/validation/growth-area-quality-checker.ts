/**
 * Growth Area Quality Validation Checker
 *
 * Automated quality-validation checker that scores each growth area against the
 * 4-criteria rubric and flags any of the four original problems:
 *   1. Generic areas     — dressed-up generic advice that could apply to anyone
 *   2. Isolated quotes   — single quote without pattern context, not a real pattern
 *   3. Arbitrary scores  — severity not justified by evidence weight
 *   4. Missing patterns  — no behavioral pattern described, just symptoms/advice
 *
 * Unlike the existing `evaluateQualityRubric()` which returns boolean pass/fail,
 * this checker produces:
 *   - Continuous scores (0-1) per rubric criterion for quality measurement
 *   - Specific problem detection with diagnostic messages
 *   - A structured validation report for pipeline gating and reporting
 *
 * Design: Composes existing helpers from growth-area-pea.ts (containsToolFileApiReference,
 * validateDistinctEvidence, hasObservableSignal, isValidToolFileApiEntry) into a higher-level
 * quality analysis rather than reimplementing validation logic.
 *
 * @module @betterprompt/shared/validation/growth-area-quality-checker
 */

import {
  validateDistinctEvidence,
  containsToolFileApiReference,
  isValidToolFileApiEntry,
  hasObservableSignal,
  type GrowthAreaPEALLMOutput,
  type GrowthAreaPEA,
  type QualityRubric,
} from '../schemas/growth-area-pea.js';

// ============================================================================
// Types
// ============================================================================

/**
 * Continuous score for a single rubric criterion.
 *
 * Provides granularity beyond the boolean pass/fail in QualityRubric:
 *   - `score`: 0-1 continuous (1.0 = excellent, 0.0 = completely fails)
 *   - `pass`: boolean hard gate (derived from score >= threshold)
 *   - `signals`: what contributed positively to the score
 *   - `deficiencies`: what is missing or weak
 */
export interface CriterionScore {
  /** Continuous quality score (0-1) */
  score: number;
  /** Hard gate pass/fail */
  pass: boolean;
  /** Positive signals detected */
  signals: string[];
  /** Deficiencies that reduce the score */
  deficiencies: string[];
}

/**
 * One of the four original problems detected in a growth area.
 *
 * Each problem flag includes:
 *   - `detected`: whether the problem is present
 *   - `severity`: how severe the problem is (critical = must fix, warning = should fix)
 *   - `evidence`: specific diagnostic details explaining why the problem was flagged
 *   - `suggestion`: actionable fix to address the problem
 */
export interface ProblemFlag {
  /** Whether this problem was detected */
  detected: boolean;
  /** Severity of the problem */
  severity: 'critical' | 'warning';
  /** Diagnostic details */
  evidence: string[];
  /** Actionable suggestion for fixing */
  suggestion: string;
}

/**
 * Complete quality validation result for a single growth area.
 *
 * Combines:
 *   - 4-criteria rubric with continuous scores
 *   - 4 original problem flags with diagnostics
 *   - Overall quality score and pass/fail
 *   - Human-readable summary
 */
export interface QualityValidationResult {
  /** Overall pass/fail — ALL criteria must pass AND no critical problems */
  passes: boolean;

  /** Aggregated quality score (0-1), weighted average of criterion scores */
  overallScore: number;

  /** 4-criteria rubric with continuous scores */
  criteria: {
    distinctMoments: CriterionScore;
    verifiableAction: CriterionScore;
    patternSpecificity: CriterionScore;
    toolFileNaming: CriterionScore;
  };

  /** 4 original problem flags */
  problems: {
    /** Dressed-up generic advice that could apply to anyone */
    genericArea: ProblemFlag;
    /** Single quote without pattern context */
    isolatedQuotes: ProblemFlag;
    /** Severity not justified by evidence weight */
    arbitraryScores: ProblemFlag;
    /** No behavioral pattern described, just symptoms */
    missingPatterns: ProblemFlag;
  };

  /** Boolean rubric for backward compatibility with existing QualityRubric */
  rubric: QualityRubric;

  /** Human-readable diagnostic summary */
  summary: string;
}

// ============================================================================
// Generic Advice Detection
// ============================================================================

/**
 * Banned generic patterns that indicate dressed-up advice rather than
 * specific behavioral observations.
 *
 * These patterns match common template-like growth areas that fail the
 * pattern_specificity criterion. They are checked against both the title
 * and description to catch subtle generics.
 */
const GENERIC_TITLE_PATTERNS: RegExp[] = [
  /^improve\s+[\w\s]+\s+(practices?|habits?|skills?)/i,
  /^better\s+[\w\s]+\s+(would|could|should)/i,
  /^consider\s+using\s+[\w\s]+\s+more/i,
  /^(plan|think|test)\s+(before|more)\s+(implementing|coding|carefully)/i,
  /^(enhance|strengthen|develop)\s+(your\s+)?[\w\s]+\s+(approach|strategy|workflow)/i,
  /^(lack|absence)\s+of\s+[\w\s]+\s+(planning|testing|review)/i,
];

/**
 * Generic description phrases that indicate advice rather than observation.
 * Matched as substrings within the description text.
 */
const GENERIC_DESCRIPTION_PHRASES: RegExp[] = [
  /this will help you write better code/i,
  /testing is important for (software|code) quality/i,
  /better error handling improves reliability/i,
  /planning saves time in the long run/i,
  /this is a (common|frequent|typical) (mistake|problem|issue)/i,
  /could apply to any (developer|project|codebase)/i,
  /generally (considered|regarded) (best|good) practice/i,
  /it'?s (always|generally) (good|better|best) to/i,
];

/**
 * Detect whether a growth area title matches a generic advice template.
 *
 * @param title - Growth area title to check
 * @returns Array of matched generic patterns (empty if none detected)
 */
export function detectGenericTitle(title: string): string[] {
  const matches: string[] = [];
  for (const pattern of GENERIC_TITLE_PATTERNS) {
    if (pattern.test(title)) {
      matches.push(`Title matches generic template: "${title}"`);
    }
  }
  return matches;
}

/**
 * Detect generic advice phrases in a description.
 *
 * @param description - Growth area description to check
 * @returns Array of matched generic phrases (empty if none detected)
 */
export function detectGenericDescription(description: string): string[] {
  const matches: string[] = [];
  for (const pattern of GENERIC_DESCRIPTION_PHRASES) {
    if (pattern.test(description)) {
      const match = description.match(pattern);
      matches.push(`Description contains generic phrase: "${match?.[0] ?? ''}"`);
    }
  }
  return matches;
}

// ============================================================================
// Severity Justification Validation
// ============================================================================

/**
 * Expected minimum evidence thresholds per severity level.
 *
 * Higher severity claims require more supporting evidence. A "critical"
 * growth area with only 2 moments from 1 session is an arbitrary score —
 * the evidence doesn't support the severity claim.
 */
const SEVERITY_EVIDENCE_THRESHOLDS: Record<string, { minMoments: number; minSessions: number }> = {
  critical: { minMoments: 3, minSessions: 2 },
  high:     { minMoments: 2, minSessions: 2 },
  medium:   { minMoments: 2, minSessions: 1 },
  low:      { minMoments: 2, minSessions: 1 },
};

/**
 * Validate that the claimed severity is justified by the evidence weight.
 *
 * A "critical" severity with minimal evidence is an arbitrary score.
 * Returns an object with whether the severity is justified and diagnostic details.
 *
 * @param severity - Claimed severity level
 * @param evidenceCount - Number of evidence moments
 * @param sessionCount - Number of distinct sessions in evidence
 * @returns Justification result
 */
export function validateSeverityJustification(
  severity: string,
  evidenceCount: number,
  sessionCount: number,
): { justified: boolean; reason?: string } {
  const threshold = SEVERITY_EVIDENCE_THRESHOLDS[severity];
  if (!threshold) {
    return { justified: false, reason: `Unknown severity level: "${severity}"` };
  }

  if (evidenceCount < threshold.minMoments) {
    return {
      justified: false,
      reason: `Severity "${severity}" requires at least ${threshold.minMoments} evidence moments but has ${evidenceCount}`,
    };
  }

  if (sessionCount < threshold.minSessions) {
    return {
      justified: false,
      reason: `Severity "${severity}" requires evidence from at least ${threshold.minSessions} sessions but has ${sessionCount}`,
    };
  }

  return { justified: true };
}

// ============================================================================
// Missing Pattern Detection
// ============================================================================

/**
 * Pattern description markers that indicate a real behavioral observation.
 *
 * A well-formed pattern description should contain quantification, behavioral
 * verbs, and session references — not just symptom descriptions or advice.
 */
const BEHAVIORAL_MARKERS: RegExp[] = [
  // Quantification: "in X of Y sessions", "across N sessions"
  /\b(in\s+\d+\s+of\s+\d+|across\s+\d+|in\s+\d+\s+sessions?)\b/i,
  // Behavioral verbs: "you consistently/repeatedly/frequently..."
  /\b(consistently|repeatedly|frequently|regularly|habitually|always|never|rarely)\b/i,
  // Observed behavior: "you did X", "the developer X"
  /\b(you\s+(skip|miss|avoid|omit|forget|ignore|bypass|neglect)|developer\s+(skips?|misses?|avoids?))\b/i,
  // Session references
  /\b(sessions?\s+(show|reveal|demonstrate|indicate)|observed\s+in|pattern\s+(of|across|in))\b/i,
];

/**
 * Detect whether a pattern description describes an actual behavioral pattern
 * (vs. just listing symptoms or giving advice).
 *
 * A real pattern has quantification + behavioral verbs + session context.
 * A missing pattern just describes a problem without grounding it in observed behavior.
 *
 * @param description - Pattern description to analyze
 * @returns Object with marker count and specific markers found
 */
export function detectBehavioralMarkers(description: string): {
  markerCount: number;
  markers: string[];
  hasBehavioralPattern: boolean;
} {
  const markers: string[] = [];

  for (const pattern of BEHAVIORAL_MARKERS) {
    const match = description.match(pattern);
    if (match) {
      markers.push(match[0]);
    }
  }

  return {
    markerCount: markers.length,
    markers,
    // Need at least 2 behavioral markers to establish it describes a pattern
    hasBehavioralPattern: markers.length >= 2,
  };
}

// ============================================================================
// Isolated Quote Detection
// ============================================================================

/**
 * Check evidence moments for isolation indicators.
 *
 * Isolated quotes are:
 *   - All from the same session (no cross-session recurrence)
 *   - Quoting the same utterance repeatedly (duplicate utteranceIds)
 *   - Very short quotes that lack context (under 20 chars)
 *   - Missing meaningful observation text
 *
 * @param evidence - Array of evidence moments
 * @returns Isolation analysis result
 */
export function analyzeEvidenceIsolation(
  evidence: ReadonlyArray<{
    utteranceId: string;
    sessionId: string;
    quote: string;
    observation: string;
    context: string;
  }>,
): {
  isolated: boolean;
  reasons: string[];
  distinctUtterances: number;
  distinctSessions: number;
} {
  const reasons: string[] = [];

  // Check for duplicate utteranceIds
  const utteranceIds = evidence.map(e => e.utteranceId);
  const distinctUtterances = new Set(utteranceIds).size;
  if (distinctUtterances < evidence.length) {
    reasons.push(
      `${evidence.length - distinctUtterances} duplicate utteranceId(s) — same moment cited multiple times`,
    );
  }

  // Check for all-same-session evidence
  const sessionIds = new Set(evidence.map(e => e.sessionId));
  if (sessionIds.size === 1 && evidence.length > 0) {
    reasons.push('All evidence from a single session — no cross-session recurrence proven');
  }

  // Check for very short quotes
  const shortQuotes = evidence.filter(e => e.quote.length < 20);
  if (shortQuotes.length > 0) {
    reasons.push(
      `${shortQuotes.length} quote(s) under 20 chars — may be fragments rather than meaningful exchanges`,
    );
  }

  // Check for generic/empty observations
  const weakObservations = evidence.filter(
    e => e.observation.length < 30 || /^(bad|poor|wrong|needs improvement|not good)/i.test(e.observation),
  );
  if (weakObservations.length > evidence.length / 2) {
    reasons.push('Majority of observations are too short or generic to demonstrate a pattern');
  }

  return {
    isolated: distinctUtterances < 2 || reasons.length >= 2,
    reasons,
    distinctUtterances,
    distinctSessions: sessionIds.size,
  };
}

// ============================================================================
// Criterion Scoring Functions
// ============================================================================

/**
 * Score the distinct_moments criterion (0-1).
 *
 * Scoring factors:
 *   - Evidence count (minimum 2, more is better up to 5)
 *   - Distinct utterance IDs (all different = better)
 *   - Distinct sessions (cross-session = much better)
 *   - Quote quality (length, verbatim feel)
 */
export function scoreDistinctMoments(
  evidence: ReadonlyArray<{
    utteranceId: string;
    sessionId: string;
    quote: string;
    observation: string;
    context: string;
  }>,
): CriterionScore {
  const signals: string[] = [];
  const deficiencies: string[] = [];
  let score = 0;

  // Use existing validator for hard gate
  const result = validateDistinctEvidence(evidence);

  if (!result.valid) {
    deficiencies.push(result.reason ?? 'Evidence validation failed');
    return { score: 0, pass: false, signals, deficiencies };
  }

  // Base: having 2+ distinct utterances = 0.4
  score += 0.4;
  signals.push(`${result.distinctUtteranceCount} distinct utterance(s)`);

  // Cross-session bonus: 2+ sessions = +0.25
  if (result.distinctSessionCount >= 2) {
    score += 0.25;
    signals.push(`Evidence spans ${result.distinctSessionCount} distinct sessions`);
  } else {
    deficiencies.push('All evidence from a single session');
  }

  // Evidence richness: 3+ moments = +0.15, 4+ = +0.2
  if (evidence.length >= 4) {
    score += 0.2;
    signals.push(`${evidence.length} evidence moments (rich)`);
  } else if (evidence.length >= 3) {
    score += 0.15;
    signals.push(`${evidence.length} evidence moments`);
  }

  // Quote quality: quotes >= 30 chars suggest verbatim, not summaries
  const substantialQuotes = evidence.filter(e => e.quote.length >= 30);
  if (substantialQuotes.length === evidence.length) {
    score += 0.15;
    signals.push('All quotes are substantial (30+ chars)');
  } else if (substantialQuotes.length > 0) {
    score += 0.05;
    deficiencies.push(`${evidence.length - substantialQuotes.length} quote(s) are short — may be summaries rather than verbatim`);
  } else {
    deficiencies.push('No substantial quotes (all under 30 chars)');
  }

  return { score: Math.min(1, score), pass: result.valid, signals, deficiencies };
}

/**
 * Patterns that indicate a verificationCheck explicitly references session-log
 * artifacts — making it truly "checkable against future session logs" (AC 3).
 *
 * These go beyond just mentioning a tool name. They describe HOW to verify
 * the action was taken by looking at actual JSONL session log structure:
 * - tool_use block appearances
 * - message position/ordering within a session
 * - session log contains/shows patterns
 * - explicit JSONL session artifact references
 *
 * This rewards well-formed checks over minimally-passing ones, creating a
 * scoring gradient: passing vs. excellent verification checks.
 */
const SESSION_LOG_SPECIFICITY_PATTERNS: RegExp[] = [
  // Direct session log artifact references (JSONL-specific)
  /\bsession\s+log\s+(contains?|shows?|should|has|reveals?|includes?)\b/i,
  /\btool_use\s+block\b/i,
  /\bin\s+the\s+session\s+log\b/i,
  /\bappears?\s+(in|within)\s+(the\s+)?(session|log|messages?|transcript)\b/i,
  // Message position references (structural JSONL ordering)
  /\bfirst\s+\d+\s+(messages?|turns?|exchanges?)\b/i,
  /\b(early|beginning)\s+(in|of)\s+the\s+session\b/i,
  /\bbefore\s+the\s+first\s+(message|edit|code|implementation)\b/i,
  // Explicit log-checking references
  /\bchecking\s+the\s+session\b/i,
  /\breviewing\s+(the\s+)?(session|logs?|transcript)\b/i,
  /\b(visible|observable|detectable)\s+(in|from)\s+(the\s+)?(session|logs?)\b/i,
  /\bJSONL\b/i,
  // Sequence verification (before/after in logs)
  /\b(appears?\s+(before|after)\s+|precedes?|follows?)\s+.*\btool_use\b/i,
];

/**
 * Check whether a verificationCheck explicitly references session-log artifacts,
 * making it truly "checkable against future session logs" (AC 3 requirement).
 *
 * This is a quality signal beyond `hasObservableSignal` — the check describes
 * HOW to verify in session logs, not just WHAT to look for.
 *
 * @param verificationCheck - The check description to analyze
 * @returns true if the check explicitly references session log structure
 */
export function hasSessionLogSpecificity(verificationCheck: string): boolean {
  return SESSION_LOG_SPECIFICITY_PATTERNS.some(pattern => pattern.test(verificationCheck));
}

/**
 * Score the verifiable_action criterion (0-1).
 *
 * Scoring factors:
 *   - Action instruction length and specificity
 *   - Verification check quality
 *   - Observable session-log signals present (hard gate)
 *   - Session log specificity bonus (AC 3 — "checkable against future session logs")
 *   - Goal relevance specificity
 *   - Instruction tool/command specificity
 *
 * AC 3 note: The `verificationCheck` is the core of "checkable against future
 * session logs". Well-formed checks explicitly reference how to look in session
 * JSONL logs (e.g., "session log contains Glob tool_use blocks") score higher
 * than minimal checks that only mention a tool name.
 */
export function scoreVerifiableAction(action: {
  instruction: string;
  verificationCheck: string;
  goalRelevance: string;
}): CriterionScore {
  const signals: string[] = [];
  const deficiencies: string[] = [];
  let score = 0;

  // Instruction length: >= 50 chars = base pass
  if (action.instruction.length >= 50) {
    score += 0.2;
    signals.push(`Instruction is ${action.instruction.length} chars (substantial)`);
  } else {
    deficiencies.push(`Instruction is only ${action.instruction.length} chars (need 50+)`);
  }

  // Verification check: >= 30 chars
  if (action.verificationCheck.length >= 30) {
    score += 0.15;
    signals.push('Verification check describes what to look for');
  } else {
    deficiencies.push(`Verification check is only ${action.verificationCheck.length} chars (need 30+)`);
  }

  // Observable signals (the core hard-gate of verifiable_action)
  if (hasObservableSignal(action.instruction, action.verificationCheck)) {
    score += 0.35;
    signals.push('References observable session-log signals (tools, commands, patterns)');
  } else {
    deficiencies.push('No observable session-log signal found — action may be vague advice');
  }

  // Session log specificity bonus (AC 3 — "checkable against future session logs")
  // Rewards verificationChecks that explicitly describe HOW to check in session logs,
  // not just WHAT to look for. A check like "Session log contains Glob tool_use blocks"
  // is more verifiable than "Glob is used more".
  if (hasSessionLogSpecificity(action.verificationCheck)) {
    score += 0.1;
    signals.push('Verification check explicitly references session-log artifacts (highly checkable)');
  } else if (action.verificationCheck.length >= 50) {
    // Partial credit for long checks that describe the verification behavior in detail
    score += 0.05;
    signals.push('Verification check is detailed (50+ chars)');
  } else {
    deficiencies.push(
      'Verification check does not reference session-log artifacts. ' +
      'Best practice: describe what appears in JSONL session logs (e.g., ' +
      '"Session log contains Grep tool_use blocks before Bash tool_use").',
    );
  }

  // Goal relevance quality
  if (action.goalRelevance.length >= 50) {
    score += 0.15;
    signals.push('Goal relevance explains why the action matters');
  } else {
    deficiencies.push(`Goal relevance is too short (${action.goalRelevance.length} chars, need 50+)`);
  }

  // Bonus: instruction contains specific tool/command names
  if (containsToolFileApiReference(action.instruction)) {
    score += 0.1;
    signals.push('Action instruction names specific tools/commands');
  }

  const pass =
    action.instruction.length >= 50 &&
    action.verificationCheck.length >= 30 &&
    hasObservableSignal(action.instruction, action.verificationCheck);

  return { score: Math.min(1, score), pass, signals, deficiencies };
}

/**
 * Score the pattern_specificity criterion (0-1).
 *
 * Scoring factors:
 *   - Description length (100+ chars = meaningful)
 *   - Behavioral markers present (quantification, verbs, session refs)
 *   - No generic advice patterns detected
 *   - toolsFilesApis has specific entries
 */
export function scorePatternSpecificity(
  pattern: {
    title: string;
    description: string;
    toolsFilesApis: string[];
  },
): CriterionScore {
  const signals: string[] = [];
  const deficiencies: string[] = [];
  let score = 0;

  // Description length
  if (pattern.description.length >= 150) {
    score += 0.2;
    signals.push(`Description is ${pattern.description.length} chars (detailed)`);
  } else if (pattern.description.length >= 100) {
    score += 0.1;
    signals.push(`Description is ${pattern.description.length} chars (adequate)`);
  } else {
    deficiencies.push(`Description is only ${pattern.description.length} chars (need 100+)`);
  }

  // Behavioral markers
  const markers = detectBehavioralMarkers(pattern.description);
  if (markers.hasBehavioralPattern) {
    score += 0.3;
    signals.push(`${markers.markerCount} behavioral markers found: ${markers.markers.join(', ')}`);
  } else if (markers.markerCount >= 1) {
    score += 0.1;
    deficiencies.push(`Only ${markers.markerCount} behavioral marker — needs quantification + behavior verb`);
  } else {
    deficiencies.push('No behavioral markers — description reads like advice, not observation');
  }

  // Generic pattern detection
  const genericTitle = detectGenericTitle(pattern.title);
  const genericDesc = detectGenericDescription(pattern.description);
  if (genericTitle.length === 0 && genericDesc.length === 0) {
    score += 0.25;
    signals.push('No generic advice patterns detected');
  } else {
    if (genericTitle.length > 0) deficiencies.push(...genericTitle);
    if (genericDesc.length > 0) deficiencies.push(...genericDesc);
  }

  // toolsFilesApis specificity
  const validEntries = pattern.toolsFilesApis.filter(isValidToolFileApiEntry);
  if (validEntries.length >= 2) {
    score += 0.25;
    signals.push(`${validEntries.length} specific tools/files/APIs named`);
  } else if (validEntries.length === 1) {
    score += 0.15;
    signals.push('1 specific tool/file/API named');
  } else {
    deficiencies.push('No valid tool/file/API entries');
  }

  const pass =
    pattern.toolsFilesApis.length >= 1 &&
    pattern.description.length >= 100;

  return { score: Math.min(1, score), pass, signals, deficiencies };
}

/**
 * Score the tool_file_naming criterion (0-1).
 *
 * Scoring factors:
 *   - toolsFilesApis has valid (non-vague) entries
 *   - Title contains recognizable tool/file/API reference
 *   - Description contains recognizable tool/file/API reference
 */
export function scoreToolFileNaming(
  pattern: {
    title: string;
    description: string;
    toolsFilesApis: string[];
  },
): CriterionScore {
  const signals: string[] = [];
  const deficiencies: string[] = [];
  let score = 0;

  // Valid toolsFilesApis entries
  const validEntries = pattern.toolsFilesApis.filter(isValidToolFileApiEntry);
  if (validEntries.length >= 1) {
    score += 0.3;
    signals.push(`Valid tool entries: ${validEntries.join(', ')}`);
  } else {
    deficiencies.push('No valid tool/file/API entries (all are vague placeholders)');
  }

  // Title contains tool reference
  if (containsToolFileApiReference(pattern.title)) {
    score += 0.35;
    signals.push('Title names a specific tool/file/API');
  } else {
    deficiencies.push('Title does not reference any specific tool, file, or API');
  }

  // Description contains tool reference
  if (containsToolFileApiReference(pattern.description)) {
    score += 0.35;
    signals.push('Description references specific tools/files/APIs');
  } else {
    deficiencies.push('Description does not reference any specific tool, file, or API');
  }

  const hasValidEntries = validEntries.length >= 1;
  const titleOrDescContainsTool =
    containsToolFileApiReference(pattern.title) ||
    containsToolFileApiReference(pattern.description);
  const pass = hasValidEntries && titleOrDescContainsTool;

  return { score: Math.min(1, score), pass, signals, deficiencies };
}

// ============================================================================
// Problem Flagging
// ============================================================================

/**
 * Flag the "generic area" problem.
 *
 * A generic area is dressed-up advice that could apply to any developer.
 * Detected by:
 *   - Title matches generic template patterns
 *   - Description contains generic advice phrases
 *   - Low pattern_specificity score
 *   - No behavioral markers in description
 */
export function flagGenericArea(
  pattern: { title: string; description: string; toolsFilesApis: string[] },
  specificityScore: CriterionScore,
): ProblemFlag {
  const evidence: string[] = [];

  const genericTitle = detectGenericTitle(pattern.title);
  const genericDesc = detectGenericDescription(pattern.description);
  const markers = detectBehavioralMarkers(pattern.description);

  if (genericTitle.length > 0) evidence.push(...genericTitle);
  if (genericDesc.length > 0) evidence.push(...genericDesc);
  if (!markers.hasBehavioralPattern) {
    evidence.push('Description lacks behavioral markers (no quantification or observed behavior verbs)');
  }
  if (specificityScore.score < 0.4) {
    evidence.push(`Pattern specificity score is low (${specificityScore.score.toFixed(2)})`);
  }

  const detected = evidence.length >= 2;

  return {
    detected,
    severity: genericTitle.length > 0 ? 'critical' : 'warning',
    evidence,
    suggestion: detected
      ? 'Replace generic title with specific behavior + technology (e.g., "Skipping vitest After Prisma Schema Changes"). Add quantification ("in X of Y sessions") and name specific files/tools the builder interacted with.'
      : 'No generic area problems detected.',
  };
}

/**
 * Flag the "isolated quotes" problem.
 *
 * Isolated quotes are evidence moments that don't establish a pattern:
 *   - All from same session
 *   - Duplicate utteranceIds
 *   - Fragmented quotes
 */
export function flagIsolatedQuotes(
  evidence: ReadonlyArray<{
    utteranceId: string;
    sessionId: string;
    quote: string;
    observation: string;
    context: string;
  }>,
  momentsScore: CriterionScore,
): ProblemFlag {
  const isolation = analyzeEvidenceIsolation(evidence);
  const diagnostics = [...isolation.reasons];

  if (momentsScore.score < 0.4) {
    diagnostics.push(`Distinct moments score is low (${momentsScore.score.toFixed(2)})`);
  }

  return {
    detected: isolation.isolated,
    severity: isolation.distinctUtterances < 2 ? 'critical' : 'warning',
    evidence: diagnostics,
    suggestion: isolation.isolated
      ? 'Include evidence from 2+ distinct sessions with different utteranceIds. Each quote should be the developer\'s verbatim words (30+ chars), not a summary. Observations should describe specific behavior, not generic judgments.'
      : 'No isolated quote problems detected.',
  };
}

/**
 * Flag the "arbitrary scores" problem.
 *
 * An arbitrary score is a severity level not justified by evidence weight:
 *   - "critical" with only 2 moments from 1 session
 *   - "high" with no cross-session evidence
 */
export function flagArbitraryScores(
  severity: string,
  evidence: ReadonlyArray<{ utteranceId: string; sessionId: string }>,
): ProblemFlag {
  const sessionIds = new Set(evidence.map(e => e.sessionId));
  const justification = validateSeverityJustification(
    severity,
    evidence.length,
    sessionIds.size,
  );

  const diagnostics: string[] = [];
  if (!justification.justified && justification.reason) {
    diagnostics.push(justification.reason);
  }

  // Additional check: severity escalation without proportional evidence
  if (severity === 'critical' && evidence.length <= 2) {
    diagnostics.push('Critical severity with minimal evidence (2 or fewer moments)');
  }
  if ((severity === 'critical' || severity === 'high') && sessionIds.size < 2) {
    diagnostics.push(`${severity} severity but evidence from only ${sessionIds.size} session(s)`);
  }

  const detected = diagnostics.length > 0;

  return {
    detected,
    severity: severity === 'critical' ? 'critical' : 'warning',
    evidence: diagnostics,
    suggestion: detected
      ? `Either downgrade severity to match evidence weight, or add more evidence moments from additional sessions. ${severity === 'critical' ? 'Critical severity requires 3+ moments from 2+ sessions.' : 'High severity requires 2+ moments from 2+ sessions.'}`
      : 'Severity is justified by evidence weight.',
  };
}

/**
 * Flag the "missing patterns" problem.
 *
 * A missing pattern means the description doesn't describe an actual
 * behavioral pattern — it's just symptoms, advice, or generic observations.
 * Detected by:
 *   - No behavioral markers (quantification, behavior verbs, session refs)
 *   - Description is too short to describe a pattern
 *   - Evidence doesn't connect to the described pattern
 */
export function flagMissingPatterns(
  pattern: { title: string; description: string },
  evidence: ReadonlyArray<{ observation: string }>,
): ProblemFlag {
  const diagnostics: string[] = [];

  const markers = detectBehavioralMarkers(pattern.description);
  if (!markers.hasBehavioralPattern) {
    diagnostics.push(
      `Description has only ${markers.markerCount} behavioral marker(s) (need 2+). ` +
      'A pattern should include quantification (e.g., "in 4 of 6 sessions") and behavioral observation verbs.',
    );
  }

  if (pattern.description.length < 100) {
    diagnostics.push(
      `Description is only ${pattern.description.length} chars — too short to describe a behavioral pattern with context.`,
    );
  }

  // Check evidence observations connect to the pattern
  const weakObservations = evidence.filter(e => e.observation.length < 30);
  if (weakObservations.length > evidence.length / 2) {
    diagnostics.push(
      `${weakObservations.length} of ${evidence.length} evidence observations are too short (<30 chars) to demonstrate the described pattern.`,
    );
  }

  const detected = diagnostics.length >= 2;

  return {
    detected,
    severity: markers.markerCount === 0 ? 'critical' : 'warning',
    evidence: diagnostics,
    suggestion: detected
      ? 'Rewrite the description to describe what the builder ACTUALLY DID (not what they should do). Include: (1) quantification like "in X of Y sessions", (2) behavioral verbs like "consistently skips/avoids/omits", (3) specific context about when/where the behavior occurs.'
      : 'Pattern description adequately describes an observed behavioral pattern.',
  };
}

// ============================================================================
// Main Quality Validation Checker
// ============================================================================

/**
 * Validate a growth area against the full quality rubric and flag problems.
 *
 * This is the main entry point for the quality validation checker.
 * It scores each growth area against the 4-criteria rubric with continuous
 * scores and flags any of the four original problems.
 *
 * Works with both LLM output (pre-rubric) and validated PEA (post-rubric).
 *
 * @param growthArea - Growth area to validate (LLM output or validated PEA)
 * @returns Complete quality validation result
 */
export function validateGrowthAreaQuality(
  growthArea: GrowthAreaPEALLMOutput | GrowthAreaPEA,
): QualityValidationResult {
  // ── Score each criterion ──────────────────────────────────────────────
  const distinctMoments = scoreDistinctMoments(growthArea.evidence);
  const verifiableAction = scoreVerifiableAction(growthArea.action);
  const patternSpecificity = scorePatternSpecificity(growthArea.pattern);
  const toolFileNaming = scoreToolFileNaming(growthArea.pattern);

  // ── Flag problems ─────────────────────────────────────────────────────
  const genericArea = flagGenericArea(growthArea.pattern, patternSpecificity);
  const isolatedQuotes = flagIsolatedQuotes(growthArea.evidence, distinctMoments);
  const arbitraryScores = flagArbitraryScores(
    growthArea.pattern.severity,
    growthArea.evidence,
  );
  const missingPatterns = flagMissingPatterns(growthArea.pattern, growthArea.evidence);

  // ── Compute overall score (weighted average) ──────────────────────────
  // Weights reflect relative importance of each criterion
  const weights = {
    distinctMoments: 0.30,    // Evidence is foundational
    verifiableAction: 0.25,   // Actionability is key
    patternSpecificity: 0.25, // Must be specific, not generic
    toolFileNaming: 0.20,     // Technical grounding
  };

  const overallScore =
    distinctMoments.score * weights.distinctMoments +
    verifiableAction.score * weights.verifiableAction +
    patternSpecificity.score * weights.patternSpecificity +
    toolFileNaming.score * weights.toolFileNaming;

  // ── Backward-compatible boolean rubric ────────────────────────────────
  const rubric: QualityRubric = {
    distinctMoments: distinctMoments.pass,
    verifiableAction: verifiableAction.pass,
    patternSpecificity: patternSpecificity.pass,
    toolFileNaming: toolFileNaming.pass,
  };

  // ── Overall pass: all criteria pass AND no critical problems ──────────
  const allCriteriaPass =
    distinctMoments.pass &&
    verifiableAction.pass &&
    patternSpecificity.pass &&
    toolFileNaming.pass;

  const hasCriticalProblem =
    (genericArea.detected && genericArea.severity === 'critical') ||
    (isolatedQuotes.detected && isolatedQuotes.severity === 'critical') ||
    (arbitraryScores.detected && arbitraryScores.severity === 'critical') ||
    (missingPatterns.detected && missingPatterns.severity === 'critical');

  const passes = allCriteriaPass && !hasCriticalProblem;

  // ── Build diagnostic summary ──────────────────────────────────────────
  const summary = buildDiagnosticSummary(
    growthArea.pattern.title,
    passes,
    overallScore,
    { distinctMoments, verifiableAction, patternSpecificity, toolFileNaming },
    { genericArea, isolatedQuotes, arbitraryScores, missingPatterns },
  );

  return {
    passes,
    overallScore,
    criteria: {
      distinctMoments,
      verifiableAction,
      patternSpecificity,
      toolFileNaming,
    },
    problems: {
      genericArea,
      isolatedQuotes,
      arbitraryScores,
      missingPatterns,
    },
    rubric,
    summary,
  };
}

/**
 * Validate a batch of growth areas and return results with filtering.
 *
 * @param growthAreas - Array of growth areas to validate
 * @returns Object with all results, passing results, and failing results
 */
export function validateGrowthAreaBatch(
  growthAreas: (GrowthAreaPEALLMOutput | GrowthAreaPEA)[],
): {
  results: Array<{ growthArea: GrowthAreaPEALLMOutput | GrowthAreaPEA; validation: QualityValidationResult }>;
  passing: Array<{ growthArea: GrowthAreaPEALLMOutput | GrowthAreaPEA; validation: QualityValidationResult }>;
  failing: Array<{ growthArea: GrowthAreaPEALLMOutput | GrowthAreaPEA; validation: QualityValidationResult }>;
  summary: BatchValidationSummary;
} {
  const results = growthAreas.map(ga => ({
    growthArea: ga,
    validation: validateGrowthAreaQuality(ga),
  }));

  const passing = results.filter(r => r.validation.passes);
  const failing = results.filter(r => !r.validation.passes);

  // Problem frequency across the batch
  const problemFrequency = {
    genericArea: results.filter(r => r.validation.problems.genericArea.detected).length,
    isolatedQuotes: results.filter(r => r.validation.problems.isolatedQuotes.detected).length,
    arbitraryScores: results.filter(r => r.validation.problems.arbitraryScores.detected).length,
    missingPatterns: results.filter(r => r.validation.problems.missingPatterns.detected).length,
  };

  const avgScore = results.length > 0
    ? results.reduce((sum, r) => sum + r.validation.overallScore, 0) / results.length
    : 0;

  return {
    results,
    passing,
    failing,
    summary: {
      total: results.length,
      passing: passing.length,
      failing: failing.length,
      passRate: results.length > 0 ? passing.length / results.length : 0,
      averageScore: avgScore,
      problemFrequency,
    },
  };
}

/**
 * Summary of a batch validation run.
 */
export interface BatchValidationSummary {
  /** Total number of growth areas validated */
  total: number;
  /** Number passing all criteria */
  passing: number;
  /** Number failing at least one criterion */
  failing: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** Average quality score across all growth areas */
  averageScore: number;
  /** How many growth areas exhibit each problem */
  problemFrequency: {
    genericArea: number;
    isolatedQuotes: number;
    arbitraryScores: number;
    missingPatterns: number;
  };
}

// ============================================================================
// Diagnostic Summary Builder
// ============================================================================

/**
 * Build a human-readable diagnostic summary for a growth area validation.
 */
function buildDiagnosticSummary(
  title: string,
  passes: boolean,
  overallScore: number,
  criteria: {
    distinctMoments: CriterionScore;
    verifiableAction: CriterionScore;
    patternSpecificity: CriterionScore;
    toolFileNaming: CriterionScore;
  },
  problems: {
    genericArea: ProblemFlag;
    isolatedQuotes: ProblemFlag;
    arbitraryScores: ProblemFlag;
    missingPatterns: ProblemFlag;
  },
): string {
  const lines: string[] = [];

  lines.push(`Quality Validation: "${title}"`);
  lines.push(`Result: ${passes ? 'PASS' : 'FAIL'} (score: ${overallScore.toFixed(2)})`);
  lines.push('');

  // Criteria scores
  lines.push('Criteria:');
  const criteriaEntries: Array<[string, CriterionScore]> = [
    ['distinct_moments', criteria.distinctMoments],
    ['verifiable_action', criteria.verifiableAction],
    ['pattern_specificity', criteria.patternSpecificity],
    ['tool_file_naming', criteria.toolFileNaming],
  ];
  for (const [name, criterion] of criteriaEntries) {
    const status = criterion.pass ? 'PASS' : 'FAIL';
    lines.push(`  ${name}: ${status} (${criterion.score.toFixed(2)})`);
    if (criterion.deficiencies.length > 0) {
      for (const d of criterion.deficiencies) {
        lines.push(`    - ${d}`);
      }
    }
  }

  // Problem flags
  const detectedProblems = Object.entries(problems).filter(([, flag]) => flag.detected);
  if (detectedProblems.length > 0) {
    lines.push('');
    lines.push('Problems detected:');
    for (const [name, flag] of detectedProblems) {
      lines.push(`  ${name} (${flag.severity}):`);
      for (const e of flag.evidence) {
        lines.push(`    - ${e}`);
      }
      lines.push(`    Fix: ${flag.suggestion}`);
    }
  }

  return lines.join('\n');
}
