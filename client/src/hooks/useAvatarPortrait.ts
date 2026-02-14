import type { VRM } from '@pixiv/three-vrm';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { createVRMAnimationClip, type VRMAnimation, VRMAnimationLoaderPlugin, VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
import { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { assetUrl } from '@/lib/config';

// Enable Three.js global file cache so VRM files downloaded for portraits
// are reused when the same model is loaded by useVRM (avoids double download).
THREE.Cache.enabled = true;

const SIZE = 128;
const DEFAULT_COLOR = 0x1f2937; // zinc-800-ish background
const CONCURRENCY = 1;
/** How far (in seconds) to advance the idle animation to get a natural pose. */
const POSE_TIME = 1.0;

/** Cached VRMAnimation data keyed by URL so each .vrma is only loaded once. */
const poseAnimationCache = new Map<string, VRMAnimation>();
const poseAnimationLoading = new Map<string, Promise<VRMAnimation | null>>();

function loadPoseAnimation(url: string): Promise<VRMAnimation | null> {
  const cached = poseAnimationCache.get(url);
  if (cached) {
    return Promise.resolve(cached);
  }
  const existing = poseAnimationLoading.get(url);
  if (existing) {
    return existing;
  }
  const promise = new Promise<VRMAnimation | null>((resolve) => {
    const loader = new GLTFLoader();
    loader.register((parser) => new VRMAnimationLoaderPlugin(parser));
    loader.load(
      url,
      (gltf) => {
        const anim = (gltf.userData as { vrmAnimations?: VRMAnimation[] }).vrmAnimations?.[0] ?? null;
        if (anim) {
          poseAnimationCache.set(url, anim);
        }
        resolve(anim);
      },
      undefined,
      () => resolve(null),
    );
  });
  poseAnimationLoading.set(url, promise);
  return promise;
}

/** Apply a VRMAnimation to a VRM, advance the mixer, then dispose it. */
function applyPoseToVrm(vrm: VRM, animData: VRMAnimation): void {
  // Create VRMLookAtQuaternionProxy to suppress createVRMAnimationClip warning
  if (vrm.lookAt) {
    const proxy = new VRMLookAtQuaternionProxy(vrm.lookAt);
    proxy.name = 'VRMLookAtQuaternionProxy';
    vrm.scene.add(proxy);
  }
  const mixer = new THREE.AnimationMixer(vrm.scene);
  const clip = createVRMAnimationClip(animData, vrm);
  const action = mixer.clipAction(clip);
  action.play();
  mixer.update(POSE_TIME);
  vrm.update(0);
  mixer.stopAllAction();
  mixer.uncacheRoot(vrm.scene);
}

/**
 * Renders the given GLTF model to a PNG data URL.
 * When poseUrl is provided, loads that animation so the avatar has a natural pose instead of T-pose.
 * Frames the upper part of the model (head portrait).
 */
async function renderGltfToDataUrl(modelPath: string, poseUrl?: string, size: number = SIZE): Promise<string> {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;

  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setSize(size, size);
  renderer.setClearColor(DEFAULT_COLOR, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);

  const ambient = new THREE.AmbientLight(0xffffff, 1);
  scene.add(ambient);
  const directional = new THREE.DirectionalLight(0xffffff, 1);
  directional.position.set(5, 80, 5);
  scene.add(directional);

  const isVrm = modelPath.endsWith('.vrm');

  // Load VRM/GLTF and pose animation in parallel
  const loader = new GLTFLoader();
  if (isVrm) {
    loader.register((parser) => new VRMLoaderPlugin(parser));
  }
  const [gltf, poseAnim] = await Promise.all([loader.loadAsync(assetUrl(modelPath)), isVrm && poseUrl ? loadPoseAnimation(poseUrl) : Promise.resolve(null)]);

  const model = gltf.scene;
  const vrm: VRM | undefined = gltf.userData.vrm;
  if (isVrm && vrm) {
    VRMUtils.rotateVRM0(vrm);
    if (poseAnim) {
      applyPoseToVrm(vrm, poseAnim);
    }
  }
  scene.add(model);

  const box = new THREE.Box3().setFromObject(model);
  const sizeBox = box.getSize(new THREE.Vector3());
  const height = sizeBox.y;

  // Portrait framing: focus on the head (top ~25% of the model)
  const headY = box.max.y - height * 0.12;
  const headTarget = new THREE.Vector3(0, headY, 0);

  const headSize = height * 0.25;
  const distance = headSize > 0 ? headSize * 2.8 : 2;
  camera.position.set(0, headY, distance);
  camera.lookAt(headTarget);
  camera.updateProjectionMatrix();

  renderer.render(scene, camera);

  let dataUrl: string;
  try {
    dataUrl = canvas.toDataURL('image/png');
  } finally {
    renderer.dispose();
    scene.clear();
  }

  return dataUrl;
}

const cache = new Map<string, string>();

type QueueItem = {
  modelPath: string;
  poseUrl?: string;
  resolve: (url: string) => void;
  reject: (err: unknown) => void;
};

const queue: QueueItem[] = [];
let running = 0;

function processQueue(): void {
  if (running >= CONCURRENCY || queue.length === 0) {
    return;
  }
  const item = queue.shift();
  if (!item) {
    return;
  }
  const cached = cache.get(item.modelPath);
  if (cached) {
    item.resolve(cached);
    processQueue();
    return;
  }
  running += 1;
  renderGltfToDataUrl(item.modelPath, item.poseUrl)
    .then((url) => {
      cache.set(item.modelPath, url);
      item.resolve(url);
    })
    .catch((err) => {
      item.reject(err);
    })
    .finally(() => {
      running -= 1;
      processQueue();
    });
}

function getPortraitQueued(modelPath: string, poseUrl?: string): Promise<string> {
  const cached = cache.get(modelPath);
  if (cached) {
    return Promise.resolve(cached);
  }
  return new Promise<string>((resolve, reject) => {
    queue.push({ modelPath, poseUrl, resolve, reject });
    processQueue();
  });
}

export interface AvatarPortraitState {
  dataUrl: string | null;
  loading: boolean;
  error: Error | null;
  /** When using lazy mode, call this (e.g. onMouseEnter) to start generating the portrait. */
  request?: () => void;
}

export interface UseAvatarPortraitOptions {
  /** If true, do not load until request() is called (e.g. on hover). */
  lazy?: boolean;
  /** URL of a VRMA animation to apply as idle pose. When omitted the portrait shows T-pose. */
  poseUrl?: string;
}

/**
 * Returns a portrait image (data URL) generated from the given GLTF model path.
 * Result is cached by modelPath so the same model is only rendered once.
 * With { lazy: true }, generation starts only when request() is called (e.g. onMouseEnter).
 */
export function useAvatarPortrait(modelPath: string | undefined, options: UseAvatarPortraitOptions = {}): AvatarPortraitState {
  const { lazy = false, poseUrl } = options;
  const cachedInitial = modelPath ? (cache.get(modelPath) ?? null) : null;
  const [dataUrl, setDataUrl] = useState<string | null>(cachedInitial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const startedRef = useRef(false);

  const request = useCallback(() => {
    if (!modelPath) {
      return;
    }
    if (cache.has(modelPath)) {
      setDataUrl(cache.get(modelPath) ?? null);
      return;
    }
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;
    setLoading(true);
    setError(null);
    getPortraitQueued(modelPath, poseUrl)
      .then((url) => {
        setDataUrl(url);
      })
      .catch((err) => {
        setError(err instanceof Error ? err : new Error(String(err)));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [modelPath, poseUrl]);

  useEffect(() => {
    if (!modelPath) {
      setDataUrl(null);
      setLoading(false);
      setError(null);
      startedRef.current = false;
      return;
    }

    if (!lazy) {
      const cached = cache.get(modelPath);
      if (cached) {
        setDataUrl(cached);
        setLoading(false);
        setError(null);
        return;
      }
      startedRef.current = true;
      setLoading(true);
      setError(null);
      let cancelled = false;
      getPortraitQueued(modelPath, poseUrl)
        .then((url) => {
          if (!cancelled) {
            setDataUrl(url);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setError(err instanceof Error ? err : new Error(String(err)));
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }

    startedRef.current = false;
    const cached = cache.get(modelPath);
    setDataUrl(cached ?? null);
    setLoading(false);
    setError(null);
  }, [modelPath, lazy, poseUrl]);

  const state: AvatarPortraitState = { dataUrl, loading, error };
  if (lazy) {
    state.request = request;
  }
  return state;
}
