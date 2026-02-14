import type { VRM } from '@pixiv/three-vrm';
import { createVRMAnimationClip, type VRMAnimation, VRMAnimationLoaderPlugin } from '@pixiv/three-vrm-animation';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

/** Result of loading a .vrma with GLTFLoader + VRMAnimationLoaderPlugin (has userData.vrmAnimations). */
interface LoadedVRMA {
  userData: { vrmAnimations?: VRMAnimation[] };
}

/** Global cache of loaded VRMAnimation data by URL. Survives model switches; clips are recreated per VRM. */
const vrmAnimationDataCache = new Map<string, VRMAnimation>();

function createLoader(): { load: (url: string, onDone: (gltf: LoadedVRMA) => void) => void } {
  const loader = new GLTFLoader();
  loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
  return {
    load: (url: string, onDone: (gltf: LoadedVRMA) => void) => {
      loader.load(url, onDone as (gltf: unknown) => void);
    },
  };
}

export interface PlayOptions {
  /** Whether the animation should loop. Defaults to true. */
  loop?: boolean;
  /** Crossfade duration in seconds. Defaults to 0.5. */
  fadeDuration?: number;
}

export interface VRMAnimationState {
  /** The THREE.AnimationMixer — call mixer.update(delta) in useFrame. */
  readonly mixer: THREE.AnimationMixer | null;
  /** Play a .vrma by its URL. Crossfades from the current clip. */
  readonly play: (url: string, options?: PlayOptions) => void;
  /** Stop any playing animation (model stays in current pose). */
  readonly stop: () => void;
  /** Currently playing animation URL (null when stopped). */
  readonly currentUrl: string | null;
  /** Synchronous read of current URL (ref). Use when you need the value at effect/callback time. */
  readonly getCurrentUrl: () => string | null;
  /** Available animation URLs that have been preloaded. */
  readonly loaded: ReadonlySet<string>;
}

/**
 * Hook that manages VRMA animation loading and playback for a VRM model.
 * Loads animations on demand when play(url) is called (no preloading).
 */
export function useVRMAnimation(vrm: VRM | null, onFinished?: (url: string) => void): VRMAnimationState {
  const [loaded, setLoaded] = useState<Set<string>>(new Set());
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clipsRef = useRef<Map<string, THREE.AnimationClip>>(new Map());
  const currentActionRef = useRef<THREE.AnimationAction | null>(null);
  const currentUrlRef = useRef<string | null>(null);
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const loadingRef = useRef<Set<string>>(new Set());
  const pendingPlaysRef = useRef<Map<string, PlayOptions>>(new Map());
  const loaderRef = useRef<ReturnType<typeof createLoader> | null>(null);
  const vrmRef = useRef<VRM | null>(null);

  const onFinishedRef = useRef(onFinished);
  onFinishedRef.current = onFinished;

  useEffect(() => {
    if (!vrm) {
      mixerRef.current = null;
      loaderRef.current = null;
      vrmRef.current = null;
      return;
    }

    vrmRef.current = vrm;
    const mixer = new THREE.AnimationMixer(vrm.scene);
    mixerRef.current = mixer;
    loaderRef.current = createLoader();

    clipsRef.current.clear();
    loadingRef.current.clear();
    pendingPlaysRef.current.clear();
    currentActionRef.current = null;
    currentUrlRef.current = null;
    setCurrentUrl(null);
    setLoaded(new Set());

    const handleFinished = (e: { action: THREE.AnimationAction }) => {
      for (const [url, clip] of clipsRef.current.entries()) {
        if (clip === e.action.getClip()) {
          onFinishedRef.current?.(url);
          break;
        }
      }
    };
    mixer.addEventListener('finished', handleFinished);

    return () => {
      mixer.removeEventListener('finished', handleFinished);
      mixer.stopAllAction();
      mixerRef.current = null;
      loaderRef.current = null;
      vrmRef.current = null;
    };
  }, [vrm]);

  const startAction = useCallback((url: string, clip: THREE.AnimationClip, options?: PlayOptions) => {
    const mixer = mixerRef.current;
    if (!mixer) {
      return;
    }
    if (currentUrlRef.current === url) {
      return;
    }

    const { loop = true, fadeDuration = 0.5 } = options ?? {};

    const newAction = mixer.clipAction(clip);
    newAction.reset();
    newAction.setEffectiveWeight(1);
    newAction.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
    newAction.clampWhenFinished = !loop;
    newAction.play();

    if (currentActionRef.current) {
      currentActionRef.current.crossFadeTo(newAction, fadeDuration, true);
    }

    currentActionRef.current = newAction;
    currentUrlRef.current = url;
    setCurrentUrl(url);
  }, []);

  const play = useCallback(
    (url: string, options?: PlayOptions) => {
      const mixer = mixerRef.current;
      const loader = loaderRef.current;
      const vrmCurrent = vrmRef.current;
      if (!mixer || !loader || !vrmCurrent) {
        return;
      }

      const clip = clipsRef.current.get(url);
      if (clip) {
        startAction(url, clip, options);
        return;
      }

      const cached = vrmAnimationDataCache.get(url);
      if (cached) {
        const newClip = createVRMAnimationClip(cached, vrmCurrent);
        clipsRef.current.set(url, newClip);
        setLoaded((prev) => new Set(prev).add(url));
        startAction(url, newClip, options);
        return;
      }

      if (loadingRef.current.has(url)) {
        pendingPlaysRef.current.set(url, options ?? {});
        return;
      }

      loadingRef.current.add(url);
      pendingPlaysRef.current.set(url, options ?? {});

      loader.load(url, (gltf) => {
        if (!mixerRef.current || !vrmRef.current) {
          loadingRef.current.delete(url);
          pendingPlaysRef.current.delete(url);
          return;
        }

        const vrmAnimation = gltf.userData.vrmAnimations?.[0];
        if (!vrmAnimation) {
          loadingRef.current.delete(url);
          pendingPlaysRef.current.delete(url);
          return;
        }

        vrmAnimationDataCache.set(url, vrmAnimation);

        const newClip = createVRMAnimationClip(vrmAnimation, vrmRef.current);
        clipsRef.current.set(url, newClip);
        setLoaded((prev) => new Set(prev).add(url));

        loadingRef.current.delete(url);
        const opts = pendingPlaysRef.current.get(url);
        pendingPlaysRef.current.delete(url);

        startAction(url, newClip, opts);
      });
    },
    [startAction],
  );

  const stop = useCallback(() => {
    const mixer = mixerRef.current;
    if (mixer) {
      mixer.stopAllAction();
    }
    currentActionRef.current = null;
    currentUrlRef.current = null;
    setCurrentUrl(null);
  }, []);

  const getCurrentUrl = useCallback(() => currentUrlRef.current, []);
  return { mixer: mixerRef.current, play, stop, currentUrl, getCurrentUrl, loaded };
}
