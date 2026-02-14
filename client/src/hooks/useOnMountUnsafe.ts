import type { EffectCallback } from 'react';
import { useEffect, useRef } from 'react';

export function useOnMountUnsafe(effect: EffectCallback) {
  const initialized = useRef(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: wanted behavior
  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      effect();
    }
  }, []);
}
