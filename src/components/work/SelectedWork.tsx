"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { WORK } from "@/config/work";
import type { PanelScreen } from "./Drum";

// WebGL has no server-side equivalent, so the canvas is client-only.
const Drum = dynamic(() => import("./Drum"), { ssr: false });

/**
 * Selected Work.
 *
 * The stage is exactly one viewport, as the reference's is - it sets
 * `min-height: 100svh; max-height: 100svh` on the slider and means it. The
 * header line sits in its own fixed strip at the top, the display word
 * fills the width behind the drum and is cropped by the edges, the drum is
 * centred, and the control bar is fixed near the bottom edge.
 *
 * The reference draws its titles into the canvas, which costs a font atlas
 * and gives up selectable, translatable, screen-readable text. They are DOM
 * here instead, positioned from the panel placements the drum reports every
 * frame, so each title still travels with its own panel.
 *
 * The list below the stage is not a fallback. It is the real content, and
 * it is what a crawler, a reader mode, or a browser with WebGL disabled
 * gets; the drum is the presentation layer over it.
 */
export default function SelectedWork() {
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<"arc" | "flat">("arc");
  const [hover, setHover] = useState(-1);
  /** Whether the pointer is on the control bar, which opens its controls. */
  const [barOpen, setBarOpen] = useState(false);
  /** Which step button is under the pointer, for the bar's preview. */
  const [peek, setPeek] = useState<-1 | 0 | 1>(0);

  const viewRef = useRef<HTMLSpanElement>(null);
  const titleRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const screenRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLHeadingElement>(null);
  const cursorRef = useRef<HTMLSpanElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const raf = useRef(0);

  const items = WORK.items;
  const count = items.length;

  /**
   * Move the View pill with the cursor.
   *
   * Written straight to the element rather than held in state: hover is a
   * boolean-ish thing that changes rarely and belongs in React, but the
   * coordinates change on every mousemove and re-rendering the section for
   * them would be absurd.
   */
  const onCursor = useCallback((x: number, y: number) => {
    const el = viewRef.current;
    if (el) el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;
  }, []);

  /**
   * Put each title on its own panel.
   *
   * Same reasoning as the pill, with more at stake: this runs on every one
   * of the drum's frames, and the titles have to land on the panels in the
   * *same* frame the panels moved or they trail a frame behind and visibly
   * swim. Writing the transforms here, synchronously, is what keeps them
   * welded to the image.
   */
  const onPanels = useCallback((panels: readonly PanelScreen[]) => {
    for (let i = 0; i < panels.length; i++) {
      const el = titleRefs.current[i];
      if (!el) continue;
      const p = panels[i];

      /*
       * `span` is one world unit as a fraction of the canvas width, so a
       * panel's own width on screen is `span * panelWidth`. Dividing the
       * title's flat-mode width by that gives a scale of 1 when the panel
       * is a full flat card and less as it turns or the drum closes.
       */
      const scale = (p.span * 5.4) / 0.65;

      // Squared, so a panel only a little turned is already well faded -
      // the reference never shows two titles at once on the closed drum.
      const alpha = p.facing * p.facing;

      el.style.transform = `translate3d(${p.x}px, ${p.y}px, 0) translate(-50%, -50%) scale(${scale})`;
      el.style.opacity = String(alpha);
    }
  }, []);

  /**
   * Pointer position over the section, as two custom properties.
   *
   * Everything that leans with the cursor - the display word, the glow,
   * the ring - reads these rather than having its own listener. One
   * handler writing two numbers is cheaper than five, and it guarantees
   * they all lean by the same amount at the same instant.
   */
  const onScreenMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const el = screenRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - r.left;
    const y = e.clientY - r.top;

    el.style.setProperty("--w-px", String((x / r.width) * 2 - 1));
    el.style.setProperty("--w-py", String((y / r.height) * 2 - 1));

    /*
     * The ring rides the whole section, not just the canvas.
     *
     * It used to be driven from the drum's own pointer handler, which only
     * fires over the canvas - so the ring froze the moment the pointer
     * crossed onto the heading or the bar while the native cursor carried
     * on without it. Driving it from here, where the section is already
     * measuring the pointer, means one source of truth for everything that
     * follows the cursor.
     */
    const ring = cursorRef.current;
    if (ring) ring.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%)`;

    /*
     * How far apart the chromatic ghosts are pulled.
     *
     * Proximity to the word rather than `:hover` on it, and not by choice
     * at first: the stage is absolutely positioned over the whole section,
     * so the canvas swallows every pointer event and the heading behind it
     * can never be hovered at all.
     *
     * It turned out to be the better effect. A binary hover snaps the
     * separation on at the letter's edge; this opens it as the cursor
     * approaches and closes it as the cursor leaves, so the word responds
     * to being *neared* rather than to being touched.
     */
    const word = displayRef.current;
    if (word) {
      const wr = word.getBoundingClientRect();
      const cx = e.clientX;
      const cy = e.clientY;
      // Distance to the word's box, zero when the pointer is inside it.
      const dx = Math.max(wr.left - cx, 0, cx - wr.right);
      const dy = Math.max(wr.top - cy, 0, cy - wr.bottom);
      const dist = Math.hypot(dx, dy);
      const amount = 1 - Math.min(dist / (wr.height * 0.9), 1);
      // Eased, so the separation builds late rather than linearly.
      el.style.setProperty("--w-chroma-amt", (amount * amount).toFixed(3));
    }
  }, []);

  /**
   * How far the section has travelled through the viewport, 0 to 1.
   *
   * Drives the warm glow behind the drum, so the section lights up as it
   * arrives and cools as it leaves. Read in a rAF rather than in the
   * scroll handler: Lenis emits one per frame anyway, and doing the layout
   * read inside the frame keeps it batched with everything else measuring.
   */
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    const read = () => {
      raf.current = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      // 0 as the section enters, 1 at the middle of its pass, 0 as it goes.
      const through = (vh - r.top) / (vh + r.height);
      const arc = Math.sin(Math.min(Math.max(through, 0), 1) * Math.PI);
      el.style.setProperty("--w-through", arc.toFixed(4));
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

  const step = useCallback(
    (by: number) => setIndex((i) => (((i + by) % count) + count) % count),
    [count]
  );

  /**
   * Clicking a panel.
   *
   * A panel that is not centred pulls itself to the front first - the same
   * two-step the reference uses, and the only thing that makes sense when
   * the thing you clicked is half turned away from you.
   */
  const open = useCallback(
    (i: number) => {
      if (i !== index) {
        setIndex(i);
        return;
      }
      const href: string = items[i].href;
      if (href) window.location.href = href;
    },
    [index, items]
  );

  // Arrow keys step the drum while the section is the one on screen.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  /**
   * What the bar is previewing.
   *
   * Resting, it names the project on the front of the drum under a
   * "Category" label. With the pointer on a step button it shows where that
   * button goes instead, under "Next" - the thumbnail included, which is
   * the reference's nicest small touch and the reason the thumb is driven
   * from this index rather than from `index`.
   */
  const shown = items[(((index + peek) % count) + count) % count];
  const caption = peek === 0 ? WORK.barCaption : WORK.barNextCaption;

  return (
    <section
      id={WORK.id}
      ref={sectionRef}
      className="work"
      aria-labelledby="work-title"
    >
      <div
        ref={screenRef}
        className="work__screen"
        onPointerMove={onScreenMove}
        onPointerLeave={() => {
          const el = screenRef.current;
          if (!el) return;
          // Home, not frozen: everything leaning on the pointer unwinds.
          el.style.setProperty("--w-px", "0");
          el.style.setProperty("--w-py", "0");
          el.style.setProperty("--w-chroma-amt", "0");
        }}
      >
        {/* The warm glow. Brightest as the section crosses the middle of
            the viewport, and it leans with the cursor. */}
        <span className="work__glow" aria-hidden="true" />

        {/*
          The cursor.

          A ring replacing the native pointer for the whole section - the
          reference hides the system cursor outright with
          `cursor: none !important` while its own is up, and this does the
          same. It opens out when there is a panel under it, which is the
          same instant the View pill arrives.
        */}
        <span
          ref={cursorRef}
          className={hover >= 0 ? "work__cursor work__cursor--on" : "work__cursor"}
          aria-hidden="true"
        />
        {/* The header strip: one line, centred, over everything. */}
        <p className="work__intro">
          {/* The gap after the name is a margin, not a space character.
              JSX collapses whitespace at an element boundary, and the
              explicit {" "} that is supposed to survive it did not here. */}
          <span className="work__intro-name">{WORK.intro.name}</span>
          {WORK.intro.rest}
        </p>

        {/*
          Behind the drum, cropped by the viewport as the reference is.

          Three copies of the word, not one: a cyan ghost and a magenta
          ghost sitting under the ink. At rest they are a hair out of
          register, which is just enough to make the letters feel printed
          rather than rendered; on hover they pull apart into a chromatic
          separation and fade up.

          Stacked elements rather than a `text-shadow` pair, because a
          shadow cannot be given its own opacity or its own transition
          timing - and the whole effect is that the two ghosts arrive at
          slightly different speeds.
        */}
        <h2
          id="work-title"
          ref={displayRef}
          className="work__display"
          aria-label="Selected work"
          style={
            { "--w-display-vw": `${WORK.displayVw}vw` } as React.CSSProperties
          }
        >
          <span className="work__display-ghost work__display-ghost--c" aria-hidden="true">
            {WORK.display}
          </span>
          <span className="work__display-ghost work__display-ghost--m" aria-hidden="true">
            {WORK.display}
          </span>
          <span className="work__display-ink" aria-hidden="true">
            {WORK.display}
          </span>
        </h2>

        <div className="work__stage">
          <Drum
            items={items}
            index={index}
            mode={mode}
            onIndexChange={setIndex}
            onHoverChange={setHover}
            onCursor={onCursor}
            onPanels={onPanels}
            onOpen={open}
          />

          {/* One title per panel, ridden onto it by `onPanels`. */}
          {items.map((item, i) => (
            <p
              key={item.id}
              ref={(el) => {
                titleRefs.current[i] = el;
              }}
              className="work__title"
              aria-hidden="true"
            >
              {item.title}
            </p>
          ))}

          {/* Follows the cursor onto whichever panel it is over. */}
          <span
            ref={viewRef}
            className={hover >= 0 ? "work__view work__view--on" : "work__view"}
            aria-hidden="true"
          >
            {WORK.viewLabel}
          </span>
        </div>

        {/*
          The control bar.

          Resting it is a label and a single round button, and the whole bar
          advances the drum. Hovered, it opens into its real controls: the
          step buttons grow in, and the round button turns from "next" into
          the mode toggle. That is the reference's behaviour exactly, and it
          is why the bar is so quiet until you reach for it.
        */}
        <div
          className={[
            "work__nav",
            barOpen && "work__nav--open",
            peek !== 0 && "work__nav--peek",
          ]
            .filter(Boolean)
            .join(" ")}
          onPointerEnter={() => setBarOpen(true)}
          onPointerLeave={() => {
            setBarOpen(false);
            setPeek(0);
          }}
        >
          <div
            className="work__nav-panel"
            onClick={() => {
              if (!barOpen) step(1);
            }}
          >
            <span className="work__nav-tint" aria-hidden="true" />
            <span className="work__nav-shine" aria-hidden="true" />

            <div className="work__nav-body">
              <span className="work__nav-display" aria-hidden="true">
                <span
                  className="work__nav-thumb"
                  style={{ backgroundImage: `url(${shown.image})` }}
                />
              </span>

              <span className="work__nav-main">
                <span className="work__nav-caption">{caption}</span>
                <span className="work__nav-title">{shown.title}</span>
              </span>

              <span className="work__nav-actions">
                <button
                  type="button"
                  className="work__nav-step"
                  onClick={() => step(-1)}
                  onPointerEnter={() => setPeek(-1)}
                  onPointerLeave={() => setPeek(0)}
                  aria-label="Previous project"
                  tabIndex={barOpen ? 0 : -1}
                >
                  <Arrow dir="left" />
                </button>
                <button
                  type="button"
                  className="work__nav-step"
                  onClick={() => step(1)}
                  onPointerEnter={() => setPeek(1)}
                  onPointerLeave={() => setPeek(0)}
                  aria-label="Next project"
                  tabIndex={barOpen ? 0 : -1}
                >
                  <Arrow dir="right" />
                </button>
              </span>
            </div>
          </div>

          <button
            type="button"
            className="work__nav-large"
            onClick={() => (barOpen ? setMode((m) => (m === "arc" ? "flat" : "arc")) : step(1))}
            aria-pressed={mode === "flat"}
            aria-label={mode === "arc" ? "Flat view" : "Drum view"}
          >
            <span className="work__nav-tint" aria-hidden="true" />
            <span className="work__nav-shine" aria-hidden="true" />
            <span className="work__nav-large-content">
              <ModeIcon open={barOpen} flat={mode === "flat"} />
              <span className="work__nav-large-label">{WORK.modeLabel}</span>
            </span>
          </button>
        </div>
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

/** The step arrows, traced off the reference's own 16px icon. */
function Arrow({ dir }: { dir: "left" | "right" }) {
  const d =
    dir === "left"
      ? ["M3,8h10", "M6,5l-3,3", "M3,8l3,3"]
      : ["M13,8H3", "M10,5l3,3", "M10,11l3-3"];
  return (
    <svg className="work__nav-arrow" viewBox="0 0 16 16" aria-hidden="true">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

/**
 * The round button's icon.
 *
 * Three states, not two: a plain arrow while the bar is resting and the
 * button means "next", then the mode glyph once the bar has opened - three
 * arcs of a circle for the drum, three bars for the flat row. The arcs and
 * the bars are the same three paths cross-faded, which is near enough to
 * the reference's morph at 17px and does not need a path-tweening library.
 */
function ModeIcon({ open, flat }: { open: boolean; flat: boolean }) {
  return (
    <span className="work__nav-glyph" data-state={!open ? "next" : flat ? "flat" : "arc"}>
      <svg className="work__nav-mode" viewBox="0 0 24 24" aria-hidden="true">
        <g className="work__nav-mode-arc">
          <path d="M10.875,3.039c-4.438.555-7.875,4.334-7.875,8.922,0,1.238.251,2.418.703,3.491" />
          <path d="M20.297,15.452c.452-1.074.703-2.253.703-3.491,0-4.589-3.437-8.368-7.875-8.922" />
          <path d="M4.838,17.395c1.644,2.163,4.236,3.566,7.162,3.566s5.519-1.403,7.162-3.566" />
        </g>
        <g className="work__nav-mode-flat">
          <path d="M4,7h16" />
          <path d="M4,12h16" />
          <path d="M4,17h16" />
        </g>
        <g className="work__nav-mode-next">
          <path d="M4.5,12h15" />
          <path d="M14,6.5l5.5,5.5" />
          <path d="M14,17.5l5.5-5.5" />
        </g>
      </svg>
    </span>
  );
}
