import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const EXTRACTOR_SKILLS = [
  'extract-ai-partnership',
  'extract-session-craft',
  'extract-tool-mastery',
  'extract-skill-resilience',
  'extract-session-mastery',
] as const;

function readSkill(skillName: string): string {
  return readFileSync(
    join(process.cwd(), 'packages', 'plugin', 'skills', skillName, 'SKILL.md'),
    'utf8',
  );
}

describe('extractor skill contracts', () => {
  it('calls get_prompt_context with the correct domain for each extractor', () => {
    const expectedDomains: Record<string, string> = {
      'extract-ai-partnership': 'aiPartnership',
      'extract-session-craft': 'sessionCraft',
      'extract-tool-mastery': 'toolMastery',
      'extract-skill-resilience': 'skillResilience',
      'extract-session-mastery': 'sessionMastery',
    };

    for (const skill of EXTRACTOR_SKILLS) {
      const content = readSkill(skill);
      const domain = expectedDomains[skill];
      expect(content, `${skill} must call get_prompt_context`).toContain('get_prompt_context');
      expect(content, `${skill} must specify domain "${domain}"`).toContain(`"${domain}"`);
    }
  });

  it('persists output via save_stage_output for each extractor', () => {
    const expectedStages: Record<string, string> = {
      'extract-ai-partnership': 'extractAiPartnership',
      'extract-session-craft': 'extractSessionCraft',
      'extract-tool-mastery': 'extractToolMastery',
      'extract-skill-resilience': 'extractSkillResilience',
      'extract-session-mastery': 'extractSessionMastery',
    };

    for (const skill of EXTRACTOR_SKILLS) {
      const content = readSkill(skill);
      const stage = expectedStages[skill];
      expect(content, `${skill} must call save_stage_output`).toContain('save_stage_output');
      expect(content, `${skill} must save to stage "${stage}"`).toContain(`"${stage}"`);
    }
  });

  it('uses haiku model for all extractors', () => {
    for (const skill of EXTRACTOR_SKILLS) {
      const content = readSkill(skill);
      const match = content.match(/^model:\s+([^\n]+)$/m);
      expect(match?.[1]?.trim(), `${skill} must use haiku`).toBe('haiku');
    }
  });
});
