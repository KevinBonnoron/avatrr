import type { VRM } from '@pixiv/three-vrm';
import { VRMLoaderPlugin, VRMUtils } from '@pixiv/three-vrm';
import { VRMLookAtQuaternionProxy } from '@pixiv/three-vrm-animation';
import { useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { WebGLRenderer } from 'three';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/addons/loaders/KTX2Loader.js';

/** Shared KTX2Loader singleton. */
const ktx2Loader = new KTX2Loader().setTranscoderPath('https://cdn.jsdelivr.net/gh/pmndrs/drei-assets/basis/');

function createLoader(gl: WebGLRenderer): GLTFLoader {
  ktx2Loader.detectSupport(gl);
  const loader = new GLTFLoader();
  loader.setKTX2Loader(ktx2Loader);
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.register((parser) => new VRMLoaderPlugin(parser));
  return loader;
}

export function useVRM(url: string): VRM | null {
  const [vrm, setVrm] = useState<VRM | null>(null);
  const gl = useThree((s) => s.gl);
  const loaderRef = useRef<GLTFLoader | null>(null);

  useEffect(() => {
    if (!loaderRef.current) {
      loaderRef.current = createLoader(gl);
    }
    const loader = loaderRef.current;

    let disposed = false;
    loader
      .loadAsync(url)
      .then((gltf) => {
        if (disposed) {
          return;
        }

        const loadedVrm = gltf.userData.vrm as VRM;
        VRMUtils.rotateVRM0(loadedVrm);
        loadedVrm.scene.traverse((obj) => {
          obj.frustumCulled = false;
        });

        // Create VRMLookAtQuaternionProxy to suppress warnings from createVRMAnimationClip
        if (loadedVrm.lookAt) {
          const proxy = new VRMLookAtQuaternionProxy(loadedVrm.lookAt);
          proxy.name = 'VRMLookAtQuaternionProxy';
          loadedVrm.scene.add(proxy);
        }

        setVrm(loadedVrm);
      })
      .catch((err) => {
        console.error('[useVRM] Failed to load VRM:', err);
      });

    return () => {
      disposed = true;
      setVrm((prev) => {
        if (prev) {
          VRMUtils.deepDispose(prev.scene);
        }
        return null;
      });
    };
  }, [url, gl]);

  return vrm;
}
