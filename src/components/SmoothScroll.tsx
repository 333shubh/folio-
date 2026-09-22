"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import { SCROLL } from "@/config/scroll";

/**
 * Eased scrolling, the way both reference sites do it.
 *
 * This is the other half of the landing transition, and the half that is
 * invisible in a screenshot: native wheel scrolling moves the page in hard
 * ~100px steps, so the section covering the hero arrives in jumps. Lenis
 * interpolates toward the target every frame, and the cover glides instead.
 *
 * The lerp was measured rather than picked: a single 400px wheel tick on
 * the reference reached 61% of the way in 219ms and 92% in 608ms, which
 * fits `1 - (1 - 0.07)^frames` at 60Hz almost exactly.
 *
 * Lenis writes through to the real scroll position rather than transforming
 * a wrapper, so `position: fixed`, `window.scrollY` and the collage's own
 * scroll listener all keep working untouched.
 */
export default function SmoothScroll() {
  useEffect(() => {
    const lenis = new Lenis({
      lerp: SCROLL.lerp,
      // Hash links go through the same easing as everything else, and clear
      // the pinned nav strip on arrival.
      anchors: { offset: -SCROLL.anchorOffset },
      // Honours prefers-reduced-motion by falling back to 1:1 scrolling.
      respectReducedMotion: true,
    });

    let frame = 0;
    const loop = (time: number) => {
      lenis.raf(time);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      lenis.destroy();
    };
  }, []);

  return null;
}
