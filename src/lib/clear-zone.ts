/**
 * The clear zone is the patch of screen the dancing character occupies.
 * Collage cards drift around it and never cross it.
 *
 * It is defined in viewport-relative units and recomputed on resize, so it
 * stays locked to the character at any screen size. Values are clamped so it
 * does not collapse on small screens or swallow the page on ultrawide ones.
 */

export type ClearZone = {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
};

/** Cards are fully hidden at the zone edge and fully visible past this. */
export const FADE_BAND = 1.45;

const clamp = (v: number, min: number, max: number) =>
  Math.min(Math.max(v, min), max);

export function getClearZone(vw: number, vh: number): ClearZone {
  return {
    cx: vw * 0.5,
    // Slightly below centre - the character stands on the floor plane, so its
    // visual mass sits lower than the geometric middle of the viewport.
    cy: vh * 0.54,
    rx: clamp(vw * 0.19, 140, 380),
    ry: clamp(vh * 0.4, 200, 470),
  };
}

/**
 * Normalised elliptical distance from the zone centre.
 * < 1 is inside the zone, 1 is exactly on the edge, > 1 is outside.
 */
export function zoneDistance(x: number, y: number, z: ClearZone): number {
  const dx = (x - z.cx) / z.rx;
  const dy = (y - z.cy) / z.ry;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Opacity for a card at distance `d`, ramped smoothly across the fade band.
 * Without this the zone boundary reads as a hard invisible edge, which looks
 * worse than letting cards overlap in the first place.
 */
export function zoneFade(d: number): number {
  if (d >= FADE_BAND) return 1;
  if (d <= 1) return 0;
  const t = (d - 1) / (FADE_BAND - 1);
  // smoothstep
  return t * t * (3 - 2 * t);
}

/**
 * Unit vector pointing away from the zone centre, in ellipse-normalised space.
 * Used to nudge a card back out if drift carries it inward.
 */
export function repulsion(
  x: number,
  y: number,
  z: ClearZone
): { nx: number; ny: number } {
  const dx = (x - z.cx) / z.rx;
  const dy = (y - z.cy) / z.ry;
  const len = Math.hypot(dx, dy) || 1e-6;
  return { nx: dx / len, ny: dy / len };
}
