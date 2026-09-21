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
   * Clip played once on load, before settling into the idle.
   * Falls back to the first clip in the file if the name is not present.
   */
  introClip: process.env.NEXT_PUBLIC_CHARACTER_INTRO ?? "waving",

  /** Resting loop between dances. */
  idleClip: process.env.NEXT_PUBLIC_CHARACTER_IDLE ?? "idle",

  /**
   * Clicking the character advances through these, in order, so every dance
   * in the model gets used rather than one on repeat.
   */
  danceClips: [
    "hiphop",
    "twist",
    "snake",
    "slide",
    "chicken",
    "twerk",
  ] as readonly string[],

  /**
   * Playback rate for the dances. The clips are authored quick; below 1
   * reads as a groove rather than a fast-forward.
   */
  danceTimeScale: 0.72,
  /** Crossfade between clips, in seconds. */
  fadeSeconds: 0.35,

  /**
   * Model is auto-normalised to this height in world units, feet on y=0,
   * so any .glb drops in at a sane size regardless of its export scale.
   */
  targetHeight: 2.6,
  /** Extra multiplier on top of the auto-fit, for taste. */
  scale: 1.0,
  /**
   * Poses sampled per clip when fitting. Every clip is sampled and the
   * union taken, so switching dances can never crop the figure - a big
   * dance reaches further than an idle, and the camera has to allow for the
   * largest of them.
   */
  fitSamples: 12,

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
   * Measured on mimosaagency.com by reading the isolated parallax transform
   * (each card has a layout transform and a separate inner wrapper that
   * carries only the parallax). A full-viewport traverse of ~1332 x 810 px
   * moved that wrapper by an average of (+2.88, -1.82) px - about 0.2% of
   * cursor travel, with a 1.4-4.0px spread between cards. Reading it off
   * getBoundingClientRect, as a first pass did, rounds the whole effect away.
   */
  pointerAmplitudeX: 1.5,
  /**
   * Negative on purpose: the reference moves cards *against* the cursor
   * vertically while following it horizontally.
   */
  pointerAmplitudeY: -1,
  /**
   * Time constant for the cursor follow, in seconds - roughly how long the
   * field takes to cover ~63% of the distance to the cursor.
   *
   * Time-based, not per-frame: a per-frame lerp converges more than twice as
   * fast on a 144Hz display as on a 60Hz one, and crawls when throttled.
   */
  pointerTau: 0.42,

  /**
   * How far the field pans per pixel scrolled.
   *
   * Note this is a deliberate departure from the reference: mimosa's field
   * is pinned - a real 395px wheel scroll moved its cards 16px, and its
   * layout transform sat frozen over six seconds. Panning on scroll is the
   * looping behaviour that was asked for, not a copy of that site.
   */
  scrollFactor: 0.45,

  /**
   * Sideways drift per pixel scrolled, so the field loops left/right as
   * well as up/down rather than only sliding vertically.
   */
  scrollDriftX: 0.12,

  /** Card opacity before the clear-zone fade is applied. */
  baseOpacity: 1,

  /** Concurrent <video> elements. Each one is a live decode pipeline. */
  maxVideos: 6,
} as const;

export const STAGE = {
  /** Measured off nic0martins.com: rgb(230, 230, 230). */
  background: "#e6e6e6",
} as const;
