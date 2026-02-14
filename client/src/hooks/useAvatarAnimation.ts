import type { Expression } from '@avatrr/shared';
import { useCallback, useMemo, useRef } from 'react';
import { type LipSyncData, ZERO_LIP_SYNC } from '@/lib/tts';

export type AnimationName = 'idle' | 'talking';

export interface MoodState {
  expression: Expression;
  intensity: number;
}

export interface AvatarAnimationControls {
  /** Start playing an animation. It will blend smoothly from the current state. */
  play: (name: AnimationName) => void;
  /** Get the currently active animation name. */
  current: () => AnimationName;
  /** How far into the talking animation we are (0 = silent, 1 = full talk). Useful for blending. */
  talkingWeight: () => number;
  /** Set real-time audio amplitude (0–1) from TTS playback. */
  setAmplitude: (value: number) => void;
  /** Get current audio amplitude (0–1). */
  amplitude: () => number;
  /** Set real-time lip-sync data (amplitude + frequency bands) from TTS playback. */
  setLipSync: (data: LipSyncData) => void;
  /** Get current lip-sync data. */
  lipSync: () => LipSyncData;
  /** Set the current facial expression. */
  setExpression: (expr: Expression) => void;
  /** Get the current facial expression. */
  expression: () => Expression;
  /** Set the persistent mood state. */
  setMood: (mood: Expression, intensity: number) => void;
  /** Get the current persistent mood state. */
  getMood: () => MoodState;
}

/**
 * Hook that manages avatar animation state.
 * Returns controls that can be passed to the Model component
 * and used externally to trigger animations.
 */
export function useAvatarAnimation(): AvatarAnimationControls {
  const activeAnimation = useRef<AnimationName>('idle');
  const talkingWeightRef = useRef(0);
  const amplitudeRef = useRef(0);
  const lipSyncRef = useRef<LipSyncData>(ZERO_LIP_SYNC);
  const expressionRef = useRef<Expression>('neutral');
  const moodRef = useRef<MoodState>({ expression: 'neutral', intensity: 0 });

  const play = useCallback((name: AnimationName) => {
    activeAnimation.current = name;
  }, []);

  const current = useCallback(() => activeAnimation.current, []);

  const talkingWeight = useCallback(() => talkingWeightRef.current, []);

  const setLipSync = useCallback((data: LipSyncData) => {
    lipSyncRef.current = data;
    amplitudeRef.current = data.amplitude;
  }, []);

  const lipSync = useCallback(() => lipSyncRef.current, []);

  const setAmplitude = useCallback((value: number) => {
    amplitudeRef.current = value;
  }, []);

  const amplitude = useCallback(() => amplitudeRef.current, []);

  const setExpression = useCallback((expr: Expression) => {
    expressionRef.current = expr;
  }, []);

  const expression = useCallback(() => expressionRef.current, []);

  const setMood = useCallback((mood: Expression, intensity: number) => {
    moodRef.current = { expression: mood, intensity };
  }, []);

  const getMood = useCallback(() => moodRef.current, []);

  return useMemo(() => ({ play, current, talkingWeight, setAmplitude, amplitude, setLipSync, lipSync, setExpression, expression, setMood, getMood }), [play, current, talkingWeight, setAmplitude, amplitude, setLipSync, lipSync, setExpression, expression, setMood, getMood]);
}
