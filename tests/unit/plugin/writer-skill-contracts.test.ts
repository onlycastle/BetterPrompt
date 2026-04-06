import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const WRITER_SKILLS = [
  'write-ai-partnership',
  'write-session-craft',
  'write-tool-mastery',
  'write-skill-resilience',
  'write-session-mastery',
];

function readSkill(skillName: string): string {
  return readFileSync(
    join(process.cwd(), 'packages', 'plugin', 'skills', skillName, 'SKILL.md'),
    'utf8',
  );
}

describe('writer skill contracts', () => {
  it('requires severity in growth areas', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(content, `${skill} must mention severity`).toMatch(/severity/i);
    }
  });

  it('persists output via save-domain-results for each writer', () => {
    const expectedDomains: Record<string, string> = {
      'write-ai-partnership': 'aiPartnership',
      'write-session-craft': 'sessionCraft',
      'write-tool-mastery': 'toolMastery',
      'write-skill-resilience': 'skillResilience',
      'write-session-mastery': 'sessionMastery',
    };

    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      const domain = expectedDomains[skill];
      expect(content, `${skill} must call save-domain-results`).toContain('save-domain-results');
      expect(content, `${skill} must save to domain "${domain}"`).toContain(`"${domain}"`);
    }
  });

  it('retries validation errors locally instead of delegating', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(content, `${skill} must retry validation errors`).toMatch(
        /validation error.*retry/,
      );
    }
  });

  it('uses sonnet model for all writers', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      const match = content.match(/^model:\s+([^\n]+)$/m);
      expect(match?.[1]?.trim(), `${skill} must use sonnet`).toBe('sonnet');
    }
  });

  // ====================================================================
  // AC 3: Verifiable Next-Session Action Contract
  //
  // Every writer skill MUST instruct the LLM to generate a verifiable
  // next-session action checkable against future session logs.
  //
  // Requirements:
  //   1. skill documents the verifiableAction field in output format
  //   2. skill quality checklist includes verifiable_action criterion
  //   3. skill explains checkDescription must reference session-log signals
  //   4. skill includes pea.action section with instruction and verificationCheck
  //
  // These tests prevent quality regressions where a writer skill update
  // accidentally removes the verifiable action requirement, allowing
  // vague actions to pass the quality gate.
  // ====================================================================

  it('AC3: documents verifiableAction in output format (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include verifiableAction in output format`,
      ).toContain('verifiableAction');
    }
  });

  it('AC3: quality checklist includes verifiable_action criterion check (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include verifiable_action in quality checklist`,
      ).toMatch(/verifiable_action/i);
    }
  });

  it('AC3: documents checkDescription as observable session-log signal (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must describe checkDescription as what appears in session logs`,
      ).toMatch(/checkDescription.*(30|observable|session.?log)/i);
    }
  });

  it('AC3: includes pea.action.verificationCheck in output format (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include pea.action section with verificationCheck`,
      ).toMatch(/verificationCheck/);
    }
  });

  // ====================================================================
  // AC 13: Freeform LLM-Generated Behavioral Category Tags Contract
  //
  // Every writer skill MUST instruct the LLM to generate freeform
  // behavioral category tags for cross-developer clustering in team views.
  //
  // Requirements:
  //   1. skill documents the categoryTags field in its output format
  //   2. skill quality checklist includes the categoryTags requirement
  //   3. skill specifies tags are freeform (not constrained to a fixed taxonomy)
  //   4. skill specifies 1-5 descriptive behavioral tags per growth area
  //
  // These contract tests prevent quality regressions where a writer skill
  // update accidentally removes the categoryTags requirement, causing
  // growth areas to be saved without tags (failing the AC 13 quality gate).
  //
  // The quality gate in save-domain-results.ts enforces the hard requirement
  // at save time — these tests ensure the LLM is instructed to generate tags
  // BEFORE the gate fires (preventing unnecessary retries).
  // ====================================================================

  it('AC13: documents categoryTags field in output format (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include categoryTags in output format`,
      ).toContain('categoryTags');
    }
  });

  it('AC13: quality checklist includes categoryTags requirement (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      // The checklist entry for categoryTags must mention "categoryTags" in a checklist item
      expect(
        content,
        `${skill} must include categoryTags in quality checklist`,
      ).toMatch(/- \[ \].*categoryTags/);
    }
  });

  it('AC13: specifies freeform tags not constrained to a fixed taxonomy (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      // Must reference the shared pea-growth-area-format.md which explains freeform tags,
      // OR include a [M] label comment indicating it's metadata, OR have 1-5 in the schema hint
      // OR mention "descriptive" or "freeform" or "behavioral" for the tags
      const hasFreeformSignal =
        content.includes('pea-growth-area-format.md') ||
        content.includes('[M] descriptive-behavioral-tag') ||
        content.match(/categoryTags.*1.{0,10}5/);
      expect(
        hasFreeformSignal,
        `${skill} must indicate categoryTags are freeform/descriptive behavioral tags (not a fixed taxonomy). ` +
        `Expected: reference to pea-growth-area-format.md, or "[M] descriptive-behavioral-tag" in output template, ` +
        `or categoryTags with 1-5 item constraint.`,
      ).toBe(true);
    }
  });

  // ====================================================================
  // Sub-AC 1: Pattern → Evidence → Action Format Contract
  //
  // Every writer skill MUST instruct the LLM to output growth areas in
  // structured Pattern → Evidence → Action format with Evidence
  // explicitly quoted verbatim from the session event data provided in
  // the prompt context (extraction stage quotes[] array).
  //
  // Requirements:
  //   1. skill includes `pea` sub-object in output format template
  //   2. skill requires evidence quotes to be verbatim from session data
  //   3. skill quality checklist includes distinct_moments criterion
  //   4. skill includes pea.pattern.toolsFilesApis in output format
  //   5. skill includes pea.action.goalRelevance in output format
  //   6. skill references pea-growth-area-format.md for evidence protocol
  //   7. skill includes lowConfidence flag in output format
  //
  // These tests prevent quality regressions where a writer skill update
  // accidentally removes the PEA format requirement, allowing unstructured
  // growth areas to be submitted without proper evidence citation.
  //
  // The quality gate in save-domain-results.ts enforces the hard rubric
  // at save time — these contract tests ensure the LLM is instructed to
  // produce correctly structured PEA output BEFORE the gate fires.
  // ====================================================================

  it('Sub-AC1: includes pea sub-object in output format template (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include "pea" sub-object in growth area output format`,
      ).toContain('"pea"');
    }
  });

  it('Sub-AC1: requires verbatim evidence quoting from session event data (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      // Skills must instruct the LLM to copy evidence quotes verbatim from the
      // extraction stage output (quotes[n].text field in the prompt context).
      const hasVerbatimInstruction =
        content.includes('verbatim') ||
        /EXACT\s+words/i.test(content) ||
        content.includes('quotes[n].text');
      expect(
        hasVerbatimInstruction,
        `${skill} must instruct LLM to copy evidence quotes verbatim from session event data. ` +
        `Expected one of: "verbatim", "EXACT words", or "quotes[n].text" reference.`,
      ).toBe(true);
    }
  });

  it('Sub-AC1: quality checklist includes distinct_moments criterion (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include distinct_moments criterion in quality checklist`,
      ).toMatch(/distinct_moments/);
    }
  });

  it('Sub-AC1: pea.pattern.toolsFilesApis required in output format (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include toolsFilesApis in pea.pattern output format template`,
      ).toContain('toolsFilesApis');
    }
  });

  it('Sub-AC1: pea.action.goalRelevance required in output format (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include goalRelevance in pea.action output format template`,
      ).toContain('goalRelevance');
    }
  });

  it('Sub-AC1: references pea-growth-area-format.md for evidence citation protocol (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must reference pea-growth-area-format.md for evidence citation protocol`,
      ).toContain('pea-growth-area-format.md');
    }
  });

  it('Sub-AC1: includes lowConfidence flag in output format (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(
        content,
        `${skill} must include lowConfidence flag in output format`,
      ).toContain('lowConfidence');
    }
  });

  it('Sub-AC1: pea.evidence array requires sessionId for session-source tracing (all 5 writer skills)', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      // Evidence moments in pea.evidence MUST include sessionId to enable
      // distinct-session verification (cross-session patterns are stronger evidence).
      // The pea.evidence section must mention sessionId in its format template.
      const hasPeaSessionId =
        content.includes('"sessionId"') ||
        content.includes('sessionId');
      expect(
        hasPeaSessionId,
        `${skill} must include sessionId in pea.evidence format template for session-source tracing`,
      ).toBe(true);
    }
  });
});
