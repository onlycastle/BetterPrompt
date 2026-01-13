/**
 * Mock Personal Data
 * Sample individual developer journey data showing growth from speedrunner to architect
 */

import type {
  PersonalAnalytics,
  HistoryEntry,
  Recommendation,
} from '../types/personal';

/**
 * Generate realistic growth progression over 12 analyses (~6 weeks)
 * Shows evolution from speedrunner (52) -> architect (74)
 * Control level: vibe-coder -> developing
 */
function generateRealisticHistory(): HistoryEntry[] {
  const baseDate = new Date('2025-12-02'); // ~6 weeks ago
  const history: HistoryEntry[] = [];

  // Week 1: Starting as speedrunner - low scores, high burnout
  history.push({
    date: new Date(baseDate.getTime() + 0 * 86400000).toISOString().split('T')[0],
    overallScore: 52,
    dimensions: {
      aiCollaboration: 70,
      contextEngineering: 42,
      burnoutRisk: 65,
      toolMastery: 48,
      aiControl: 35,
      skillResilience: 38,
    },
  });

  history.push({
    date: new Date(baseDate.getTime() + 2 * 86400000).toISOString().split('T')[0],
    overallScore: 54,
    dimensions: {
      aiCollaboration: 72,
      contextEngineering: 44,
      burnoutRisk: 63,
      toolMastery: 50,
      aiControl: 37,
      skillResilience: 40,
    },
  });

  // Week 2: Starting to improve context engineering
  history.push({
    date: new Date(baseDate.getTime() + 7 * 86400000).toISOString().split('T')[0],
    overallScore: 58,
    dimensions: {
      aiCollaboration: 73,
      contextEngineering: 50,
      burnoutRisk: 60,
      toolMastery: 52,
      aiControl: 40,
      skillResilience: 43,
    },
  });

  history.push({
    date: new Date(baseDate.getTime() + 10 * 86400000).toISOString().split('T')[0],
    overallScore: 60,
    dimensions: {
      aiCollaboration: 74,
      contextEngineering: 53,
      burnoutRisk: 58,
      toolMastery: 55,
      aiControl: 42,
      skillResilience: 45,
    },
  });

  // Week 3: AI Control starting to improve, burnout reducing
  history.push({
    date: new Date(baseDate.getTime() + 14 * 86400000).toISOString().split('T')[0],
    overallScore: 63,
    dimensions: {
      aiCollaboration: 75,
      contextEngineering: 56,
      burnoutRisk: 55,
      toolMastery: 58,
      aiControl: 48,
      skillResilience: 48,
    },
  });

  history.push({
    date: new Date(baseDate.getTime() + 17 * 86400000).toISOString().split('T')[0],
    overallScore: 65,
    dimensions: {
      aiCollaboration: 76,
      contextEngineering: 60,
      burnoutRisk: 52,
      toolMastery: 60,
      aiControl: 52,
      skillResilience: 50,
    },
  });

  // Week 4: Crossing into developing territory
  history.push({
    date: new Date(baseDate.getTime() + 21 * 86400000).toISOString().split('T')[0],
    overallScore: 67,
    dimensions: {
      aiCollaboration: 77,
      contextEngineering: 64,
      burnoutRisk: 48,
      toolMastery: 63,
      aiControl: 55,
      skillResilience: 53,
    },
  });

  history.push({
    date: new Date(baseDate.getTime() + 24 * 86400000).toISOString().split('T')[0],
    overallScore: 69,
    dimensions: {
      aiCollaboration: 78,
      contextEngineering: 67,
      burnoutRisk: 45,
      toolMastery: 66,
      aiControl: 58,
      skillResilience: 56,
    },
  });

  // Week 5: Skill resilience improving, type shifting
  history.push({
    date: new Date(baseDate.getTime() + 28 * 86400000).toISOString().split('T')[0],
    overallScore: 71,
    dimensions: {
      aiCollaboration: 79,
      contextEngineering: 70,
      burnoutRisk: 42,
      toolMastery: 68,
      aiControl: 62,
      skillResilience: 60,
    },
  });

  history.push({
    date: new Date(baseDate.getTime() + 31 * 86400000).toISOString().split('T')[0],
    overallScore: 72,
    dimensions: {
      aiCollaboration: 80,
      contextEngineering: 72,
      burnoutRisk: 40,
      toolMastery: 70,
      aiControl: 65,
      skillResilience: 63,
    },
  });

  // Week 6: Recent analyses showing architect emergence
  history.push({
    date: new Date(baseDate.getTime() + 35 * 86400000).toISOString().split('T')[0],
    overallScore: 73,
    dimensions: {
      aiCollaboration: 81,
      contextEngineering: 74,
      burnoutRisk: 38,
      toolMastery: 72,
      aiControl: 68,
      skillResilience: 65,
    },
  });

  history.push({
    date: new Date(baseDate.getTime() + 38 * 86400000).toISOString().split('T')[0],
    overallScore: 74,
    dimensions: {
      aiCollaboration: 82,
      contextEngineering: 76,
      burnoutRisk: 35,
      toolMastery: 74,
      aiControl: 70,
      skillResilience: 67,
    },
  });

  return history;
}

