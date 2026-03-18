import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildPendingAnalysisAdditionalContext,
  estimateSessionDurationMsFromTranscript,
} from '../../../packages/plugin/lib/hook-utils.js';

describe('plugin hook utils', () => {
  it('estimates session duration from transcript timestamps', () => {
    const dir = mkdtempSync(join(tmpdir(), 'betterprompt-hook-utils-'));
    const transcriptPath = join(dir, 'session.jsonl');

    writeFileSync(transcriptPath, [
      JSON.stringify({ timestamp: '2026-03-16T10:00:00.000Z' }),
      JSON.stringify({ timestamp: '2026-03-16T10:05:00.000Z' }),
    ].join('\n'));

    expect(estimateSessionDurationMsFromTranscript(transcriptPath)).toBe(5 * 60 * 1000);
  });

  it('returns zero for unreadable or invalid transcripts', () => {
    expect(estimateSessionDurationMsFromTranscript('/tmp/does-not-exist.jsonl')).toBe(0);
  });

  it('builds startup context for queued auto-analysis', () => {
    const context = buildPendingAnalysisAdditionalContext();

    expect(context).toContain('queued');
    expect(context).toContain('/analyze');
    expect(context).toContain('auto-analysis');
  });
});
