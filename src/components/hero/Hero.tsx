"use client";

import dynamic from "next/dynamic";
import Collage from "./Collage";
import InfoCard from "./InfoCard";
import NavBar from "./NavBar";

// WebGL has no server-side equivalent, so the canvas is client-only.
const Character = dynamic(() => import("./Character"), { ssr: false });

export default function Hero() {
  return (
    <section className="hero" id="top">
      {/* Layer 1 - drifting media field, kept behind and de-emphasised. */}
      <Collage />

      {/* Layer 2 - the character, always unobstructed. */}
      <div className="hero-stage">
        <Character />
      </div>

      {/* Layer 3 - foreground UI. */}
      <InfoCard />
      <NavBar />
    </section>
  );
}
