"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { WORK } from "@/config/work";

// WebGL has no server-side equivalent, so the canvas is client-only.
const Drum = dynamic(() => import("./Drum"), { ssr: false });

/**
 * Selected Work.
 *
 * The drum carries the images; everything legible is DOM on top of it. The
 * reference draws its titles into the canvas, which costs a font atlas and
 * gives up selectable, translatable, screen-readable text - for a title
 * sitting dead centre over the panel, an overlay is indistinguishable and
 * far cheaper.
 *
 * The list under the canvas is not a fallback. It is the real content, and
 * it is what a crawler, a reader mode, or a browser with WebGL disabled
 * gets; the drum is the presentation layer over it.
 */
export default function SelectedWork() {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"arc" | "flat">("arc");

  const items = WORK.items;
  const current = items[index];

  const step = useCallback(
    (by: number) =>
      setIndex((i) => ((i + by) % items.length + items.length) % items.length),
    [items.length]
  );

  return (
    <section id={WORK.id} className="work" aria-labelledby="work-title">
      <p className="work__intro">
        <span className="work__intro-name">{WORK.intro.name}</span>
        {WORK.intro.rest}
      </p>

      {/* Sits behind the drum, cropped by the viewport as the reference does. */}
      <h2 id="work-title" className="work__display" aria-label="Selected work">
        <span aria-hidden="true">{WORK.display}</span>
      </h2>

      <div className="work__stage">
        <Drum items={items} index={index} mode={mode} onIndexChange={setIndex} />

        {/*
          The title tracks the drum but does not move with it: it swaps on
          the selection, which is what the reference's centred serif does
          once a panel settles.
        */}
        <p className="work__title" key={current.id}>
          {current.title}
        </p>
      </div>

      <div className="work__bar">
        <div className="work__now">
          <span
            className="work__thumb"
            style={{ backgroundImage: `url(${current.image})` }}
            aria-hidden="true"
          />
          <span className="work__now-label">{current.title}</span>

          <button
            type="button"
            className="work__step"
            onClick={() => step(-1)}
            aria-label="Previous project"
          >
            <span aria-hidden="true">←</span>
          </button>
          <button
            type="button"
            className="work__step"
            onClick={() => step(1)}
            aria-label="Next project"
          >
            <span aria-hidden="true">→</span>
          </button>
        </div>

        <button
          type="button"
          className="work__mode"
          onClick={() => setMode((m) => (m === "arc" ? "flat" : "arc"))}
          aria-pressed={mode === "flat"}
        >
          <span className="work__mode-icon" aria-hidden="true" />
          {mode === "arc" ? "Flat" : "Arc"}
          <span className="visually-hidden"> view</span>
        </button>
      </div>

      {/* The content itself, for everything that is not the canvas. */}
      <ol className="work__list">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              className={
                i === index ? "work__list-link is-current" : "work__list-link"
              }
              href={item.href}
              onClick={() => setIndex(i)}
            >
              <span className="work__list-index">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="work__list-name">{item.title}</span>
              <span className="work__list-note">{item.note}</span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
