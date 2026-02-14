import type { Expression } from '@avatrr/shared';
import { VRMExpressionPresetName } from '@pixiv/three-vrm';
import { useFrame } from '@react-three/fiber';
import { useCallback, useEffect, useRef, useState } from 'react';
import type * as THREE from 'three';
import type { AvatarAnimationControls } from '@/hooks/useAvatarAnimation';
import { useVRM } from '@/hooks/useVRM';
import { useVRMAnimation, type VRMAnimationState } from '@/hooks/useVRMAnimation';

function lerp(current: number, target: number, alpha: number): number {
  return current + (target - current) * alpha;
}

/**
 * We use VRM standard presets from @pixiv/three-vrm (Happy, Sad, Angry, Surprised, Neutral, Relaxed).
 * This map links our app Expression type to those preset names. VRM has no "thinking" preset, so we use Relaxed.
 */
const EXPRESSION_MAP: Record<Expression, string> = {
  neutral: VRMExpressionPresetName.Neutral,
  happy: VRMExpressionPresetName.Happy,
  sad: VRMExpressionPresetName.Sad,
  angry: VRMExpressionPresetName.Angry,
  surprised: VRMExpressionPresetName.Surprised,
  thinking: VRMExpressionPresetName.Relaxed,
};

/** All VRM emotion presets we drive — reset to 0 each frame before applying the active one. */
const ALL_EMOTION_PRESETS = [VRMExpressionPresetName.Neutral, VRMExpressionPresetName.Happy, VRMExpressionPresetName.Sad, VRMExpressionPresetName.Angry, VRMExpressionPresetName.Surprised, VRMExpressionPresetName.Relaxed];

/** Blink timing constants. */
const BLINK_MIN_INTERVAL = 2;
const BLINK_MAX_INTERVAL = 8;
const BLINK_CLOSE_DURATION = 0.12;
const BLINK_OPEN_DURATION = 0.16;
const BLINK_TOTAL_DURATION = BLINK_CLOSE_DURATION + BLINK_OPEN_DURATION;

/** How fast expression weight ramps up/down (higher = more visible, quicker). */
const EXPRESSION_WEIGHT_LERP = 0.18;
/** How fast the VRM preset value follows the target (higher = snappier). */
const EXPRESSION_VALUE_LERP = 0.25;
/** Decay speed for other presets when switching expression. */
const EXPRESSION_RESET_LERP = 0.2;
/** Amplify expression intensity (1 = normal, >1 = more pronounced; VRM typically clamps to 1). */
const EXPRESSION_INTENSITY = 1.0;
/** Scale mouth openness when talking so the Aa preset is more visible (1 = raw amplitude). */
const MOUTH_OPENNESS_SCALE = 0.5;

export interface VRMModelProps {
  animation: AvatarAnimationControls;
  modelPath: string;
  /** User-selected animation URL to play. Null = "Aucune" (stop). */
  activeVrmaUrl?: string | null;
  /** Animation URL to play after the appearing intro (from avatar config). Null = no animation after appearing. */
  defaultAnimationUrl?: string | null;
  /** Animation URL to play as intro when the avatar appears. Null = skip appearing and show immediately. */
  appearingAnimationUrl?: string | null;
  /** Called when the actually playing animation URL changes (for menu sync). */
  onPlayingAnimationChange?: (url: string | null) => void;
  /** One-shot animation URL (e.g. from SSE). Played once with loop: false, then cleared via callback. */
  oneShotAnimationUrl?: string | null;
  /** Called when the one-shot animation has finished. */
  onOneShotAnimationFinished?: () => void;
  /** Called when the VRM scene is loaded and ready (for bounding box / camera framing). */
  onSceneReady?: (scene: THREE.Object3D) => void;
}

