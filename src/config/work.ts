/**
 * Selected Work — content and geometry for the drum carousel.
 *
 * The projects are deliberate placeholders. Swap `title`, `note`, `href`
 * and `image` for real work; nothing in the component needs touching, and
 * the geometry re-derives itself from `items.length`, so three is not a
 * magic number.
 *
 * Panoramas come from `node scripts/gen-work-placeholders.mjs`. Replace the
 * files at those paths with real images of the same shape (roughly 8:3) and
 * the drum picks them up as-is.
 */

export const WORK = {
  id: "work",

  /** Display type behind the drum. Kept short - it spans the full width. */
  display: "SELECTED WORK",

  /** The one-line intro above the drum, matching the reference's register. */
  intro: {
    name: "shubhjadiya",
    rest: " is a developer and designer.",
  },

  items: [
    {
      id: "work-1",
      title: "Work #1",
      note: "Placeholder — replace with a real project.",
      href: "#work",
      image: "/work/work-1.jpg",
    },
    {
      id: "work-2",
      title: "Work #2",
      note: "Placeholder — replace with a real project.",
      href: "#work",
      image: "/work/work-2.jpg",
    },
    {
      id: "work-3",
      title: "Work #3",
      note: "Placeholder — replace with a real project.",
      href: "#work",
      image: "/work/work-3.jpg",
    },
  ],
} as const;

/**
 * Drum geometry.
 *
 * Both display modes are the *same* cylinder at a different radius - that is
 * the whole trick, and it is what the reference does. At the arc radius the
 * panels close into a drum; stretch the radius and the same panels flatten
 * into a row, with the neighbours turning edge-on at the sides. One animated
 * number drives the entire morph, so the two modes can never disagree.
 */
export const DRUM = {
  /** Panel size in world units. Width is arc length, so it survives the bend. */
  panelWidth: 5.4,
  panelHeight: 2.1,

  /**
   * Radius multipliers, relative to the radius that closes the panels into a
   * full circle. 1 is a closed drum; the flat value is tuned by eye against
   * the reference rather than derived.
   */
  arcRadiusScale: 1,
  flatRadiusScale: 2.8,

  /** Seconds for the arc <-> flat morph and for a snap to settle. */
  morphSeconds: 0.9,
  snapSeconds: 0.7,

  /** Horizontal segments per panel. Enough that the curve has no facets. */
  segments: 72,

  /** Drag sensitivity, in radians of spin per pixel of cursor travel. */
  dragPerPixel: 0.0042,
  /** Trackpad swipe sensitivity, in radians of spin per unit of deltaX. */
  wheelPerUnit: 0.0018,

  /** Camera. The slight lift is what shows the top face of the drum. */
  cameraHeight: 0.62,
  cameraDistance: 5.6,
  fov: 34,
} as const;

export type WorkItem = (typeof WORK.items)[number];
