/**
 * About — the unveiled gradient, and the bee.
 *
 * The section has no photograph in it. It starts as a flat, almost blank
 * field, and the colour is only where the pointer has been: moving across
 * it wipes a gradient into view, which then closes again behind you.
 *
 * Everything that decides how that feels is a number in this file, so the
 * feel can be tuned without reading a line of the shader.
 */

export const ABOUT = {
  id: "about",

  eyebrow: "About",
  title: "I build the thing,\nnot the deck about it.",

  /*
   * What the work is, not what it is made of.
   *
   * Deliberately no frameworks, no languages and no tool names: a list of
   * those says what someone has touched, never what they can be handed.
   * That belongs on the CV, where a reader has gone looking for it. Here
   * the question being answered is "what happens if I give this person a
   * problem", so every line is a capability with an outcome attached.
   */
  body: [
    "I take an idea that only half exists and come back with something running. Usually that means the whole path — the shape of the product, the interface, the system underneath it, and the hundred small decisions in between that nobody writes a ticket for.",
    "I am most useful early, when the problem is still vague and the fastest way to understand it is to build a real version and put it in front of someone.",
  ],

  /** Hint under the text, so the reveal is discoverable at all. */
  hint: "Move the cursor — and try the bee.",

  /** Where the board's link frame points. */
  link: {
    label: "shubhjadiya.com",
    note: "Everything else lives here.",
    href: "https://github.com/333shubh",
  },
} as const;

/**
 * The board.
 *
 * Frames on a Figma-ish canvas that can be picked up and moved. Positions
 * are percentages of the board, not pixels, so the arrangement survives a
 * resize - a drag then stores an offset in pixels on top of that, which is
 * the only part that is really per-session.
 *
 * `w` is in pixels and clamps with a max-width in CSS; a frame is a card,
 * so it wants a readable measure rather than a share of the viewport.
 */
export const BOARD = {
  /** Badge over a selected frame, as Figma labels a selection. */
  groupLabel: "About",

  frames: [
    {
      id: "can-product",
      kind: "card",
      name: "Idea → working",
      title: "Take it from idea to working",
      note: "Scoping, building and shipping a product end to end, on my own if that is what it needs.",
      x: 1,
      y: 2,
      w: 250,
      tilt: -1.5,
    },
    {
      id: "can-interface",
      kind: "card",
      name: "Interface",
      title: "Interfaces that feel considered",
      note: "Motion, interaction and the details that decide whether something feels built or assembled.",
      x: 40,
      y: 0,
      w: 250,
      tilt: 1.2,
    },
    {
      id: "can-systems",
      kind: "card",
      name: "Systems",
      title: "The machinery behind it",
      note: "Services, data and agentic pieces that have to hold up once real people are using it.",
      x: 32,
      y: 33,
      w: 254,
      tilt: -0.6,
    },
    {
      id: "shot-1",
      kind: "image",
      name: "Shot 01",
      src: "/media/shadows.jpg",
      alt: "Placeholder — swap for a shot of real work.",
      x: 1,
      y: 36,
      w: 190,
      tilt: 2.4,
    },
    {
      id: "shot-2",
      kind: "image",
      name: "Shot 02",
      src: "/media/horses.jpg",
      alt: "Placeholder — swap for a shot of real work.",
      x: 31,
      y: 66,
      w: 178,
      tilt: -2.8,
    },
    {
      id: "shot-3",
      kind: "image",
      name: "Shot 03",
      src: "/media/cat.jpg",
      alt: "Placeholder — swap for a shot of real work.",
      x: 62,
      y: 63,
      w: 178,
      tilt: 1.8,
    },
    {
      id: "link",
      kind: "link",
      name: "Link",
      x: 72,
      y: 35,
      w: 196,
      tilt: -1.1,
    },
  ],
} as const;

/**
 * The unveil.
 *
 * The pointer leaves a trail, the trail is a mask, and the mask is what
 * decides whether a pixel shows the blank field or the gradient. Nothing
 * fades in or out globally; every pixel is simply asking how recently the
 * cursor came near it.
 */
