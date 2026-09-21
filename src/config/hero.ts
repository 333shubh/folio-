/**
 * Every tunable for the landing hero lives here, so the look can be dialled
 * in without reading the animation code.
 *
 * Numbers marked "measured" were taken off the reference sites directly
 * rather than eyeballed - see notes/inspiration.md for the method.
 */

export const CHARACTER = {
  /**
   * Swap the dancing character by pointing this at another .glb in /public.
   * The file needs a rigged mesh and at least one animation clip.
   *
   * Override locally with NEXT_PUBLIC_CHARACTER_MODEL in .env.local.
   */
  model: process.env.NEXT_PUBLIC_CHARACTER_MODEL ?? "/models/nico.glb",

  /**
   * Clip to play. Falls back to the first clip in the file if this name is
   * not found, so an unfamiliar model still animates instead of standing still.
   */
  clip: process.env.NEXT_PUBLIC_CHARACTER_CLIP ?? "hiphop",

  /**
   * Model is auto-normalised to this height in world units, feet on y=0,
   * so any .glb drops in at a sane size regardless of its export scale.
   */
  targetHeight: 2.6,
  /** Extra multiplier on top of the auto-fit, for taste. */
  scale: 1.0,
  /**
   * Poses sampled across the clip when fitting. The union of their bounding
   * boxes is the extent the character ever reaches, so it is never cropped
   * mid-move. 24 is plenty for a dance loop and costs one frame, once.
   */
  fitSamples: 24,

  /**
   * Fraction of the visible height the figure occupies.
   * Measured on nic0martins.com: the character stands ~78% of viewport
   * height, considerably larger than it first looks.
   */
  frameFill: 0.78,
  /**
   * World units that must stay visible horizontally. The dance throws the
   * arms wide, so this is wider than the standing silhouette.
   */
  minVisibleWidth: 3.4,
  /**
   * Where the camera looks, as a fraction of character height. The reference
   * sits the figure low with its feet close to the bottom edge, which means
   * aiming above the midpoint.
   */
  lookAtFraction: 0.62,

  /** Slow idle turn, radians/sec. Set to 0 to lock the facing. */
  turnSpeed: 0.12,

  /**
   * Ground shadow opacity. The reference has none at all - the figure sits
   * on a completely flat field - so this is off by default.
   */
  contactShadowOpacity: 0,
} as const;

export const COLLAGE = {
  /** How far past the viewport the tiled field extends, in px. */
  margin: 200,

  /**
   * Cursor parallax, peak px offset at the viewport edge, scaled per card by
   * depth.
   *
   * Measured on mimosaagency.com: a full-viewport cursor traverse
   * (~1224 x 720 px) moved cards an average of just (6.4, 5.1) px, with a
   * 0-14px spread between them. It is far subtler than it looks.
   */
  pointerAmplitudeX: 8,
  pointerAmplitudeY: 6,
  /**
   * Time constant for the cursor follow, in seconds - roughly how long the
   * field takes to cover ~63% of the distance to the cursor.
   *
   * Time-based, not per-frame: a per-frame lerp converges more than twice as
   * fast on a 144Hz display as on a 60Hz one, and crawls when throttled.
   */
  pointerTau: 0.42,

  /** Scroll parallax, as a fraction of scroll distance (~0.05 measured). */
  scrollFactor: 0.05,

  /** Card opacity before the clear-zone fade is applied. */
  baseOpacity: 1,

  /** Concurrent <video> elements. Each one is a live decode pipeline. */
  maxVideos: 6,
} as const;

export const STAGE = {
  /** Measured off nic0martins.com: rgb(230, 230, 230). */
  background: "#e6e6e6",
} as const;
