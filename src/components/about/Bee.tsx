"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { BEE } from "@/config/about";
import {
  approach,
  elasticOut,
  integrate,
  makeBody,
  pursue,
  seek,
} from "./steering";

/**
 * The bee, the fruit, and the chase.
 *
 * A reproduction of the reference's own setup rather than an impression of
 * it. Three bodies are in play:
 *
 *   fruit    rides the cursor directly, on its own plane
 *   evader   seeks a point orbiting the cursor
 *   bee      pursues the evader, leading it
 *
 * Nothing chases the pointer itself. That is the point: the bee is always
 * aiming at where a *second* moving thing is about to be, which is what
 * produces the swinging, overshooting, never-quite-arriving flight. Every
 * attempt to shortcut this to "lerp the bee toward the cursor" reads as a
 * cursor follower, however it is tuned.
 *
 * Clicking the fruit drops it. It falls under gravity, stretches along the
 * fall, squashes on landing and springs back on an elastic curve, sits for
 * a moment and goes - and the next one to spawn is the other fruit.
 */

const BEE_URL = "/models/bee.glb";
const ORANGE_URL = "/models/orange.glb";
const GRAPES_URL = "/models/grapes.glb";

/**
 * The body, striped.
 *
 * The glb ships geometry with no materials - the reference paints it from
 * a separate 1024px texture that is not part of the model. Rather than
 * invent a UV unwrap, the stripes are banded straight off the local z,
 * which is the axis the body is long on. It stays crisp at any size and
 * costs one fract and two smoothsteps.
 */
