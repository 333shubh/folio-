"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CHARACTER } from "@/config/hero";

function Dancer() {
  const root = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(CHARACTER.model);

  /**
   * Clone so the cached GLTF is never mutated.
   *
   * Object3D.clone() is not enough for a rigged model: it copies the meshes
   * but leaves them bound to the *original* skeleton, so the mixer animates
   * bones nothing is listening to and the character sits in its bind pose.
   * SkeletonUtils.clone rebuilds the bone graph and rebinds the skins.
   */
  const model = useMemo(() => {
    const c = cloneSkeleton(scene) as THREE.Group;
    c.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return c;
  }, [scene]);

  const { actions, names } = useAnimations(animations, root);

  useEffect(() => {
    if (!names.length) return;
    // Fall back to the first clip so an unfamiliar model still dances.
    const name = names.includes(CHARACTER.clip) ? CHARACTER.clip : names[0];
    const action = actions[name];
    if (!action) return;

    action.reset().setLoop(THREE.LoopRepeat, Infinity).fadeIn(0.4).play();
    return () => {
      action.fadeOut(0.3);
    };
  }, [actions, names]);

  /**
   * Fit the model to a known height with its feet on y=0.
   *
   * Measured from the *animated* pose, not the bind pose. A rest pose tells
   * you very little: rigs exported from different tools sit in T-pose, A-pose
   * or flat on their back along Z, so a bind-pose height can be off by an
   * order of magnitude. Sampling a few frames in means the character is
   * standing the way it will actually be seen.
   *
   * Hidden until fitted, otherwise the first frames flash at the wrong scale.
   */
  const fitted = useRef(false);
  const frames = useRef(0);

  useFrame((_, delta) => {
    const g = inner.current;

    if (g && !fitted.current) {
      frames.current += 1;
      // Give the mixer a few frames to drive the skeleton into a real pose.
      if (frames.current >= CHARACTER.fitAfterFrames) {
        g.scale.setScalar(1);
        g.position.set(0, 0, 0);
        g.updateWorldMatrix(true, true);

        const box = new THREE.Box3().setFromObject(g);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const height = size.y || 1;
        const scale = (CHARACTER.targetHeight / height) * CHARACTER.scale;

        g.scale.setScalar(scale);
        g.position.set(
          -center.x * scale,
          -box.min.y * scale,
          -center.z * scale
        );
        g.visible = true;
        fitted.current = true;
      }
    }

    if (root.current && CHARACTER.turnSpeed) {
      root.current.rotation.y += delta * CHARACTER.turnSpeed;
    }
  });

  return (
    <group ref={root}>
      <group ref={inner} visible={false}>
        <primitive object={model} />
      </group>
    </group>
  );
}

/**
 * Keeps the whole figure in frame at any viewport shape.
 *
 * A fixed camera distance only frames correctly at one aspect ratio - on a
 * narrow or tall window the horizontal field shrinks and the character gets
 * cropped. This solves for the distance that satisfies both the vertical and
 * horizontal fit, and re-solves on every resize.
 */
function FitCamera() {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const aspect = size.width / size.height;

    const visibleH = CHARACTER.targetHeight / CHARACTER.frameFill;
    const distForHeight = visibleH / 2 / Math.tan(vFov / 2);

    // Arms swing wide mid-dance, so the width constraint is what actually
    // bites on portrait windows.
    const distForWidth =
      CHARACTER.minVisibleWidth / 2 / (Math.tan(vFov / 2) * aspect);

    const dist = Math.max(distForHeight, distForWidth);
    const targetY = CHARACTER.targetHeight * 0.5;

    cam.position.set(0, targetY * 1.05, dist);
    cam.lookAt(0, targetY, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

export default function Character() {
  return (
    <Canvas
      className="character-canvas"
      shadows
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, CHARACTER.targetHeight * 0.55, 8], fov: 32 }}
    >
      <FitCamera />

      {/* Soft studio key + fill, matching the flat-lit reference look. */}
      <ambientLight intensity={0.9} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[1024, 1024]}
      />
      <directionalLight position={[-4, 3, -3]} intensity={0.5} />

      <Suspense fallback={null}>
        <Dancer />
      </Suspense>

      <ContactShadows
        position={[0, 0.01, 0]}
        opacity={0.42}
        scale={9}
        blur={2.6}
        far={4}
      />
    </Canvas>
  );
}

useGLTF.preload(CHARACTER.model);
