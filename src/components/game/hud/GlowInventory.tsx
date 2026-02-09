import React, { useRef, useEffect, useState } from 'react';
import { clsx } from 'clsx';
import { getItemIcon } from '../../../utils/itemIcons';

interface GlowInventoryProps {
  items: string[];
  maxSlots?: number;
  isCompact?: boolean;
  className?: string;
}

/**
 * Premium inventory grid with glowing card slots for the HUD.
 *
 * Empty slots render as dashed outlines; filled slots display the
 * abbreviated item label from `getItemIcon` and gain an animated
 * border glow on hover. New items scale in with a spring transition.
 */
export const GlowInventory: React.FC<GlowInventoryProps> = ({
  items,
  maxSlots = 4,
  isCompact = false,
  className,
}) => {
  const prevItemsRef = useRef<string[]>([]);
  const [freshIndices, setFreshIndices] = useState<Set<number>>(new Set());

  /* ------------------------------------------------------------------ */
  /*  Detect newly-filled slots so we can trigger the scale-in effect   */
  /* ------------------------------------------------------------------ */
  useEffect(() => {
    const prev = prevItemsRef.current;
    const next = new Set<number>();

    for (let i = 0; i < maxSlots; i++) {
      const hadItem = !!prev[i];
      const hasItem = !!items[i];
      if (!hadItem && hasItem) {
        next.add(i);
      }
    }

    if (next.size > 0) {
      setFreshIndices(next);
      /* Clear the "fresh" flag after the animation completes */
      const timer = setTimeout(() => setFreshIndices(new Set()), 400);
      return () => clearTimeout(timer);
    }

    prevItemsRef.current = [...items];
  }, [items, maxSlots]);

  /* Keep ref in sync even when nothing is fresh */
  useEffect(() => {
    prevItemsRef.current = [...items];
  }, [items]);

  const slotSize = isCompact ? 36 : 44;
  const columns = isCompact ? 2 : 4;

  return (
    <div className={className}>
      <p className="hud-label mb-1">Items</p>

      <div
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${columns}, ${slotSize}px)`,
          gap: 4,
        }}
      >
        {Array.from({ length: maxSlots }).map((_, i) => {
          const itemId = items[i] ?? null;
          const isFilled = itemId !== null;
          const isFresh = freshIndices.has(i);

          return (
            <div
              key={i}
              className={clsx(
                'glow-slot',
                isFilled && 'glow-slot--filled',
                isFresh && 'glow-slot--fresh',
              )}
              style={{
                width: slotSize,
                height: slotSize,
              }}
              title={isFilled ? itemId.replace(/_/g, ' ') : undefined}
            >
              {isFilled && (
                <span
                  className="glow-slot__label"
                  style={{ fontSize: isCompact ? 8 : 9 }}
                >
                  {getItemIcon(itemId)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ------------------------------------------------------------ */}
      {/*  Scoped styles -- kept co-located so the component is         */}
      {/*  self-contained. The <style> tag is harmless in React 18+     */}
      {/*  and deduplicates on re-render.                               */}
      {/* ------------------------------------------------------------ */}
      <style>{glowStyles}</style>
    </div>
  );
};

/* ================================================================== */
/*  CSS (template literal keeps everything in one file)                */
/* ================================================================== */

const glowStyles = /* css */ `
/* ---- Rotating angle property for conic gradient border ---- */
@property --glow-angle {
  syntax: "<angle>";
  initial-value: 0deg;
  inherits: false;
}

@keyframes glow-rotate {
  to { --glow-angle: 360deg; }
}

@keyframes slot-pop-in {
  0%   { transform: scale(0); }
  60%  { transform: scale(1.12); }
  80%  { transform: scale(0.95); }
  100% { transform: scale(1); }
}

/* ---- Base slot ---- */
.glow-slot {
  position: relative;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px dashed rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
  /* Isolation for the pseudo-element stacking */
  isolation: isolate;
}

/* ---- Filled slot overrides ---- */
.glow-slot--filled {
  border-style: solid;
  border-color: rgba(245, 129, 12, 0.3);
}

/* ---- Conic gradient glow pseudo-element (filled slots only) ---- */
.glow-slot--filled::before {
  content: "";
  position: absolute;
  inset: -1px;
  border-radius: 7px;           /* slightly larger to wrap the slot */
  background: conic-gradient(
    from var(--glow-angle),
    #f5810c,
    #00bcd4,
    #f5810c
  );
  z-index: -1;
  opacity: 0;
  transition: opacity 0.2s ease;
  animation: glow-rotate 3s linear infinite;
}

/* Mask the interior so only the border ring is visible */
.glow-slot--filled::after {
  content: "";
  position: absolute;
  inset: 1px;
  border-radius: 5px;
  background: rgba(26, 10, 10, 0.92);  /* ~shadow base */
  z-index: -1;
  opacity: 0;
  transition: opacity 0.2s ease;
}

/* On hover: reveal the gradient border + add a soft box-shadow fallback */
.glow-slot--filled:hover::before,
.glow-slot--filled:hover::after {
  opacity: 1;
}

.glow-slot--filled:hover {
  box-shadow:
    0 0 8px rgba(245, 129, 12, 0.4),
    inset 0 0 4px rgba(245, 129, 12, 0.1);
}

/* ---- Label text ---- */
.glow-slot__label {
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace;
  font-weight: 700;
  line-height: 1;
  color: #f5810c;
  pointer-events: none;
}

/* ---- New-item spring animation ---- */
.glow-slot--fresh {
  animation: slot-pop-in 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) both;
}
`;
