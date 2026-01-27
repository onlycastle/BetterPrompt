/**
 * NoMoreAISlop - Analyzer Module
 *
 * This module exports the analyzers and utilities for evaluating
 * developer-AI collaboration sessions.
 *
 * The primary analyzer is VerboseAnalyzer for hyper-personalized multi-session analysis.
 */

// Re-export verbose analyzer
export {
  type VerboseAnalyzerConfig,
  VerboseAnalyzer,
  VerboseAnalysisError,
  createVerboseAnalyzer,
} from './verbose-analyzer';

// Re-export content gateway
export {
  type Tier,
  type PremiumPreview,
  ContentGateway,
  createContentGateway,
} from './content-gateway';
