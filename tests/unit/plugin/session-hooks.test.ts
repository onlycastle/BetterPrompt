import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { resetConfig } from '../../../packages/plugin/lib/config.js';
import { handleSessionEndHook } from '../../../packages/plugin/hooks/post-session-handler.js';
import { handleSessionStartHook } from '../../../packages/plugin/hooks/session-start-handler.js';
import { readState, markAnalysisStarted, markAnalysisComplete } from '../../../packages/plugin/lib/debounce.js';
import { writePrefs } from '../../../packages/plugin/lib/prefs.js';

describe('plugin session hooks', () => {
  const originalHome = process.env.HOME;
  const originalAutoAnalyze = process.env.BETTERPROMPT_AUTO_ANALYZE;
  const originalAnalyzeThreshold = process.env.BETTERPROMPT_ANALYZE_THRESHOLD;
  let homeDir = '';

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'betterprompt-session-hooks-'));
    process.env.HOME = homeDir;
    process.env.BETTERPROMPT_AUTO_ANALYZE = 'true';
    process.env.BETTERPROMPT_ANALYZE_THRESHOLD = '1';
    resetConfig();
    // Mark setup as completed so existing tests exercise the pending-analysis path
    writePrefs({ welcomeCompleted: '2026-01-01T00:00:00.000Z' });
  });

  afterEach(() => {
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;

    if (originalAutoAnalyze === undefined) delete process.env.BETTERPROMPT_AUTO_ANALYZE;
    else process.env.BETTERPROMPT_AUTO_ANALYZE = originalAutoAnalyze;

    if (originalAnalyzeThreshold === undefined) delete process.env.BETTERPROMPT_ANALYZE_THRESHOLD;
    else process.env.BETTERPROMPT_ANALYZE_THRESHOLD = originalAnalyzeThreshold;

    resetConfig();
    if (homeDir) {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  function createClaudeSessionFile(fileName = 'session-1.jsonl'): void {
    const projectDir = join(homeDir, '.claude', 'projects', 'demo-project');
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(join(projectDir, fileName), '{}\n');
  }

  function createTranscript(fileName = 'transcript.jsonl'): string {
    const transcriptPath = join(homeDir, fileName);
    writeFileSync(transcriptPath, [
      JSON.stringify({ timestamp: '2026-03-16T10:00:00.000Z' }),
      JSON.stringify({ timestamp: '2026-03-16T10:07:00.000Z' }),
    ].join('\n'));
    return transcriptPath;
  }

  it('queues analysis on SessionEnd and injects startup context on the next SessionStart', () => {
    createClaudeSessionFile();
    const transcriptPath = createTranscript();

    const queued = handleSessionEndHook({ transcript_path: transcriptPath });
    expect(queued.queued).toBe(true);
    expect(queued.durationMs).toBe(7 * 60 * 1000);
    expect(readState().analysisState).toBe('pending');

    const startup = handleSessionStartHook({ source: 'startup' });
    expect(startup?.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(startup?.hookSpecificOutput.additionalContext).toContain('bp analyze');
    expect(startup?.hookSpecificOutput.additionalContext).toContain('translation');
  });

  it('suppresses startup injection for compact sessions even when analysis is pending', () => {
    createClaudeSessionFile();
    const transcriptPath = createTranscript();
    handleSessionEndHook({ transcript_path: transcriptPath });

    expect(handleSessionStartHook({ source: 'compact' })).toBeNull();
    expect(readState().analysisState).toBe('pending');
  });

  it('injects first-run context when isFirstRun returns true', () => {
    const startup = handleSessionStartHook({ source: 'startup' }, {
      isFirstRun: () => true,
      buildFirstRunAdditionalContext: () => 'first-run-context bp setup',
      isAnalysisPending: () => false,
      buildPendingAnalysisAdditionalContext: () => 'pending-context',
    });

    expect(startup?.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(startup?.hookSpecificOutput.additionalContext).toContain('bp setup');
  });

  it('first-run takes priority over pending analysis', () => {
    const startup = handleSessionStartHook({ source: 'startup' }, {
      isFirstRun: () => true,
      buildFirstRunAdditionalContext: () => 'first-run-context bp setup',
      isAnalysisPending: () => true,
      buildPendingAnalysisAdditionalContext: () => 'pending-context bp analyze',
    });

    expect(startup?.hookSpecificOutput.additionalContext).toContain('bp setup');
    expect(startup?.hookSpecificOutput.additionalContext).not.toContain('bp analyze');
  });

  it('suppresses first-run injection for compact sessions', () => {
    const startup = handleSessionStartHook({ source: 'compact' }, {
      isFirstRun: () => true,
      buildFirstRunAdditionalContext: () => 'first-run-context',
      isAnalysisPending: () => false,
      buildPendingAnalysisAdditionalContext: () => 'pending-context',
    });

    expect(startup).toBeNull();
  });

  it('falls through to pending analysis when first-run is complete', () => {
    createClaudeSessionFile();
    const transcriptPath = createTranscript();
    handleSessionEndHook({ transcript_path: transcriptPath });

    const startup = handleSessionStartHook({ source: 'startup' }, {
      isFirstRun: () => false,
      buildFirstRunAdditionalContext: () => 'first-run-context',
      isAnalysisPending: () => true,
      buildPendingAnalysisAdditionalContext: () => 'pending-context bp analyze',
    });

    expect(startup?.hookSpecificOutput.additionalContext).toContain('bp analyze');
    expect(startup?.hookSpecificOutput.additionalContext).not.toContain('bp setup');
  });

  it('returns null when neither first-run nor pending', () => {
    const startup = handleSessionStartHook({ source: 'startup' }, {
      isFirstRun: () => false,
      buildFirstRunAdditionalContext: () => 'first-run-context',
      isAnalysisPending: () => false,
      buildPendingAnalysisAdditionalContext: () => 'pending-context',
    });

    expect(startup).toBeNull();
  });

  it('transitions queued analysis through running to complete without leaving stale pending state', () => {
    createClaudeSessionFile();
    const transcriptPath = createTranscript();
    handleSessionEndHook({ transcript_path: transcriptPath });

    markAnalysisStarted();
    expect(readState().analysisState).toBe('running');
    expect(readState().analysisPending).toBe(false);

    markAnalysisComplete(1);
    const finalState = readState();
    expect(finalState.analysisState).toBe('complete');
    expect(finalState.analysisPending).toBe(false);
    expect(finalState.analysisInProgress).toBe(false);
    expect(finalState.lastAnalysisSessionCount).toBe(1);
  });
});
