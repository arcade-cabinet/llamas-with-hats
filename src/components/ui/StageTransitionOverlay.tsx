import React from 'react';

interface StageTransitionOverlayProps {
  stageName: string;
  stageDescription?: string;
  onDismiss: () => void;
}

export const StageTransitionOverlay: React.FC<StageTransitionOverlayProps> = ({
  stageName, stageDescription, onDismiss,
}) => (
  <div className="fixed inset-0 z-[90] bg-black/90 flex items-center justify-center p-8">
    <div className="text-center max-w-lg">
      <p className="text-gray-500 text-sm uppercase tracking-widest mb-2">
        Stage Complete
      </p>
      <h1 className="text-3xl md:text-5xl font-serif text-wood mb-4">
        {stageName}
      </h1>
      {stageDescription && (
        <p className="text-gray-400 mb-6 font-serif italic leading-relaxed">
          {stageDescription}
        </p>
      )}
      <div className="border-t border-wood/20 my-6" />
      <button
        onClick={onDismiss}
        className="px-8 py-3 bg-wood/20 hover:bg-wood/40 text-wood border border-wood/50 rounded-lg font-serif transition-colors"
      >
        Continue
      </button>
    </div>
  </div>
);
