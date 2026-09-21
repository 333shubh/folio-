"use client";

import { useEffect, useRef } from "react";
import mediaManifest from "@/data/collage-media.json";
import {
  getClearZone,
  zoneDistance,
  zoneFade,
  repulsion,
  type ClearZone,
} from "@/lib/clear-zone";
import { COLLAGE } from "@/config/hero";

type MediaItem = {
  src: string;
  type: "image" | "video";
  w: number;
  h: number;
};

type Card = {
  el: HTMLDivElement;
  /** Base position in field space, moved only by ambient drift. */
  bx: number;
  by: number;
  vx: number;
  vy: number;
  w: number;
  h: number;
  rot: number;
  /** Parallax depth 0..1 - deeper cards are smaller, fainter, and lag more. */
  depth: number;
};

const media = mediaManifest as MediaItem[];

/** Deterministic PRNG so the layout is identical between server and client. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export default function Collage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    const rand = mulberry32(COLLAGE.seed);
    const cards: Card[] = [];

    /**
     * Never trust these to be non-zero at mount. A hidden, collapsed or
     * not-yet-laid-out container reports 0, which collapses the whole field
     * to the margin and piles every card in one corner.
     */
    const measure = () => ({
      w: Math.max(window.innerWidth || document.documentElement.clientWidth, 1),
      h: Math.max(window.innerHeight || document.documentElement.clientHeight, 1),
    });

    let { w: vw, h: vh } = measure();
    let zone: ClearZone = getClearZone(vw, vh);

    // The field extends past the viewport so cards wrap off-screen unseen.
    const M = COLLAGE.margin;
    const fieldW = () => vw + M * 2;
    const fieldH = () => vh + M * 2;

    // Cursor parallax, normalised to -1..1 and eased toward its target.
    let pointerTX = 0;
    let pointerTY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let scrollY = window.scrollY;

    let videoCount = 0;
    const pendingPlay: HTMLVideoElement[] = [];

    // Grid sized so the cells are roughly square across the whole field.
    const cols = Math.max(2, Math.round(Math.sqrt(
      (COLLAGE.cardCount * fieldW()) / fieldH()
    )));
    const rows = Math.max(2, Math.ceil(COLLAGE.cardCount / cols));
    const cellW = fieldW() / cols;
    const cellH = fieldH() / rows;

    const cellOrder: { col: number; row: number }[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) cellOrder.push({ col: c, row: r });
    }
    // Fisher-Yates on the seeded PRNG - deterministic, but uncorrelated.
    for (let k = cellOrder.length - 1; k > 0; k--) {
      const j = Math.floor(rand() * (k + 1));
      [cellOrder[k], cellOrder[j]] = [cellOrder[j], cellOrder[k]];
    }

    for (let i = 0; i < COLLAGE.cardCount; i++) {
      const item = media[i % media.length];
      if (!item) break;

      // Cap concurrently playing videos - each one is a decode pipeline, and
      // they stack up fast next to a WebGL scene.
      const useVideo = item.type === "video" && videoCount < COLLAGE.maxVideos;
      if (useVideo) videoCount++;
      if (item.type === "video" && !useVideo) continue;

      const depth = rand();
      const scale =
        COLLAGE.minScale + (1 - depth) * (COLLAGE.maxScale - COLLAGE.minScale);
      const w = item.w * scale;
      const h = item.h * scale;

      const el = document.createElement("div");
      el.className = "collage-card";
      el.style.width = `${w}px`;
      el.style.height = `${h}px`;

      if (useVideo) {
        const v = document.createElement("video");
        v.src = item.src;
        v.muted = true;
        v.loop = true;
        v.playsInline = true;
        v.autoplay = true;
        v.preload = "auto";
        // Older Safari needs the attribute, not just the property.
        v.setAttribute("muted", "");
        v.setAttribute("playsinline", "");
        el.appendChild(v);
        pendingPlay.push(v);
      } else {
        const img = document.createElement("img");
        img.src = item.src;
        img.alt = "";
        img.decoding = "async";
        img.loading = "lazy";
        el.appendChild(img);
      }

      root.appendChild(el);

      /**
       * Place on a jittered grid rather than at random.
       *
       * Uniform random over a field this much larger than the viewport
       * clumps badly - runs of empty screen next to piles of overlapping
       * cards. One card per cell with jitter keeps coverage even while
       * still looking unplanned.
       *
       * Cells are walked in a shuffled order so card size and depth are not
       * correlated with screen position.
       */
      const cell = cellOrder[i % cellOrder.length];
      let bx = 0;
      let by = 0;
      for (let attempt = 0; attempt < 12; attempt++) {
        bx = -M + (cell.col + 0.15 + rand() * 0.7) * cellW;
        by = -M + (cell.row + 0.15 + rand() * 0.7) * cellH;
        if (zoneDistance(bx, by, zone) > COLLAGE.spawnClearance) break;
      }

      const angle = rand() * Math.PI * 2;
      const speed =
        (COLLAGE.minSpeed + rand() * (COLLAGE.maxSpeed - COLLAGE.minSpeed)) *
        (1 - depth * 0.55);

      cards.push({
        el,
        bx,
        by,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        w,
        h,
        rot: (rand() - 0.5) * COLLAGE.maxTilt,
        depth,
      });
    }

    /**
     * Cards nearer the front react more, which is what makes the field read
     * as layered depth rather than one sheet sliding around. The reference
     * shows a 22-59px spread between cards for the same cursor travel.
     */
    const parallaxFactor = (c: Card) => 0.45 + (1 - c.depth) * 0.85;

    const place = (c: Card) => {
      const f = parallaxFactor(c);
      const x = c.bx + pointerX * COLLAGE.pointerAmplitudeX * f;
      const y =
        c.by +
        pointerY * COLLAGE.pointerAmplitudeY * f -
        scrollY * COLLAGE.scrollFactor * f;
      return { x, y };
    };

    /**
     * Paint a card at its current parallaxed position.
     *
     * Position and opacity are only ever written here, and this runs once up
     * front as well as inside the frame loop - rAF does not run in a
     * background tab, so a page loaded out of focus would otherwise keep
     * every card stacked at 0,0 and invisible until first looked at.
     */
    const paint = (c: Card) => {
      const { x, y } = place(c);
      const d = zoneDistance(x, y, zone);
      const opacity =
        zoneFade(d) *
        (COLLAGE.baseOpacity - c.depth * COLLAGE.depthOpacityFalloff);

      c.el.style.transform = `translate3d(${x - c.w / 2}px, ${
        y - c.h / 2
      }px, 0) rotate(${c.rot}deg)`;
      c.el.style.opacity = opacity.toFixed(3);
    };

    for (const c of cards) paint(c);

    /**
     * Start the clips now that every card is attached.
     *
     * play() can reject transiently while the element settles, and a clip
     * that is already buffered will never fire `canplay` again - so a single
     * event listener is not a reliable fallback. A few spaced retries covers
     * both cases without busy-waiting.
     */
    const playTimers: number[] = [];
    for (const v of pendingPlay) {
      let attempts = 0;
      const tryPlay = () => {
        if (!v.isConnected || !v.paused) return;
        v.play().catch(() => {
          /* autoplay blocked by policy - card stays on its first frame */
        });
        if (++attempts < 5) {
          playTimers.push(window.setTimeout(tryPlay, 150 * attempts));
        }
      };
      tryPlay();
    }

    const onPointerMove = (e: PointerEvent) => {
      pointerTX = (e.clientX / vw) * 2 - 1;
      pointerTY = (e.clientY / vh) * 2 - 1;
    };
    // Pointer events cover mouse, pen and touch-drag in one listener.
    window.addEventListener("pointermove", onPointerMove, { passive: true });

    const onScroll = () => {
      scrollY = window.scrollY;
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      for (const v of pendingPlay) {
        if (v.isConnected && v.paused) v.play().catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", onVisibility);

    /**
     * Remap the field on resize.
     *
     * Card positions are laid out once against the field size at mount. Only
     * updating vw/vh here would leave them scattered for the old viewport -
     * clumped in a corner after a window grows, or pushed off-screen after it
     * shrinks. Rescaling their base positions keeps the distribution intact.
     */
    const onResize = () => {
      const oldW = fieldW();
      const oldH = fieldH();

      const next = measure();
      vw = next.w;
      vh = next.h;

      const sx = fieldW() / oldW;
      const sy = fieldH() / oldH;
      for (const c of cards) {
        c.bx = (c.bx + M) * sx - M;
        c.by = (c.by + M) * sy - M;
      }

      zone = getClearZone(vw, vh);
      for (const c of cards) paint(c);
    };
    window.addEventListener("resize", onResize);

    // The container can be laid out after mount (hidden pane, late fonts,
    // mobile browser chrome settling), so re-measure once the first frame
    // has actually been through layout.
    const ro = new ResizeObserver(() => {
      const next = measure();
      if (next.w !== vw || next.h !== vh) onResize();
    });
    ro.observe(document.documentElement);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      // Cap dt so a backgrounded tab does not teleport every card on return.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      // Ease toward the cursor so the field trails it with some weight.
      // Exponential smoothing on elapsed time, so the feel is identical at
      // 60Hz, 144Hz, or while the tab is being throttled.
      const k = 1 - Math.exp(-dt / COLLAGE.pointerTau);
      pointerX += (pointerTX - pointerX) * k;
      pointerY += (pointerTY - pointerY) * k;

      const fw = fieldW();
      const fh = fieldH();

      for (const c of cards) {
        if (!reduceMotion) {
          c.bx += c.vx * dt;
          c.by += c.vy * dt;
        }

        // Repel against the *rendered* position, not the base one, or
        // parallax could still carry a card across the character.
        const { x, y } = place(c);
        const d = zoneDistance(x, y, zone);
        if (d < 1) {
          const { nx, ny } = repulsion(x, y, zone);
          const push = (1 - d) * COLLAGE.repelStrength;
          c.bx += nx * zone.rx * push * dt;
          c.by += ny * zone.ry * push * dt;
        }

        // Toroidal wrap keeps the field infinite without respawning nodes.
        if (c.bx < -M - c.w) c.bx += fw + c.w;
        else if (c.bx > fw - M) c.bx -= fw + c.w;
        if (c.by < -M - c.h) c.by += fh + c.h;
        else if (c.by > fh - M) c.by -= fh + c.h;

        paint(c);
      }

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      for (const t of playTimers) clearTimeout(t);
      for (const c of cards) c.el.remove();
    };
  }, []);

  return <div ref={rootRef} className="collage-root" aria-hidden="true" />;
}
