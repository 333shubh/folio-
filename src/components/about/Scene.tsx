"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import Unveil from "./Unveil";
import Bee from "./Bee";

/**
 * The About canvases.
 *
 * Two of them, and it has to be two. The backdrop is opaque - it *is* the
 * section's background - so it has to sit behind the text and the board.
 * The bee is in the room with you and has to sit in front of them. One
 * canvas cannot be on both sides of the DOM, and the attempt to make it so
 * is worth recording: putting the single opaque canvas on top hid the
 * entire section behind a blank field.
 *
 * The front layer is transparent and takes no pointer events, so the
 * frames and the link underneath stay reachable straight through it. The
 * fruit is made clickable by the section catching the click and passing it
 * down as `drop`, rather than by the canvas swallowing pointer events.
 */

type Props = {
  pointer: React.RefObject<{ x: number; y: number } | null>;
  reveal: React.RefObject<number>;
  /** Raised by the section when someone clicks; consumed by the bee. */
  drop: React.RefObject<boolean>;
};

export default function Scene({ pointer, reveal, drop }: Props) {
  return (
    <>
      {/* Behind everything: the field the cursor wipes light into. */}
      <div className="about-scene about-scene--back">
        <Canvas
          className="about-scene__canvas"
          dpr={[1, 2]}
          gl={{ antialias: false, alpha: false }}
          // The backdrop writes straight to clip space, so this camera is
          // never consulted; it exists because Canvas wants one.
          orthographic
        >
          <Unveil pointer={pointer} reveal={reveal} />
        </Canvas>
      </div>

      {/* In front of everything: the bee and whatever it is chasing. */}
      <div className="about-scene about-scene--front">
        <Canvas
          className="about-scene__canvas"
          dpr={[1, 2]}
          gl={{ antialias: true, alpha: true }}
          camera={{ position: [0, 0, 6], fov: 45 }}
        >
          {/* Three glb files, and `useLoader` suspends until they arrive.
              Without a boundary that suspension escapes the canvas. */}
          <Suspense fallback={null}>
            <Bee pointer={pointer} reveal={reveal} drop={drop} />
          </Suspense>
        </Canvas>
      </div>
    </>
  );
}
