"use client";

import { useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { UNVEIL } from "@/config/about";

/**
 * The unveiled gradient.
 *
 * A full-frame quad over a flat field. The pointer's recent path is fed in
 * as a short ring of points, and every pixel asks how close it is to that
 * path and how long ago the cursor was there. Close and recent means the
 * gradient; far or stale means the blank field.
 *
 * The trail is sent as *segments*, not as points. Stamping a soft dot per
 * sample looks correct at reading speed and falls apart the instant anyone
 * flicks the cursor - the samples spread out and the stroke turns into a
 * dotted line. Measuring distance to the segment between consecutive
 * samples costs one extra clamp per point and the stroke stays continuous
 * at any speed.
 *
 * Doing it this way rather than with an accumulation buffer is a deliberate
 * trade: a ping-ponged render target would hold an unlimited history, but
 * it needs two framebuffers, a second material and a resize path, and the
 * history it buys beyond half a second is history that has already faded
 * out. Thirty-two points in a uniform array is the whole feature.
 */

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */ `
  precision highp float;

  #define TRAIL ${UNVEIL.trailLength}

  /** x, y in aspect-corrected space; z is age in seconds. */
  uniform vec3 uTrail[TRAIL];
  uniform float uTime;
  uniform vec2 uAspect;
  uniform float uRadius;
  uniform float uFade;
  uniform vec3 uBase;
  uniform float uLift;
  uniform float uGrain;
  uniform float uReveal;

  varying vec2 vUv;

  /** Cheap hash, for the grain that keeps the gradient from banding. */
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  /** Distance from p to the segment ab. */
  float segment(vec2 p, vec2 a, vec2 b) {
    vec2 ab = b - a;
    float len = dot(ab, ab);
    // A zero-length segment is a point; guard the divide rather than
    // branching, since the cursor sitting still produces plenty of them.
    float t = len > 0.0 ? clamp(dot(p - a, ab) / len, 0.0, 1.0) : 0.0;
    return distance(p, a + ab * t);
  }

  void main() {
    vec2 p = vUv * uAspect;

    /*
     * The mask.
     *
     * Taken as a max over the trail rather than a sum: overlapping samples
     * from a slow cursor would otherwise pile up past 1 and blow a hard
     * white core through the middle of the stroke.
     */
    float mask = 0.0;
    for (int i = 0; i < TRAIL - 1; i++) {
      vec3 a = uTrail[i];
      vec3 b = uTrail[i + 1];
      // z < 0 marks a slot that has never been written.
      if (a.z < 0.0 || b.z < 0.0) continue;

      float d = segment(p, a.xy, b.xy);
      float age = max(a.z, b.z);
      float life = 1.0 - clamp(age / uFade, 0.0, 1.0);
      // Squared, so the stroke holds its width for most of its life and
      // then leaves, rather than thinning evenly and reading as a smear.
      life = life * life;

      float reach = 1.0 - smoothstep(0.0, uRadius, d);
      mask = max(mask, reach * life);
    }

    /*
     * The sheen.
     *
     * A square root on the mask before it is used: the raw value peaks
     * well under 1 anywhere but dead centre of the stroke, so mixing
     * straight with it left a grey wash instead of light. This pushes the
     * midtones up so the lift actually arrives, while 0 stays 0 and the
     * field stays exactly the page colour.
     */
    float m = sqrt(clamp(mask, 0.0, 1.0));

    // Toward white, not toward a colour. The surface is being lit where
    // the cursor passes, not painted.
    vec3 c = mix(uBase, vec3(1.0), m * uLift * uReveal);

    // Grain last, so it sits on the result rather than on one layer of it.
    c += (hash(gl_FragCoord.xy + uTime) - 0.5) * uGrain;

    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }
`;

type Props = {
  /** Pointer in 0..1 over the section, or null when it has left. */
  pointer: React.RefObject<{ x: number; y: number } | null>;
  /** 0 while the section is arriving, 1 once it is in place. */
  reveal: React.RefObject<number>;
};

export default function Unveil({ pointer, reveal }: Props) {
  const size = useThree((s) => s.size);

  /**
   * The last cursor position that was actually recorded.
   *
   * The samples themselves live in the uniform array, newest first - not
   * in a ring buffer. A ring is the obvious structure and the wrong one
   * here: the shader joins each sample to the next one by index, so the
   * wrap point would draw a segment from the newest sample straight back
   * to the oldest, and a stray band would sweep the section every half
   * second. Shifting thirty-two vectors down by one costs nothing and the
   * indices then mean what the shader assumes they mean.
   */
  const last = useRef<{ x: number; y: number } | null>(null);

  const uniforms = useMemo(() => {
    return {
      uTrail: {
        value: Array.from({ length: UNVEIL.trailLength }, () =>
          new THREE.Vector3(0, 0, -1)
        ),
      },
      uTime: { value: 0 },
      uAspect: { value: new THREE.Vector2(1, 1) },
      uRadius: { value: UNVEIL.radius as number },
      uFade: { value: UNVEIL.fade as number },
      uBase: { value: new THREE.Color(UNVEIL.base) },
      uLift: { value: UNVEIL.lift as number },
      uGrain: { value: UNVEIL.grain as number },
      uReveal: { value: 1 },
    };
  }, []);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 1 / 30);

    /*
     * Aspect correction.
     *
     * The mask is measured in a space where one unit is the same distance
     * across and down, or the wipe is an ellipse on every window that is
     * not square. The shorter side stays 1 and the longer one grows.
     */
    const aspect = size.width / Math.max(size.height, 1);
    uniforms.uAspect.value.set(aspect >= 1 ? aspect : 1, aspect >= 1 ? 1 : 1 / aspect);

    const slots = uniforms.uTrail.value;

    // Age everything that has been written.
    for (const v of slots) {
      if (v.z >= 0) v.z += delta;
    }

    /*
     * Push a sample, but only when the cursor has actually moved.
     *
     * A still cursor writing the same point every frame would refill the
     * whole ring with one position, and the stroke behind it would vanish
     * in a third of a second while a bright dot sat under the pointer.
     */
    const p = pointer.current;
    if (p) {
      const moved =
        !last.current ||
        Math.abs(p.x - last.current.x) > 0.0008 ||
        Math.abs(p.y - last.current.y) > 0.0008;

      if (moved) {
        // Shift down, then write the newest into slot 0.
        for (let i = slots.length - 1; i > 0; i--) {
          slots[i].copy(slots[i - 1]);
        }
        slots[0].set(
          p.x * uniforms.uAspect.value.x,
          (1 - p.y) * uniforms.uAspect.value.y,
          0
        );
        last.current = { x: p.x, y: p.y };
      }
    }

    uniforms.uTime.value = state.clock.elapsedTime;
    uniforms.uReveal.value = reveal.current ?? 1;
  });

  return (
    <mesh frustumCulled={false} renderOrder={-1}>
      {/* Two triangles covering clip space; the vertex shader ignores the
          camera entirely, so there is nothing to frame or to resize. */}
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        // It is the backdrop: it must never occlude the bee in front of it.
        depthTest={false}
        depthWrite={false}
      />
    </mesh>
  );
}
