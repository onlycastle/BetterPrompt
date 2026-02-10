import { describe, it, expect } from 'vitest';
import { SessionParser } from '../src/lib/parser/index.js';
import { calculateAllDimensions } from '../src/lib/analyzer/dimensions/index.js';

describe('SessionParser Integration', { timeout: 60000 }, () => {
  const parser = new SessionParser();

  it('should list available sessions', async () => {
    const sessions = await parser.listSessions();

    expect(Array.isArray(sessions)).toBe(true);
    console.log(`Found ${sessions.length} sessions`);

    if (sessions.length > 0) {
      const first = sessions[0];
      expect(first).toHaveProperty('sessionId');
      expect(first).toHaveProperty('projectPath');
      expect(first).toHaveProperty('projectName');
      expect(first).toHaveProperty('timestamp');
      expect(first).toHaveProperty('messageCount');
      expect(first).toHaveProperty('durationSeconds');

      console.log('First session:', {
        sessionId: first.sessionId,
        projectName: first.projectName,
        messageCount: first.messageCount,
        durationSeconds: first.durationSeconds,
      });
    }
  });

  it('should parse a real session', async () => {
    const sessions = await parser.listSessions();

    if (sessions.length === 0) {
      console.log('No sessions found, skipping');
      return;
    }

    // Parse the most recent session
    const sessionId = sessions[0].sessionId;
    console.log(`Parsing session: ${sessionId}`);

    const parsed = await parser.parseSession(sessionId);

    expect(parsed).toHaveProperty('sessionId', sessionId);
    expect(parsed).toHaveProperty('projectPath');
    expect(parsed).toHaveProperty('messages');
    expect(parsed).toHaveProperty('stats');
    expect(Array.isArray(parsed.messages)).toBe(true);

    console.log('Parsed session:', {
      sessionId: parsed.sessionId,
      projectPath: parsed.projectPath,
      messageCount: parsed.messages.length,
      stats: parsed.stats,
    });

    // Check message structure
    if (parsed.messages.length > 0) {
      const firstMsg = parsed.messages[0];
      expect(firstMsg).toHaveProperty('uuid');
      expect(firstMsg).toHaveProperty('role');
      expect(firstMsg).toHaveProperty('timestamp');
      expect(firstMsg).toHaveProperty('content');

      console.log('First message:', {
        role: firstMsg.role,
        contentLength: firstMsg.content.length,
        hasToolCalls: !!firstMsg.toolCalls,
      });
    }
  });

  it('should calculate session statistics correctly', async () => {
    const sessions = await parser.listSessions();

    if (sessions.length === 0) {
      console.log('No sessions found, skipping');
      return;
    }

    const sessionId = sessions[0].sessionId;
    const parsed = await parser.parseSession(sessionId);

    expect(parsed.stats.userMessageCount).toBeGreaterThanOrEqual(0);
    expect(parsed.stats.assistantMessageCount).toBeGreaterThanOrEqual(0);
    expect(parsed.stats.toolCallCount).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(parsed.stats.uniqueToolsUsed)).toBe(true);

    // Verify counts match actual messages
    const userMsgs = parsed.messages.filter(m => m.role === 'user').length;
    const assistantMsgs = parsed.messages.filter(m => m.role === 'assistant').length;

    expect(parsed.stats.userMessageCount).toBe(userMsgs);
    expect(parsed.stats.assistantMessageCount).toBe(assistantMsgs);
  });

  it('should calculate dimension analysis for parsed sessions', async () => {
    const sessions = await parser.listSessions();

    if (sessions.length === 0) {
      console.log('No sessions found, skipping');
      return;
    }

    // Parse a few sessions for analysis
    const parsedSessions = [];
    for (const meta of sessions.slice(0, 5)) {
      try {
        const parsed = await parser.parseSessionFile(meta.filePath);
        parsedSessions.push(parsed);
      } catch {
        // Skip invalid sessions
      }
    }

    if (parsedSessions.length === 0) {
      console.log('No valid sessions parsed, skipping');
      return;
    }

    // Calculate dimensions
    const dimensions = calculateAllDimensions(parsedSessions);

    // Verify AI Collaboration Mastery result
    expect(dimensions.aiCollaboration).toHaveProperty('score');
    expect(dimensions.aiCollaboration).toHaveProperty('level');
    expect(dimensions.aiCollaboration).toHaveProperty('breakdown');
    expect(dimensions.aiCollaboration.score).toBeGreaterThanOrEqual(0);
    expect(dimensions.aiCollaboration.score).toBeLessThanOrEqual(100);

    // Verify breakdown categories (Context Engineering is now a separate dimension)
    expect(dimensions.aiCollaboration.breakdown).toHaveProperty('structuredPlanning');
    expect(dimensions.aiCollaboration.breakdown).toHaveProperty('aiOrchestration');
    expect(dimensions.aiCollaboration.breakdown).toHaveProperty('criticalVerification');

    // Verify Context Engineering result (new top-level dimension with 4 strategies)
    expect(dimensions.contextEngineering).toHaveProperty('score');
    expect(dimensions.contextEngineering).toHaveProperty('level');
    expect(dimensions.contextEngineering).toHaveProperty('breakdown');
    expect(dimensions.contextEngineering.score).toBeGreaterThanOrEqual(0);
    expect(dimensions.contextEngineering.score).toBeLessThanOrEqual(100);
    expect(dimensions.contextEngineering.breakdown).toHaveProperty('write');
    expect(dimensions.contextEngineering.breakdown).toHaveProperty('select');
    expect(dimensions.contextEngineering.breakdown).toHaveProperty('compress');
    expect(dimensions.contextEngineering.breakdown).toHaveProperty('isolate');

    // Verify Burnout Risk result
    expect(dimensions.burnoutRisk).toHaveProperty('score');
    expect(dimensions.burnoutRisk).toHaveProperty('level');
    expect(dimensions.burnoutRisk).toHaveProperty('breakdown');

    console.log('Dimension analysis:', {
      aiCollaboration: {
        score: dimensions.aiCollaboration.score,
        level: dimensions.aiCollaboration.level,
        breakdown: {
          structuredPlanning: dimensions.aiCollaboration.breakdown.structuredPlanning.score,
          aiOrchestration: dimensions.aiCollaboration.breakdown.aiOrchestration.score,
          criticalVerification: dimensions.aiCollaboration.breakdown.criticalVerification.score,
        },
      },
      contextEngineering: {
        score: dimensions.contextEngineering.score,
        level: dimensions.contextEngineering.level,
        breakdown: {
          write: dimensions.contextEngineering.breakdown.write.score,
          select: dimensions.contextEngineering.breakdown.select.score,
          compress: dimensions.contextEngineering.breakdown.compress.score,
          isolate: dimensions.contextEngineering.breakdown.isolate.score,
        },
      },
      burnoutRisk: { score: dimensions.burnoutRisk.score, level: dimensions.burnoutRisk.level },
    });
  });
});
