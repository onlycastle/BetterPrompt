import { ImageResponse } from 'next/og';

export const runtime = 'nodejs';

export const alt = 'NoMoreAISlop - See Your Anti-Patterns. Stop Making AI Slop.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const TYPES = [
  { name: 'Architect', color: '#00BCD4' },
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
          backgroundColor: '#FFFFFF',
          fontFamily: 'monospace',
          position: 'relative',
        }}
      >
        {/* Graph paper grid - horizontal lines */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            backgroundImage: 'linear-gradient(to bottom, #E8EDF5 1px, transparent 1px)',
            backgroundSize: '100% 24px',
          }}
        />
        {/* Graph paper grid - vertical lines */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            backgroundImage: 'linear-gradient(to right, #E8EDF5 1px, transparent 1px)',
            backgroundSize: '24px 100%',
          }}
        />

        {/* Left margin line (notebook style) */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 72,
            width: 2,
            display: 'flex',
            backgroundColor: 'rgba(0, 188, 212, 0.25)',
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            padding: '56px 80px 44px 100px',
            flex: 1,
            position: 'relative',
          }}
        >
          {/* Brand name */}
          <div
            style={{
              display: 'flex',
              fontSize: 58,
              fontWeight: 700,
              color: '#00BCD4',
              marginBottom: 28,
            }}
          >
            NoMoreAISlop
          </div>

          {/* Tagline */}
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              color: '#1A1A2E',
              lineHeight: 1.5,
            }}
          >
            {"AI isn\u2019t the problem."}
          </div>
          <div
            style={{
              display: 'flex',
              fontSize: 30,
              fontWeight: 600,
              color: '#1A1A2E',
              lineHeight: 1.5,
              marginBottom: 36,
            }}
          >
            Unconscious dependency is.
          </div>

          {/* Terminal CTA */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 188, 212, 0.06)',
              border: '1px solid rgba(0, 188, 212, 0.2)',
              borderRadius: 8,
              padding: '12px 28px',
            }}
          >
            <div style={{ display: 'flex', color: '#00BCD4', fontSize: 22, marginRight: 14 }}>
              {'\u25b8'}
            </div>
            <div style={{ display: 'flex', color: '#1A1A2E', fontSize: 22, fontWeight: 500 }}>
              npx no-ai-slop
            </div>
          </div>

          {/* Spacer */}
          <div style={{ display: 'flex', flex: 1 }} />

          {/* Developer types */}
          <div style={{ display: 'flex', flexDirection: 'row', marginBottom: 16 }}>
            {TYPES.map((type, i) => (
              <div
                key={type.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: 'rgba(26, 26, 46, 0.04)',
                  border: '1px solid rgba(26, 26, 46, 0.08)',
                  borderRadius: 20,
                  padding: '8px 16px',
                  marginLeft: i > 0 ? 12 : 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: type.color,
                    marginRight: 8,
                  }}
                />
                <div style={{ display: 'flex', fontSize: 14, color: '#4A4A5A' }}>{type.name}</div>
              </div>
            ))}
          </div>

          {/* URL */}
          <div style={{ display: 'flex', fontSize: 15, color: '#8A8A9A' }}>
            www.nomoreaislop.app
          </div>
        </div>
      </div>
    ),
    size
  );
}
