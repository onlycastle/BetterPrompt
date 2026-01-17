/**
 * Public Result Page Wrapper
 * Server component for SEO, fetches data directly from Supabase
 * Shows full preview content - login required for detailed analysis in /personal
 */

import { createClient } from '@supabase/supabase-js';
import styles from './PublicResultPage.module.css';
import { DetailButton } from './DetailButton';
import { FormattedText } from '../utils/textFormatting';

// ============================================================================
// Types
// ============================================================================

interface PatternExample {
  quote: string;
  analysis: string;
}

interface PromptPattern {
  patternName: string;
  description: string;
  frequency: string;
  examples?: PatternExample[];
  effectiveness?: string;
  tip?: string;
}

interface DimensionStrength {
  title: string;
  description: string;
  evidence?: string[];
}

interface DimensionGrowthArea {
  title: string;
  description: string;
  recommendation?: string;
  evidence?: string[];
}

interface DimensionInsight {
  dimension: string;
  dimensionDisplayName: string;
  strengths: DimensionStrength[];
  growthAreas: DimensionGrowthArea[];
}

interface ActionablePractice {
  patternId: string;
  advice: string;
  source: string;
  feedback?: string;
  tip?: string;
  dimension: string;
}

interface ActionablePractices {
  practiced: ActionablePractice[];
  opportunities: ActionablePractice[];
  summary?: string;
}

interface AntiPatternsAnalysis {
  detected: Array<{
    displayName: string;
    severity: string;
    description: string;
  }>;
  overallHealthScore?: number;
  summary?: string;
}

interface CriticalThinkingAnalysis {
  strengths: Array<{ displayName: string; description: string }>;
  opportunities: Array<{ displayName: string; description: string }>;
  overallScore?: number;
  summary?: string;
}

interface PlanningAnalysis {
  planningMaturityLevel?: string;
  strengths: Array<{ displayName: string; description: string }>;
  opportunities: Array<{ displayName: string; description: string }>;
  summary?: string;
}

interface Evaluation {
  primaryType: string;
  controlLevel?: string;
  distribution: {
    architect: number;
    scientist: number;
    collaborator: number;
    speedrunner: number;
    craftsman: number;
  };
  personalitySummary: string;
  promptPatterns?: PromptPattern[];
  dimensionInsights?: DimensionInsight[];
  actionablePractices?: ActionablePractices;
  antiPatternsAnalysis?: AntiPatternsAnalysis;
  criticalThinkingAnalysis?: CriticalThinkingAnalysis;
  planningAnalysis?: PlanningAnalysis;
}

// Dimension display names for Korean localization
const DIMENSION_DISPLAY_NAMES: Record<string, string> = {
  aiCollaboration: 'AI 협업 마스터리',
  contextEngineering: '컨텍스트 엔지니어링',
  toolMastery: '도구 활용도',
  burnoutRisk: '번아웃 리스크',
  aiControl: 'AI 제어 지수',
  skillResilience: '스킬 회복력',
};

interface ResultData {
  resultId: string;
  evaluation: Evaluation;
}

const TYPE_META: Record<string, { emoji: string; name: string; tagline: string }> = {
  architect: { emoji: '🏗️', name: 'Architect', tagline: 'Strategic thinker who plans before diving into code' },
  scientist: { emoji: '🔬', name: 'Scientist', tagline: 'Truth-seeker who always verifies AI output' },
  collaborator: { emoji: '🤝', name: 'Collaborator', tagline: 'Partnership master who finds answers through dialogue' },
  speedrunner: { emoji: '⚡', name: 'Speedrunner', tagline: 'Agile executor who delivers through fast iteration' },
  craftsman: { emoji: '🔧', name: 'Craftsman', tagline: 'Artisan who prioritizes code quality above all' },
};

async function fetchResult(resultId: string): Promise<ResultData | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
      console.error(`Missing environment variables: ${missing.join(', ')}`);
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('analysis_results')
      .select('evaluation')
      .eq('result_id', resultId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      resultId,
      evaluation: data.evaluation as Evaluation,
    };
  } catch (error) {
    console.error('Error fetching result:', error);
    return null;
  }
}

interface PublicResultPageWrapperProps {
  resultId: string;
}

