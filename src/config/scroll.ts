/**
 * Page scroll feel.
 *
 * Measured on mimosaagency.com, which runs Lenis: one 400px wheel tick
 * settled over ~1.5s, passing 61% at 219ms and 92% at 608ms. Fitting
 * `1 - (1 - l)^frames` at 60Hz gives l = 0.07 from both samples.
 */
export const SCROLL = {
  /** Fraction of the remaining distance covered per frame. Lower is slower. */
  lerp: 0.07,

  /**
   * Where a hash link lands, relative to the top of its target - enough to
   * clear the nav strip, which is a 26px pill at a 4px inset.
   */
  anchorOffset: 44,
} as const;
