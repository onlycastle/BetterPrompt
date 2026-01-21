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