export function VRMModel({ animation, modelPath, activeVrmaUrl = null, defaultAnimationUrl = null, appearingAnimationUrl = null, onPlayingAnimationChange, oneShotAnimationUrl = null, onOneShotAnimationFinished, onSceneReady }: VRMModelProps) {
  const vrm = useVRM(modelPath);

  useEffect(() => {
    if (vrm && onSceneReady) {
      onSceneReady(vrm.scene);
    }
  }, [vrm, onSceneReady]);
  const [visible, setVisible] = useState(false);
  const hasAppearedRef = useRef(false);
  const appearingStartedRef = useRef(false);
  const playRef = useRef<VRMAnimationState['play']>(() => {});
  const stopRef = useRef<VRMAnimationState['stop']>(() => {});
  const oneShotUrlRef = useRef<string | null>(null);
  /** URL to restore when the one-shot ends (set when we start the one-shot). */
  const restoreAfterOneShotRef = useRef<string | null>(null);
  oneShotUrlRef.current = oneShotAnimationUrl ?? null;

  const onAnimationFinished = useCallback(
    (url: string) => {
      if (url === oneShotUrlRef.current) {
        const toRestore = restoreAfterOneShotRef.current;
        onOneShotAnimationFinished?.();
        requestAnimationFrame(() => {
          if (toRestore) {
            playRef.current(toRestore);
          } else {
            stopRef.current();
          }
        });
        return;
      }
      if (url === appearingAnimationUrl) {
        hasAppearedRef.current = true;
        if (defaultAnimationUrl) {
          playRef.current(defaultAnimationUrl);
        } else {
          stopRef.current();
        }
      }
    },
    [onOneShotAnimationFinished, appearingAnimationUrl, defaultAnimationUrl],
  );

  const vrmaAnimation = useVRMAnimation(vrm, onAnimationFinished);
  playRef.current = vrmaAnimation.play;
  stopRef.current = vrmaAnimation.stop;

  useEffect(() => {
    onPlayingAnimationChange?.(vrmaAnimation.currentUrl ?? null);
  }, [vrmaAnimation.currentUrl, onPlayingAnimationChange]);

  // Start the appearing animation when the model is ready (loads on demand, once). Do not show the model yet.
  // When no appearing animation is configured, skip the sequence and show immediately.
  useEffect(() => {
    if (!vrm || hasAppearedRef.current || appearingStartedRef.current) {
      return;
    }
    appearingStartedRef.current = true;
    if (appearingAnimationUrl) {
      vrmaAnimation.play(appearingAnimationUrl, { loop: false });
    } else {
      // No appearing animation: show immediately and play idle if available.
      hasAppearedRef.current = true;
      setVisible(true);
      if (defaultAnimationUrl) {
        vrmaAnimation.play(defaultAnimationUrl);
      }
    }
  }, [vrm, vrmaAnimation.play, appearingAnimationUrl, defaultAnimationUrl]);

  // Show the model only when the appearing animation is actually playing (avoids flash of unanimated pose)
  useEffect(() => {
    if (!hasAppearedRef.current && appearingAnimationUrl && vrmaAnimation.currentUrl === appearingAnimationUrl) {
      setVisible(true);
    }
  }, [vrmaAnimation.currentUrl, appearingAnimationUrl]);

  // When one-shot is set, play it once (and remember what to restore). Otherwise sync with user-selected animation.
  useEffect(() => {
    if (!hasAppearedRef.current) {
      return;
    }
    if (oneShotAnimationUrl) {
      const current = vrmaAnimation.getCurrentUrl();
      if (current !== oneShotAnimationUrl) {
        const toRestore = current && current !== appearingAnimationUrl ? current : (activeVrmaUrl ?? defaultAnimationUrl ?? null);
        restoreAfterOneShotRef.current = toRestore;
      }
      vrmaAnimation.play(oneShotAnimationUrl, { loop: false });
      return;
    }
    restoreAfterOneShotRef.current = null;
    const urlToPlay = activeVrmaUrl ?? defaultAnimationUrl;
    if (urlToPlay) {
      vrmaAnimation.play(urlToPlay);
    } else {
      vrmaAnimation.stop();
    }
  }, [oneShotAnimationUrl, activeVrmaUrl, defaultAnimationUrl, appearingAnimationUrl, vrmaAnimation.play, vrmaAnimation.stop, vrmaAnimation.getCurrentUrl]);

  const talkWeight = useRef(0);
  const smoothAmplitude = useRef(0);
  const expressionWeight = useRef(0);
  const currentExpression = useRef<Expression>('neutral');
  const blinkNextTime = useRef(0);
  const blinkProgress = useRef(-1);

  useFrame((state, delta) => {
    if (!vrm) {
      return;
    }

    const t = state.clock.elapsedTime;

    // --- Update VRMA mixer (drives bone animations) ---
    if (vrmaAnimation.mixer) {
      vrmaAnimation.mixer.update(delta);
    }

    // --- Blend talking weight ---
    const targetWeight = animation.current() === 'talking' ? 1 : 0;
    talkWeight.current = lerp(talkWeight.current, targetWeight, 0.08);
    smoothAmplitude.current = lerp(smoothAmplitude.current, animation.amplitude(), 0.18);
    const amp = smoothAmplitude.current;
    const tw = talkWeight.current;

    // --- Expression tracking ---
    const expr = animation.expression();
    if (expr !== currentExpression.current) {
      currentExpression.current = expr;
      expressionWeight.current = 0;
    }
    expressionWeight.current = lerp(expressionWeight.current, expr !== 'neutral' ? 1 : 0, EXPRESSION_WEIGHT_LERP);

    // --- Facial expressions via VRM expressionManager ---
    const em = vrm.expressionManager;
    if (em) {
      // Reset all emotion presets, then apply active one
      for (const preset of ALL_EMOTION_PRESETS) {
        const current = em.getValue(preset) ?? 0;
        em.setValue(preset, lerp(current, 0, EXPRESSION_RESET_LERP));
      }
      const vrmExprName = EXPRESSION_MAP[expr];
      if (vrmExprName) {
        const current = em.getValue(vrmExprName) ?? 0;
        const targetValue = Math.min(1, expressionWeight.current * EXPRESSION_INTENSITY);
        em.setValue(vrmExprName, lerp(current, targetValue, EXPRESSION_VALUE_LERP));
      }

      // --- Persistent mood base layer (low-weight, does not override reactive expressions) ---
      // Scale mood down during speech so VRM overrideMouth doesn't block visemes.
      const moodScale = 1 - tw;
      const mood = animation.getMood();
      if (moodScale > 0.01 && mood.expression !== 'neutral' && mood.intensity > 0) {
        const moodPreset = EXPRESSION_MAP[mood.expression];
        if (moodPreset) {
          const moodTarget = mood.intensity * 0.3 * moodScale;
          const currentVal = em.getValue(moodPreset) ?? 0;
          // Only apply mood if the reactive expression isn't already stronger
          if (currentVal < moodTarget) {
            em.setValue(moodPreset, lerp(currentVal, moodTarget, 0.08));
          }
        }
      }

      // --- Mouth / lip-sync (multi-shape driven by frequency bands) ---
      const ALL_VISEME_PRESETS = [VRMExpressionPresetName.Aa, VRMExpressionPresetName.Ee, VRMExpressionPresetName.Ih, VRMExpressionPresetName.Ou, VRMExpressionPresetName.Oh] as const;
      if (tw > 0) {
        const ls = animation.lipSync();
        const hasRealAudio = amp > 0.01;
        // When no real audio data yet, use a synthetic fallback for Aa only
        if (!hasRealAudio) {
          const synth = (Math.sin(t * 8) * 0.3 + Math.sin(t * 13) * 0.2 + 0.5) * tw;
          const openness = Math.min(1, synth * MOUTH_OPENNESS_SCALE);
          const curAa = em.getValue(VRMExpressionPresetName.Aa) ?? 0;
          em.setValue(VRMExpressionPresetName.Aa, lerp(curAa, openness, 0.15));
          for (const p of [VRMExpressionPresetName.Ee, VRMExpressionPresetName.Ih, VRMExpressionPresetName.Ou, VRMExpressionPresetName.Oh] as const) {
            em.setValue(p, lerp(em.getValue(p) ?? 0, 0, 0.1));
          }
        } else {
          // Map frequency bands to VRM viseme presets
          const targets: [string, number][] = [
            [VRMExpressionPresetName.Aa, Math.min(1, ls.bands.mid * tw * MOUTH_OPENNESS_SCALE)],
            [VRMExpressionPresetName.Ee, Math.min(1, ls.bands.high * tw * 1.0)],
            [VRMExpressionPresetName.Ih, Math.min(1, ls.bands.high * tw * 0.6)],
            [VRMExpressionPresetName.Ou, Math.min(1, ls.bands.low * tw * 1.2)],
            [VRMExpressionPresetName.Oh, Math.min(1, ls.bands.low * tw * 0.5)],
          ];
          for (const [preset, target] of targets) {
            em.setValue(preset, lerp(em.getValue(preset) ?? 0, target, 0.15));
          }
        }
      } else {
        // Decay all viseme presets to 0
        for (const preset of ALL_VISEME_PRESETS) {
          em.setValue(preset, lerp(em.getValue(preset) ?? 0, 0, 0.1));
        }
      }

      // --- Blink ---
      if (blinkProgress.current < 0 && t >= blinkNextTime.current) {
        blinkProgress.current = 0;
      }
      if (blinkProgress.current >= 0) {
        blinkProgress.current += delta;
        let closedness = 0;
        if (blinkProgress.current >= BLINK_TOTAL_DURATION) {
          blinkProgress.current = -1;
          blinkNextTime.current = t + BLINK_MIN_INTERVAL + Math.random() * (BLINK_MAX_INTERVAL - BLINK_MIN_INTERVAL);
        } else if (blinkProgress.current <= BLINK_CLOSE_DURATION) {
          closedness = blinkProgress.current / BLINK_CLOSE_DURATION;
        } else {
          closedness = 1 - (blinkProgress.current - BLINK_CLOSE_DURATION) / BLINK_OPEN_DURATION;
        }
        em.setValue(VRMExpressionPresetName.Blink, closedness);
      } else {
        em.setValue(VRMExpressionPresetName.Blink, 0);
      }
    }

    // --- Update VRM (expressions, spring bones, constraints) ---
    vrm.update(delta);
  });

  if (!vrm) {
    return null;
  }

  return <primitive object={vrm.scene} visible={visible} />;
}
