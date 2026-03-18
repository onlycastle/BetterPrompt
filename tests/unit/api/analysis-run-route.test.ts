import { describe, expect, it } from 'vitest';
import { POST } from '../../../app/api/analysis/run/route.js';

describe('analysis run route', () => {
  it('returns 410 with plugin migration guidance after cutover', async () => {
    const response = await POST();
    const body = await response.json();

    expect(response.status).toBe(410);
    expect(body.error).toBe('ANALYSIS_ROUTE_REMOVED');
    expect(body.message).toContain('Claude Code plugin');
    expect(body.message).toContain('/api/analysis/sync');
  });
});
