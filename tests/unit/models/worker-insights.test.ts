/**
 * Tests for worker-insights.ts parsing functions
 *
 * Focuses on evidence deduplication logic to ensure duplicate quotes
 * are filtered within each strength/growth area item.
 */

import {
  parseStructuredEvidence,
  parseWorkerStrengthsData,
  parseWorkerGrowthAreasData,
  parseStructuredStrengths,
  parseStructuredGrowthAreas,
  StructuredEvidenceLLM,
  StructuredStrengthLLM,
  StructuredGrowthLLM,
} from '../../../src/lib/models/worker-insights';

describe('parseStructuredEvidence', () => {
  it('should filter out duplicate quotes (same text, different utteranceIds)', () => {
    const input: StructuredEvidenceLLM[] = [
      { utteranceId: 'session_0', quote: 'This is a duplicate quote example' },
      { utteranceId: 'session_96', quote: 'This is a duplicate quote example' },
      { utteranceId: 'session_204', quote: 'This is a duplicate quote example' },
    ];

    const result = parseStructuredEvidence(input);

    expect(result).toHaveLength(1);
    expect(result[0].utteranceId).toBe('session_0'); // First one kept
    expect(result[0].quote).toBe('This is a duplicate quote example');
  });

  it('should deduplicate case-insensitively', () => {
    const input: StructuredEvidenceLLM[] = [
      { utteranceId: 'session_1', quote: 'Hello World Example Quote' },
      { utteranceId: 'session_2', quote: 'hello world example quote' },
      { utteranceId: 'session_3', quote: 'HELLO WORLD EXAMPLE QUOTE' },
    ];

    const result = parseStructuredEvidence(input);

    expect(result).toHaveLength(1);
    expect(result[0].utteranceId).toBe('session_1');
  });

  it('should deduplicate after trimming whitespace', () => {
    const input: StructuredEvidenceLLM[] = [
      { utteranceId: 'session_1', quote: 'Quote with spaces around it' },
      { utteranceId: 'session_2', quote: '  Quote with spaces around it  ' },
    ];

    const result = parseStructuredEvidence(input);

    expect(result).toHaveLength(1);
  });

  it('should keep unique quotes', () => {
    const input: StructuredEvidenceLLM[] = [
      { utteranceId: 'session_1', quote: 'First unique quote here' },
      { utteranceId: 'session_2', quote: 'Second unique quote here' },
      { utteranceId: 'session_3', quote: 'Third unique quote here' },
    ];

    const result = parseStructuredEvidence(input);

    expect(result).toHaveLength(3);
  });

  it('should still filter invalid utteranceIds', () => {
    const input: StructuredEvidenceLLM[] = [
      { utteranceId: 'invalid', quote: 'This has invalid utteranceId' },
      { utteranceId: 'session_1', quote: 'This is valid with good ID' },
    ];

    const result = parseStructuredEvidence(input);

    expect(result).toHaveLength(1);
    expect(result[0].utteranceId).toBe('session_1');
  });

  it('should still filter short quotes', () => {
    const input: StructuredEvidenceLLM[] = [
      { utteranceId: 'session_1', quote: 'too short' },
      { utteranceId: 'session_2', quote: 'This is long enough to pass' },
    ];

    const result = parseStructuredEvidence(input);

    expect(result).toHaveLength(1);
    expect(result[0].quote).toBe('This is long enough to pass');
  });
});

describe('parseStructuredStrengths', () => {
  it('should deduplicate evidence within each strength', () => {
    const input: StructuredStrengthLLM[] = [
      {
        title: 'Good Planning',
        description: 'Developer shows consistent planning behavior.',
        evidence: [
          { utteranceId: 'session_0', quote: 'Let me plan this out first' },
          { utteranceId: 'session_50', quote: 'Let me plan this out first' },
          { utteranceId: 'session_100', quote: 'Different quote about planning' },
        ],
      },
    ];

    const result = parseStructuredStrengths(input);

    expect(result).toHaveLength(1);
    expect(result[0].evidence).toHaveLength(2); // Duplicate filtered
  });

  it('should allow same quote across different strengths', () => {
    const input: StructuredStrengthLLM[] = [
      {
        title: 'Strength One',
        description: 'First strength description here.',
        evidence: [
          { utteranceId: 'session_1', quote: 'This quote appears in both strengths' },
        ],
      },
      {
        title: 'Strength Two',
        description: 'Second strength description here.',
        evidence: [
          { utteranceId: 'session_2', quote: 'This quote appears in both strengths' },
        ],
      },
    ];

    const result = parseStructuredStrengths(input);

    expect(result).toHaveLength(2);
    expect(result[0].evidence).toHaveLength(1);
    expect(result[1].evidence).toHaveLength(1);
  });
});

describe('parseStructuredGrowthAreas', () => {
  it('should deduplicate evidence within each growth area', () => {
    const input: StructuredGrowthLLM[] = [
      {
        title: 'Error Loop Pattern',
        description: 'Developer tends to retry without changing approach.',
        evidence: [
          { utteranceId: 'session_0', quote: 'Fix it again please fix it now' },
          { utteranceId: 'session_96', quote: 'Fix it again please fix it now' },
          { utteranceId: 'session_204', quote: 'Fix it again please fix it now' },
        ],
        recommendation: 'Try pausing and analyzing the error first.',
        severity: 'high',
      },
    ];

    const result = parseStructuredGrowthAreas(input);

    expect(result).toHaveLength(1);
    expect(result[0].evidence).toHaveLength(1); // All duplicates filtered
  });

  it('should allow same quote across different growth areas', () => {
    const input: StructuredGrowthLLM[] = [
      {
        title: 'Growth Area One',
        description: 'First growth area description here.',
        evidence: [
          { utteranceId: 'session_1', quote: 'Shared evidence across growth areas' },
        ],
        recommendation: 'Recommendation for area one.',
      },
      {
        title: 'Growth Area Two',
        description: 'Second growth area description here.',
        evidence: [
          { utteranceId: 'session_2', quote: 'Shared evidence across growth areas' },
        ],
        recommendation: 'Recommendation for area two.',
      },
    ];

    const result = parseStructuredGrowthAreas(input);

    expect(result).toHaveLength(2);
    expect(result[0].evidence).toHaveLength(1);
    expect(result[1].evidence).toHaveLength(1);
  });
});

describe('parseWorkerStrengthsData (legacy)', () => {
  it('should deduplicate evidence within each strength', () => {
    // Legacy format: title|description|evidence1,evidence2|frequency
    const data =
      'Good Planning|Developer plans well|session_0:Let me plan out first,session_50:Let me plan out first,session_100:Different quote here|75';

    const result = parseWorkerStrengthsData(data);

    expect(result).toHaveLength(1);
    expect(result[0].evidence).toHaveLength(2); // Duplicate filtered
  });
});

describe('parseWorkerGrowthAreasData (legacy)', () => {
  it('should deduplicate evidence within each growth area', () => {
    // Legacy format: title|description|evidence1,evidence2|recommendation|severity
    const data =
      'Error Loop|Tends to retry|session_0:Fix it fix it please,session_50:Fix it fix it please|Try analyzing first|high';

    const result = parseWorkerGrowthAreasData(data);

    expect(result).toHaveLength(1);
    expect(result[0].evidence).toHaveLength(1); // Duplicate filtered
  });
});
