import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export const alt = 'NoMoreAISlop - Self-Hosted AI Session Analysis';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPES = [
  { name: 'Architect', color: '#00d4ff' },
  { name: 'Analyst', color: '#8B5CF6' },
  { name: 'Conductor', color: '#F59E0B' },
  { name: 'Speedrunner', color: '#4ADE80' },
  { name: 'Trendsetter', color: '#FF6B9D' },
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
          background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)',
          fontFamily: 'monospace',
          padding: '56px 80px',
          position: 'relative',
        }}
      >
        {/* Cyan glow border */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            right: 20,
            bottom: 20,
            border: '2px solid #00d4ff',
            borderRadius: 20,
            opacity: 0.25,
            display: 'flex',
          }}
        />

        {/* Brand logo row: >_ NoMoreAISlop */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 28,
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 700,
              color: '#00d4ff',
            }}
          >
            {'>_'}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 700,
              color: '#ffffff',
              marginLeft: 16,
            }}
          >
            NoMoreAISlop
          </div>
        </div>

        {/* Tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: 36,
            color: '#e0e0e0',
            lineHeight: 1.4,
            marginBottom: 12,
          }}
        >
          {'Analyze AI sessions on your own server.'}
        </div>

        {/* Sub-tagline */}
        <div
          style={{
            display: 'flex',
            fontSize: 22,
            color: '#444466',
            marginBottom: 36,
          }}
        >
          {'CLI intake \u00b7 Gemini workers \u00b7 SQLite reports'}
        </div>

        {/* Spacer */}
        <div style={{ display: 'flex', flex: 1 }} />

        {/* Developer type badges */}
        <div style={{ display: 'flex', flexDirection: 'row', marginBottom: 20 }}>
          {TYPES.map((type, i) => (
            <div
              key={type.name}
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: 24,
                padding: '10px 20px',
                marginLeft: i > 0 ? 12 : 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: type.color,
                  marginRight: 10,
                }}
              />
              <div style={{ display: 'flex', fontSize: 20, color: '#cccccc' }}>{type.name}</div>
            </div>
          ))}
        </div>

        {/* URL */}
        <div
          style={{
            display: 'flex',
            fontSize: 18,
            color: '#00d4ff',
            opacity: 0.5,
          }}
        >
          github.com/nomoreaislop/nomoreaislop
        </div>
      </div>
    ),
    size
  );
}
