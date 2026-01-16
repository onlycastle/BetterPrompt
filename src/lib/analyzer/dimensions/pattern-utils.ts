/**
 * Pattern Matching Utilities for Dimension Analysis
 *
 * Shared helpers for counting pattern matches in text.
 */

/**
 * Count all regex matches in a string
 *
 * @param text - The text to search
 * @param pattern - The regex pattern (should have 'gi' flags)
 * @returns The number of matches found
 */
export function countMatches(text: string, pattern: RegExp): number {
  const matches = text.match(pattern);
  return matches ? matches.length : 0;
}

/**
 * Test if any regex matches exist in a string
 *
 * @param text - The text to search
 * @param pattern - The regex pattern
 * @returns True if at least one match exists
 */
export function hasMatch(text: string, pattern: RegExp): boolean {
  return pattern.test(text);
}

/**
 * Count matches, checking if minimum threshold is met
 *
 * @param text - The text to search
 * @param pattern - The regex pattern
 * @param minCount - Minimum count to return (returns 0 or 1 if below threshold)
 * @returns Number of matches, or 0 if below threshold
 */
export function countIfAtLeast(
  text: string,
  pattern: RegExp,
  minCount: number
): number {
  const count = countMatches(text, pattern);
  return count >= minCount ? count : 0;
}

/**
 * Common regex patterns for dimension analysis
 */
export const PATTERNS = {
  // File references
  filePath: /(?:src\/|\.\/|\/[\w-]+\/|[\w-]+\.[tj]sx?|[\w-]+\.(?:md|json|yaml|yml|py|go|rs|java|kt|swift|rb))\b/gi,
  fileLine: /[\w/.+-]+\.(?:[tj]sx?|py|go|rs|java|kt|rb|vue|css|scss|html|json|yaml|yml|md):\d+/gi,

  // Code elements
  codeElement: /\b(?:class|function|method|component|interface|type|const)\s+([A-Z][a-zA-Z0-9]*|[a-z][a-zA-Z0-9]+)\b/gi,
  pascalCase: /\b([A-Z][a-z]+(?:[A-Z][a-z]+)+)\b/g,

  // Commands
  compactCommand: /\/compact\b/gi,

  // Planning/structure keywords
  constraints: /\b(must|should not|shouldn't|cannot|can't|required|constraint|limit|maximum|minimum|only|never|always|ensure|avoid)\b/gi,
  patterns: /\b(pattern|similar to|like the|existing|same as|follow|consistent with|based on|matching|mimic|replicate)\b/gi,
  steps: /\b(step\s*\d|first[,:]|second[,:]|then[,:]|next[,:]|finally[,:]|1\.|2\.|3\.|\d\)\s)/gi,
  specs: /\b(requirements?\.md|design\.md|spec\.md|plan\.md|todo\.md|tasks\.md|readme\.md|architecture\.md)\b/gi,

  // Verification keywords
  review: /\b(review|check|verify|double.?check|look at|examine|inspect|validate|ensure|confirm)\b/gi,
  test: /\b(test|npm test|yarn test|pytest|jest|vitest|run tests|unit test|integration test)\b/gi,
  modification: /\b(change|fix|update|modify|wrong|error|incorrect|doesn't|don't|not right|actually|wait|no,|but |instead)\b/gi,

  // Critique patterns
  correction: /\b(wrong|incorrect|error|mistake|not right|that's not|no,|actually,?|wait,?|but that|however)\b/gi,
  rejection: /\b(don't want|not what i|doesn't work|won't work|reject|cancel|stop|undo)\b/gi,
  alternative: /\b(alternative|another way|different approach|other option|instead of|rather than|try a different)\b/gi,

  // Questions
  question: /\?|^(what|why|how|when|where|which|can you|could you|would you)\b/gi,

  // Control patterns
  subagent: /\b(subagent|sub-agent|task tool|delegate|spawn agent|launch agent)\b/gi,

  // Control-specific modification pattern (broader than verification modification)
  modificationRequest: /\b(change|fix|update|modify|adjust|correct|revise|redo|rewrite|alter)\b/gi,

  // Control-specific constraint pattern (includes do not patterns)
  constraintsFull: /\b(must|should|shouldn't|cannot|can't|required|constraint|limit|maximum|minimum|only|never|always|ensure|avoid|don't|do not)\b/gi,

  // Requirement statements
  requirement: /\b(requirement|specification|spec|criteria|rule|condition|need to|has to|needs to)\b/gi,

  // Resilience patterns
  vagueStart: /^(help|hi|hello|hey|can you|could you|i need|please)\b/i,
  detailedStart: /\b(implement|create|build|refactor|fix the bug in|add feature|update the|modify)\b/i,
  codeBlock: /```[\s\S]*?```|`[^`]+`/,
  factualChallenge: /\b(are you sure|i don't think|that doesn't seem|is that correct|verify that|double check|really\?|actually i think)\b/gi,
  hallucination: /\b(hallucin|made up|doesn't exist|not a real|fake|fabricated|invented|imagin)\b/gi,
  explanationRequest: /\b(explain|what does this|how does this work|tell me about|describe|walk me through|break down)\b/gi,
  whatDoes: /\bwhat (does|is|are) (this|that|it|the)\b/gi,
  selfExplanation: /\b(i think|i believe|my understanding|as i understand|the way i see|from what i know|based on my)\b/gi,
} as const;

/**
 * Words that are false positives for PascalCase detection
 */
export const PASCAL_CASE_EXCLUSIONS = [
  'The',
  'This',
  'That',
  'When',
  'Where',
  'What',
  'How',
  'Why',
  'Please',
  'Thanks',
  'Claude',
  'Hello',
  'Error',
  'Warning',
  'Note',
  'Todo',
  'Fixme',
];

/**
 * Filter PascalCase matches to remove common false positives
 *
 * @param matches - Array of PascalCase matches
 * @returns Filtered array with false positives removed
 */
export function filterPascalCaseMatches(matches: string[]): string[] {
  return matches.filter((m) => !PASCAL_CASE_EXCLUSIONS.includes(m));
}
