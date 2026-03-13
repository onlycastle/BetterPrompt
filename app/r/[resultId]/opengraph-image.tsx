import { ImageResponse } from 'next/og';
import { getAnalysisRecord } from '@/lib/local/analysis-store';
import { TYPE_METADATA, type CodingStyleType } from '@/lib/models/coding-style';

export const runtime = 'nodejs';

export const alt = 'BetterPrompt Report';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const DOMAIN_BARS: Array<{ key: string; label: string; color: string }> = [
  { key: 'thinkingQuality', label: 'Thinking', color: '#1d4ed8' },
  { key: 'communicationPatterns', label: 'Communication', color: '#0f766e' },
  { key: 'learningBehavior', label: 'Learning', color: '#b45309' },
  { key: 'contextEfficiency', label: 'Context', color: '#7c3aed' },
];

type DomainScores = Record<string, { domainScore?: number } | undefined>;

function GenericImage() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f7f3e8 0%, #e6eef8 100%)',
        color: '#0f172a',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontSize: 56, fontWeight: 700, marginBottom: 16 }}>
        BetterPrompt
      </div>
      <div style={{ fontSize: 24, opacity: 0.8 }}>
        Self-hosted AI collaboration report
      </div>
    </div>
  );
}

export default async function Image({
  params,
}: {
  params: Promise<{ resultId: string }>;
}) {
  const { resultId } = await params;
  const result = getAnalysisRecord(resultId);

  if (!result?.evaluation?.primaryType) {
    return new ImageResponse(<GenericImage />, size);
  }

  const primaryType = result.evaluation.primaryType as CodingStyleType;
  const typeMeta = TYPE_METADATA[primaryType];
  const percentage = Math.round(result.evaluation.distribution?.[primaryType] ?? 0);
  const domainScores = (result.evaluation.workerInsights ?? {}) as DomainScores;
  const scores = DOMAIN_BARS.map((bar) => ({
    ...bar,
    score: domainScores[bar.key]?.domainScore ?? null,
  }));

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'linear-gradient(135deg, #f7f3e8 0%, #e6eef8 100%)',
          color: '#0f172a',
          fontFamily: 'monospace',
          padding: 40,
          gap: 32,
        }}
      >
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            border: '2px solid rgba(15, 23, 42, 0.15)',
            borderRadius: 24,
            padding: 32,
            background: 'rgba(255,255,255,0.6)',
          }}
        >
          <div style={{ fontSize: 18, letterSpacing: 2, opacity: 0.7 }}>
            SELF-HOSTED REPORT
          </div>
          <div style={{ fontSize: 72, marginTop: 24 }}>
            {typeMeta.emoji}
          </div>
          <div style={{ fontSize: 44, fontWeight: 700, marginTop: 16 }}>
            {typeMeta.name}
          </div>
          <div style={{ fontSize: 22, marginTop: 12, opacity: 0.8 }}>
            {percentage}% match
          </div>
          <div style={{ fontSize: 20, marginTop: 20 }}>
            {typeMeta.tagline}
          </div>
          <div style={{ fontSize: 18, marginTop: 36, opacity: 0.75 }}>
            betterprompt
          </div>
        </div>

        <div
          style={{
            width: 420,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            gap: 18,
            borderRadius: 24,
            padding: 32,
            background: 'rgba(255,255,255,0.72)',
            border: '2px solid rgba(15, 23, 42, 0.1)',
          }}
        >
          <div style={{ fontSize: 18, letterSpacing: 2, opacity: 0.7 }}>
            DIMENSION SCORES
          </div>
          {scores.map((score) => (
            <div key={score.key} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18 }}>
                <span>{score.label}</span>
                <span>{score.score !== null ? Math.round(score.score) : '-'}</span>
              </div>
              <div
                style={{
                  width: '100%',
                  height: 10,
                  borderRadius: 999,
                  background: 'rgba(15, 23, 42, 0.08)',
                  overflow: 'hidden',
                }}
              >
                {score.score !== null && (
                  <div
                    style={{
                      width: `${Math.max(score.score, 3)}%`,
                      height: '100%',
                      borderRadius: 999,
                      background: score.color,
                    }}
                  />
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
