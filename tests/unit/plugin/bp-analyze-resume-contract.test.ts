import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSkill(skillName: string): string {
  return readFileSync(
    join(process.cwd(), 'packages', 'plugin', 'skills', skillName, 'SKILL.md'),
    'utf8',
  );
}

describe('bp-analyze resume contract', () => {
  it('checks run progress before restarting Phase 1', () => {
    const content = readSkill('bp-analyze');

    expect(content).toContain('Before starting Phase 1, call `get_run_progress`.');
    expect(content).toContain('Do **NOT** call `scan_sessions` or `extract_data` again when a resumable run already exists.');
    expect(content).toContain('resume from `nextStep` using the saved current run');
  });

  it('treats a completed run as a report-regeneration path', () => {
    const content = readSkill('bp-analyze');

    expect(content).toContain('`completionStatus: "complete"`');
    expect(content).toContain('skip straight to Phase 4 and call `generate_report`');
  });

  it('dispatches each stage as an isolated agent and tracks via get_run_progress', () => {
    const content = readSkill('bp-analyze');

    expect(content).toContain('dispatch it as an Agent');
    expect(content).toContain('call `get_run_progress` again and follow the returned `nextStep`');
  });
});
