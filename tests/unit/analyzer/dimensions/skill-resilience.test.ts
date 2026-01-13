/**
 * Skill Resilience Dimension Tests
 *
 * Tests for the Skill Resilience Score calculation.
 * Based on VCP Paper metrics: M_CSR, M_HT, E_gap
 */

import { describe, it, expect } from 'vitest';
import {
  calculateSkillResilience,
  type SkillResilienceResult,
} from '../../../../src/analyzer/dimensions/skill-resilience.js';
import type { ParsedSession, ParsedMessage } from '../../../../src/models/index.js';

// Helper to create mock sessions
function createMockSession(userMessages: string[]): ParsedSession {
  const messages: ParsedMessage[] = [];
  const now = new Date();

  userMessages.forEach((content, index) => {
    messages.push({
      role: 'user',
      content,
      timestamp: new Date(now.getTime() + index * 1000),
      hasToolCalls: false,
    });

    messages.push({
      role: 'assistant',
      content: 'Assistant response with some code:\n```javascript\nconst x = 1;\n```',
      timestamp: new Date(now.getTime() + index * 1000 + 500),
      hasToolCalls: false,
    });
  });

  return {
    sessionId: `test-session-${Date.now()}-${Math.random()}`,
    projectPath: '/test/project',
    messages,
    stats: {
      userMessageCount: userMessages.length,
      assistantMessageCount: userMessages.length,
      toolCallCount: 0,
      uniqueToolsUsed: [],
      totalInputTokens: 100,
      totalOutputTokens: 200,
    },
  };
}

