"use client";

import { useCallback, useRef, useState } from "react";
import { ABOUT, BOARD } from "@/config/about";

/**
 * The board.
 *
 * Frames laid out on the section the way objects sit on a Figma canvas -
 * a name badge, a selection outline and four corner handles - and every
 * one of them can be picked up and dragged.
 *
 * The drag writes `transform` straight to the element for the whole
 * gesture and only tells React where the frame ended up on release. State
 * per pointermove would re-render the whole board - seven frames and their
 * chrome - on every frame of every drag, to move one card, and it is the
 * difference between a drag that sticks to the cursor and one that swims
 * behind it.
 *
 * Positions are a percentage of the board plus a pixel offset. The
 * percentage is the arrangement, which has to survive a resize; the offset
 * is what the reader did to it, which only has to survive the session.
 */

type Offset = { x: number; y: number };

export default function Board() {
  /** Pixel offsets applied on top of each frame's authored position. */
  const [offsets, setOffsets] = useState<Record<string, Offset>>({});
  /** The frame under the pointer, which is the one wearing the chrome. */
  const [active, setActive] = useState<string | null>(null);
  /** Most recently touched frame, so a dragged frame comes to the front. */
  const [front, setFront] = useState<string | null>(null);

  const refs = useRef<Record<string, HTMLDivElement | null>>({});
  /** Live gesture, outside React for the reason in the file comment. */
  const drag = useRef<{
    id: string;
    startX: number;
    startY: number;
    base: Offset;
    moved: boolean;
  } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, id: string) => {
      // Let a real click on the link through; everything else is a handle.
      if ((e.target as HTMLElement).closest("a")) return;
      e.preventDefault();

      const base = offsets[id] ?? { x: 0, y: 0 };
      drag.current = {
        id,
        startX: e.clientX,
        startY: e.clientY,
        base,
        moved: false,
      };
      setFront(id);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [offsets]
  );

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;

    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // A few pixels of slop, so a click on the link is not read as a drag.
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) d.moved = true;

    const el = refs.current[d.id];
    if (el) {
      el.style.setProperty("--dx", `${d.base.x + dx}px`);
      el.style.setProperty("--dy", `${d.base.y + dy}px`);
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;

    if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
    if (!d.moved) return;

    // Commit, so a re-render does not snap the frame back to where it was.
    setOffsets((o) => ({
      ...o,
      [d.id]: {
        x: d.base.x + (e.clientX - d.startX),
        y: d.base.y + (e.clientY - d.startY),
      },
    }));
  }, []);

  return (
    <div className="board" aria-label="Things I can be handed">
      {BOARD.frames.map((f) => {
        const off = offsets[f.id] ?? { x: 0, y: 0 };
        const on = active === f.id;

        return (
          <div
            key={f.id}
            ref={(el) => {
              refs.current[f.id] = el;
            }}
            className={on ? "frame frame--on" : "frame"}
            style={
              {
                left: `${f.x}%`,
                top: `${f.y}%`,
                width: `${f.w}px`,
                // Authored tilt and live drag are separate properties, so
                // the drag never has to know what the tilt was.
                "--tilt": `${f.tilt}deg`,
                "--dx": `${off.x}px`,
                "--dy": `${off.y}px`,
                zIndex: front === f.id ? 20 : undefined,
              } as React.CSSProperties
            }
            onPointerEnter={() => setActive(f.id)}
            onPointerLeave={() => setActive((a) => (a === f.id ? null : a))}
            // Stopped, or picking up a card would also drop the fruit.
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => onPointerDown(e, f.id)}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            {/* The Figma chrome: a name badge and four corner handles. */}
            <span className="frame__badge" aria-hidden="true">
              {f.name}
            </span>
            <span className="frame__handles" aria-hidden="true">
              <i />
              <i />
              <i />
              <i />
            </span>

            {f.kind === "card" ? (
              <div className="frame__card">
                <p className="frame__title">{f.title}</p>
                <p className="frame__note">{f.note}</p>
              </div>
            ) : null}

            {f.kind === "image" ? (
              <div className="frame__image">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={f.src} alt={f.alt} draggable={false} />
              </div>
            ) : null}

            {f.kind === "link" ? (
              <div className="frame__card frame__card--link">
                <p className="frame__note">{ABOUT.link.note}</p>
                <a
                  className="frame__link"
                  href={ABOUT.link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {ABOUT.link.label}
                  <span aria-hidden="true"> ↗</span>
                </a>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
