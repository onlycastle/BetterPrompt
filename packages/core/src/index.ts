/**
 * @nomoreaislop/core
 *
 * Core utilities for NoMoreAISlop CLI and Desktop applications.
 * Provides session scanning, parsing, and upload functionality.
 */

// Session scanning and parsing
export {
  scanSessions,
  hasClaudeProjects,
  listProjectDirs,
  listSessionFiles,
  CLAUDE_PROJECTS_DIR,
  type SessionMetadata,
  type SessionWithParsed,
  type ScanResult,
} from './scanner.js';

// Session formatting
export {
  parseSessionContent,
  formatSessionsForAnalysis,
  countFormattedTokens,
  DATA_ANALYST_FORMAT,
  PERSONALITY_ANALYST_FORMAT,
  type ParsedMessage,
  type ParsedSession,
  type SessionStats,
  type SessionFormatOptions,
} from './session-formatter.js';

// Server upload
export {
  uploadForAnalysis,
  formatSize,
  type AnalysisResult,
  type ProgressCallback,
  type UploadOptions,
} from './uploader.js';
