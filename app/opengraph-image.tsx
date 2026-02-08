import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export const alt = 'NoMoreAISlop - AI Coding Style Analysis';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPES = [
  { emoji: '🏗️', name: 'Architect', color: '#00d4ff' },
  { emoji: '🔬', name: 'Analyst', color: '#8B5CF6' },
  { emoji: '🎼', name: 'Conductor', color: '#F59E0B' },
  { emoji: '⚡', name: 'Speedrunner', color: '#ffff00' },
  { emoji: '🚀', name: 'Trendsetter', color: '#06B6D4' },
];

export default function Image() {
  return new ImageResponse(
    (
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
        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 700,
            color: '#00d4ff',
            marginBottom: 16,
          }}
        >
          NoMoreAISlop
        </div>

        {/* Tagline */}
        <div
          style={{
            fontSize: 28,
            color: '#888888',
            marginBottom: 60,
          }}
        >
          Discover Your AI Coding Style
        </div>

        {/* Type icons row */}
        <div
          style={{
            display: 'flex',
            gap: 48,
            marginBottom: 60,
          }}
        >
          {TYPES.map((type) => (
            <div
              key={type.name}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <div style={{ fontSize: 40 }}>{type.emoji}</div>
              <div style={{ fontSize: 16, color: type.color }}>{type.name}</div>
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            fontSize: 20,
            color: '#00d4ff',
            opacity: 0.7,
          }}
        >
          www.nomoreaislop.app
        </div>
      </div>
    ),
    size
  );
}