export async function PublicResultPageWrapper({ resultId }: PublicResultPageWrapperProps) {
  const data = await fetchResult(resultId);

  if (!data) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <div className={styles.errorIcon}>🔍</div>
          <h1>Result Not Found</h1>
          <p>This analysis result may have expired or doesn't exist.</p>
          <a href="https://npmjs.com/package/no-ai-slop" className={styles.ctaButton}>
            Try no-ai-slop yourself
          </a>
        </div>
      </div>
    );
  }

  const { evaluation } = data;
  const typeMeta = TYPE_META[evaluation.primaryType] || TYPE_META.collaborator;

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.typeEmoji}>{typeMeta.emoji}</div>
        <h1 className={styles.typeName}>{typeMeta.name}</h1>
        <p className={styles.typeTagline}>{typeMeta.tagline}</p>
      </div>

      {/* Distribution */}
      <div className={styles.card}>
        <h2>Type Distribution</h2>
        <div className={styles.distribution}>
          {Object.entries(evaluation.distribution).map(([type, percentage]) => {
            const meta = TYPE_META[type];
            const isMain = type === evaluation.primaryType;
            return (
              <div key={type} className={`${styles.barRow} ${isMain ? styles.primary : ''}`}>
                <div className={styles.barLabel}>
                  <span>{meta.emoji}</span>
                  <span>{meta.name}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className={styles.barValue}>{Math.round(percentage)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className={styles.card}>
        <h2>Your AI Collaboration Style</h2>
        <FormattedText text={evaluation.personalitySummary} as="p" className={styles.summary} />
      </div>

      {/* Prompt Patterns - Show 3 patterns with 1 quote each (FREE tier) */}
      {evaluation.promptPatterns && evaluation.promptPatterns.length > 0 && (
        <div className={styles.card}>
          <h2>프롬프트 패턴 분석</h2>
          <div className={styles.contentCounter}>
            <span className={styles.contentCounterIcon}>💬</span>
            <span>{evaluation.promptPatterns.length}개 패턴 중 3개 표시 · 패턴당 1개 예시만</span>
          </div>
          <div className={styles.patterns}>
            {/* Show first 3 patterns with 1 quote each */}
            {evaluation.promptPatterns.slice(0, 3).map((pattern, idx) => (
              <div key={idx} className={styles.patternItem}>
                <h3>{pattern.patternName}</h3>
                <p>{pattern.description}</p>
                <span className={styles.frequency}>{pattern.frequency}</span>
                {/* Show only first quote */}
                {pattern.examples && pattern.examples.length > 0 && (
                  <div className={styles.examples}>
                    <blockquote className={styles.quoteBlock}>
                      <p className={styles.quoteText}>"{pattern.examples[0].quote}"</p>
                      <cite className={styles.quoteAnalysis}>{pattern.examples[0].analysis}</cite>
                    </blockquote>
                    {/* Show blurred teaser for remaining quotes */}
                    {pattern.examples.length > 1 && (
                      <div className={styles.blurredTeaser}>
                        <div className={styles.blurredDimensions}>
                          <div className={styles.blurredDimensionItem}>
                            추가 예시 {pattern.examples.length - 1}개
                          </div>
                        </div>
                        <div className={styles.teaserOverlay}>
                          <span className={styles.lockIcon}>🔒</span>
                          <span>더 많은 예시 보기</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
            {/* Show teaser for remaining patterns */}
            {evaluation.promptPatterns.length > 3 && (
              <div className={styles.blurredTeaser}>
                <div className={styles.blurredDimensions}>
                  {evaluation.promptPatterns.slice(3, 6).map((p, idx) => (
                    <div key={idx} className={styles.blurredDimensionItem}>
                      {p.patternName}
                    </div>
                  ))}
                </div>
                <div className={styles.teaserOverlay}>
                  <span className={styles.lockIcon}>🔒</span>
                  <span>+{evaluation.promptPatterns.length - 3}개 패턴 분석</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Dimension Insights - Show ALL 6 dimensions with first strength only (FREE tier) */}
      {evaluation.dimensionInsights && evaluation.dimensionInsights.length > 0 && (
        <div className={styles.card}>
          <h2>6개 차원 심층 분석</h2>
          <div className={styles.contentCounter}>
            <span className={styles.contentCounterIcon}>📊</span>
            <span>차원당 첫 번째 강점만 표시 중 · 전체 인사이트 보기 →</span>
          </div>
          <div className={styles.dimensionGrid}>
            {/* Show ALL 6 dimensions but only first strength */}
            {evaluation.dimensionInsights.map((insight, idx) => {
              const totalStrengths = insight.strengths?.length || 0;
              const totalGrowth = insight.growthAreas?.length || 0;
              const hiddenCount = Math.max(0, totalStrengths - 1) + totalGrowth;

              return (
                <div key={idx} className={styles.dimensionCard}>
                  <h3 className={styles.dimensionTitle}>
                    {insight.dimensionDisplayName || DIMENSION_DISPLAY_NAMES[insight.dimension] || insight.dimension}
                  </h3>
                  {insight.strengths && insight.strengths.length > 0 && (
                    <div className={styles.strengthsList}>
                      {/* Show only first strength */}
                      <div className={styles.strengthItem}>
                        <strong>{insight.strengths[0].title}</strong>
                        <p>{insight.strengths[0].description}</p>
                      </div>
                      {/* Show teaser if more content exists */}
                      {hiddenCount > 0 && (
                        <div className={styles.blurredTeaser}>
                          <div className={styles.blurredDimensions}>
                            {insight.strengths.slice(1, 3).map((s, sIdx) => (
                              <div key={sIdx} className={styles.blurredDimensionItem}>
                                {s.title}
                              </div>
                            ))}
                          </div>
                          <div className={styles.teaserOverlay}>
                            <span className={styles.lockIcon}>🔒</span>
                            <span>+{hiddenCount}개 인사이트</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Actionable Practices - Source teaser */}
      {evaluation.actionablePractices && (
        <div className={styles.card}>
          <h2>전문가 패턴 매칭</h2>
          <div className={styles.expertTeaser}>
            {evaluation.actionablePractices.practiced && evaluation.actionablePractices.practiced.length > 0 && (
              <div className={styles.expertSources}>
                <p className={styles.expertLabel}>당신이 실천 중인 전문가 패턴:</p>
                <div className={styles.sourceList}>
                  {[...new Set(evaluation.actionablePractices.practiced.map(p => p.source))].slice(0, 3).map((source, idx) => (
                    <span key={idx} className={styles.sourceBadge}>{source}</span>
                  ))}
                </div>
              </div>
            )}
            <div className={styles.blurredPractices}>
              <div className={styles.practicePreview}>
                {evaluation.actionablePractices.practiced?.slice(0, 2).map((practice, idx) => (
                  <div key={idx} className={styles.blurredPracticeItem}>
                    <span className={styles.practiceAdvice}>{practice.advice.slice(0, 50)}...</span>
                  </div>
                ))}
              </div>
              <div className={styles.teaserOverlay}>
                <span className={styles.lockIcon}>🔒</span>
                <span>상세 피드백 보기</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Anti-Pattern Teaser - "X개의 위험 신호 발견" (개수만 표시) */}
      {evaluation.antiPatternsAnalysis && evaluation.antiPatternsAnalysis.detected && evaluation.antiPatternsAnalysis.detected.length > 0 && (
        <div className={styles.card}>
          <h2>위험 신호 분석</h2>
          <div className={styles.antiPatternTeaser}>
            <div className={styles.antiPatternAlert}>
              <span className={styles.antiPatternIcon}>⚠️</span>
              <span className={styles.antiPatternCount}>
                {evaluation.antiPatternsAnalysis.detected.length}개의 주의가 필요한 패턴이 발견되었습니다
              </span>
            </div>
            <div className={styles.antiPatternBlurredArea}>
              <div className={styles.antiPatternBlurredLines}>
                <div className={styles.antiPatternBlurredLine} />
                <div className={styles.antiPatternBlurredLine} />
                <div className={styles.antiPatternBlurredLine} />
              </div>
            </div>
            <div className={styles.antiPatternCta}>
              <span className={styles.lockIcon}>🔒</span>
              <span>프리미엄에서 상세 분석 확인하기</span>
            </div>
          </div>
        </div>
      )}

      {/* Growth Roadmap Teaser */}
      <div className={styles.card}>
        <div className={styles.roadmapTeaser}>
          <div className={styles.roadmapTeaserIcon}>🗺️</div>
          <div className={styles.roadmapTeaserTitle}>맞춤 성장 로드맵이 생성되었습니다</div>
          <div className={styles.roadmapTeaserSubtitle}>
            당신의 강점과 성장 영역에 기반한 3단계 발전 계획
          </div>
          <div className={styles.roadmapStepsPreview}>
            <div className={styles.roadmapStepDot} />
            <div className={styles.roadmapStepDot} />
            <div className={styles.roadmapStepDot} />
          </div>
          <div className={styles.antiPatternCta}>
            <span className={styles.lockIcon}>🔒</span>
            <span>로드맵 확인하기</span>
          </div>
        </div>
      </div>

      {/* Score Teaser */}
      {(evaluation.antiPatternsAnalysis || evaluation.criticalThinkingAnalysis || evaluation.planningAnalysis) && (
        <div className={styles.card}>
          <h2>당신의 점수는?</h2>
          <div className={styles.scoreTeaser}>
            {evaluation.antiPatternsAnalysis?.overallHealthScore !== undefined && (
              <div className={styles.scoreItem}>
                <span className={styles.scoreLabel}>코드 건강도</span>
                <span className={styles.scoreValue}>
                  <span className={styles.blurredScore}>??</span>/100
                </span>
              </div>
            )}
            {evaluation.criticalThinkingAnalysis?.overallScore !== undefined && (
              <div className={styles.scoreItem}>
                <span className={styles.scoreLabel}>비판적 사고</span>
                <span className={styles.scoreValue}>
                  <span className={styles.blurredScore}>??</span>/100
                </span>
              </div>
            )}
            {evaluation.planningAnalysis?.planningMaturityLevel && (
              <div className={styles.scoreItem}>
                <span className={styles.scoreLabel}>계획 수립 수준</span>
                <span className={styles.scoreValue}>
                  <span className={styles.blurredScore}>???</span>
                </span>
              </div>
            )}
            <div className={styles.teaserNote}>
              <span className={styles.lockIcon}>🔒</span>
              <span>로그인하고 점수 확인하기</span>
            </div>
          </div>
        </div>
      )}

      {/* Detail Button - Login and go to /personal for detailed analysis */}
      <DetailButton resultId={resultId} />
    </div>
  );
}