/**
 * Generate personalized recommendations based on weak dimensions
 * Focus on areas still below 70: AI Control (70), Skill Resilience (67)
 */
function generateRecommendations(): Recommendation[] {
  return [
    {
      id: 'rec-1',
      priority: 'high',
      dimension: 'aiControl',
      title: 'Master AI Output Verification',
      description: 'Learn systematic approaches to validate and test AI-generated code. Focus on understanding what to verify and when to override AI suggestions.',
      type: 'article',
      url: 'https://example.com/ai-verification',
      estimatedMinutes: 15,
    },
    {
      id: 'rec-2',
      priority: 'high',
      dimension: 'skillResilience',
      title: 'Maintain Core Programming Skills',
      description: 'Practice implementing algorithms without AI assistance. Weekly challenges to ensure fundamental skills remain sharp.',
      type: 'exercise',
      estimatedMinutes: 30,
    },
    {
      id: 'rec-3',
      priority: 'medium',
      dimension: 'aiControl',
      title: 'Debugging AI Code: A Practical Guide',
      description: 'Watch this 45-minute workshop on effective strategies for debugging and refining AI-generated solutions.',
      type: 'video',
      url: 'https://example.com/debugging-ai',
      estimatedMinutes: 45,
    },
    {
      id: 'rec-4',
      priority: 'medium',
      dimension: 'contextEngineering',
      title: 'Advanced Context Techniques',
      description: 'Elevate your prompting from good to great. Learn how to provide optimal context for complex architectural decisions.',
      type: 'article',
      url: 'https://example.com/context-mastery',
      estimatedMinutes: 20,
    },
    {
      id: 'rec-5',
      priority: 'low',
      dimension: 'burnoutRisk',
      title: 'Sustainable AI-Assisted Development',
      description: 'Strategies for maintaining healthy work patterns while leveraging AI tools. Balance speed with sustainability.',
      type: 'article',
      url: 'https://example.com/sustainable-dev',
      estimatedMinutes: 12,
    },
  ];
}

const history = generateRealisticHistory();
const firstEntry = history[0];
const latestEntry = history[history.length - 1];

/**
 * Calculate dimension improvements (latest - first)
 */
function calculateDimensionImprovements(first: any, latest: any) {
  return {
    aiCollaboration: latest.aiCollaboration - first.aiCollaboration,
    contextEngineering: latest.contextEngineering - first.contextEngineering,
    burnoutRisk: latest.burnoutRisk - first.burnoutRisk, // Note: lower is better
    toolMastery: latest.toolMastery - first.toolMastery,
    aiControl: latest.aiControl - first.aiControl,
    skillResilience: latest.skillResilience - first.skillResilience,
  };
}

// Mock Personal Analytics
export const MOCK_PERSONAL_DATA: PersonalAnalytics = {
  // Top-level properties for JourneyHeader
  currentType: 'architect',
  firstAnalysisDate: firstEntry.date,
  analysisCount: 12,
  totalImprovement: latestEntry.overallScore - firstEntry.overallScore,

  // Current dimension scores (from latest analysis)
  currentDimensions: latestEntry.dimensions!,
  dimensionImprovements: calculateDimensionImprovements(
    firstEntry.dimensions,
    latestEntry.dimensions
  ),

  // Detailed analysis comparisons
  firstAnalysis: {
    date: firstEntry.date,
    score: firstEntry.overallScore,
    overallScore: firstEntry.overallScore,
    primaryType: 'speedrunner',
    controlLevel: 'vibe-coder',
    dimensions: firstEntry.dimensions!,
  },
  latestAnalysis: {
    date: latestEntry.date,
    score: latestEntry.overallScore,
    overallScore: latestEntry.overallScore,
    primaryType: 'architect',
    controlLevel: 'developing',
    dimensions: latestEntry.dimensions!,
  },

  // Journey tracking
  journey: {
    totalAnalyses: 12,
    currentStreak: 7, // Days with analyses
    longestStreak: 11,
  },

  // Growth data
  history,
  recommendations: generateRecommendations(),
};
