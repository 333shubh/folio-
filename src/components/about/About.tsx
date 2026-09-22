"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { ABOUT } from "@/config/about";
import Board from "./Board";

// WebGL has no server-side equivalent, so the canvas is client-only.
const Scene = dynamic(() => import("./Scene"), { ssr: false });

/**
 * About.
 *
 * Selected Work ends on a white screen; this is what it opens out into.
 * The section is one viewport of near-blank field with the text set over
 * it, and it arrives the way the rest of the page does - climbing over
 * what came before rather than pushing it out of frame.
 *
 * There is no photograph. The colour is only where the cursor has been:
 * moving across the section wipes a gradient into view along the pointer's
 * path, and it closes again behind you. A bee flies over the whole thing,
 * and clicking it knocks it out of the air.
 *
 * The softness is in three places, and all three matter:
 *
 *  - a white veil over the scene that burns off as the section arrives, so
 *    the field surfaces out of the page rather than cutting in
 *  - the reveal held back until the section is a third up the screen, which
 *    is what hides the join
 *  - the wipe itself, which fades over a second and a half rather than
 *    snapping shut behind the cursor
 *
 * The pointer and the reveal are passed down as refs, not as state. Both
 * change continuously, and re-rendering a section to carry a float to a
 * canvas that is already running its own loop would be pure waste.
 */
export default function About() {
  const sectionRef = useRef<HTMLElement>(null);
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const reveal = useRef(0);
  const raf = useRef(0);
  /**
   * A click asking for the fruit to be dropped.
   *
   * The canvas is over the content and takes no pointer events, so the
   * fruit cannot be clicked directly. The section catches the click
   * instead and raises this flag; the scene consumes it on its next frame,
   * where it already knows where the fruit is.
   */
  const drop = useRef(false);

  /** Only mounted once the section is near, so the page does not pay for
      a second WebGL context while nobody is looking at it. */
  const [live, setLive] = useState(false);

  /**
   * How far the section has arrived, from its own position on screen.
   *
   * Read in a rAF rather than in the scroll handler itself: Lenis emits a
   * scroll event per frame anyway, and doing the layout read inside the
   * frame keeps it batched with everything else that measures.
   */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const read = () => {
      raf.current = 0;
      const top = el.getBoundingClientRect().top;
      const vh = window.innerHeight;
      // 1 when the section's top has reached the top of the viewport, 0
      // while it is still a full screen below it.
      const r = 1 - Math.min(Math.max(top / vh, 0), 1);
      reveal.current = r;

      /*
       * The veil, written as a custom property on the section.
       *
       * This was a scroll-driven `animation-timeline: view()` first, which
       * is the right instinct - it runs on the compositor and costs no
       * script. It was also wrong by a mile in practice: `cover` measures
       * the element's whole pass across the viewport, so a full-height
       * section spends its named range half-faded before it has arrived.
       * Driving it from the same number the canvas uses keeps the veil and
       * the push-in exactly in step, which is the point of the thing.
       *
       * Held fully opaque until the section is a third of the way up the
       * screen, then cleared over the rest. That first third is what makes
       * the join invisible: Selected Work ends on white and the veil *is*
       * white, so while it is solid there is simply no edge between the two
       * sections to see - the field then surfaces out of the middle of the
       * screen rather than sliding in from the bottom of it.
       */
      const t = Math.min(Math.max((r - 0.35) / 0.6, 0), 1);
      el.style.setProperty("--about-reveal", String(t * t * (3 - 2 * t)));

      setLive(top < vh * 1.6);
    };

    const onScroll = () => {
      if (!raf.current) raf.current = requestAnimationFrame(read);
    };

    read();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, []);

  /**
   * The pointer, in 0..1 over the section.
   *
   * Written to a ref and read by the canvas's own frame loop. Nothing here
   * smooths or samples it - that belongs next to the frame it is used in,
   * where the delta is known and the trail lives.
   */
  const onMove = useCallback((e: React.PointerEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointer.current = {
      x: (e.clientX - r.left) / r.width,
      y: (e.clientY - r.top) / r.height,
    };
  }, []);

  return (
    <section
      id={ABOUT.id}
      ref={sectionRef}
      className="about"
      aria-labelledby="about-title"
      onPointerMove={onMove}
      // Null, not the last position: the canvas drifts it home from here.
      onPointerLeave={() => {
        pointer.current = null;
      }}
      onClick={() => {
        drop.current = true;
      }}
    >
      {/*
        The scene.

        The canvas is the backdrop itself, not a layer over one - there is
        no photograph behind it to fall back to, so the section carries the
        resting colour on its own background and the canvas simply paints
        over it once it is up.
      */}
      {live ? <Scene pointer={pointer} reveal={reveal} drop={drop} /> : null}

      {/*
        The veil.

        Opaque page white over the whole scene, thinning to nothing as the
        section climbs into place. Selected Work ends on white and this is
        the same white, so while it is solid there is no edge between the
        two sections to see.
      */}
      <span className="about__veil" aria-hidden="true" />

      <div className="about__inner">
        <div className="about__text">
          <p className="about__eyebrow">{ABOUT.eyebrow}</p>
          <h2 id="about-title" className="about__title">
            {ABOUT.title}
          </h2>
          <div className="about__body">
            {ABOUT.body.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
          <p className="about__hint">{ABOUT.hint}</p>
        </div>

        {/* Draggable frames, laid out as objects on a canvas. */}
        <Board />
      </div>
    </section>
  );
}
