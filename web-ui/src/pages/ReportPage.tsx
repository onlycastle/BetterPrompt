/**
 * Report Page
 *
 * Displays coding style analysis results from a shared report link.
 * This is a basic implementation - full features to be added later.
 */

import { useParams } from 'react-router-dom';
import { useReport } from '../hooks';
import { REPORT_TYPE_METADATA } from '../types/report';

export function ReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { data, isLoading, error } = useReport(reportId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading report...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="text-6xl mb-4">😔</div>
          <h1 className="text-2xl font-bold mb-2">Report Not Found</h1>
          <p className="text-gray-600">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { typeResult, dimensions, stats } = data;
  const typeInfo = REPORT_TYPE_METADATA[typeResult.primaryType];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <div className="text-8xl mb-4">{typeInfo.emoji}</div>
        <h1 className="text-4xl font-bold mb-2">{typeInfo.name}</h1>
        <p className="text-xl text-gray-600 mb-4">{typeInfo.tagline}</p>
        <p className="text-sm text-gray-500">
          Based on {typeResult.sessionCount} sessions | Viewed {stats.viewCount} times
        </p>
      </div>

      {/* Description */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Your Coding Style</h2>
        <p className="text-gray-700 mb-6">{typeInfo.description}</p>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Strengths */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-green-700">Strengths</h3>
            <ul className="space-y-2">
              {typeInfo.strengths.map((strength, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-green-500 mr-2">✓</span>
                  <span className="text-gray-700">{strength}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Growth Points */}
          <div>
            <h3 className="text-lg font-semibold mb-3 text-blue-700">Growth Areas</h3>
            <ul className="space-y-2">
              {typeInfo.growthPoints.map((point, i) => (
                <li key={i} className="flex items-start">
                  <span className="text-blue-500 mr-2">→</span>
                  <span className="text-gray-700">{point}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Type Distribution */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">Type Distribution</h2>
        <div className="space-y-3">
          {Object.entries(typeResult.distribution).map(([type, percentage]) => {
            const meta = REPORT_TYPE_METADATA[type as keyof typeof REPORT_TYPE_METADATA];
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">
                    {meta.emoji} {meta.name}
                  </span>
                  <span className="text-gray-600">{Math.round(percentage)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dimensions (if unlocked) */}
      {dimensions && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-bold mb-4">Deep Analysis (Unlocked)</h2>
          <p className="text-gray-600 mb-4">
            Full dimension analysis coming soon! This includes AI Collaboration, Context
            Engineering, Burnout Risk, Tool Mastery, AI Control, and Skill Resilience scores.
          </p>
          <div className="grid md:grid-cols-3 gap-4">
            {[
              { key: 'aiCollaboration', emoji: '🤝', label: 'AI Collaboration' },
              { key: 'contextEngineering', emoji: '🎯', label: 'Context Engineering' },
              { key: 'burnoutRisk', emoji: '🔥', label: 'Burnout Risk' },
            ].map(({ key, emoji, label }) => (
              <div key={key} className="bg-gray-50 p-4 rounded">
                <div className="text-2xl mb-2">{emoji}</div>
                <div className="font-semibold">{label}</div>
                <div className="text-sm text-gray-600">
                  {dimensions[key as keyof typeof dimensions]?.level ?? 'N/A'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share Section */}
      <div className="text-center">
        <button
          onClick={() => {
            navigator.clipboard.writeText(window.location.href).catch(() => {
              // Fallback: do nothing on failure, user can manually copy URL
            });
          }}
          className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-6 rounded-lg transition"
        >
          📋 Copy Share Link
        </button>
      </div>
    </div>
  );
}
