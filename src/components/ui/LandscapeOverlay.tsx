import React from 'react';

export const LandscapeOverlay: React.FC = () => (
  <div className="fixed inset-0 z-[9999] bg-shadow flex items-center justify-center p-8">
    <div className="text-center">
      <div className="text-6xl mb-4 animate-bounce">{'\u{1F4F1}'}</div>
      <p className="text-wood text-xl font-serif">
        Please rotate your device to landscape mode
      </p>
      <p className="text-gray-500 text-sm mt-2">
        For the best gameplay experience
      </p>
    </div>
  </div>
);
