"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { DRUM, type WorkItem } from "@/config/work";

/**
 * The Selected Work drum.
 *
 * Both display modes are one cylinder at two radii. `arc` closes the panels
 * into a drum; `flat` stretches the radius far enough that the panels are
 * genuinely flat cards in a row, with the neighbours falling away at the
 * sides. Every frame re-derives the layout from the current radius, so the
 * two modes are the same code path and cannot drift apart.
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
  uniform float uWash;
  varying vec2 vUv;
  varying float vFace;

  void main() {
    vec2 uv = vec2(vUv.x, mix(vUv.y, 1.0 - vUv.y, uFlip));
    vec3 c = texture2D(uMap, uv).rgb;

    /*
     * Sides that turn away from the camera wash out toward the page, which
     * is what makes the drum read as a solid object on a white ground.
     *
     * Darkening them instead - the obvious way to shade a cylinder - is
     * wrong here, and visibly so: it lights the drum as if it were in a
     * dark room, and the reference's edges very plainly dissolve into the
     * white rather than falling into shadow. In flat mode vFace is ~1 over
     * the whole card, so this costs nothing there.
     */
    c = mix(vec3(1.0), c, mix(uWash, 1.0, pow(vFace, 0.55)));

    /*
     * The reflection fades out as it drops away from the panel's foot.
     *
     * The mirror mesh is scaled by -1 on Y, which turns the geometry over:
     * vUv.y = 0 is the edge touching the panel and 1 is the far bottom, the
     * opposite way round from the panel above it.
     */
    float fade = mix(1.0, 1.0 - smoothstep(0.0, 0.72, vUv.y), uFlip);

    gl_FragColor = vec4(c, uOpacity * fade);
    #include <colorspace_fragment>
  }
