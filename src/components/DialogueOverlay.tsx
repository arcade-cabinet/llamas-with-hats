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
            style={{
                position: 'absolute',
                bottom: '10%',
                left: '10%',
                right: '10%',
                backgroundColor: 'rgba(0,0,0,0.8)',
                color: 'white',
                padding: '20px',
                border: '2px solid red',
                cursor: 'pointer',
                textAlign: 'center',
                fontSize: '1.2rem',
                fontFamily: 'monospace'
            }}
        >
            <p>{text || "..."}</p>
            <small>Click anywhere to continue</small>
        </div>
    );
};
