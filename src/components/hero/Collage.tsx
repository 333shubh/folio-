"use client";

import { useEffect, useRef } from "react";
import mediaManifest from "@/data/collage-media.json";
import layoutData from "@/data/mimosa-layout.json";
import {
  getClearZone,
  zoneDistance,
  zoneFade,
  type ClearZone,
} from "@/lib/clear-zone";
import { COLLAGE } from "@/config/hero";

type MediaItem = {
  src: string;
  type: "image" | "video";
  w: number;
  h: number;
};

type LayoutCard = {
  x: number;
  y: number;
  w: number;
  h: number;
  type: "image" | "video";
};

type Card = {
  el: HTMLDivElement;
  /** Position in field space, fixed once laid out. */
  bx: number;
  by: number;
  w: number;
  h: number;
  /** Parallax depth 0..1, derived from the slot so it is stable. */
  depth: number;
};

const media = mediaManifest as MediaItem[];
const layout = layoutData as unknown as {
  refWidth: number;
  tileW: number;
  tileH: number;
  cards: LayoutCard[];
};

export default function Collage() {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    /**
     * Never trust these to be non-zero at mount. A hidden, collapsed or
     * not-yet-laid-out container reports 0, which collapses the field and
     * piles every card in one corner.
     */
    const measure = () => ({
      w: Math.max(window.innerWidth || document.documentElement.clientWidth, 1),
      h: Math.max(
        window.innerHeight || document.documentElement.clientHeight,
        1
      ),
    });

    let { w: vw, h: vh } = measure();
    let zone: ClearZone = getClearZone(vw, vh);

    let pointerTX = 0;
    let pointerTY = 0;
    let pointerX = 0;
    let pointerY = 0;
    let scrollY = window.scrollY;

    const cards: Card[] = [];
    const pendingPlay: HTMLVideoElement[] = [];

    const images = media.filter((m) => m.type === "image");
    const videos = media.filter((m) => m.type === "video");

    /**
     * Build the field.
     *
     * The reference lays out a fixed, authored set of cards and tiles that
     * block across the plane rather than scattering at random - measured as
     * an exact repeat every (0.9894 * vw, 1.0 * vh). Tiling is what keeps it
     * composed instead of noisy, and it covers any viewport without needing
     * more cards.
     */
    const build = () => {
      for (const c of cards) c.el.remove();
      cards.length = 0;
      pendingPlay.length = 0;

      const scale = vw / layout.refWidth;
      const tileW = layout.tileW * vw;
      const tileH = layout.tileH * vh;

      // Repeat just far enough to cover the viewport plus a margin.
      const M = COLLAGE.margin;
      const colFrom = Math.floor(-M / tileW) - 1;
      const colTo = Math.floor((vw + M) / tileW) + 1;
      const rowFrom = Math.floor(-M / tileH) - 1;
      const rowTo = Math.floor((vh + M) / tileH) + 1;

      let imgI = 0;
      let vidI = 0;
      let videoCount = 0;

      for (let row = rowFrom; row <= rowTo; row++) {
        for (let col = colFrom; col <= colTo; col++) {
          for (let s = 0; s < layout.cards.length; s++) {
            const slot = layout.cards[s];

            const w = slot.w * scale;
            const h = slot.h * scale;
            const bx = slot.x * vw + col * tileW;
            const by = slot.y * vh + row * tileH;

            /**
             * Cull anything that can never be seen, before allocating any
             * media to it.
             *
             * Tiling to cover the viewport generates a whole ring of
             * off-screen repeats - 208 cards at 1440x900 before this, most
             * permanently outside. Each is a DOM node with a decoded image
             * behind it, so they are not free. Culling first also stops the
             * off-screen repeats from eating the video budget and leaving
             * visible slots as stills.
             */
            if (
              bx + w / 2 < -M ||
              bx - w / 2 > vw + M ||
              by + h / 2 < -M ||
              by - h / 2 > vh + M
            ) {
              continue;
            }

            // Cap live video decoding; overflow slots fall back to stills.
            const useVideo =
              slot.type === "video" &&
              videos.length > 0 &&
              videoCount < COLLAGE.maxVideos;
            const item = useVideo
              ? videos[vidI++ % videos.length]
              : images[imgI++ % images.length];
            if (!item) continue;
            if (useVideo) videoCount++;

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
              // Older Safari needs the attributes, not just the properties.
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

            cards.push({
              el,
              bx,
              by,
              w,
              h,
              // Stable per-slot depth - no RNG, so layering is identical on
              // every load and between server and client.
              depth: ((s * 7) % layout.cards.length) / layout.cards.length,
            });
          }
        }
      }
    };

    /**
     * Cards nearer the front react slightly more, so the field reads as
     * layered rather than one sheet sliding. The reference shows a 0-14px
     * spread between cards for a full-viewport cursor traverse.
     */
    const parallaxFactor = (c: Card) => 0.5 + (1 - c.depth) * 1.0;

    const place = (c: Card) => {
      const f = parallaxFactor(c);
      return {
        x: c.bx + pointerX * COLLAGE.pointerAmplitudeX * f,
        y:
          c.by +
          pointerY * COLLAGE.pointerAmplitudeY * f -
          scrollY * COLLAGE.scrollFactor * f,
      };
    };

    /**
     * Paint a card.
     *
     * This also runs once up front, not only inside the frame loop - rAF does
     * not run in a background tab, so a page loaded out of focus would keep
     * every card stacked at 0,0 and invisible until first looked at.
     */
    const paint = (c: Card) => {
      const { x, y } = place(c);
      const d = zoneDistance(x, y, zone);
      const opacity = zoneFade(d) * COLLAGE.baseOpacity;

      c.el.style.transform = `translate3d(${x - c.w / 2}px, ${
        y - c.h / 2
      }px, 0)`;
      c.el.style.opacity = opacity.toFixed(3);
    };

    /**
     * Start the clips.
     *
     * play() can reject transiently while the element settles, and a clip
     * that is already buffered never fires `canplay` again - so a single
     * listener is not a reliable fallback. A few spaced retries covers both.
     */
    const playTimers: number[] = [];
    const startClips = () => {
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
    };

    build();
    for (const c of cards) paint(c);
    startClips();

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
     * Rebuild on resize.
     *
     * Slots are anchored to viewport fractions and sized against the
     * reference width, so the field has to be laid out again rather than
     * nudged - otherwise it stays composed for the old viewport.
     */
    let resizeTimer = 0;
    const onResize = () => {
      const next = measure();
      if (next.w === vw && next.h === vh) return;
      vw = next.w;
      vh = next.h;
      zone = getClearZone(vw, vh);

      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        build();
        for (const c of cards) paint(c);
        startClips();
      }, 120);
    };
    window.addEventListener("resize", onResize);

    // The container can be laid out after mount (hidden pane, late fonts,
    // mobile browser chrome settling), so catch a size that arrives late.
    const ro = new ResizeObserver(onResize);
    ro.observe(document.documentElement);

    let raf = 0;
    let last = performance.now();

    const frame = (now: number) => {
      // Cap dt so a backgrounded tab does not lurch on return.
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;

      if (!reduceMotion) {
        // Exponential smoothing on elapsed time, so the feel is identical at
        // 60Hz, 144Hz, or while the tab is being throttled.
        const k = 1 - Math.exp(-dt / COLLAGE.pointerTau);
        pointerX += (pointerTX - pointerX) * k;
        pointerY += (pointerTY - pointerY) * k;
      }

      for (const c of cards) paint(c);

      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      ro.disconnect();
      window.clearTimeout(resizeTimer);
      for (const t of playTimers) clearTimeout(t);
      for (const c of cards) c.el.remove();
    };
  }, []);

  return <div ref={rootRef} className="collage-root" aria-hidden="true" />;
}
