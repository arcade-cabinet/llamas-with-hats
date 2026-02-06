import React from 'react';

interface HUDProps {
    horrorLevel: number;
}

export const HUD: React.FC<HUDProps> = ({ horrorLevel }) => {
    return (
        <div style={{
            position: 'absolute',
            top: 20,
            left: 20,
            color: 'white',
            fontFamily: 'monospace',
            backgroundColor: 'rgba(0,0,0,0.5)',
            padding: '10px',
            pointerEvents: 'none'
        }}>
            <h2>Disturbing Level: {horrorLevel}</h2>
        </div>
    );
};
