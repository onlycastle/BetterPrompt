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

  it('persists output via save_domain_results for each writer', () => {
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
      expect(content, `${skill} must call save_domain_results`).toContain('save_domain_results');
      expect(content, `${skill} must save to domain "${domain}"`).toContain(`"${domain}"`);
    }
  });

  it('retries validation errors locally instead of delegating', () => {
    for (const skill of WRITER_SKILLS) {
      const content = readSkill(skill);
      expect(content, `${skill} must retry validation errors`).toMatch(
        /validation error, fix the payload and retry/,
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
});
