/**
 * TranslatorStage Tests
 *
 * Phase 4 TranslatorStage translates English ContentWriter output into target language.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';
import type { TranslatorOutput } from '../../../../src/lib/models/translator-output.js';

vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

import { TranslatorStage, type TranslatorConfig } from '../../../../src/lib/analyzer/stages/translator.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

function createMockEnglishResponse() {
  return {
    personalitySummary: 'You are a thoughtful developer who maintains strong oversight of AI-generated code.',
    promptPatterns: [{ patternName: 'Verification Before Progress', description: 'You pause to verify results before moving forward', frequency: 'often', examples: [{ quote: 'Let me verify this first', analysis: 'Good verification habit' }], effectiveness: 'very_effective', tip: 'Continue this pattern' }],
    topFocusAreas: {
      areas: [{ rank: 1, dimension: 'aiCollaboration', title: 'Expand Test Coverage', narrative: 'Your verification habits are strong', expectedImpact: 'Catch more edge cases', priorityScore: 85 }],
      summary: 'Focus on systematizing your verification approach',
    },
  };
}

function createMockAgentOutputs(): AgentOutputs {
  return {
    thinkingQuality: { verificationAntiPatterns: [], planningHabits: [], criticalThinkingMoments: [], communicationPatterns: [], confidenceScore: 0.9 },
    learningBehavior: {
      repeatedMistakePatterns: [],
      knowledgeGaps: [{ topic: 'TypeScript generics', displayName: 'TypeScript Generics', depthLevel: 'shallow', frequencyOfQuestions: 3, examples: ['generics syntax'], suggestedResource: 'TypeScript docs' }],
      learningProgressIndicators: [],
      confidenceScore: 0.75,
    },
    knowledgeGap: {
      knowledgeGapsData: 'TypeScript:3:shallow:generics',
      learningProgressData: '',
      recommendedResourcesData: '',
      topInsights: ['TypeScript needs attention'],
      overallKnowledgeScore: 70,
      confidenceScore: 0.75,
      strengthsData: 'React hooks|Good understanding|learned useEffect',
      growthAreasData: 'TypeScript generics|Needs improvement|unclear syntax|Study generics docs|sometimes|moderate|70',
      strengths: [],
      growthAreas: [],
    },
    contextEfficiency: {
      contextUsagePatternData: 'session1:80:90',
      inefficiencyPatternsData: '',
      promptLengthTrendData: '',
      redundantInfoData: '',
      topInsights: [],
      overallEfficiencyScore: 75,
      avgContextFillPercent: 80,
      confidenceScore: 0.8,
      strengthsData: 'Efficient context use|Good context management|rarely repeats info',
      growthAreasData: '',
      strengths: [],
      growthAreas: [],
    },
  };
}

function createMockTranslatorOutput(): TranslatorOutput {
  return {
    personalitySummary: '당신은 AI 생성 코드에 대한 강력한 감독을 유지하는 사려 깊은 개발자입니다.',
    promptPatterns: [{ patternName: '진행 전 검증', description: '앞으로 나아가기 전에 결과를 확인하기 위해 멈춥니다', examples: [{ quote: '먼저 확인해 보겠습니다', analysis: '좋은 검증 습관' }], tip: '이 패턴을 계속하세요' }],
    topFocusAreas: {
      areas: [{ title: '테스트 커버리지 확장', narrative: '당신의 검증 습관은 강합니다', expectedImpact: '더 많은 엣지 케이스 포착' }],
      summary: '검증 접근 방식을 체계화하는 데 집중하세요',
    },
    translatedAgentInsights: {
      knowledgeGap: { strengthsData: 'React hooks|좋은 이해도|useEffect 학습 완료', growthAreasData: 'TypeScript 제네릭|개선 필요|불명확한 구문|제네릭 문서 학습|가끔|보통|70' },
      contextEfficiency: { strengthsData: '효율적인 컨텍스트 사용|좋은 컨텍스트 관리|반복이 거의 없음', growthAreasData: '' },
    },
  };
}

describe('TranslatorStage', () => {
  let stage: TranslatorStage;
  let mockGenerateStructured: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(() => ({ generateStructured: mockGenerateStructured }) as unknown as GeminiClient);
    stage = new TranslatorStage();
  });

  describe('constructor', () => {
    it('should create stage with default config', () => {
      const stage = new TranslatorStage();
      expect(stage).toBeDefined();
    });

    it('should create stage with custom config', () => {
      const config: TranslatorConfig = {
        apiKey: 'test-key',
        model: 'gemini-3-flash-preview',
        temperature: 1.0,
        maxOutputTokens: 32768,
        maxRetries: 3,
      };
      const stage = new TranslatorStage(config);
      expect(stage).toBeDefined();
    });
  });

  describe('translate()', () => {
    function setupMockResponse(output: TranslatorOutput = createMockTranslatorOutput(), usage = { promptTokens: 100, completionTokens: 50, totalTokens: 150 }) {
      mockGenerateStructured.mockResolvedValue({ data: output, usage });
    }

    async function translateToKorean(agentOutputs: AgentOutputs = createMockAgentOutputs()) {
      return stage.translate(createMockEnglishResponse(), 'ko', agentOutputs);
    }

    it('should translate English response to Korean', async () => {
      setupMockResponse(createMockTranslatorOutput(), { promptTokens: 1200, completionTokens: 600, totalTokens: 1800 });

      const result = await translateToKorean();

      expect(result.data.personalitySummary).toContain('개발자');
      expect(result.usage).toEqual({ promptTokens: 1200, completionTokens: 600, totalTokens: 1800 });
    });

    it('should call generateStructured with correct parameters', async () => {
      setupMockResponse();
      await translateToKorean();

      expect(mockGenerateStructured).toHaveBeenCalledWith(
        expect.objectContaining({
          systemPrompt: expect.any(String),
          userPrompt: expect.any(String),
          responseSchema: expect.any(Object),
          maxOutputTokens: 65536,
        })
      );
    });

    it('should include translatedAgentInsights in output', async () => {
      setupMockResponse();
      const result = await translateToKorean();

      expect(result.data.translatedAgentInsights?.knowledgeGap).toBeDefined();
    });

    it('should translate promptPatterns', async () => {
      setupMockResponse();
      const result = await translateToKorean();

      expect(result.data.promptPatterns?.[0].patternName).toContain('검증');
    });

    it('should translate topFocusAreas', async () => {
      setupMockResponse();
      const result = await translateToKorean();

      expect(result.data.topFocusAreas?.areas?.[0].title).toContain('테스트');
    });

    it('should throw on LLM error (NO FALLBACK policy)', async () => {
      mockGenerateStructured.mockRejectedValue(new Error('LLM API error'));

      await expect(translateToKorean()).rejects.toThrow('LLM API error');
    });

    it('should handle empty agentOutputs', async () => {
      const emptyOutput: TranslatorOutput = { personalitySummary: '당신은 사려 깊은 개발자입니다.', promptPatterns: [], topFocusAreas: { areas: [], summary: '' } };
      setupMockResponse(emptyOutput);

      const result = await stage.translate(createMockEnglishResponse(), 'ko', {});

      expect(result.data.personalitySummary).toBeDefined();
    });

    it('should serialize InsightEvidence objects without [object Object]', async () => {
      setupMockResponse();

      const agentOutputs: AgentOutputs = {
        thinkingQuality: {
          verificationAntiPatterns: [],
          planningHabits: [],
          criticalThinkingMoments: [],
          communicationPatterns: [],
          confidenceScore: 0.9,
          strengths: [
            {
              title: 'Systematic Verification',
              description: 'You consistently verify AI output before accepting it.',
              evidence: [
                { utteranceId: 'session1_5', quote: 'Let me check the output carefully before continuing' },
                { utteranceId: 'session1_8', quote: 'I want to verify this matches the expected behavior' },
              ],
            },
          ],
          growthAreas: [
            {
              title: 'Error Loop Pattern',
              description: 'You sometimes retry the same approach without adjusting.',
              evidence: [
                { utteranceId: 'session2_3', quote: 'Try again with the same approach as before' },
              ],
              recommendation: 'Pause and reconsider your strategy when encountering repeated failures.',
              severity: 'high',
            },
          ],
        },
      };

      await stage.translate(createMockEnglishResponse(), 'ko', agentOutputs);

      const calledArgs = mockGenerateStructured.mock.calls[0][0];
      const userPrompt: string = calledArgs.userPrompt;

      expect(userPrompt).not.toContain('[object Object]');
      expect(userPrompt).toContain('Let me check the output carefully before continuing');
      expect(userPrompt).toContain('I want to verify this matches the expected behavior');
      expect(userPrompt).toContain('Try again with the same approach as before');
    });

    it('should handle legacy string evidence correctly', async () => {
      setupMockResponse();

      const agentOutputs: AgentOutputs = {
        contextEfficiency: {
          contextUsagePatternData: '',
          inefficiencyPatternsData: '',
          promptLengthTrendData: '',
          redundantInfoData: '',
          topInsights: [],
          overallEfficiencyScore: 75,
          avgContextFillPercent: 80,
          confidenceScore: 0.8,
          strengthsData: '',
          growthAreasData: '',
          strengths: [
            {
              title: 'Efficient Token Usage',
              description: 'You use context efficiently.',
              evidence: ['good context reuse', 'minimal redundancy observed'],
            },
          ],
          growthAreas: [],
        },
      };

      await stage.translate(createMockEnglishResponse(), 'ko', agentOutputs);

      const calledArgs = mockGenerateStructured.mock.calls[0][0];
      const userPrompt: string = calledArgs.userPrompt;

      expect(userPrompt).not.toContain('[object Object]');
      expect(userPrompt).toContain('good context reuse');
      expect(userPrompt).toContain('minimal redundancy observed');
    });

    it('should handle mixed string and InsightEvidence evidence types', async () => {
      setupMockResponse();

      const agentOutputs: AgentOutputs = {
        learningBehavior: {
          repeatedMistakePatterns: [],
          knowledgeGaps: [],
          learningProgressIndicators: [],
          confidenceScore: 0.8,
          strengths: [
            {
              title: 'Quick Learner',
              description: 'You rapidly integrate new concepts.',
              evidence: [
                'applied the pattern correctly on second attempt',
                { utteranceId: 'session3_12', quote: 'Now I understand how this works, let me apply it' },
              ],
            },
          ],
          growthAreas: [
            {
              title: 'Incomplete Error Handling',
              description: 'Error handling is sometimes overlooked.',
              evidence: [
                { utteranceId: 'session4_2', quote: 'Just ignore the error for now and move on' },
                'skipped error handling in multiple files',
              ],
              recommendation: 'Always consider error cases when implementing new features.',
              severity: 'medium',
            },
          ],
        },
      };

      await stage.translate(createMockEnglishResponse(), 'ko', agentOutputs);

      const calledArgs = mockGenerateStructured.mock.calls[0][0];
      const userPrompt: string = calledArgs.userPrompt;

      expect(userPrompt).not.toContain('[object Object]');
      expect(userPrompt).toContain('applied the pattern correctly on second attempt');
      expect(userPrompt).toContain('Now I understand how this works, let me apply it');
      expect(userPrompt).toContain('Just ignore the error for now and move on');
      expect(userPrompt).toContain('skipped error handling in multiple files');
    });
  });
});