const BODY_VERT = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  void main() {
    vPos = position;
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BODY_FRAG = /* glsl */ `
  precision highp float;

  uniform vec3 uBody;
  uniform vec3 uStripe;

  varying vec3 vPos;
  varying vec3 vNormal;

  void main() {
    // Bands across the abdomen, and a dark head at the front end.
    float band = fract(vPos.z * 9.0 + 0.5);
    float stripe = smoothstep(0.30, 0.38, band) - smoothstep(0.62, 0.70, band);
    float head = smoothstep(0.085, 0.135, vPos.z);
    vec3 base = mix(uBody, uStripe, clamp(max(stripe, head), 0.0, 1.0));

    float key = max(dot(vNormal, normalize(vec3(0.3, 0.8, 0.9))), 0.0);
    float fill = max(dot(vNormal, normalize(vec3(-0.4, -0.6, 0.2))), 0.0);
    gl_FragColor = vec4(base * (0.62 + 0.42 * key + 0.16 * fill), 1.0);
    #include <colorspace_fragment>
  }
`;

type Props = {
  /** Pointer in 0..1 over the section, or null when it has left. */
  pointer: React.RefObject<{ x: number; y: number } | null>;
  /** 0 while the section is arriving, 1 once it is in place. */
  reveal: React.RefObject<number>;
  /** Raised by the section on a click; consumed here. */
  drop: React.RefObject<boolean>;
};

/** What the fruit is doing. */
type Phase = "follow" | "falling" | "resting" | "vanishing" | "away";

export default function Bee({ pointer, reveal, drop }: Props) {
  const beeGltf = useLoader(GLTFLoader, BEE_URL);
  const orangeGltf = useLoader(GLTFLoader, ORANGE_URL);
  const grapesGltf = useLoader(GLTFLoader, GRAPES_URL);

  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);

  const beeGroup = useRef<THREE.Group>(null);
  const fruitGroup = useRef<THREE.Group>(null);
  const fruitInner = useRef<THREE.Group>(null);
  const wings = useRef<THREE.Object3D[]>([]);

  /*
   * Everything below changes every frame and nothing in the tree renders
   * from it, so none of it is React state - that would re-render the
   * section at the refresh rate to move numbers the DOM never sees.
   */
  const bee = useMemo(() => makeBody(BEE.pursuer.mass, BEE.pursuer.maxForce, BEE.pursuer.maxSpeed), []);
  const evader = useMemo(() => makeBody(BEE.evader.mass, BEE.evader.maxForce, BEE.evader.maxSpeed), []);
  const orbitTarget = useMemo(() => new THREE.Vector3(), []);
  /**
   * The point the orbit is drawn around.
   *
   * Held separately from `orbitTarget` rather than reusing it, and not for
   * tidiness: `orbitTarget.set(orbitTarget.x + ..., ...)` reads its own
   * previous value, so with no pointer on screen it adds up to three
   * quarters of a unit to itself every frame and walks off to infinity in
   * a few seconds. The positions go non-finite, the matrices follow, and
   * the tab takes the renderer down with it.
   */
  const orbitCentre = useMemo(() => new THREE.Vector3(), []);
  const mouse = useMemo(() => new THREE.Vector3(), []);
  const steer = useMemo(() => new THREE.Vector3(), []);

  const phase = useRef<Phase>("follow");
  const since = useRef(0);
  /** Which fruit is out. The reference alternates on every spawn. */
  const which = useRef(0);
  const fallVelocity = useRef(0);
  const landed = useRef(false);

  /** Cursor-speed tilt and stretch, and when the pointer last moved. */
  const prevPointer = useRef<{ x: number; y: number } | null>(null);
  const targetRotZ = useRef(0);
  const currentRotZ = useRef(0);
  const targetScale = useRef(1);
  const currentScale = useRef(1);
  const lastMoveAt = useRef(0);

  /** Cloned so a second mount never animates the first one's graph. */
  const beeScene = useMemo(() => beeGltf.scene.clone(true), [beeGltf.scene]);
  const fruits = useMemo(
    () => [orangeGltf.scene.clone(true), grapesGltf.scene.clone(true)],
    [orangeGltf.scene, grapesGltf.scene]
  );

  /**
   * Dress the bee.
   *
   * The reference picks its meshes out by name - anything containing "bee"
   * takes the body material, anything containing "aile" takes the wing -
   * and the glb is named the same way, so the same test works here.
   */
  useEffect(() => {
    const found: THREE.Object3D[] = [];

    const body = new THREE.ShaderMaterial({
      vertexShader: BODY_VERT,
      fragmentShader: BODY_FRAG,
      uniforms: {
        uBody: { value: new THREE.Color(BEE.body) },
        uStripe: { value: new THREE.Color(BEE.stripe) },
      },
    });
    const wing = new THREE.MeshBasicMaterial({
      color: "#ffffff",
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    beeScene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;

      if (/aile/i.test(`${m.name} ${m.parent?.name ?? ""}`)) {
        m.material = wing;
        const hinge = /aile/i.test(m.parent?.name ?? "") ? m.parent! : m;
        if (!found.includes(hinge)) found.push(hinge);
        return;
      }
      m.material = body;
    });

    wings.current = found;
    return () => {
      body.dispose();
      wing.dispose();
    };
  }, [beeScene]);

  /** The fruit ship their own materials, so they only need tidying. */
  useEffect(() => {
    for (const f of fruits) {
      f.traverse((o) => {
        const m = o as THREE.Mesh;
        if (!m.isMesh) return;
        const mat = m.material as THREE.MeshStandardMaterial;
        if (mat && "roughness" in mat) mat.roughness = 0.45;
      });
    }
  }, [fruits]);

  useFrame((state, rawDelta) => {
    const bg = beeGroup.current;
    const fg = fruitGroup.current;
    const fi = fruitInner.current;
    if (!bg || !fg || !fi) return;

    const delta = Math.min(rawDelta, 1 / 30);
    const t = state.clock.elapsedTime;
    since.current += delta;

    const alive = (reveal.current ?? 1) > 0.5;
    const p = pointer.current;

    /*
     * Cursor to world, on the plane the fruit rides.
     *
     * The reference raycasts against a `Plane(normal (0,0,1), -0.48)`.
     * The camera here never moves and the plane is a constant, so the same
     * answer comes out of two multiplies - no raycaster, no matrix work.
     */
    const depth = camera.position.z - BEE.hoverZ;
    const halfH = Math.tan((camera.fov * Math.PI) / 360) * depth;
    const halfW = halfH * (size.width / Math.max(size.height, 1));

    if (p) {
      mouse.set((p.x * 2 - 1) * halfW, -(p.y * 2 - 1) * halfH, BEE.hoverZ);

      /*
       * Tilt and stretch from how fast the pointer is travelling.
       *
       * Signed by the dominant axis, so a flick left leans the other way
       * from a flick right, and scaled by the reference's own factor.
       */
      const prev = prevPointer.current;
      if (prev) {
        const dx = (p.x - prev.x) * size.width;
        const dy = (p.y - prev.y) * size.height;
        const speed = Math.hypot(dx, dy);
        if (speed > 0.001) {
          const signed =
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? speed
                : -speed
              : dy > 0
                ? speed
                : -speed;
          const h = Math.max(-1, Math.min(signed * BEE.pointerSpeedFactor, 1));
          targetRotZ.current = h;
          targetScale.current = 1 + Math.abs(h);
          lastMoveAt.current = performance.now();
        }
      }
      prevPointer.current = { x: p.x, y: p.y };
    }

    /*
     * Unwind on a timer, not on a speed threshold.
     *
     * A pointer that has stopped sends no events at all, so there is no
     * speed left to measure and nothing would ever reset it.
     */
    if (performance.now() - lastMoveAt.current > BEE.pointerSpeedResetMs) {
      targetRotZ.current = 0;
      targetScale.current = 1;
    }
    currentRotZ.current += (targetRotZ.current - currentRotZ.current) * approach(BEE.rotationDamping, delta);
    currentScale.current += (targetScale.current - currentScale.current) * approach(BEE.speedScaleDamping, delta);

    /*
     * A click, if there was one.
     *
     * Consumed whatever the phase, so a click that lands mid-fall is not
     * queued up to fire the moment the next fruit spawns.
     */
    if (drop.current) {
      drop.current = false;
      if (phase.current === "follow" && p) {
        fallVelocity.current = 0;
        landed.current = false;
        phase.current = "falling";
        since.current = 0;
      }
    }

    // ---- the fruit -------------------------------------------------
    fg.visible = alive && !!p && phase.current !== "away";
    for (let i = 0; i < fruits.length; i++) {
      fruits[i].visible = i === which.current;
    }

    switch (phase.current) {
      case "follow": {
        if (p) {
          const k = approach(BEE.cursorLerp, delta);
          fg.position.x += (mouse.x - fg.position.x) * k;
          fg.position.y += (mouse.y - fg.position.y) * k;
          fg.position.z += (BEE.hoverZ - fg.position.z) * k;
        }
        fg.rotation.set(0, 0, currentRotZ.current * BEE.rotationVisualDegrees * (Math.PI / 180));
        fi.scale.setScalar(BEE.fruitScale * currentScale.current);
        fi.position.y = 0;
        break;
      }

      case "falling": {
        fallVelocity.current -= BEE.gravity * delta;
        fg.position.y += fallVelocity.current * delta;

        /*
         * Stretch along the fall, capped.
         *
         * Proportional to speed, so the fruit is longest at the moment
         * before impact. The cap is what stops it becoming a streak on a
         * long drop.
         */
        const s = Math.min(Math.abs(fallVelocity.current) * BEE.fallStretch, BEE.fallStretchMax);
        fi.scale.set(
          BEE.fruitScale * (1 - s * 0.25),
          BEE.fruitScale * (1 + s),
          BEE.fruitScale * (1 - s * 0.25)
        );
        fg.rotation.z += delta * 2.2;

        if (fg.position.y <= BEE.groundY) {
          fg.position.y = BEE.groundY;
          landed.current = true;
          phase.current = "resting";
          since.current = 0;
        }
        break;
      }

      case "resting": {
        /*
         * The landing squash, springing back on an elastic curve.
         *
         * Wide and flat at the moment of impact, then `elastic.out(1.25)`
         * over 1.25s - the reference's own figures - which is what gives
         * it the two or three diminishing wobbles rather than one bounce.
         */
        const k = Math.min(since.current / BEE.landSquash.seconds, 1);
        const e = elasticOut(k);
        const sx = BEE.landSquash.x + (1 - BEE.landSquash.x) * e;
        const sy = BEE.landSquash.y + (1 - BEE.landSquash.y) * e;
        fi.scale.set(BEE.fruitScale * sx, BEE.fruitScale * sy, BEE.fruitScale * sx);
        fg.position.y = BEE.groundY;
        fg.rotation.set(0, 0, 0);

        if (since.current >= BEE.restSeconds) {
          phase.current = "vanishing";
          since.current = 0;
        }
        break;
      }

      case "vanishing": {
        const k = Math.min(since.current / BEE.vanishSeconds, 1);
        fg.position.y = BEE.groundY - k * k * 4;
        fi.scale.setScalar(BEE.fruitScale * (1 - k));
        if (k >= 1) {
          phase.current = "away";
          since.current = 0;
        }
        break;
      }

      case "away": {
        if (since.current >= BEE.returnSeconds) {
          // The other fruit comes back, as the reference alternates.
          which.current = (which.current + 1) % fruits.length;
          fg.position.copy(mouse);
          fi.scale.setScalar(BEE.fruitScale);
          landed.current = false;
          fallVelocity.current = 0;
          phase.current = "follow";
          since.current = 0;
        }
        break;
      }
    }

    // ---- the chase -------------------------------------------------
    bg.visible = alive;
    if (!alive) return;

    /*
     * The target the evader seeks: a circle around the cursor.
     *
     * The centre only moves while there is a pointer, so when the cursor
     * leaves the bee keeps orbiting the last place it saw rather than
     * snapping to the middle of the screen.
     */
    if (p) orbitCentre.set(mouse.x, mouse.y, 0);
    orbitTarget.set(
      orbitCentre.x + Math.cos(t * BEE.orbitSpeed) * BEE.orbitRadius,
      orbitCentre.y + Math.sin(t * BEE.orbitSpeed) * BEE.orbitRadius,
      BEE.targetZ
    );

    seek(evader, orbitTarget, steer);
    integrate(evader, steer, delta);

    pursue(bee, evader, BEE.predictionFactor, steer);
    integrate(bee, steer, delta);

    bg.position.copy(bee.position);

    /*
     * Facing and banking, from the velocity the simulation produced.
     *
     * Reading it off the body rather than off a formula means the bee
     * leans into turns it actually made, which is the only way the lean
     * and the path can never disagree.
     */
    const v = bee.velocity;
    if (v.lengthSq() > 1e-6) {
      const yaw = Math.atan2(v.z, v.x);
      const pitch = THREE.MathUtils.clamp(-v.y * 0.12, -0.45, 0.45);
      const k = Math.min(delta * 6, 1);
      bg.rotation.y += (-yaw - bg.rotation.y) * k;
      bg.rotation.x += (pitch - bg.rotation.x) * k;
      bg.rotation.z +=
        (THREE.MathUtils.clamp(-v.x * 0.22, -0.7, 0.7) - bg.rotation.z) *
        Math.min(delta * 5, 1);
    }

    /*
     * The wingbeat.
     *
     * The glb has no animation track, so this is the animation. At 26
     * beats a second against 60 frames the wings alias into a blur rather
     * than reading as two paddles waving, which is the intent.
     */
    const flap = Math.sin(t * BEE.wingBeat * Math.PI * 2);
    for (let i = 0; i < wings.current.length; i++) {
      wings.current[i].rotation.x = flap * 0.85 * (i === 0 ? 1 : -1);
    }
  });

  return (
    <>
      {/*
        Lighting, matching the reference: one white key at half intensity
        out in front, plus enough ambient that the unlit side of the fruit
        does not go black against a near-white page.
      */}
      <ambientLight intensity={1.4} />
      <directionalLight position={[0, 0, 5]} intensity={0.5} />
      <directionalLight position={[2, 4, 3]} intensity={1.1} />

      {/* The fruit, out at the cursor. Clicking it drops it. */}
      {/* The fruit, out at the cursor. The section drops it on a click. */}
      <group ref={fruitGroup} visible={false}>
        {/* Both fruits are mounted; which one is showing is switched in
            the frame loop, not here - a ref cannot be read during render
            and swapping the mounted object would reload nothing but would
            churn the scene graph on every spawn. */}
        <group ref={fruitInner} scale={BEE.fruitScale}>
          {fruits.map((f, i) => (
            <primitive key={i} object={f} />
          ))}
        </group>
      </group>

      <group ref={beeGroup} scale={BEE.scale}>
        <primitive object={beeScene} />
      </group>
    </>
  );
}

// Fetched as soon as the module is, rather than when the section arrives.
useLoader.preload(GLTFLoader, BEE_URL);
useLoader.preload(GLTFLoader, ORANGE_URL);
useLoader.preload(GLTFLoader, GRAPES_URL);