export const UNVEIL = {
  /**
   * How many pointer samples the trail remembers.
   *
   * At 60Hz this is a little over half a second of cursor history. They
   * are joined as segments rather than stamped as dots, which is the
   * difference between a continuous ribbon and a dotted line the moment
   * anybody moves the cursor quickly.
   */
  trailLength: 32,

  /** Radius of the wipe, as a fraction of the frame's larger side. */
  radius: 0.26,

  /**
   * Seconds for a point on the trail to close back up.
   *
   * Long enough that a slow sweep leaves a readable stroke behind it,
   * short enough that the section returns to blank if you leave it alone.
   */
  fade: 2.1,

  /**
   * The blank field the section rests at.
   *
   * Must match `--page` in the stylesheet. The canvas *is* the section's
   * background rather than a layer over one, so if these two disagree the
   * seam shows the moment the canvas comes up.
   */
  base: "#f4f4f2",

  /**
   * How far the wipe lifts toward white, 0 to 1.
   *
   * The reveal is a translucent white sheen, not a colour - the reference
   * lights the surface where the cursor passes rather than painting it.
   * Colour here read as a gimmick over the text; light reads as the page
   * noticing you.
   */
  lift: 0.85,

  /** Grain over the whole thing, so the sheen never bands. */
  grain: 0.022,
} as const;

/**
 * The bee, the fruit, and the chase.
 *
 * These are not invented numbers. The reference runs a steering simulation
 * - a pursuer, an evader and a seek target - and every constant below was
 * read out of its shipped bundle rather than guessed at from a video:
 * `massPursuer .2`, `maxSpeedPursuer 2.5`, `_orbitRadius .75`,
 * `_orbitSpeed 9`, `_cursorLerp 14`, `_gravity 18`, and the rest.
 *
 * The one deliberate departure is the axis the fruit falls along. The
 * reference is looking down at a ground plane, so its fruit falls in z,
 * away from the camera, and lands on that floor. This section has no
 * floor and a camera pointing straight at it, where a fall in z reads as
 * the fruit politely shrinking. It falls in y here, down the screen, which
 * is the same gesture seen from the front.
 */
export const BEE = {
  /**
   * The chase.
   *
   * Three bodies, not one. The bee pursues an evader, the evader seeks a
   * target, and the target orbits the cursor - so the bee is always aiming
   * at where something else is about to be. That indirection is the whole
   * reason it moves like an animal instead of like a cursor follower, and
   * it is why a simple lerp toward the pointer never looks right no matter
   * how it is tuned.
   */
  pursuer: { mass: 0.2, maxForce: 100, maxSpeed: 2.5 },
  evader: { mass: 1, maxForce: 100, maxSpeed: 2.5 },
  /** How far ahead the pursuer leads its target, in seconds of travel. */
  predictionFactor: 5,

  /** The target the evader seeks: a circle around the cursor. */
  orbitRadius: 0.75,
  orbitSpeed: 9,
  /** How far in front of the page the bee flies. */
  targetZ: 0.3,

  /**
   * The fruit.
   *
   * It rides the cursor on its own plane, with an exponential follow -
   * `1 - exp(-14 * dt)` - which is framerate-independent and is the
   * reference's own figure.
   */
  cursorLerp: 14,
  hoverZ: 0.48,
  groundY: -1.9,

  /**
   * Tilt and stretch from cursor speed.
   *
   * Flicking the pointer leans the fruit and stretches it along the
   * direction of travel; stopping unwinds it. The reset is on a timer
   * rather than on a speed threshold, because a pointer that stops sends
   * no events at all and there is nothing left to measure.
   */
  pointerSpeedFactor: 0.02,
  rotationVisualDegrees: 110,
  rotationDamping: 6,
  speedScaleDamping: 6,
  pointerSpeedResetMs: 50,

  /** The fall, once the fruit is dropped. */
  gravity: 18,
  /** Stretch along the fall, capped so it never becomes a streak. */
  fallStretch: 0.028,
  fallStretchMax: 0.35,
  /** The squash on landing, and how long it takes to spring back. */
  landSquash: { x: 1.4, y: 0.5, seconds: 1.25 },
  /** How long the fruit sits there before it goes. */
  restSeconds: 3,
  vanishSeconds: 0.7,
  returnSeconds: 1.4,

  /** Wingbeat, in flaps per second. Real bees are past 200; this reads. */
  wingBeat: 26,

  /**
   * Size multipliers for the models.
   *
   * Both are authored tiny - the bee is about a third of a unit nose to
   * tail - so these are large-ish numbers doing ordinary work.
   */
  scale: 1.5,
  fruitScale: 1.1,

  body: "#f5c518",
  stripe: "#1b1b1b",
} as const;
