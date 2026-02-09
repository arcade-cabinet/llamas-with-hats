import React from 'react';

interface RadialHealthGaugeProps {
  health: number;
  maxHealth: number;
  label?: string;
  size?: number;
  className?: string;
}

const RADIUS = 38;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function getHealthColor(percent: number): string {
  if (percent > 60) return '#22c55e';
  if (percent > 30) return '#f5810c';
  if (percent > 15) return '#f43f5e';
  return '#ff0000';
}

export const RadialHealthGauge: React.FC<RadialHealthGaugeProps> = ({
  health,
  maxHealth,
  label,
  size = 72,
  className,
}) => {
  const healthPercent = maxHealth > 0 ? Math.max(0, Math.min(100, (health / maxHealth) * 100)) : 0;
  const strokeOffset = CIRCUMFERENCE - (healthPercent / 100) * CIRCUMFERENCE;
  const arcColor = getHealthColor(healthPercent);
  const isCritical = healthPercent <= 15;

  /* Unique filter ID per instance avoids collisions when multiple gauges render */
  const filterId = React.useId().replace(/:/g, '_');
  const glowId = `glow${filterId}`;

  return (
    <div
      className={className}
      style={{ width: size, height: size, position: 'relative' }}
    >
      <svg
        viewBox="0 0 100 100"
        width={size}
        height={size}
        style={{ transform: 'rotate(-90deg)' }}
      >
        <defs>
          <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow
              dx="0"
              dy="0"
              stdDeviation={isCritical ? undefined : '2.5'}
              floodColor={arcColor}
              floodOpacity="0.7"
            />
          </filter>

          {isCritical && (
            <filter id={`${glowId}-pulse`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow
                dx="0"
                dy="0"
                stdDeviation="2.5"
                floodColor={arcColor}
                floodOpacity="0.7"
              >
                <animate
                  attributeName="stdDeviation"
                  values="2;5;2"
                  dur="1.2s"
                  repeatCount="indefinite"
                />
              </feDropShadow>
            </filter>
          )}
        </defs>

        {/* Background segmented track */}
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="8"
          strokeDasharray="6 8"
        />

        {/* Foreground health arc */}
        <circle
          cx="50"
          cy="50"
          r={RADIUS}
          fill="none"
          stroke={arcColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={`${CIRCUMFERENCE} ${CIRCUMFERENCE}`}
          strokeDashoffset={strokeOffset}
          filter={`url(#${isCritical ? `${glowId}-pulse` : glowId})`}
          style={{
            transition: 'stroke-dashoffset 0.4s ease-out, stroke 0.3s ease',
          }}
        />
      </svg>

      {/* Center text overlay (not rotated) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <span
          style={{
            fontSize: 20,
            fontWeight: 700,
            lineHeight: 1,
            color: '#ffffff',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {Math.round(health)}
        </span>
        {label && (
          <span
            style={{
              fontSize: 7,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'rgba(255,255,255,0.4)',
              marginTop: 2,
              lineHeight: 1,
            }}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
};
