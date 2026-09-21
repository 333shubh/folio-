/**
 * Every tunable for the landing hero lives here, so the look can be dialled
 * in without reading the animation code.
 */

export const CHARACTER = {
  /**
   * Swap the dancing character by pointing this at another .glb in /public.
   * The file needs a rigged mesh and at least one animation clip.
   *
   * Override locally with NEXT_PUBLIC_CHARACTER_MODEL in .env.local.
   */
  model:
    process.env.NEXT_PUBLIC_CHARACTER_MODEL ?? "/models/RobotExpressive.glb",

  /**
   * Clip to play. Falls back to the first clip in the file if this name is
   * not found, so an unfamiliar model still animates instead of standing still.
   */
  clip: process.env.NEXT_PUBLIC_CHARACTER_CLIP ?? "Dance",

  /**
   * Model is auto-normalised to this height in world units, feet on y=0,
   * so any .glb drops in at a sane size regardless of its export scale.
   */
  targetHeight: 2.6,
  /** Extra multiplier on top of the auto-fit, for taste. */
  scale: 1.0,
  /**
   * Frames to wait before measuring. The mixer needs a beat to drive the
   * skeleton out of its rest pose, which is what makes the measurement
   * meaningful for rigs that rest lying flat.
   */
  fitAfterFrames: 6,
  /**
   * Fraction of the visible height the figure should occupy.
   * Lower = more breathing room around it.
   */
  frameFill: 0.62,
  /**
   * World units that must stay visible horizontally. The dance throws the
   * arms wide, so this is wider than the standing silhouette.
   */
  minVisibleWidth: 3.4,
  /** Slow idle turn, radians/sec. Set to 0 to lock the facing. */
  turnSpeed: 0.12,
} as const;

export const COLLAGE = {
  seed: 20260921,
  cardCount: 26,
  /** How far past the viewport the drifting field extends, in px. */
  margin: 320,

  /**
   * Ambient drift, px/sec.
   *
   * The mimosa reference has none - measured stable to the pixel with no
   * input, its field moves only on cursor and scroll. A little drift keeps
   * the hero from looking frozen while the character dances; set both to 0
   * to match the reference exactly.
   */
  minSpeed: 2,
  maxSpeed: 6,
  maxTilt: 9,

  /**
   * Cursor parallax. Peak offset in px for a cursor at the viewport edge,
   * scaled per card by depth so the field layers instead of sliding as one
   * sheet. Measured ~37px x / ~30px y across the full viewport on the
   * reference, with a 22-59px spread between cards.
   */
  pointerAmplitudeX: 46,
  pointerAmplitudeY: 38,
  /**
   * Time constant for the cursor follow, in seconds - roughly how long the
   * field takes to cover ~63% of the distance to the cursor.
   *
   * Time-based, not per-frame: a per-frame lerp converges more than twice as
   * fast on a 144Hz display as on a 60Hz one, and crawls whenever the tab is
   * throttled. Higher = heavier, laggier.
   */
  pointerTau: 0.42,

  /** Scroll parallax, as a fraction of scroll distance (~0.05 measured). */
  scrollFactor: 0.06,

  minScale: 0.18,
  maxScale: 0.42,

  /** Ceiling opacity before depth falloff - keeps the collage secondary. */
  baseOpacity: 0.82,
  depthOpacityFalloff: 0.28,

  /** Cards must spawn at least this far outside the clear zone. */
  spawnClearance: 1.5,
  /** How hard a card is pushed back out of the character's space. */
  repelStrength: 0.9,

  /** Concurrent <video> elements. Each one is a live decode pipeline. */
  maxVideos: 4,
} as const;

export const STAGE = {
  background: "#e8e8e6",
} as const;
