import { describe, it, expect } from 'vitest';
import { SessionParser } from '../src/lib/parser/index.js';

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

});
