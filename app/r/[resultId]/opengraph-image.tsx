import { ImageResponse } from 'next/og';
import { getSupabase } from '@/lib/supabase';
import type { TypeResult } from '@/lib/models/coding-style';

export const runtime = 'nodejs';

export const alt = 'AI Builder Profile | BetterPrompt';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPE_INFO: Record<string, { emoji: string; name: string; color: string }> = {
  architect: { emoji: '🏗️', name: 'Architect', color: '#00d4ff' },
  analyst: { emoji: '🔬', name: 'Analyst', color: '#8B5CF6' },
  conductor: { emoji: '🎼', name: 'Conductor', color: '#F59E0B' },
  speedrunner: { emoji: '⚡', name: 'Speedrunner', color: '#ffff00' },
  trendsetter: { emoji: '🚀', name: 'Trendsetter', color: '#06B6D4' },
};

/** Domain score display config for OG image */
const DOMAIN_BARS: { key: string; label: string; color: string }[] = [
  { key: 'thinkingQuality', label: 'Thinking', color: '#00d4ff' },
  { key: 'communicationPatterns', label: 'Communication', color: '#8B5CF6' },
  { key: 'learningBehavior', label: 'Learning', color: '#4ADE80' },
  { key: 'contextEfficiency', label: 'Context', color: '#F59E0B' },
];

interface DomainScores {
  [key: string]: { domainScore?: number } | undefined;
}

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
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
        fontFamily: 'monospace',
      }}
    >
      <div style={{ fontSize: 64, fontWeight: 700, color: '#00d4ff', marginBottom: 16 }}>
        BetterPrompt
      </div>
      <div style={{ fontSize: 28, color: '#888888', marginBottom: 40 }}>
        AI Builder Profile
      </div>
      <div style={{ fontSize: 20, color: '#00d4ff', opacity: 0.7 }}>www.betterprompt.sh</div>
    </div>
  );
}

export default async function Image({ params }: { params: { resultId: string } }) {
  let typeResult: TypeResult | null = null;
  let domainScores: DomainScores | null = null;

  try {
    const supabase = getSupabase();

    // Fetch type_result from shared_reports
    const { data: reportData } = await supabase
      .from('shared_reports')
      .select('type_result, result_id')
      .eq('report_id', params.resultId)
      .eq('is_active', true)
      .single();

    if (reportData?.type_result) {
      typeResult = reportData.type_result as TypeResult;
    }

    // Try to fetch domain scores from analysis_results
    if (reportData?.result_id) {
      const { data: analysisData } = await supabase
        .from('analysis_results')
        .select('evaluation')
        .eq('id', reportData.result_id)
        .single();

      if (analysisData?.evaluation) {
        const eval_ = analysisData.evaluation as { workerInsights?: DomainScores };
        domainScores = eval_.workerInsights ?? null;
      }
    }
  } catch {
    // Fallback to generic image for social crawlers
  }

  if (!typeResult) {
    return new ImageResponse(<GenericImage />, size);
  }

  const typeInfo = TYPE_INFO[typeResult.primaryType] || TYPE_INFO.architect;
  const percentage = Math.round(typeResult.distribution[typeResult.primaryType] || 0);

  // Extract scores for domain bars
  const scores = DOMAIN_BARS.map(bar => ({
    ...bar,
    score: domainScores?.[bar.key]?.domainScore ?? null,
  }));
  const hasScores = scores.some(s => s.score !== null);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'row',
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
          fontFamily: 'monospace',
          padding: 40,
        }}
      >
        {/* Border glow effect */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: `2px solid ${typeInfo.color}`,
            borderRadius: 20,
            opacity: 0.3,
          }}
        />

        {/* Left side: Type info */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div style={{ fontSize: 20, color: '#666666', marginBottom: 24, letterSpacing: 2 }}>
            YOUR AI BUILDER PROFILE
          </div>

          <div style={{ fontSize: 72, marginBottom: 8 }}>{typeInfo.emoji}</div>

          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: typeInfo.color,
              marginBottom: 8,
            }}
          >
            {typeInfo.name.toUpperCase()}
          </div>

          <div style={{ fontSize: 24, color: '#666666', marginBottom: 32 }}>
            {percentage}% match
          </div>

          <div style={{ fontSize: 16, color: '#00d4ff', opacity: 0.6 }}>www.betterprompt.sh</div>
        </div>

        {/* Right side: Domain scores (if available) */}
        {hasScores && (
          <div
            style={{
              width: 400,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 20,
              paddingLeft: 40,
              borderLeft: '1px solid rgba(255,255,255,0.1)',
            }}
          >
            <div style={{ fontSize: 16, color: '#888888', marginBottom: 8, letterSpacing: 1 }}>
              DIMENSION SCORES
            </div>
            {scores.map((s) => (
              <div key={s.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 14, color: '#aaaaaa' }}>{s.label}</span>
                  <span style={{ fontSize: 14, color: s.color, fontWeight: 600 }}>
                    {s.score !== null ? Math.round(s.score) : '—'}
                  </span>
                </div>
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 4,
                    overflow: 'hidden',
                    display: 'flex',
                  }}
                >
                  {s.score !== null && (
                    <div
                      style={{
                        width: `${Math.max(s.score, 3)}%`,
                        height: '100%',
                        background: s.color,
                        borderRadius: 4,
                        opacity: 0.8,
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    ),
    size
  );
}
