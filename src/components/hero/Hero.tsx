"use client";

import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import Collage from "./Collage";
import InfoCard from "./InfoCard";

// WebGL has no server-side equivalent, so the canvas is client-only.
const Character = dynamic(() => import("./Character"), { ssr: false });

/**
 * The landing hero, and the transition out of it.
 *
 * Measured off the reference, which does something less obvious than it
 * looks: the hero never scrolls. It is a `position: fixed` layer that stays
 * put for the whole page, and the section below it is opaque and sits one
 * stacking level higher, so scrolling *climbs the next section over* a hero
 * that has not moved. The empty runway below is what gives that section a
 * viewport's worth of travel to do it in.
 *
 * The obvious alternative - scrolling the hero away - reads completely
 * differently: things leave the frame rather than being covered by them.
 */
export default function Hero() {
  const [covered, setCovered] = useState(false);
  const raf = useRef(0);

  /**
   * Once the next section has climbed all the way over, the hero is doing
   * invisible work: a rigged glb, an animation mixer and a drifting media
   * field, all rendering behind an opaque panel for the rest of the page.
   * Hiding it hands those frames back - `visibility: hidden` stops r3f's
   * loop and pauses the videos, where opacity would not.
   */
  useEffect(() => {
    const read = () => {
      raf.current = 0;
      setCovered(window.scrollY > window.innerHeight * 1.05);
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

  return (
    <>
      {/* The runway. Empty on purpose - it is the scroll the cover needs. */}
      <div className="hero-runway" id="top" aria-hidden="true" />

      <section
        className={covered ? "hero hero--covered" : "hero"}
        aria-label="Intro"
      >
        {/* Layer 1 - drifting media field, kept behind and de-emphasised. */}
        <Collage />

        {/* Layer 2 - the character, always unobstructed. */}
        <div className="hero-stage">
          <Character />
        </div>

        {/* Layer 3 - foreground UI. */}
        <InfoCard />
      </section>
    </>
  );
}
