import React from 'react';

interface HUDProps {
    horrorLevel: number;
    currentGoal: string;
}

export const HUD: React.FC<HUDProps> = ({ horrorLevel, currentGoal }) => {
    return (
        <div className="hud">
            <h2>Disturbing Level: {horrorLevel}</h2>
            <div className="goal-container">
                <h3>CURRENT DESIRE:</h3>
                <p>{currentGoal}</p>
            </div>
        </div>
    );
};
