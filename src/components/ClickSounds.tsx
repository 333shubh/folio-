"use client";

import { useEffect } from "react";
import { playClick } from "@/lib/click-sound";

/**
 * Plays a click on every interactive element, via one delegated listener.
 *
 * Delegation rather than per-component handlers: new buttons and links get
 * the sound for free, and nothing has to remember to wire it up.
 */
export default function ClickSounds() {
  useEffect(() => {
    const INTERACTIVE = 'a[href], button, [role="button"], summary, input, select';

    const isInteractive = (target: EventTarget | null) =>
      target instanceof Element && target.closest(INTERACTIVE) !== null;

    const onDown = (e: PointerEvent) => {
      // Primary button only - a right-click opening a context menu should
      // not tick.
      if (e.button !== 0) return;
      if (isInteractive(e.target)) playClick("down");
    };

    const onUp = (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (isInteractive(e.target)) playClick("up");
    };

    /**
     * Keyboard activation fires no pointer events, so Enter/Space on a
     * focused control would be silent without this.
     */
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key !== "Enter" && e.key !== " ") return;
      if (isInteractive(document.activeElement)) playClick("down");
    };

    document.addEventListener("pointerdown", onDown);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("keydown", onKey);

    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  return null;
}
