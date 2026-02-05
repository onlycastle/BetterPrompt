/**
 * Type tests for report types
 *
 * This file ensures type safety for report data structures.
 */

import { describe, it, expect } from 'vitest';
import type {
  ReportData,
  TypeResult,
  CodingStyleType,
  TypeDistribution,
  FullAnalysisResult,
  DimensionLevel,
  AIControlLevel,
  MasteryLevel,
  SkillResilienceLevel,
} from '../report';
import { REPORT_TYPE_METADATA, REPORT_DIMENSION_METADATA } from '../report';

describe('Report Types', () => {
  describe('CodingStyleType', () => {
    it('should have metadata for all types', () => {
      const types: CodingStyleType[] = [
        'architect',
        'analyst',
        'conductor',
        'speedrunner',
        'trendsetter',
      ];

      types.forEach((type) => {
        expect(REPORT_TYPE_METADATA[type]).toBeDefined();
        expect(REPORT_TYPE_METADATA[type].emoji).toBeDefined();
        expect(REPORT_TYPE_METADATA[type].name).toBeDefined();
        expect(REPORT_TYPE_METADATA[type].tagline).toBeDefined();
        expect(REPORT_TYPE_METADATA[type].description).toBeDefined();
        expect(REPORT_TYPE_METADATA[type].strengths).toBeInstanceOf(Array);
        expect(REPORT_TYPE_METADATA[type].growthPoints).toBeInstanceOf(Array);
      });
    });
  });

  describe('TypeDistribution', () => {
    it('should accept valid distribution', () => {
      const distribution: TypeDistribution = {
        architect: 25,
        analyst: 20,
        conductor: 15,
        speedrunner: 30,
        trendsetter: 10,
      };

      expect(distribution.architect).toBe(25);
      expect(distribution.analyst).toBe(20);
      expect(distribution.conductor).toBe(15);
      expect(distribution.speedrunner).toBe(30);
      expect(distribution.trendsetter).toBe(10);
    });
  });

  describe('TypeResult', () => {
    it('should accept valid type result', () => {
      const typeResult: TypeResult = {
        primaryType: 'architect',
        distribution: {
          architect: 40,
          analyst: 25,
          conductor: 15,
          speedrunner: 10,
          trendsetter: 10,
        },
        sessionCount: 5,
        analyzedAt: '2025-01-13T00:00:00Z',
        metrics: {
          avgPromptLength: 150,
          avgFirstPromptLength: 200,
          avgTurnsPerSession: 8,
          questionFrequency: 0.2,
          modificationRate: 0.15,
          toolUsageHighlight: 'Heavy use of planning tools',
        },
        evidence: [
          {
            type: 'architect',
            quote: 'First, let me plan the architecture...',
            timestamp: '2025-01-13T00:00:00Z',
            explanation: 'Shows strategic planning approach',
          },
        ],
      };

      expect(typeResult.primaryType).toBe('architect');
      expect(typeResult.distribution.architect).toBe(40);
      expect(typeResult.evidence).toHaveLength(1);
    });
  });

  describe('DimensionMetadata', () => {
    it('should have metadata for all dimensions', () => {
      const dimensions: (keyof FullAnalysisResult)[] = [
        'aiCollaboration',
        'contextEngineering',
        'burnoutRisk',
        'toolMastery',
        'aiControl',
        'skillResilience',
      ];

      dimensions.forEach((dimension) => {
        expect(REPORT_DIMENSION_METADATA[dimension]).toBeDefined();
        expect(REPORT_DIMENSION_METADATA[dimension].label).toBeDefined();
        expect(REPORT_DIMENSION_METADATA[dimension].icon).toBeDefined();
        expect(REPORT_DIMENSION_METADATA[dimension].description).toBeDefined();
        expect(REPORT_DIMENSION_METADATA[dimension].shortDescription).toBeDefined();
      });
    });
  });

  describe('DimensionLevel', () => {
    it('should accept valid levels', () => {
      const levels: DimensionLevel[] = ['novice', 'developing', 'proficient', 'expert'];

      levels.forEach((level) => {
        expect(['novice', 'developing', 'proficient', 'expert']).toContain(level);
      });
    });
  });

  describe('AIControlLevel', () => {
    it('should accept valid levels', () => {
      const levels: AIControlLevel[] = ['explorer', 'navigator', 'cartographer'];

      levels.forEach((level) => {
        expect(['explorer', 'navigator', 'cartographer']).toContain(level);
      });
    });
  });

  describe('MasteryLevel', () => {
    it('should accept valid levels', () => {
      const levels: MasteryLevel[] = ['beginner', 'intermediate', 'advanced', 'expert'];

      levels.forEach((level) => {
        expect(['beginner', 'intermediate', 'advanced', 'expert']).toContain(level);
      });
    });
  });

  describe('SkillResilienceLevel', () => {
    it('should accept valid levels', () => {
      const levels: SkillResilienceLevel[] = ['dependent', 'balanced', 'independent'];

      levels.forEach((level) => {
        expect(['dependent', 'balanced', 'independent']).toContain(level);
      });
    });
  });

  describe('ReportData', () => {
    it('should accept minimal report data', () => {
      const reportData: ReportData = {
        reportId: 'abc123',
        typeResult: {
          primaryType: 'analyst',
          distribution: {
            architect: 10,
            analyst: 50,
            conductor: 20,
            speedrunner: 10,
            trendsetter: 10,
          },
          sessionCount: 3,
          analyzedAt: '2025-01-13T00:00:00Z',
          metrics: {
            avgPromptLength: 100,
            avgFirstPromptLength: 150,
            avgTurnsPerSession: 10,
            questionFrequency: 0.3,
            modificationRate: 0.2,
            toolUsageHighlight: 'Frequent verification',
          },
          evidence: [],
        },
        sessionMetadata: {
          sessionId: null,
          durationMinutes: null,
          messageCount: null,
          toolCallCount: null,
        },
        stats: {
          viewCount: 0,
          shareCount: 0,
        },
        createdAt: '2025-01-13T00:00:00Z',
      };

      expect(reportData.reportId).toBe('abc123');
      expect(reportData.typeResult.primaryType).toBe('analyst');
      expect(reportData.dimensions).toBeUndefined();
    });

    it('should accept full report data with dimensions', () => {
      const reportData: ReportData = {
        reportId: 'xyz789',
        typeResult: {
          primaryType: 'architect',
          distribution: {
            architect: 45,
            analyst: 20,
            conductor: 15,
            speedrunner: 10,
            trendsetter: 10,
          },
          sessionCount: 10,
          analyzedAt: '2025-01-13T00:00:00Z',
          metrics: {
            avgPromptLength: 200,
            avgFirstPromptLength: 300,
            avgTurnsPerSession: 7,
            questionFrequency: 0.15,
            modificationRate: 0.1,
            toolUsageHighlight: 'Strategic tool usage',
          },
          evidence: [],
        },
        dimensions: {
          aiCollaboration: {
            score: 75,
            level: 'proficient',
            breakdown: {
              structuredPlanning: {
                score: 80,
                todoWriteUsage: 10,
                stepByStepPlans: 5,
                specFileReferences: 3,
              },
              aiOrchestration: {
                score: 70,
                taskToolUsage: 8,
                multiAgentSessions: 4,
                parallelWorkflows: 2,
              },
              criticalVerification: {
                score: 75,
                codeReviewRequests: 6,
                testRequests: 5,
                outputModifications: 10,
              },
            },
            strengths: ['Strong planning', 'Good orchestration'],
            growthAreas: ['Increase verification'],
            interpretation: 'You collaborate effectively with AI',
          },
          contextEngineering: {
            score: 70,
            level: 'proficient',
            breakdown: {
              write: {
                score: 75,
                fileReferences: 20,
                codeElementReferences: 15,
                constraintsMentioned: 10,
                patternReferences: 5,
              },
              select: {
                score: 70,
                specificity: 80,
                codebaseNavigation: 10,
                existingPatternUsage: 5,
              },
              compress: {
                score: 65,
                compactUsageCount: 5,
                iterationEfficiency: 70,
                avgTurnsPerSession: 8,
              },
              isolate: {
                score: 70,
                taskToolUsage: 10,
                agentDelegation: 5,
                workPartitioning: 3,
              },
            },
            strengths: ['Good context management'],
            growthAreas: ['Improve compression'],
            interpretation: 'You manage context well',
          },
          burnoutRisk: {
            score: 85,
            level: 'healthy',
            breakdown: {
              sessionIntensity: {
                score: 90,
                avgSessionDuration: 45,
                longSessionCount: 2,
                avgDailySessionCount: 3,
              },
              workLifeBalance: {
                score: 85,
                offHoursWorkRate: 0.1,
                weekendWorkRate: 0.05,
                restPeriodQuality: 90,
              },
              stressSignals: {
                score: 80,
                urgentLanguageCount: 2,
                frustrationSignals: 1,
                rushPatterns: 1,
              },
            },
            warnings: [],
            recommendations: ['Keep up the healthy balance'],
            interpretation: 'Your work patterns are healthy',
          },
          toolMastery: {
            score: 75,
            level: 'advanced',
            breakdown: {
              basicTools: {
                score: 90,
                readWriteEdit: 50,
                grepGlob: 30,
              },
              advancedTools: {
                score: 75,
                taskTool: 10,
                regexUsage: 15,
                composedWorkflows: 5,
              },
              expertTools: {
                score: 60,
                backgroundExecution: 3,
                parallelTasks: 2,
                customScripts: 1,
              },
            },
            toolUsagePatterns: {
              read: 30,
              write: 15,
              grep: 20,
            },
            strengths: ['Strong basic tool usage'],
            growthAreas: ['Explore expert features'],
            interpretation: 'You use tools effectively',
          },
          aiControl: {
            score: 70,
            level: 'navigator',
            breakdown: {
              verificationRate: 0.7,
              constraintSpecification: 0.65,
              outputCritique: 0.75,
              contextControl: 0.7,
            },
            signals: ['Regular verification', 'Clear constraints'],
            strengths: ['Good verification habits'],
            growthAreas: ['Increase critique frequency'],
            interpretation: 'You are building control over AI',
          },
          skillResilience: {
            score: 75,
            level: 'balanced',
            breakdown: {
              manualCoding: {
                score: 80,
                editVsWrite: 0.6,
                directManipulation: 20,
              },
              problemSolving: {
                score: 75,
                debuggingApproach: 70,
                solutionOriginality: 80,
              },
              skillPreservation: {
                score: 70,
                codeReading: 15,
                understandingDepth: 75,
              },
            },
            strengths: ['Independent problem solving'],
            growthAreas: ['Practice more manual coding'],
            interpretation: 'You maintain a healthy balance',
          },
        },
        sessionMetadata: {
          sessionId: 'session-123',
          durationMinutes: 60,
          messageCount: 50,
          toolCallCount: 30,
        },
        stats: {
          viewCount: 10,
          shareCount: 3,
        },
        createdAt: '2025-01-13T00:00:00Z',
      };

      expect(reportData.reportId).toBe('xyz789');
      expect(reportData.dimensions).toBeDefined();
      expect(reportData.dimensions?.aiCollaboration.score).toBe(75);
      expect(reportData.dimensions?.contextEngineering.level).toBe('proficient');
    });
  });
});
