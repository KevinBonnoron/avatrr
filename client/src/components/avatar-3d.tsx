import type { SceneConfig } from '@avatrr/shared';
import { Environment, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useCallback, useRef, useState } from 'react';
import * as THREE from 'three';
import type { AvatarAnimationControls } from '@/hooks/useAvatarAnimation';
import { assetUrl } from '@/lib/config';
import { VRMModel } from './vrm-model';

const FOV = 35;
const PADDING = 1.15;
const CAMERA_LERP_SPEED = 5;

const SUN_DISTANCE = 90;

function rgb(r: number, g: number, b: number) {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

/** Compute sun position, light params and sky gradient from time of day (0–24). Sunrise ~6, noon 12, sunset ~18. */
function getTimeOfDayLighting(hour: number) {
  const clamped = ((hour % 24) + 24) % 24;
  const dayPhase = (clamped - 6) / 12;
  const elevation = dayPhase >= 0 && dayPhase <= 1 ? Math.sin(dayPhase * Math.PI) : 0;
  const azimuth = dayPhase >= 0 && dayPhase <= 1 ? dayPhase * Math.PI : dayPhase < 0 ? 0 : Math.PI;
  const x = SUN_DISTANCE * Math.cos(elevation) * Math.cos(azimuth);
  const y = SUN_DISTANCE * Math.sin(elevation);
  const z = SUN_DISTANCE * Math.cos(elevation) * Math.sin(azimuth);
  const sunPosition: [number, number, number] = [x, y, z];
  const isDay = elevation > 0.05;
  const ambientIntensity = isDay ? 0.4 + 0.25 * elevation : 0.12;
  const directionalIntensity = isDay ? 0.8 + 1.2 * elevation : 0.02;
  const warmth = 1 - elevation;
  const sunColor = rgb(255 - 45 * warmth, 255 - 90 * warmth, 255 - 140 * warmth);

  return { sunPosition, ambientIntensity, directionalIntensity, sunColor };
}

export interface CameraPresetControls {
  frameFullBody: () => void;
  frameBust: () => void;
  frameFace: () => void;
}

export interface Avatar3DProps {
  animation: AvatarAnimationControls;
  modelPath: string;
  activeVrmaUrl?: string | null;
  defaultAnimationUrl?: string | null;
  /** Animation URL to play as intro when the avatar appears. Null = skip appearing. */
  appearingAnimationUrl?: string | null;
  onPlayingAnimationChange?: (url: string | null) => void;
  /** One-shot animation URL (e.g. from SSE). Played once then cleared. */
  oneShotAnimationUrl?: string | null;
  /** Called when the one-shot animation has finished. */
  onOneShotAnimationFinished?: () => void;
  /** Time of day in hours (0–24) for sun position and lighting. Default 12 (noon). */
  timeOfDay?: number;
  /** Called when camera preset controls become available. */
  onCameraReady?: (controls: CameraPresetControls) => void;
  /** Active scene/background. Null = default sky/ground. */
  scene?: SceneConfig | null;
}

export function Avatar3D({ animation, modelPath, activeVrmaUrl, defaultAnimationUrl, appearingAnimationUrl, onPlayingAnimationChange, oneShotAnimationUrl = null, onOneShotAnimationFinished, timeOfDay = 12, onCameraReady, scene = null }: Avatar3DProps) {
  const { sunPosition, ambientIntensity, directionalIntensity, sunColor } = getTimeOfDayLighting(timeOfDay);
  const is2d = scene?.type === '2d';
  const isHdri = scene?.type === 'hdri';
  const [vrmScene, setVrmScene] = useState<THREE.Object3D | null>(null);
  const controlsRef = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const cameraAnimatingRef = useRef(false);

  const handleSceneReady = useCallback((scene: THREE.Object3D) => {
    setVrmScene(scene);
  }, []);

  const sceneFileUrl = scene ? assetUrl(scene.path) : null;

  return (
    <div className="w-full h-full relative" style={is2d && sceneFileUrl ? { backgroundImage: `url(${sceneFileUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined}>
      <Canvas camera={{ position: [0, 1.6, 1.7], fov: FOV }} gl={{ antialias: true, ...(!isHdri ? { alpha: true } : {}) }} style={!isHdri ? { background: 'transparent' } : undefined}>
        {/* HDRI environment as background */}
        {isHdri && sceneFileUrl ? (
          <Environment files={sceneFileUrl} background environmentIntensity={0.8} />
        ) : (
          <Environment preset="city" background={false} environmentIntensity={0.3} />
        )}
        <SceneLights sunPosition={sunPosition} ambientIntensity={ambientIntensity} directionalIntensity={directionalIntensity} sunColor={sunColor} />
        <VRMModel
          animation={animation}
          modelPath={modelPath}
          activeVrmaUrl={activeVrmaUrl}
          defaultAnimationUrl={defaultAnimationUrl}
          appearingAnimationUrl={appearingAnimationUrl}
          onPlayingAnimationChange={onPlayingAnimationChange}
          oneShotAnimationUrl={oneShotAnimationUrl}
          onOneShotAnimationFinished={onOneShotAnimationFinished}
          onSceneReady={handleSceneReady}
        />
        <CameraFramer scene={vrmScene} controlsRef={controlsRef} onCameraReady={onCameraReady} animatingRef={cameraAnimatingRef} />
        <OrbitControls
          ref={controlsRef}
          target={[0, 1.6, 0]}
          enableZoom
          enablePan
          onStart={() => {
            cameraAnimatingRef.current = false;
          }}
        />
      </Canvas>
    </div>
  );
}

/** Compute camera position and target to frame a vertical slice (yMinRatio–yMaxRatio) of the scene's bounding box. */
function computeFraming(box: THREE.Box3, yMinRatio: number, yMaxRatio: number) {
  const min = box.min.y + (box.max.y - box.min.y) * yMinRatio;
  const max = box.min.y + (box.max.y - box.min.y) * yMaxRatio;
  const height = max - min;
  const centerY = (min + max) / 2;
  const fovRad = THREE.MathUtils.degToRad(FOV);
  const distance = ((height > 0 ? height : 1.7) / 2 / Math.tan(fovRad / 2)) * PADDING;
  return { centerY, distance };
}

/** Frames the camera to fit the VRM model's bounding box. Runs once when scene becomes available. Exposes preset controls via callback. Animates transitions smoothly. */
function CameraFramer({ scene, controlsRef, onCameraReady, animatingRef }: { scene: THREE.Object3D | null; controlsRef: React.RefObject<React.ComponentRef<typeof OrbitControls> | null>; onCameraReady?: (controls: CameraPresetControls) => void; animatingRef: React.RefObject<boolean> }) {
  const { camera } = useThree();
  const framedRef = useRef<THREE.Object3D | null>(null);
  const readyRef = useRef(false);
  const goalPosition = useRef<THREE.Vector3 | null>(null);
  const goalTarget = useRef<THREE.Vector3 | null>(null);

  const startTransition = useCallback(
    (yMinRatio: number, yMaxRatio: number) => {
      if (!scene) {
        return;
      }
      const box = new THREE.Box3().setFromObject(scene);
      const { centerY, distance } = computeFraming(box, yMinRatio, yMaxRatio);
      goalPosition.current = new THREE.Vector3(0, centerY, distance);
      goalTarget.current = new THREE.Vector3(0, centerY, 0);
      animatingRef.current = true;
    },
    [scene, animatingRef],
  );

  useFrame((_, delta) => {
    if (!animatingRef.current || !goalPosition.current || !goalTarget.current) {
      return;
    }
    const alpha = 1 - Math.exp(-CAMERA_LERP_SPEED * delta);
    camera.position.lerp(goalPosition.current, alpha);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();
    if (controlsRef.current) {
      const controls = controlsRef.current as unknown as { target: THREE.Vector3; update: () => void };
      controls.target.lerp(goalTarget.current, alpha);
      controls.update();
    }
    if (camera.position.distanceTo(goalPosition.current) < 0.001) {
      animatingRef.current = false;
    }
  });

  if (scene && framedRef.current !== scene) {
    framedRef.current = scene;
    readyRef.current = false;

    const box = new THREE.Box3().setFromObject(scene);
    const { centerY, distance } = computeFraming(box, -0.08, 1);
    camera.position.set(0, centerY, distance);
    (camera as THREE.PerspectiveCamera).updateProjectionMatrix();

    if (controlsRef.current) {
      const controls = controlsRef.current as unknown as { target: THREE.Vector3; update: () => void };
      controls.target.set(0, centerY, 0);
      controls.update();
    }
  }

  if (scene && !readyRef.current && onCameraReady) {
    readyRef.current = true;
    onCameraReady({
      frameFullBody: () => startTransition(-0.08, 1),
      frameBust: () => startTransition(0.5, 1),
      frameFace: () => startTransition(0.75, 1),
    });
  }

  return null;
}

/** Lights: sun position from props so lighting follows time of day. */
function SceneLights({ sunPosition, ambientIntensity, directionalIntensity, sunColor }: { sunPosition: readonly [number, number, number]; ambientIntensity: number; directionalIntensity: number; sunColor: string }) {
  return (
    <>
      <ambientLight intensity={ambientIntensity} />
      <directionalLight position={sunPosition} intensity={directionalIntensity} color={sunColor} />
    </>
  );
}

