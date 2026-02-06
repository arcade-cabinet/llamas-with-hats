import React from 'react';

interface HUDProps {
    horrorLevel: number;
}

export const HUD: React.FC<HUDProps> = ({ horrorLevel }) => {
    return (
        <div className="hud">
            <h2>Disturbing Level: {horrorLevel}</h2>
        </div>
    );
};
