import React from 'react';

export const LandscapeOverlay: React.FC = () => (
  <div
    className="fixed inset-0 z-[9999] flex items-center justify-center p-8"
    style={{ background: 'var(--color-void)' }}
  >
    <div className="text-center">
      {/* Rotating phone icon */}
      <div
        className="text-6xl mb-4"
        style={{
          animation: 'landscape-rotate 1.5s ease-in-out infinite',
          display: 'inline-block',
        }}
      >
        {'\u{1F4F1}'}
      </div>
      <p
        className="font-serif text-xl mb-2"
        style={{ color: 'var(--color-pumpkin)' }}
      >
        Please rotate your device
      </p>
      <p style={{ fontSize: 13, color: 'var(--color-hud-muted)' }}>
        Landscape mode provides the best experience
      </p>
    </div>
  </div>
);
