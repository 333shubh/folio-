"use client";

/**
 * The react-hooks immutability rule is disabled for this file.
 *
 * Driving an AnimationMixer *is* mutation: an AnimationAction is configured
 * by assigning timeScale, weight and loop mode on the object itself, and the
 * mixer keeps per-action state between frames. There is no immutable form of
 * that API. The rule models React state, so it reads every action setup as a
 * violation - all of it already lives inside effects, not render.
 */
/* eslint-disable react-hooks/immutability */

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useGLTF, useAnimations, ContactShadows } from "@react-three/drei";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { CHARACTER } from "@/config/hero";

function Dancer() {
  const root = useRef<THREE.Group>(null);
  const inner = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(CHARACTER.model);
  const [hovered, setHovered] = useState(false);

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
        // Nothing casts a shadow in this scene; skipping the shadow pass
        // keeps the draw cheap.
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
    return c;
  }, [scene]);

  const { actions, names, mixer } = useAnimations(animations, root);

  /**
   * Advances to the next dance. Assigned inside the effect below.
   *
   * All of the mixer work lives in effects rather than callbacks: actions
   * are imperative three.js objects, and configuring one (timeScale, loop
   * mode, weight) during render is exactly what the compiler's immutability
   * rule is there to catch.
   */
  const nextDanceRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const g = inner.current;
    if (!g || !mixer || !names.length) return;

    const pick = (wanted: string) =>
      names.includes(wanted) ? wanted : names[0];

    const dances = CHARACTER.danceClips.filter((c) => names.includes(c));

    let current: string | null = null;
    let danceIndex = -1;

    /** Crossfade to a clip, leaving the previous one to fade out. */
    const crossfadeTo = (
      name: string,
      opts: { loop: boolean; timeScale?: number }
    ) => {
      const next = actions[name];
      if (!next) return;

      const prev = current ? actions[current] : null;

      next.reset();
      next.setEffectiveWeight(1);
      next.timeScale = opts.timeScale ?? 1;
      next.clampWhenFinished = !opts.loop;
      next.setLoop(
        opts.loop ? THREE.LoopRepeat : THREE.LoopOnce,
        opts.loop ? Infinity : 1
      );
      next.play();

      if (prev && prev !== next) {
        prev.crossFadeTo(next, CHARACTER.fadeSeconds, false);
      } else {
        next.fadeIn(CHARACTER.fadeSeconds);
      }

      current = name;
    };

    const goIdle = () => crossfadeTo(pick(CHARACTER.idleClip), { loop: true });

    nextDanceRef.current = () => {
      if (!dances.length) return;
      danceIndex = (danceIndex + 1) % dances.length;
      crossfadeTo(dances[danceIndex], {
        loop: true,
        timeScale: CHARACTER.danceTimeScale,
      });
    };

    /**
     * Fit by sampling every clip, at full weight.
     *
     * Four traps, all of which produced a visibly broken character here:
     *
     * 1. A rest pose says almost nothing. Rigs export in T-pose, A-pose, or
     *    flat on their back along Z - this model measures 0.4 units tall at
     *    rest versus 1.77 deep, a 6.5x scale error.
     * 2. A single animated frame is no better. Land on a crouch and the
     *    height comes up short, the scale overshoots, and the figure is
     *    cropped as soon as it stands up.
     * 3. Sampling during a fade-in blends the clip with the bind pose, so a
     *    flat rest pose drags the measurement down and the scale explodes.
     * 4. One clip is not enough either, now that clicking switches dances -
     *    a big dance reaches further than an idle, so the camera has to
     *    allow for the largest of them or a later dance clips out of frame.
     */
    g.scale.setScalar(1);
    g.position.set(0, 0, 0);

    const union = new THREE.Box3();
    const box = new THREE.Box3();
    const samples = CHARACTER.fitSamples;

    for (const name of names) {
      const action = actions[name];
      if (!action) continue;

      for (const other of names) actions[other]?.stop();
      action.reset().play();
      action.setEffectiveWeight(1);

      const duration = action.getClip().duration;
      if (duration <= 0) continue;

      for (let i = 0; i < samples; i++) {
        mixer.setTime((i / samples) * duration);
        g.updateWorldMatrix(true, true);
        box.setFromObject(g);
        if (!box.isEmpty()) union.union(box);
      }
      action.stop();
    }

    mixer.setTime(0);

    if (!union.isEmpty()) {
      const size = union.getSize(new THREE.Vector3());
      const center = union.getCenter(new THREE.Vector3());
      const height = size.y || 1;
      const scale = (CHARACTER.targetHeight / height) * CHARACTER.scale;

      g.scale.setScalar(scale);
      g.position.set(-center.x * scale, -union.min.y * scale, -center.z * scale);
      g.visible = true;
    }

    // Wave hello, then settle into the idle.
    const intro = pick(CHARACTER.introClip);
    crossfadeTo(intro, { loop: false });

    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === actions[intro]) goIdle();
    };
    mixer.addEventListener("finished", onFinished);

    return () => {
      mixer.removeEventListener("finished", onFinished);
      for (const name of names) actions[name]?.stop();
      nextDanceRef.current = null;
    };
  }, [actions, names, mixer]);

  useFrame((_, delta) => {
    if (root.current && CHARACTER.turnSpeed) {
      root.current.rotation.y += delta * CHARACTER.turnSpeed;
    }
  });

  // The cursor should say the character is clickable.
  useEffect(() => {
    document.body.style.cursor = hovered ? "pointer" : "";
    return () => {
      document.body.style.cursor = "";
    };
  }, [hovered]);

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    nextDanceRef.current?.();
  };

  return (
    <group
      ref={root}
      onClick={onClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Hidden until fitted, or the first frames flash at the wrong scale. */}
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
    const targetY = CHARACTER.targetHeight * CHARACTER.lookAtFraction;

    cam.position.set(0, targetY, dist);
    cam.lookAt(0, targetY, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);

  return null;
}

export default function Character() {
  return (
    <Canvas
      className="character-canvas"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, CHARACTER.targetHeight * 0.55, 8], fov: 32 }}
    >
      <FitCamera />

      {/*
        Flat, low-contrast studio light.

        The reference casts no shadow on the ground and shows very little
        falloff across the figure, so this is mostly ambient with a gentle
        front-top key and a fill to lift the far side. A strong directional
        here reads as a different scene entirely.
      */}
      <ambientLight intensity={1.5} />
      <directionalLight position={[2, 5, 6]} intensity={0.85} />
      <directionalLight position={[-4, 2, -3]} intensity={0.35} />
      <hemisphereLight args={["#ffffff", "#c9c9c9", 0.6]} />

      <Suspense fallback={null}>
        <Dancer />
      </Suspense>

      {CHARACTER.contactShadowOpacity > 0 && (
        <ContactShadows
          position={[0, 0.01, 0]}
          opacity={CHARACTER.contactShadowOpacity}
          scale={9}
          blur={2.6}
          far={4}
        />
      )}
    </Canvas>
  );
}

useGLTF.preload(CHARACTER.model);
