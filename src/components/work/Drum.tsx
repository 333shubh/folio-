"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DRUM, type WorkItem } from "@/config/work";

/**
 * The Selected Work drum.
 *
 * Both display modes are one cylinder at two radii. `arc` closes the panels
 * into a drum; `flat` stretches the radius until the front panel is nearly
 * a flat billboard and its neighbours turn edge-on at the sides. Every
 * frame re-derives the layout from the current radius, so the two modes are
 * the same code path and cannot drift apart.
 *
 * The bend happens in the vertex shader rather than in rebuilt geometry:
 * the radius animates continuously, and regenerating three buffer
 * geometries per frame to follow it is a lot of garbage for a curve a
 * single sine can express.
 */

const VERT = /* glsl */ `
  uniform float uRadius;
  varying vec2 vUv;
  varying float vFace;

  void main() {
    vUv = uv;

    /*
     * position.x is arc length along the panel, not a chord, so the panel
     * keeps its width at every radius - only the angle it subtends changes.
     * Pulling the surface back by uRadius keeps the panel's centre on the
     * group origin however far the radius is stretched.
     */
    float theta = position.x / uRadius;
    vec3 bent = vec3(
      sin(theta) * uRadius,
      position.y,
      cos(theta) * uRadius - uRadius
    );

    // Facing, for the shading that makes the curve legible.
    vec3 n = normalize(normalMatrix * vec3(sin(theta), 0.0, cos(theta)));
    vFace = clamp(n.z, 0.0, 1.0);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(bent, 1.0);
  }
`;

const FRAG = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uOpacity;
  uniform float uFlip;
  varying vec2 vUv;
  varying float vFace;

  void main() {
    vec2 uv = vec2(vUv.x, mix(vUv.y, 1.0 - vUv.y, uFlip));
    vec3 c = texture2D(uMap, uv).rgb;

    // Sides that turn away from the camera fall off, so the drum reads as a
    // solid object rather than as three flat stickers.
    c *= mix(0.42, 1.0, pow(vFace, 0.55));

    /*
     * The reflection fades out as it drops away from the drum's foot.
     *
     * The mirror mesh is scaled by -1 on Y, which turns the geometry over:
     * vUv.y = 0 is the edge touching the drum and 1 is the far bottom, the
     * opposite way round from the panel above it.
     */
    float fade = mix(1.0, 1.0 - smoothstep(0.0, 0.72, vUv.y), uFlip);

    gl_FragColor = vec4(c, uOpacity * fade);
    #include <colorspace_fragment>
  }
