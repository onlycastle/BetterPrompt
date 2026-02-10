/**
 * Animations Module
 *
 * Exports all animation-related utilities for the CLI.
 */

export {
  type ChippyExpression,
  getChippyInline,
  getChippyFull,
  getChippyWithIndicator,
  getChippyLarge,
  getChipCharacter,
  getChipCharacterWithBubble,
  getLargeChipCharacter,
  getLargeChipCharacterWithBubble,
  BEAR_LINE_WIDTH,
  LARGE_BUBBLE_WIDTH,
  THINKING_FRAMES,
  CELEBRATION_FRAMES,
  getAnimationFrame,
} from './chippy.js';

export {
  generateWelcomeBanner,
  generateCompactHeader,
  generateCelebrationBanner,
  WAITING_MESSAGES,
  getWaitingMessage,
} from './banner.js';

export {
  type SessionInsights,
  type AnalysisMessage,
  type MilestoneConfig,
  computeSessionInsights,
  generatePersonalizedMessages,
  getAnalyzingStatusMessage,
  formatDuration,
  formatDateShort,
  MILESTONES,
} from './analysis-messages.js';
