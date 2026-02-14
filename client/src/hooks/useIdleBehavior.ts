import { useEffect, useRef } from 'react';

const DEFAULT_MIN_INTERVAL = 8;
const DEFAULT_MAX_INTERVAL = 20;

export interface UseIdleBehaviorOptions {
  /** Pool of animation IDs that can be randomly triggered. */
  idlePool: readonly string[];
  /** Min interval in seconds between idle behaviors. */
  minInterval?: number;
  /** Max interval in seconds between idle behaviors. */
  maxInterval?: number;
  /** Whether the avatar is currently busy (speaking, receiving, etc.). Pauses idle when true. */
  isBusy: boolean;
  /** Callback to play a one-shot animation by config ID. */
  playAnimationOnce: (animationId: string) => void;
}

/**
 * Randomly triggers idle animations from a pool when the avatar is not busy.
 * Schedules the next idle behavior after a random delay within [min, max] seconds.
 */
export function useIdleBehavior({ idlePool, minInterval = DEFAULT_MIN_INTERVAL, maxInterval = DEFAULT_MAX_INTERVAL, isBusy, playAnimationOnce }: UseIdleBehaviorOptions): void {
  const playRef = useRef(playAnimationOnce);
  playRef.current = playAnimationOnce;

  useEffect(() => {
    if (isBusy || idlePool.length === 0) {
      return;
    }

    const min = Math.max(1, minInterval) * 1000;
    const max = Math.max(min, maxInterval * 1000);

    let timeoutId: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      const delay = min + Math.random() * (max - min);
      timeoutId = setTimeout(() => {
        const randomIndex = Math.floor(Math.random() * idlePool.length);
        const animId = idlePool[randomIndex];
        if (animId) {
          playRef.current(animId);
        }
        scheduleNext();
      }, delay);
    };

    scheduleNext();
    return () => clearTimeout(timeoutId);
  }, [isBusy, idlePool, minInterval, maxInterval]);
}
