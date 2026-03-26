import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSkillModel(skillName: string): string | null {
  const skillPath = join(
    process.cwd(),
    'packages',
    'plugin',
    'skills',
    skillName,
    'SKILL.md',
  );
  const content = readFileSync(skillPath, 'utf8');
  const match = content.match(/^model:\s+([^\n]+)$/m);
  return match?.[1]?.trim() ?? null;
}

const HAIKU_SKILLS = [
  'summarize-sessions',
  'extract-ai-partnership',
  'extract-session-craft',
  'extract-tool-mastery',
  'extract-skill-resilience',
  'extract-session-mastery',
  'summarize-projects',
  'generate-weekly-insights',
];

const SONNET_SKILLS = [
  'write-ai-partnership',
  'write-session-craft',
  'write-tool-mastery',
  'write-skill-resilience',
  'write-session-mastery',
  'classify-type',
  'write-content',
  'translate-report',
];

describe('plugin skill model tiering', () => {
  it('extraction and summarization skills use haiku', () => {
    for (const skill of HAIKU_SKILLS) {
      expect(readSkillModel(skill), skill).toBe('haiku');
    }
  });

  it('narrative and writing skills use sonnet', () => {
    for (const skill of SONNET_SKILLS) {
      expect(readSkillModel(skill), skill).toBe('sonnet');
    }
  });

  it('orchestrator uses sonnet', () => {
    expect(readSkillModel('bp-analyze')).toBe('sonnet');
  });
});
