import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function readSkill(skillName: string): string {
  return readFileSync(
    join(process.cwd(), 'packages', 'plugin', 'skills', skillName, 'SKILL.md'),
    'utf8',
  );
}

describe('bp-analyze agent dispatch contract', () => {
  const content = readSkill('bp-analyze');

  it('dispatches skills as isolated agents', () => {
    expect(content).toContain('isolated Agent');
    expect(content).toContain('Agent tool');
    expect(content).toContain('dispatch it as an Agent');
  });

  it('specifies model tiering per agent', () => {
    expect(content).toContain('model: `haiku`');
    expect(content).toContain('model: `sonnet`');
    expect(content).toContain('Model Tiering');
  });

  it('uses get_run_progress as the state machine', () => {
    expect(content).toContain('`get_run_progress` is the ONLY source of truth');
    expect(content).toContain('call `get_run_progress` again');
  });

  it('calls MCP tools directly for deterministic stages', () => {
    expect(content).toContain('Call the `classify_developer_type` MCP tool');
    expect(content).toContain('Call the `verify_evidence` MCP tool');
    expect(content).toContain('call that MCP tool directly');
  });

  it('prohibits skills from spawning sub-agents internally', () => {
    expect(content).toContain('must NOT internally spawn additional Agents or Tasks');
  });

  it('does not contain old single-session constraint language', () => {
    expect(content).not.toContain('single-session and deterministic');
    expect(content).not.toContain('Do NOT switch to `Agent`, `Task`, or any delegation mechanism');
    expect(content).not.toContain('Launch exactly **one** BetterPrompt skill at a time');
  });

  it('still supports resume flow', () => {
    expect(content).toContain('Before starting Phase 1, call `get_run_progress`.');
    expect(content).toContain('`completionStatus: "complete"`');
    expect(content).toContain('skip straight to Phase 4 and call `generate_report`');
    expect(content).toContain('Do **NOT** call `scan_sessions` or `extract_data` again when a resumable run already exists.');
  });
});
