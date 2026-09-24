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
  model:
    process.env.NEXT_PUBLIC_CHARACTER_MODEL ?? "/models/RobotExpressive.glb",

  /**
   * Clip played once on load, before settling into the idle.
   * Falls back to the first clip in the file if the name is not present.
   */
  /**
   * Candidates, tried in order and matched case-insensitively.
   *
   * Clip names are whatever the rig's author typed - "waving" in one model,
   * "Wave" in the next - so a single exact name only ever works for the one
   * model it was written against, which defeats the point of the model
   * being swappable.
   */
  introClips: [
    process.env.NEXT_PUBLIC_CHARACTER_INTRO,
    "waving",
    "wave",
  ].filter(Boolean) as readonly string[],

  /** Resting loop between dances. */
  idleClips: [
    process.env.NEXT_PUBLIC_CHARACTER_IDLE,
    "idle",
    "standing",
  ].filter(Boolean) as readonly string[],

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
    // RobotExpressive, and most stock rigs, call it simply "Dance".
    "dance",
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
   * Cursor parallax, peak px offset at the viewport edge, scaled per card
   * by depth.
   *
   * Re-measured, because the first pass was wrong twice over. It read an
   * isolated inner transform and came back with ~3px of travel, and it
   * concluded the vertical axis ran *against* the cursor. Driving the
   * reference with real pointer events and reading getBoundingClientRect
   * gives a cursor traverse of 1300 x 500 px moving cards by (+82, +43) to
   * (+114, +79) - two orders of magnitude larger than the old number, and
   * positive on both axes. The cards follow the cursor diagonally.
   *
   * The per-card spread is depth, not noise.
   */
  pointerAmplitudeX: 40,
  pointerAmplitudeY: 32,
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
   * Also re-measured. An earlier note here claimed the reference's field was
   * pinned and that panning on scroll was our own departure from it. It is
   * not: that measurement drove the page with `scrollTo`, which the
   * reference's smooth-scroll library does not observe, so the field sat
   * still while the page moved underneath it. Driven with real wheel
   * events, six ticks moved the cards 0.62-0.8x the scroll distance, and
   * they wrap - which is exactly the looping field this already had.
   */
  scrollFactor: 0.7,

  /**
   * Sideways drift per pixel scrolled.
   *
   * Zero, measured: card x did not change by a single pixel across 720px of
   * wheel scrolling. The field loops vertically only; the horizontal
   * movement in the reference comes from the cursor, not from scroll.
   */
  scrollDriftX: 0,

  /** Card opacity before the clear-zone fade is applied. */
  baseOpacity: 1,

  /** Concurrent <video> elements. Each one is a live decode pipeline. */
  maxVideos: 6,
} as const;

export const STAGE = {
  /** Measured off nic0martins.com: rgb(230, 230, 230). */
  background: "#e6e6e6",
} as const;