`;

/** Mutable interaction state, shared between the pointer handlers and the
 *  frame loop. Deliberately outside React state - it changes every frame,
 *  and re-rendering the tree at 120Hz to carry a float is not the job. */
type Control = {
  /** Current spin of the drum, in radians. */
  spin: number;
  /** Spin at the moment the pointer went down. */
  spinAtGrab: number;
  /** Cursor x at the moment the pointer went down. */
  xAtGrab: number;
  dragging: boolean;
  /** Whether the live drag has passed the click/drag threshold. */
  moved: boolean;
  /** Current cylinder radius, eased toward the mode's target. */
  radius: number;
};

type Props = {
  items: readonly WorkItem[];
  index: number;
  mode: "arc" | "flat";
  onIndexChange: (i: number) => void;
};

/** The radius at which `count` panels close into a full circle. */
function closedRadius(count: number) {
  return (DRUM.panelWidth * count) / (2 * Math.PI);
}

function Panels({ items, index, mode, onIndexChange }: Props) {
  /*
   * Interaction state lives here, next to the frame loop that reads it,
   * rather than in the wrapper component.
   *
   * The pointer handlers hang off the canvas element itself - reachable
   * through r3f's `gl` - so the drag, the spin and the layout are one
   * unit. Owning the state a level up and passing the ref down meant a
   * component mutating something it did not own, which is what the hooks
   * immutability rule is there to catch.
   */
  const ctl = useRef<Control>({
    spin: 0,
    spinAtGrab: 0,
    xAtGrab: 0,
    dragging: false,
    moved: false,
    radius: closedRadius(items.length),
  });

  const canvas = useThree((s) => s.gl.domElement);
  const group = useRef<THREE.Group>(null);
  const panels = useRef<(THREE.Mesh | null)[]>([]);
  const mirrors = useRef<(THREE.Mesh | null)[]>([]);

  const urls = useMemo(() => items.map((i) => i.image) as string[], [items]);
  const textures = useLoader(THREE.TextureLoader, urls);

  useEffect(() => {
    for (const t of textures) {
      t.colorSpace = THREE.SRGBColorSpace;
      // The panel is a single unrepeated image; clamping avoids a seam
      // bleeding in from the opposite edge at the panel joins.
      t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
      t.anisotropy = 8;
    }
  }, [textures]);

  /**
   * A flat strip that the vertex shader bends. `position.x` spans the
   * panel's full width, which the shader then reads as arc length.
   */
  const geometry = useMemo(
    () => new THREE.PlaneGeometry(DRUM.panelWidth, DRUM.panelHeight, DRUM.segments, 1),
    []
  );
  useEffect(() => () => geometry.dispose(), [geometry]);

  const materials = useMemo(
    () =>
      textures.map(
        (map) =>
          new THREE.ShaderMaterial({
            vertexShader: VERT,
            fragmentShader: FRAG,
            uniforms: {
              uMap: { value: map },
              uRadius: { value: closedRadius(textures.length) },
              uOpacity: { value: 1 },
              uFlip: { value: 0 },
            },
            side: THREE.DoubleSide,
          })
      ),
    [textures]
  );

  /** The reflection reuses the panel image, flipped and faded. */
  const mirrorMaterials = useMemo(
    () =>
      materials.map((m) => {
        const c = m.clone();
        c.uniforms.uOpacity.value = 0.2;
        c.uniforms.uFlip.value = 1;
        c.transparent = true;
        c.depthWrite = false;
        return c;
      }),
    [materials]
  );

  useEffect(
    () => () => {
      for (const m of materials) m.dispose();
      for (const m of mirrorMaterials) m.dispose();
    },
    [materials, mirrorMaterials]
  );

  const targetRadius =
    closedRadius(items.length) *
    (mode === "arc" ? DRUM.arcRadiusScale : DRUM.flatRadiusScale);

  useFrame((_, rawDelta) => {
    const c = ctl.current;
    // A tab left in the background hands back a huge first delta; clamping
    // stops the drum snapping a quarter turn the moment it is focused.
    const delta = Math.min(rawDelta, 1 / 30);

    // Exponential ease, framerate-independent. `1 - 2^(-t/half)` reaches the
    // same fraction of the way home per second at any refresh rate.
    const ease = (from: number, to: number, seconds: number) =>
      from + (to - from) * (1 - Math.pow(2, (-delta / seconds) * 6));

    c.radius = ease(c.radius, targetRadius, DRUM.morphSeconds);

    const step = DRUM.panelWidth / c.radius;

    /*
     * A full turn of the *field*, which is not a full circle.
     *
     * The panels only close into 2π at the arc radius. Stretch the radius
     * and they subtend far less, so wrapping at π would leave all three
     * bunched on one side of the frame with nothing opposite them. Wrapping
     * at the field's own period puts each panel at whichever repeat is
     * nearest the front, which centres the row in flat mode and is exactly
     * the old behaviour in arc mode, where the period *is* 2π.
     */
    const turn = items.length * step;
    const wrap = (a: number) => {
      const m = ((a % turn) + turn) % turn;
      return m > turn / 2 ? m - turn : m;
    };

    // While dragging, the pointer owns the spin; otherwise it settles onto
    // the selected panel by the shortest way round.
    if (!c.dragging) {
      c.spin = ease(c.spin, c.spin + wrap(-index * step - c.spin), DRUM.snapSeconds);
    }

    // The group sits back by the radius so the front panel stays on the
    // camera's focus point no matter how far the radius is stretched.
    if (group.current) group.current.position.z = -c.radius;

    for (let i = 0; i < items.length; i++) {
      const angle = wrap(i * step + c.spin);
      const x = Math.sin(angle) * c.radius;
      const z = Math.cos(angle) * c.radius;

      for (const set of [panels, mirrors]) {
        const mesh = set.current[i];
        if (!mesh) continue;
        mesh.position.x = x;
        mesh.position.z = z;
        mesh.rotation.y = angle;
        (mesh.material as THREE.ShaderMaterial).uniforms.uRadius.value = c.radius;
      }
    }
  });

  /**
   * Drag and swipe.
   *
   * The whole canvas is the dial, not just the panels: grabbing the empty
   * space beside the drum turns it too, the way a physical one would. That
   * is why these are DOM listeners on the canvas rather than r3f pointer
   * props on a mesh, which would only fire over the geometry itself.
   */
  useEffect(() => {
    const c = ctl.current;
    const count = items.length;

    /** Snaps to whichever panel ended up facing front, and reports it up. */
    const settle = () => {
      const step = DRUM.panelWidth / c.radius;
      const nearest = Math.round(-c.spin / step);
      onIndexChange(((nearest % count) + count) % count);
    };

    const down = (e: PointerEvent) => {
      if (e.button !== 0) return;
      c.dragging = true;
      c.moved = false;
      c.xAtGrab = e.clientX;
      c.spinAtGrab = c.spin;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };

    const move = (e: PointerEvent) => {
      if (!c.dragging) return;
      const dx = e.clientX - c.xAtGrab;
      // A few pixels of slop, so a click is a click and not a tiny drag.
      if (Math.abs(dx) > 3) c.moved = true;
      c.spin = c.spinAtGrab + dx * DRUM.dragPerPixel;
    };

    const up = (e: PointerEvent) => {
      if (!c.dragging) return;
      c.dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      canvas.style.cursor = "";
      // A click that never moved must not change the selection - the ease
      // back to the current panel handles it on its own.
      if (c.moved) settle();
    };

    /*
     * Horizontal wheel only.
     *
     * The drum sits in a page that scrolls, so claiming deltaY would trap
     * the reader inside the section. deltaX is free: a trackpad swipe spins
     * the drum and a normal scroll still moves the page past it.
     */
    const wheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      c.dragging = false;
      c.spin -= e.deltaX * DRUM.wheelPerUnit;
      settle();
    };

    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [canvas, items.length, onIndexChange]);

  return (
    <group ref={group}>
      {items.map((item, i) => (
        <group key={item.id}>
          <mesh
            ref={(m) => {
              panels.current[i] = m;
            }}
            geometry={geometry}
            material={materials[i]}
          />
          {/* Reflection: the same panel, mirrored under the drum's foot. */}
          <mesh
            ref={(m) => {
              mirrors.current[i] = m;
            }}
            geometry={geometry}
            material={mirrorMaterials[i]}
            position-y={-DRUM.panelHeight}
            scale-y={-1}
          />
        </group>
      ))}
    </group>
  );
}

/**
 * Frames the drum at any viewport shape.
 *
 * A fixed distance only frames correctly at one aspect ratio: the drum is
 * much wider than it is tall, so on a narrow window it is the *width* that
 * runs out first, long before the height does. This solves both constraints
 * and re-solves on resize, and it also fixes the camera's aim - r3f's
 * default camera points down -Z from wherever it is put, which at this
 * height would leave the drum sitting low in frame.
 */
function FitCamera({ count }: { count: number }) {
  const { camera, size } = useThree();

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const vFov = (cam.fov * Math.PI) / 180;
    const aspect = size.width / size.height;

    // The flat mode is the wide one, so frame for that and the drum fits too.
    const widest = DRUM.panelWidth * 1.04;
    const distForWidth = widest / 2 / (Math.tan(vFov / 2) * aspect);
    // Room for the panel plus the part of its reflection that is still lit.
    const distForHeight = (DRUM.panelHeight * 1.55) / 2 / Math.tan(vFov / 2);

    cam.position.set(
      0,
      DRUM.cameraHeight,
      Math.max(DRUM.cameraDistance, distForWidth, distForHeight)
    );
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, size, count]);

  return null;
}

export default function Drum(props: Props) {
  return (
    <div className="drum">
      <Canvas
        className="drum__canvas"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{
          position: [0, DRUM.cameraHeight, DRUM.cameraDistance],
          fov: DRUM.fov,
        }}
      >
        <FitCamera count={props.items.length} />
        {/* The panel textures suspend while they load. */}
        <Suspense fallback={null}>
          <Panels {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
