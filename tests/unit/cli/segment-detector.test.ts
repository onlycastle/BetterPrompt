import { describe, it, expect } from 'vitest';
import {
  detectSegments,
  calculateFreshnessScore,
  type Segment,
  type SegmentDetectionResult,
} from '../../../packages/cli/src/segment-detector.js';

describe('Segment Detector', () => {
  describe('detectSegments', () => {
    it('should detect a single segment for continuous conversation', () => {
      const content = `
{"type": "user", "message": "Hello", "timestamp": "2024-01-01T10:00:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T10:00:30Z"}
{"type": "user", "message": "How are you?", "timestamp": "2024-01-01T10:01:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T10:01:30Z"}
      `.trim();

      const result = detectSegments(content);
      expect(result.isMultiSegment).toBe(false);
      expect(result.segments.length).toBe(1);
      expect(result.segments[0].boundaryType).toBe('session-start');
      expect(result.segments[0].messageCount).toBe(4);
    });

    it('should detect time gap segments', () => {
      const content = `
{"type": "user", "message": "First session", "timestamp": "2024-01-01T10:00:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T10:01:00Z"}
{"type": "user", "message": "After 45 minute break", "timestamp": "2024-01-01T10:45:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T10:46:00Z"}
      `.trim();

      const result = detectSegments(content);
      expect(result.isMultiSegment).toBe(true);
      expect(result.segments.length).toBe(2);
      expect(result.segments[0].boundaryType).toBe('session-start');
      expect(result.segments[1].boundaryType).toBe('time-gap');
      expect(result.timeGapCount).toBe(1);
    });

    it('should detect context continuation markers', () => {
      const content = `
{"type": "user", "message": "First message", "timestamp": "2024-01-01T10:00:00Z"}
{"type": "assistant", "message": "being continued from a previous conversation", "timestamp": "2024-01-01T10:01:00Z"}
{"type": "user", "message": "Continue", "timestamp": "2024-01-01T10:02:00Z"}
      `.trim();

      const result = detectSegments(content);
      expect(result.isMultiSegment).toBe(true);
      expect(result.contextContinueCount).toBe(1);
      expect(result.segments.some(s => s.boundaryType === 'context-continue')).toBe(true);
    });

    it('should detect /clear command', () => {
      const content = `
{"type": "user", "message": "First message", "timestamp": "2024-01-01T10:00:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T10:01:00Z"}
{"type": "user", "message": "/clear", "timestamp": "2024-01-01T10:02:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T10:02:30Z"}
{"type": "user", "message": "Fresh start", "timestamp": "2024-01-01T10:03:00Z"}
      `.trim();

      const result = detectSegments(content);
      expect(result.isMultiSegment).toBe(true);
      expect(result.clearCommandCount).toBe(1);
      expect(result.segments.some(s => s.boundaryType === 'clear-command')).toBe(true);
    });

    it('should detect <command-name>/clear</command-name> format', () => {
      const content = `
{"type": "user", "message": "First message", "timestamp": "2024-01-01T10:00:00Z"}
{"type": "assistant", "message": "<command-name>/clear</command-name>", "timestamp": "2024-01-01T10:01:00Z"}
{"type": "user", "message": "After clear", "timestamp": "2024-01-01T10:02:00Z"}
      `.trim();

      const result = detectSegments(content);
      expect(result.clearCommandCount).toBe(1);
    });

    it('should handle empty content', () => {
      const result = detectSegments('');
      expect(result.segments.length).toBe(0);
      expect(result.isMultiSegment).toBe(false);
    });

    it('should handle malformed JSON lines', () => {
      const content = `
{"type": "user", "message": "Valid", "timestamp": "2024-01-01T10:00:00Z"}
not valid json
{"type": "assistant", "message": [], "timestamp": "2024-01-01T10:01:00Z"}
      `.trim();

      const result = detectSegments(content);
      expect(result.segments.length).toBe(1);
      expect(result.segments[0].messageCount).toBe(2);
    });

    it('should track segment timestamps', () => {
      const content = `
{"type": "user", "message": "First", "timestamp": "2024-01-01T10:00:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T10:05:00Z"}
{"type": "user", "message": "After gap", "timestamp": "2024-01-01T11:00:00Z"}
{"type": "assistant", "message": [], "timestamp": "2024-01-01T11:02:00Z"}
      `.trim();

      const result = detectSegments(content);
      expect(result.segments.length).toBe(2);

      // First segment
      expect(result.segments[0].startTime?.toISOString()).toBe('2024-01-01T10:00:00.000Z');
      expect(result.segments[0].endTime?.toISOString()).toBe('2024-01-01T10:05:00.000Z');

      // Second segment
      expect(result.segments[1].startTime?.toISOString()).toBe('2024-01-01T11:00:00.000Z');
      expect(result.segments[1].endTime?.toISOString()).toBe('2024-01-01T11:02:00.000Z');
    });
  });

  describe('calculateFreshnessScore', () => {
    it('should return 100 for single fresh segment', () => {
      const result: SegmentDetectionResult = {
        segments: [
          {
            startLine: 0,
            endLine: 10,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 10,
            boundaryType: 'session-start',
          },
        ],
        isMultiSegment: false,
        contextContinueCount: 0,
        clearCommandCount: 0,
        timeGapCount: 0,
      };

      const score = calculateFreshnessScore(result);
      expect(score).toBe(100);
    });

    it('should return lower score for context-continue segments', () => {
      const freshResult: SegmentDetectionResult = {
        segments: [
          {
            startLine: 0,
            endLine: 10,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 10,
            boundaryType: 'session-start',
          },
        ],
        isMultiSegment: false,
        contextContinueCount: 0,
        clearCommandCount: 0,
        timeGapCount: 0,
      };

      const continuedResult: SegmentDetectionResult = {
        segments: [
          {
            startLine: 0,
            endLine: 10,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 10,
            boundaryType: 'context-continue',
          },
        ],
        isMultiSegment: false,
        contextContinueCount: 1,
        clearCommandCount: 0,
        timeGapCount: 0,
      };

      const freshScore = calculateFreshnessScore(freshResult);
      const continuedScore = calculateFreshnessScore(continuedResult);

      expect(freshScore).toBeGreaterThan(continuedScore);
    });

    it('should treat time-gap segments as fresh', () => {
      const result: SegmentDetectionResult = {
        segments: [
          {
            startLine: 0,
            endLine: 5,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 5,
            boundaryType: 'session-start',
          },
          {
            startLine: 6,
            endLine: 10,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 5,
            boundaryType: 'time-gap',
          },
        ],
        isMultiSegment: true,
        contextContinueCount: 0,
        clearCommandCount: 0,
        timeGapCount: 1,
      };

      const score = calculateFreshnessScore(result);
      expect(score).toBe(100);
    });

    it('should treat clear-command segments as fresh', () => {
      const result: SegmentDetectionResult = {
        segments: [
          {
            startLine: 0,
            endLine: 5,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 5,
            boundaryType: 'session-start',
          },
          {
            startLine: 6,
            endLine: 10,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 5,
            boundaryType: 'clear-command',
          },
        ],
        isMultiSegment: true,
        contextContinueCount: 0,
        clearCommandCount: 1,
        timeGapCount: 0,
      };

      const score = calculateFreshnessScore(result);
      expect(score).toBe(100);
    });

    it('should penalize multiple context continuations', () => {
      const singleContinue: SegmentDetectionResult = {
        segments: [
          {
            startLine: 0,
            endLine: 10,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 10,
            boundaryType: 'context-continue',
          },
        ],
        isMultiSegment: false,
        contextContinueCount: 1,
        clearCommandCount: 0,
        timeGapCount: 0,
      };

      const multipleContinue: SegmentDetectionResult = {
        segments: [
          {
            startLine: 0,
            endLine: 10,
            startTime: new Date(),
            endTime: new Date(),
            messageCount: 10,
            boundaryType: 'context-continue',
          },
        ],
        isMultiSegment: false,
        contextContinueCount: 3,
        clearCommandCount: 0,
        timeGapCount: 0,
      };

      const singleScore = calculateFreshnessScore(singleContinue);
      const multipleScore = calculateFreshnessScore(multipleContinue);

      expect(singleScore).toBeGreaterThan(multipleScore);
    });

    it('should return 0 for empty segments', () => {
      const result: SegmentDetectionResult = {
        segments: [],
        isMultiSegment: false,
        contextContinueCount: 0,
        clearCommandCount: 0,
        timeGapCount: 0,
      };

      const score = calculateFreshnessScore(result);
      expect(score).toBe(0);
    });
  });
});
