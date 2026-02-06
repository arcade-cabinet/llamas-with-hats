import React from 'react';

interface DialogueOverlayProps {
    active: boolean;
    text: string | null;
    onClick: () => void;
}

export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({ active, text, onClick }) => {
    if (!active) return null;

    return (
        <div
            className="dialogue-overlay"
            onClick={onClick}
        >
            <p>{text || "..."}</p>
            <small>Click anywhere to continue</small>
        </div>
    );
};