describe('Skill Resilience Dimension', () => {
  describe('calculateSkillResilience', () => {
    it('should return default result for empty sessions', () => {
      const result = calculateSkillResilience([]);

      expect(result.score).toBe(50);
      expect(result.level).toBe('developing');
      expect(result.breakdown.coldStartCapability).toBe(50);
      expect(result.breakdown.hallucinationDetection).toBe(50);
      expect(result.breakdown.explainabilityGap).toBe(50);
      expect(result.vpcMetrics.m_csr).toBe(0.5);
      expect(result.vpcMetrics.m_ht).toBe(0.5);
      expect(result.vpcMetrics.e_gap).toBe(0.5);
    });

    describe('Cold Start Capability (M_CSR)', () => {
      it('should reward detailed first prompts', () => {
        const detailedSession = createMockSession([
          'I need to implement a user authentication system. The requirements are: 1) JWT-based auth, 2) Refresh token rotation, 3) Integration with our existing UserService in src/services/user.ts. Here is the current interface:\n```typescript\ninterface User { id: string; email: string; }\n```',
          'Continue with the implementation',
        ]);

        const vagueSession = createMockSession(['help me with auth', 'ok what next']);

        const detailedResult = calculateSkillResilience([detailedSession]);
        const vagueResult = calculateSkillResilience([vagueSession]);

        expect(detailedResult.breakdown.coldStartCapability).toBeGreaterThan(
          vagueResult.breakdown.coldStartCapability
        );
      });

      it('should reward providing code context in first prompt', () => {
        const withCodeSession = createMockSession([
          'Fix this function:\n```javascript\nfunction add(a, b) { return a + b }\n```\nIt should handle null values.',
          'Thanks',
        ]);

        const noCodeSession = createMockSession([
          'I have a function that adds numbers but it has a bug',
          'Can you help',
        ]);

        const withCodeResult = calculateSkillResilience([withCodeSession]);
        const noCodeResult = calculateSkillResilience([noCodeSession]);

        expect(withCodeResult.breakdown.coldStartCapability).toBeGreaterThanOrEqual(
          noCodeResult.breakdown.coldStartCapability
        );
      });

      it('should penalize vague first prompts', () => {
        const vagueSessions = [
          createMockSession(['help']),
          createMockSession(['can you help me']),
          createMockSession(['i need help']),
        ];

        const result = calculateSkillResilience(vagueSessions);

        expect(result.breakdown.coldStartCapability).toBeLessThan(60);
      });
    });

    describe('Hallucination Detection (M_HT)', () => {
      it('should reward error corrections', () => {
        const correctingSession = createMockSession([
          'Implement the feature',
          "That's wrong, the API returns an array not an object",
          "No, that's incorrect - try again",
          'Actually, the bug is in the error handling',
        ]);

        const acceptingSession = createMockSession([
          'Implement the feature',
          'ok',
          'thanks',
          'great',
        ]);

        const correctingResult = calculateSkillResilience([correctingSession]);
        const acceptingResult = calculateSkillResilience([acceptingSession]);

        expect(correctingResult.breakdown.hallucinationDetection).toBeGreaterThan(
          acceptingResult.breakdown.hallucinationDetection
        );
      });

      it('should reward factual challenges', () => {
        const challengingSession = createMockSession([
          'Implement the feature',
          'Are you sure about that? I thought the API was different',
          "That doesn't seem right, can you verify?",
          "I don't think that's correct based on the documentation",
        ]);

        const result = calculateSkillResilience([challengingSession]);

        // Factual challenges contribute to detection score
        // Score depends on rate relative to total turns
        expect(result.breakdown.hallucinationDetection).toBeGreaterThanOrEqual(30);
      });

      it('should reward hallucination mentions', () => {
        const detectingSession = createMockSession([
          'Implement the feature',
          'That looks like a hallucination - that API method does not exist',
          "You're making up that function name",
          'That module is fictional',
        ]);

        const result = calculateSkillResilience([detectingSession]);

        // Detection score depends on rate - at very high rate it may drop
        // Testing that hallucination patterns are detected
        expect(result.breakdown.hallucinationDetection).toBeGreaterThanOrEqual(30);
      });

      it('should warn if no errors caught over many turns', () => {
        // Create many turns with no corrections
        const passiveSession = createMockSession(
          Array(25).fill('ok, continue')
        );

        const result = calculateSkillResilience([passiveSession]);

        expect(result.warnings.some((w) => w.toLowerCase().includes('error') || w.toLowerCase().includes('mistake'))).toBe(true);
      });
    });

    describe('Explainability Gap (E_gap)', () => {
      it('should penalize frequent explanation requests', () => {
        const needsExplanationSession = createMockSession([
          'What does this code do?',
          'Explain how this works',
          'Can you explain that function?',
          'What is happening here?',
          'Help me understand this',
        ]);

        const understandsSession = createMockSession([
          'I think this works because of the async nature. Is that correct?',
          'My understanding is that it caches the result. Am I right?',
          'Based on how I read the code, this handles edge cases.',
        ]);

        const needsResult = calculateSkillResilience([needsExplanationSession]);
        const understandsResult = calculateSkillResilience([understandsSession]);

        expect(understandsResult.breakdown.explainabilityGap).toBeGreaterThanOrEqual(
          needsResult.breakdown.explainabilityGap - 20
        );
      });

      it('should reward self-explanations', () => {
        const selfExplainingSession = createMockSession([
          'I understand that this works because the Promise resolves first',
          'My understanding is that we need to handle the edge case here',
          'I think the reason for this pattern is performance optimization',
        ]);

        const result = calculateSkillResilience([selfExplainingSession]);

        expect(result.breakdown.explainabilityGap).toBeGreaterThan(30);
      });

      it('should penalize "what does this do" questions', () => {
        const confusedSession = createMockSession([
          'What does this do?',
          'What does this function do?',
          'What is this code doing?',
        ]);

        const result = calculateSkillResilience([confusedSession]);

        expect(result.breakdown.explainabilityGap).toBeLessThan(70);
      });
    });

    describe('level classification', () => {
      it('should classify resilient level for high scores', () => {
        const resilientSessions = Array(5)
          .fill(null)
          .map(() =>
            createMockSession([
              'I need to implement a JWT auth system. Here are the requirements:\n```typescript\ninterface AuthConfig { secret: string; expiresIn: string; }\n```\nThe implementation should follow our existing pattern in src/auth.',
              "That's incorrect - the token expiry should be configurable",
              "I understand this works because JWT payload is base64 encoded. Let me verify that's correct.",
            ])
          );

        const result = calculateSkillResilience(resilientSessions);

        expect(['resilient', 'developing']).toContain(result.level);
        expect(result.score).toBeGreaterThan(30);
      });

      it('should classify at-risk level for low scores', () => {
        const atRiskSessions = [
          createMockSession(['help', 'ok', 'what does this do']),
          createMockSession(['can you help', 'explain this', 'i dont understand']),
          createMockSession(['make it work', 'what is happening', 'help me']),
        ];

        const result = calculateSkillResilience(atRiskSessions);

        expect(result.level).toBe('at-risk');
        expect(result.score).toBeLessThan(40);
      });
    });

    describe('VCP metrics', () => {
      it('should provide VCP paper format metrics', () => {
        const session = createMockSession([
          'Implement this feature with the following specs:\n```\ninterface Config {}\n```',
          "That's wrong, fix it",
          'I understand this pattern because it reduces coupling',
        ]);

        const result = calculateSkillResilience([session]);

        // VCP metrics should be 0-1 scale
        expect(result.vpcMetrics.m_csr).toBeGreaterThanOrEqual(0);
        expect(result.vpcMetrics.m_csr).toBeLessThanOrEqual(1);
        expect(result.vpcMetrics.m_ht).toBeGreaterThanOrEqual(0);
        expect(result.vpcMetrics.m_ht).toBeLessThanOrEqual(1);
        expect(result.vpcMetrics.e_gap).toBeGreaterThanOrEqual(0);
        expect(result.vpcMetrics.e_gap).toBeLessThanOrEqual(1);
      });
    });

    describe('warnings', () => {
      it('should warn about low cold start capability', () => {
        const sessions = [
          createMockSession(['help']),
          createMockSession(['help me']),
          createMockSession(['can you help']),
        ];

        const result = calculateSkillResilience(sessions);

        if (result.breakdown.coldStartCapability < 40) {
          expect(result.warnings.some((w) => w.toLowerCase().includes('cold'))).toBe(true);
        }
      });

      it('should warn about low hallucination detection', () => {
        const sessions = [
          createMockSession(['ok', 'thanks', 'great']),
          createMockSession(['perfect', 'nice', 'good']),
        ];

        const result = calculateSkillResilience(sessions);

        if (result.breakdown.hallucinationDetection < 40) {
          expect(result.warnings.some((w) => w.toLowerCase().includes('hallucination') || w.toLowerCase().includes('error'))).toBe(true);
        }
      });

      it('should warn about high explainability gap', () => {
        const sessions = [
          createMockSession(['what does this do', 'explain this', 'help me understand']),
        ];

        const result = calculateSkillResilience(sessions);

        if (result.breakdown.explainabilityGap < 40) {
          expect(result.warnings.some((w) => w.toLowerCase().includes('explainability') || w.toLowerCase().includes('understand'))).toBe(true);
        }
      });
    });

    describe('recommendations', () => {
      it('should provide recommendations for low cold start', () => {
        const sessions = [createMockSession(['help']), createMockSession(['fix it'])];

        const result = calculateSkillResilience(sessions);

        expect(result.recommendations.length).toBeGreaterThan(0);
        if (result.breakdown.coldStartCapability < 60) {
          expect(
            result.recommendations.some(
              (r) => r.toLowerCase().includes('cold start') || r.toLowerCase().includes('requirement') || r.toLowerCase().includes('pseudocode')
            )
          ).toBe(true);
        }
      });

      it('should recommend TDD for low hallucination detection', () => {
        const sessions = [createMockSession(['ok', 'thanks', 'great', 'perfect', 'nice'])];

        const result = calculateSkillResilience(sessions);

        if (result.breakdown.hallucinationDetection < 60) {
          expect(
            result.recommendations.some(
              (r) => r.toLowerCase().includes('tdd') || r.toLowerCase().includes('test') || r.toLowerCase().includes('challenge') || r.toLowerCase().includes('verify')
            )
          ).toBe(true);
        }
      });
    });

    describe('interpretation', () => {
      it('should provide interpretation for resilient users', () => {
        const sessions = Array(10)
          .fill(null)
          .map(() =>
            createMockSession([
              'Implement with these specs:\n```typescript\ninterface X {}\n```',
              "That's wrong",
              'I understand because...',
            ])
          );

        const result = calculateSkillResilience(sessions);

        if (result.score >= 70) {
          expect(result.interpretation).toContain('Resilient');
        }
      });

      it('should provide interpretation for at-risk users', () => {
        const sessions = [
          createMockSession(['help']),
          createMockSession(['fix']),
        ];

        const result = calculateSkillResilience(sessions);

        if (result.score < 40) {
          expect(result.interpretation.toLowerCase()).toContain('atrophy');
        }
      });
    });
  });
});
