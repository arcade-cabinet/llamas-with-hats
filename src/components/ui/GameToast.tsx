/**
 * Game Toast Notification System
 * ==============================
 *
 * In-game toast notifications for events such as item pickups, goal
 * completions/failures, story beats, and area unlocks.
 *
 * Exports:
 * - GameToastProvider  -- context provider that owns toast state
 * - useGameToast       -- hook returning addToast(type, message, icon?)
 * - GameToastContainer -- visual stack rendered in the top-right corner
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { GameToastType, GameToastData } from '../../types/toast';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT_COLORS: Record<GameToastType, string> = {
  item_acquired: '#f5810c',
  goal_complete: '#00bcd4',
  goal_failed: '#f43f5e',
  story_beat: '#dd7bbb',
  area_unlocked: '#fbbf24',
  achievement: '#ffd700',
};

const AUTO_DISMISS_MS = 3_000;
const MAX_VISIBLE = 3;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

type AddToastFn = (type: GameToastType, message: string, icon?: string) => void;

const GameToastContext = createContext<AddToastFn | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export const GameToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<GameToastData[]>([]);
  const nextId = useRef(0);

  // Auto-dismiss: set a timeout whenever the toast list changes.
  useEffect(() => {
    if (toasts.length === 0) return;

    const oldest = toasts[0];
    const elapsed = Date.now() - oldest.timestamp;
    const remaining = Math.max(AUTO_DISMISS_MS - elapsed, 0);

    const timer = setTimeout(() => {
      setToasts((prev) => prev.slice(1));
    }, remaining);

    return () => clearTimeout(timer);
  }, [toasts]);

  const addToast: AddToastFn = useCallback(
    (type, message, icon) => {
      const toast: GameToastData = {
        id: nextId.current++,
        type,
        message,
        icon,
        timestamp: Date.now(),
      };

      setToasts((prev) => {
        const next = [...prev, toast];
        // Enforce maximum visible toasts -- drop the oldest when exceeded.
        if (next.length > MAX_VISIBLE) {
          return next.slice(next.length - MAX_VISIBLE);
        }
        return next;
      });
    },
    [],
  );

  return (
    <GameToastContext.Provider value={addToast}>
      {children}
      <GameToastContainer toasts={toasts} />
    </GameToastContext.Provider>
  );
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useGameToast() {
  const addToast = useContext(GameToastContext);
  if (!addToast) {
    throw new Error('useGameToast must be used within a GameToastProvider');
  }
  return { addToast };
}

// ---------------------------------------------------------------------------
// Container (visual stack)
// ---------------------------------------------------------------------------

export const GameToastContainer: React.FC<{ toasts: GameToastData[] }> = ({
  toasts,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 80,
        right: 16,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </AnimatePresence>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Individual Toast
// ---------------------------------------------------------------------------

const ToastItem: React.FC<{ toast: GameToastData }> = ({ toast }) => {
  const accent = ACCENT_COLORS[toast.type];
  const isAchievement = toast.type === 'achievement';

  return (
    <motion.div
      layout
      initial={{ x: 300, opacity: 0 }}
      animate={{
        x: 0,
        opacity: 1,
        transition: { type: 'spring', stiffness: 500, damping: 35 },
      }}
      exit={{
        opacity: 0,
        y: -20,
        transition: { duration: 0.3 },
      }}
      style={{
        width: isAchievement ? 300 : 280,
        background: isAchievement
          ? 'linear-gradient(135deg, rgba(10,10,12,0.95), rgba(40,30,0,0.9))'
          : 'rgba(10, 10, 12, 0.9)',
        borderRadius: 8,
        borderLeft: `4px solid ${accent}`,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: isAchievement ? '12px 16px' : '10px 14px',
        pointerEvents: 'auto',
        boxShadow: isAchievement
          ? `0 0 16px rgba(255, 215, 0, 0.15), 0 0 4px rgba(255, 215, 0, 0.1)`
          : undefined,
        position: 'relative',
        overflow: 'hidden',
      }}
      className="backdrop-blur-sm"
    >
      {/* Achievement shimmer overlay */}
      {isAchievement && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,215,0,0.06) 40%, rgba(255,215,0,0.12) 50%, rgba(255,215,0,0.06) 60%, transparent 100%)',
            backgroundSize: '200% 100%',
            animation: 'achievement-shimmer 2s ease-in-out infinite',
            pointerEvents: 'none',
          }}
        />
      )}
      {toast.icon && (
        <span
          style={{
            fontSize: isAchievement ? 24 : 18,
            lineHeight: 1,
            flexShrink: 0,
            position: 'relative',
            ...(isAchievement ? { filter: 'drop-shadow(0 0 4px rgba(255,215,0,0.5))' } : {}),
          }}
        >
          {toast.icon}
        </span>
      )}
      <div style={{ position: 'relative' }}>
        {isAchievement && (
          <span
            style={{
              display: 'block',
              fontSize: 9,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: '#ffd700',
              marginBottom: 2,
            }}
          >
            Achievement Unlocked
          </span>
        )}
        <span
          style={{
            color: isAchievement ? '#ffd700' : '#ffffff',
            fontSize: 13,
            letterSpacing: '0.025em',
            lineHeight: 1.4,
            fontWeight: isAchievement ? 600 : undefined,
          }}
        >
          {toast.message}
        </span>
      </div>
    </motion.div>
  );
};
