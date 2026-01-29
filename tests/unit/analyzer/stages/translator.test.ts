/**
 * TranslatorStage Tests
 *
 * Tests for Phase 4 TranslatorStage.
 * Translates English ContentWriter output into target language.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AgentOutputs } from '../../../../src/lib/models/agent-outputs.js';
import type { TranslatorOutput } from '../../../../src/lib/models/translator-output.js';

// Mock the GeminiClient
vi.mock('../../../../src/lib/analyzer/clients/gemini-client.js', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    generateStructured: vi.fn(),
  })),
}));

// Import after mocking
import { TranslatorStage, type TranslatorConfig } from '../../../../src/lib/analyzer/stages/translator.js';
import { GeminiClient } from '../../../../src/lib/analyzer/clients/gemini-client.js';

// ============================================================================
// Helper Functions
// ============================================================================

function createMockEnglishResponse(): any {
  return {
    personalitySummary: 'You are a thoughtful developer who maintains strong oversight of AI-generated code.',
    promptPatterns: [
      {
        patternName: 'Verification Before Progress',
        description: 'You pause to verify results before moving forward',
        frequency: 'often',
        examples: [{ quote: 'Let me verify this first', analysis: 'Good verification habit' }],
        effectiveness: 'very_effective',
        tip: 'Continue this pattern',
      },
    ],
    topFocusAreas: {
      areas: [
        {
          rank: 1,
          dimension: 'aiCollaboration',
          title: 'Expand Test Coverage',
          narrative: 'Your verification habits are strong',
          expectedImpact: 'Catch more edge cases',
          priorityScore: 85,
        },
      ],
      summary: 'Focus on systematizing your verification approach',
    },
  };
}

function createMockAgentOutputs(): AgentOutputs {
  return {
    trustVerification: {
      antiPatterns: [],
      verificationBehavior: {
        level: 'high',
        description: 'Consistently verifies AI output',
        indicators: ['reviews_code'],
      },
      patternTypes: [],
      overallTrustHealthScore: 85,
      summary: 'Strong verification habits',
      confidenceScore: 0.9,
      strengths: [
        {
          title: 'Verification Mindset',
          description: 'Consistently verifies AI output',
          evidence: ['Always reviews code'],
        },
      ],
      growthAreas: [],
    },
    workflowHabit: {
      planningHabits: [],
      criticalThinkingMoments: [],
      overallWorkflowScore: 80,
      summary: 'Good workflow',
      confidenceScore: 0.85,
      strengths: [],
      growthAreas: [],
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
    promptPatterns: [
      {
        patternName: '진행 전 검증',
        description: '앞으로 나아가기 전에 결과를 확인하기 위해 멈춥니다',
        examples: [{ quote: '먼저 확인해 보겠습니다', analysis: '좋은 검증 습관' }],
        tip: '이 패턴을 계속하세요',
      },
    ],
    topFocusAreas: {
      areas: [
        {
          title: '테스트 커버리지 확장',
          narrative: '당신의 검증 습관은 강합니다',
          expectedImpact: '더 많은 엣지 케이스 포착',
        },
      ],
      summary: '검증 접근 방식을 체계화하는 데 집중하세요',
    },
    translatedAgentInsights: {
      trustVerification: {
        strengthsData: '검증 마인드셋|AI 출력을 일관되게 검증합니다|항상 코드를 검토합니다',
        growthAreasData: '',
      },
      knowledgeGap: {
        strengthsData: 'React hooks|좋은 이해도|useEffect 학습 완료',
        growthAreasData: 'TypeScript 제네릭|개선 필요|불명확한 구문|제네릭 문서 학습|가끔|보통|70',
      },
      contextEfficiency: {
        strengthsData: '효율적인 컨텍스트 사용|좋은 컨텍스트 관리|반복이 거의 없음',
        growthAreasData: '',
      },
    },
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('TranslatorStage', () => {
  let stage: TranslatorStage;
  let mockGenerateStructured: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockGenerateStructured = vi.fn();
    vi.mocked(GeminiClient).mockImplementation(
      () =>
        ({
          generateStructured: mockGenerateStructured,
        }) as any
    );

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
    it('should translate English response to Korean', async () => {
      const mockOutput = createMockTranslatorOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: {
          promptTokens: 1200,
          completionTokens: 600,
          totalTokens: 1800,
        },
      });

      const result = await stage.translate(
        createMockEnglishResponse(),
        'ko',
        createMockAgentOutputs()
      );

      expect(result.data).toBeDefined();
      expect(result.data.personalitySummary).toContain('개발자');
      expect(result.usage).toEqual({
        promptTokens: 1200,
        completionTokens: 600,
        totalTokens: 1800,
      });
    });

    it('should call generateStructured with correct parameters', async () => {
      const mockOutput = createMockTranslatorOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      await stage.translate(
        createMockEnglishResponse(),
        'ko',
        createMockAgentOutputs()
      );

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
      const mockOutput = createMockTranslatorOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await stage.translate(
        createMockEnglishResponse(),
        'ko',
        createMockAgentOutputs()
      );

      expect(result.data.translatedAgentInsights).toBeDefined();
      expect(result.data.translatedAgentInsights?.trustVerification).toBeDefined();
      expect(result.data.translatedAgentInsights?.knowledgeGap).toBeDefined();
    });

    it('should translate promptPatterns', async () => {
      const mockOutput = createMockTranslatorOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await stage.translate(
        createMockEnglishResponse(),
        'ko',
        createMockAgentOutputs()
      );

      expect(result.data.promptPatterns).toBeDefined();
      expect(result.data.promptPatterns?.[0].patternName).toContain('검증');
    });

    it('should translate topFocusAreas', async () => {
      const mockOutput = createMockTranslatorOutput();
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await stage.translate(
        createMockEnglishResponse(),
        'ko',
        createMockAgentOutputs()
      );

      expect(result.data.topFocusAreas).toBeDefined();
      expect(result.data.topFocusAreas?.areas?.[0].title).toContain('테스트');
    });

    it('should throw on LLM error (NO FALLBACK policy)', async () => {
      const error = new Error('LLM API error');
      mockGenerateStructured.mockRejectedValue(error);

      await expect(
        stage.translate(createMockEnglishResponse(), 'ko', createMockAgentOutputs())
      ).rejects.toThrow('LLM API error');
    });

    it('should handle empty agentOutputs', async () => {
      const mockOutput: TranslatorOutput = {
        personalitySummary: '당신은 사려 깊은 개발자입니다.',
        promptPatterns: [],
        topFocusAreas: { areas: [], summary: '' },
      };
      mockGenerateStructured.mockResolvedValue({
        data: mockOutput,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      });

      const result = await stage.translate(
        createMockEnglishResponse(),
        'ko',
        {} // Empty agentOutputs
      );

      expect(result.data).toBeDefined();
      expect(result.data.personalitySummary).toBeDefined();
    });
  });
});
