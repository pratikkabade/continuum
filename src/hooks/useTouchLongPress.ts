import { useState, useRef, useCallback, useEffect } from 'react';
import { triggerHaptic, cancelHaptic } from '../utils/haptics';

interface UseTouchLongPressOptions {
  onLongPress: () => void;
  threshold?: number; // ms to trigger long press (default 520ms matching Apple iOS)
  moveTolerance?: number; // px movement allowed before canceling (default 10px for scrolling)
}

interface TouchCoordinates {
  x: number;
  y: number;
}

export function useTouchLongPress({
  onLongPress,
  threshold = 520,
  moveTolerance = 10,
}: UseTouchLongPressOptions) {
  const [isPressing, setIsPressing] = useState(false);
  const [pressProgress, setPressProgress] = useState(0);

  const startPosRef = useRef<TouchCoordinates | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const midwayTimerRef = useRef<NodeJS.Timeout | null>(null);
  const progressAnimRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const didTriggerRef = useRef(false);
  const isTouchRef = useRef(false);

  // Clear all running timers and animation frames
  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (midwayTimerRef.current) {
      clearTimeout(midwayTimerRef.current);
      midwayTimerRef.current = null;
    }
    if (progressAnimRef.current) {
      cancelAnimationFrame(progressAnimRef.current);
      progressAnimRef.current = null;
    }
    cancelHaptic();
  }, []);

  // Update progress smoothly for UI progress ring / bar
  const startProgressLoop = useCallback(() => {
    startTimeRef.current = performance.now();

    const step = () => {
      const elapsed = performance.now() - startTimeRef.current;
      const progress = Math.min(100, (elapsed / threshold) * 100);
      setPressProgress(progress);

      if (elapsed < threshold) {
        progressAnimRef.current = requestAnimationFrame(step);
      }
    };

    progressAnimRef.current = requestAnimationFrame(step);
  }, [threshold]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent | React.PointerEvent) => {
      const target = e.target as HTMLElement;

      // Ignore touches on explicit action buttons, links, or inputs
      if (
        target.closest('button') ||
        target.closest('a') ||
        target.closest('[data-action]') ||
        target.closest('input') ||
        target.closest('textarea')
      ) {
        return;
      }

      // If pointer event, only activate for touch or pen
      if ('pointerType' in e && e.pointerType !== 'touch' && e.pointerType !== 'pen') {
        return;
      }

      clearTimers();
      didTriggerRef.current = false;
      isTouchRef.current = true;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
      startPosRef.current = { x: clientX, y: clientY };

      // Micro-delay (65ms) before visually entering "pressing" state
      // This prevents visual flickering when user is quickly tapping or flicking to scroll
      timerRef.current = setTimeout(() => {
        setIsPressing(true);
        startProgressLoop();
        triggerHaptic('light');

        // Halfway haptic tick: lets user feel the tactile build-up like iOS Haptic Touch
        const remainingTime = threshold - 65;
        midwayTimerRef.current = setTimeout(() => {
          triggerHaptic('medium');
        }, remainingTime * 0.5);

        // Final trigger timer
        timerRef.current = setTimeout(() => {
          didTriggerRef.current = true;
          setIsPressing(false);
          setPressProgress(100);
          clearTimers();

          // Full Apple destructive haptic burst
          triggerHaptic('delete');
          onLongPress();

          // Keep didTrigger true briefly so subsequent synthetic click is blocked
          setTimeout(() => {
            didTriggerRef.current = false;
            setPressProgress(0);
          }, 450);
        }, remainingTime);
      }, 65);
    },
    [clearTimers, onLongPress, startProgressLoop, threshold]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent | React.PointerEvent) => {
      if (!startPosRef.current) return;

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaX = Math.abs(clientX - startPosRef.current.x);
      const deltaY = Math.abs(clientY - startPosRef.current.y);
      const distance = Math.hypot(deltaX, deltaY);

      // If finger moves more than tolerance, user is scrolling or gesturing
      // Immediately cancel long-press so scrolling is butter-smooth
      if (distance > moveTolerance) {
        clearTimers();
        setIsPressing(false);
        setPressProgress(0);
        startPosRef.current = null;
      }
    },
    [clearTimers, moveTolerance]
  );

  const handleTouchEnd = useCallback(() => {
    clearTimers();
    setIsPressing(false);
    startPosRef.current = null;

    if (!didTriggerRef.current) {
      setPressProgress(0);
    }
  }, [clearTimers]);

  const handleTouchCancel = useCallback(() => {
    clearTimers();
    setIsPressing(false);
    setPressProgress(0);
    startPosRef.current = null;
    didTriggerRef.current = false;
  }, [clearTimers]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    // Suppress native iOS/Android long-press context menu on cards
    if (isTouchRef.current) {
      e.preventDefault();
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  return {
    isPressing,
    pressProgress,
    didTrigger: didTriggerRef,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchCancel,
      onPointerDown: handleTouchStart,
      onPointerMove: handleTouchMove,
      onPointerUp: handleTouchEnd,
      onPointerCancel: handleTouchCancel,
      onContextMenu: handleContextMenu,
    },
  };
}