`;

/**
 * Mutable interaction state, shared between the pointer handlers and the
 * frame loop. Deliberately outside React state - it changes every frame,
 * and re-rendering the tree at 120Hz to carry a float is not the job.
 */
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
  /** Current camera distance, eased toward the mode's target. */
  distance: number;
  /** Camera distance that frames each mode. Solved on resize. */
  arcDistance: number;
  flatDistance: number;
  /** Cursor in canvas pixels, or null when it is outside. */
  cursor: { x: number; y: number } | null;
  /** Index of the panel under the cursor, or -1. */
  hover: number;
};

type Props = {
  items: readonly WorkItem[];
  index: number;
  mode: "arc" | "flat";
  onIndexChange: (i: number) => void;
  /** Reports which panel the cursor is over, for the View pill. */
  onHoverChange: (i: number) => void;
  /**
   * Cursor position inside the canvas, every move.
   *
   * A callback rather than state: the pill has to track the cursor, and
   * putting its coordinates through React would re-render the section on
   * every mousemove to move one element 2px.
   */
  onCursor: (x: number, y: number) => void;
  /** Click on a panel that is already centred. */
  onOpen: (i: number) => void;
  /**
   * Where each panel landed on screen this frame, for the titles.
   *
   * The reference draws a project title per slide, travelling with it -
   * two of them are legible side by side in flat mode. Carrying that in
   * the DOM needs the panels' screen positions every frame, and this is
   * the cheapest honest way to hand them over: one pre-allocated array,
   * written in place, read synchronously by the caller. Putting it through
   * React state would re-render the section at the refresh rate.
   */
  onPanels: (p: readonly PanelScreen[]) => void;
};

/** A panel's placement on screen, in canvas pixels. */
export type PanelScreen = {
  x: number;
  y: number;
  /** Apparent width of the panel, as a fraction of the canvas width. */
  span: number;
  /** 1 facing the camera, 0 edge-on or behind. */
  facing: number;
};

/** Centre-to-centre spacing of the panels, which includes the gap. */
const SPACING = DRUM.panelWidth + DRUM.panelGap;

/** The radius at which `count` panels close into a full circle. */
function closedRadius(count: number) {
  return (SPACING * count) / (2 * Math.PI);
}

function Panels({
  items,
  index,
  mode,
  onIndexChange,
  onHoverChange,
  onCursor,
  onOpen,
  onPanels,
}: Props) {
  /*
   * Interaction state lives here, next to the frame loop that reads it,
   * rather than in the wrapper component.
   *
   * The pointer handlers hang off the canvas element itself - reachable
   * through r3f's `gl` - so the drag, the spin and the layout are one unit.
   * Owning the state a level up and passing the ref down meant a component
   * mutating something it did not own, which is what the hooks immutability
   * rule is there to catch.
   */
  const ctl = useRef<Control>({
    spin: 0,
    spinAtGrab: 0,
    xAtGrab: 0,
    dragging: false,
    moved: false,
    radius: closedRadius(items.length),
    distance: 10,
    arcDistance: 10,
    flatDistance: 7,
    cursor: null,
    hover: -1,
  });

  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const canvas = gl.domElement;

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
    () =>
      new THREE.PlaneGeometry(
        DRUM.panelWidth,
        DRUM.panelHeight,
        DRUM.segments,
        1
      ),
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
              uWash: { value: DRUM.edgeWash },
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
        c.uniforms.uOpacity.value = DRUM.reflectionOpacity;
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

  /**
   * Solve the camera distance for each mode, and re-solve on resize.
   *
   * Both modes are framed against viewport *width* only, because that is
   * what the reference does: it sizes a slide `65svw` wide by `26svw` tall,
   * so the panel is a fixed fraction of the width and a fixed 2.5:1 at
   * every window shape.
   *
   * The earlier version also fitted to height and took whichever constraint
   * bound first. That is the safe general answer and the wrong one here -
   * on a short window it quietly shrank the drum, and the whole section
   * stopped matching the reference at exactly the window sizes a laptop
   * has. Height is allowed to crop instead, which is what `overflow:
   * hidden` on the section is for.
   */
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = DRUM.fov;
    const halfFov = (DRUM.fov * Math.PI) / 360;
    const aspect = size.width / Math.max(size.height, 1);

    /** Distance at which `world` units span `fraction` of the frame width. */
    const forWidth = (world: number, fraction: number) =>
      world / fraction / (2 * Math.tan(halfFov) * aspect);

    const c = ctl.current;

    /*
     * The drum is only as wide as the panels that are actually facing you.
     *
     * Fitting the full diameter was wrong and left the drum visibly small:
     * with three panels the front one spans 120 degrees of the cylinder,
     * so its silhouette is the chord `2R sin(60deg)` - 87% of the diameter -
     * and the rest of the circle is behind. Fitting the chord makes
     * `arcWidthFraction` mean what it says, the width of the thing you can
     * see, and keeps meaning it if the project count changes.
     */
    const R = closedRadius(items.length);
    const visibleWidth = 2 * R * Math.sin(Math.PI / Math.max(items.length, 2));

    c.arcDistance = forWidth(visibleWidth, DRUM.arcWidthFraction);
    c.flatDistance = forWidth(DRUM.panelWidth, DRUM.flatWidthFraction);
    cam.updateProjectionMatrix();
  }, [camera, size, items.length]);

  const targetRadius =
    closedRadius(items.length) *
    (mode === "arc" ? DRUM.arcRadiusScale : DRUM.flatRadiusScale);

  /** Scratch objects, so the frame loop allocates nothing. */
  const scratch = useMemo(() => new THREE.Vector3(), []);
  const scratchEdge = useMemo(() => new THREE.Vector3(), []);
  /**
   * Written in place every frame and handed to the caller as-is.
   *
   * A ref rather than a memo because it is deliberately mutable state that
   * outlives a render: the frame loop overwrites it at the refresh rate
   * and never replaces it. It is sized inside the loop, not during render -
   * a ref is not readable while rendering, and this one has nothing to say
   * until there is a frame to report anyway.
   */
  const screensRef = useRef<PanelScreen[]>([]);

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
    c.distance = ease(
      c.distance,
      mode === "arc" ? c.arcDistance : c.flatDistance,
      DRUM.morphSeconds
    );

    // The elevation is set as an angle rather than a height, so the look
    // down onto the top face stays the same as the camera dollies.
    const elevation = (DRUM.cameraElevationDeg * Math.PI) / 180;

    /*
     * Lift the camera and its target together.
     *
     * Moving both by the same amount leaves the view direction - and so the
     * look down onto the top face - exactly as the elevation set it, and
     * slides the drum down the frame instead. The reference centres its
     * slide on the viewport and hangs the display word off the header
     * above, which leaves the drum low in what is left over.
     */
    const frameHeight = 2 * Math.tan((DRUM.fov * Math.PI) / 360) * c.distance;
    const lift = DRUM.verticalOffset * frameHeight;

    camera.position.set(
      0,
      Math.sin(elevation) * c.distance + lift,
      Math.cos(elevation) * c.distance
    );
    camera.lookAt(0, lift, 0);
    // project() below reads the inverse world matrix, so it has to be
    // current - r3f only refreshes it on its way into the render.
    camera.updateMatrixWorld();

    const step = SPACING / c.radius;

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
      c.spin = ease(
        c.spin,
        c.spin + wrap(-index * step - c.spin),
        DRUM.snapSeconds
      );
    }

    // The group sits back by the radius so the front panel stays on the
    // camera's focus point no matter how far the radius is stretched.
    if (group.current) group.current.position.z = -c.radius;

    // Grown to fit on the first frame, and after any change of project.
    const screens = screensRef.current;
    while (screens.length < items.length) {
      screens.push({ x: 0, y: 0, span: 0, facing: 0 });
    }
    if (screens.length > items.length) screens.length = items.length;

    let nearest = -1;
    let nearestDist = Infinity;

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
        (mesh.material as THREE.ShaderMaterial).uniforms.uRadius.value =
          c.radius;
      }

      /*
       * Where the panel landed on screen.
       *
       * Projecting each panel's centre is not a raycast, and deliberately
       * so: the geometry three.js would raycast against is the *flat*
       * strip, because the bend only exists in the vertex shader. A
       * raycast would report hits against a plane nobody can see.
       *
       * The second point is one world unit along the panel's tangent, so
       * the gap between the two projections measures how many pixels a
       * world unit is worth right there. That is what sizes the title: it
       * has to shrink with a panel turning away exactly as the image on it
       * does, and a fixed font size would slide off the panel edge the
       * moment the drum moved.
       */
      const facing = Math.cos(angle);
      scratch.set(x, 0, z - c.radius).project(camera);
      scratchEdge
        .set(x + Math.cos(angle), 0, z - c.radius - Math.sin(angle))
        .project(camera);

      const screenX = ((scratch.x + 1) / 2) * size.width;
      const screenY = ((1 - scratch.y) / 2) * size.height;
      const out = screens[i];
      out.x = screenX;
      out.y = screenY;
      // Half the projected x-delta, because NDC spans -1..1 over the width.
      out.span = Math.abs(scratchEdge.x - scratch.x) / 2;
      out.facing = scratch.z < 1 ? Math.max(facing, 0) : 0;

      if (c.cursor) {
        const d = Math.abs(screenX - c.cursor.x);
        // Behind the camera, or turned away from it - not a candidate.
        if (scratch.z < 1 && facing > 0 && d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      }
    }

    /*
     * The hit area is the panel itself, measured, not a constant.
     *
     * Using a fixed fraction of the viewport was close enough in flat mode
     * and wrong in arc, where the same panel is less than half as wide on
     * screen - the View pill turned on well outside the drum. Both the
     * reach and the vertical bound come from the projection above, so they
     * follow the panel through the morph for free.
     */
    const reachX =
      nearest >= 0
        ? (screens[nearest].span * DRUM.panelWidth * size.width) / 2
        : 0;
    const reachY =
      (DRUM.panelHeight /
        (2 * Math.tan((DRUM.fov * Math.PI) / 360) * c.distance)) *
      size.height *
      0.5;

    const hover =
      c.cursor &&
      nearest >= 0 &&
      nearestDist < reachX &&
      Math.abs(c.cursor.y - screens[nearest].y) < reachY
        ? nearest
        : -1;

    if (hover !== c.hover) {
      c.hover = hover;
      onHoverChange(hover);
    }

    onPanels(screens);
  });

  /**
   * Drag, swipe and hover.
   *
   * The whole canvas is the dial, not just the panels: grabbing the empty
   * space beside the drum turns it too, the way a physical one would. That
   * is why these are DOM listeners on the canvas rather than r3f pointer
   * props on a mesh, which would only fire over the geometry itself - and
   * which, as above, would be raycasting the wrong shape anyway.
   */
  useEffect(() => {
    const c = ctl.current;
    const count = items.length;

    /** Snaps to whichever panel ended up facing front, and reports it up. */
    const settle = () => {
      const step = SPACING / c.radius;
      const nearest = Math.round(-c.spin / step);
      onIndexChange(((nearest % count) + count) % count);
    };

    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
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
      c.cursor = local(e);
      onCursor(c.cursor.x, c.cursor.y);
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
      // A click that never moved is a click on a panel, not a flick: open
      // the one under the cursor rather than re-snapping to where we are.
      if (c.moved) settle();
      else if (c.hover >= 0) onOpen(c.hover);
    };

    const leave = () => {
      c.cursor = null;
      if (c.hover !== -1) {
        c.hover = -1;
        onHoverChange(-1);
      }
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
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [canvas, items.length, onIndexChange, onHoverChange, onCursor, onOpen]);

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
          {/* Reflection: the same panel, mirrored under its foot. */}
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

export default function Drum(props: Props) {
  return (
    <div className="drum">
      <Canvas
        className="drum__canvas"
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
        camera={{ position: [0, 2, 10], fov: DRUM.fov }}
      >
        {/* The panel textures suspend while they load. */}
        <Suspense fallback={null}>
          <Panels {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
