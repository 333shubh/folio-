/**
 * Selected Work — content and geometry for the drum carousel.
 *
 * The projects are deliberate placeholders. Swap `title`, `category`,
 * `note`, `href` and `image` for real work; nothing in the component needs
 * touching, and the geometry re-derives itself from `items.length`, so
 * three is not a magic number.
 *
 * Panoramas come from `node scripts/gen-work-placeholders.mjs`. Replace the
 * files at those paths with real images of the same shape (5:2) and the
 * drum picks them up as-is.
 */

export const WORK = {
  id: "work",

  /**
   * Display type behind the drum.
   *
   * Set in the display serif at 18.1vw and cropped by the viewport, which
   * is the reference's own figure. Around a dozen characters is the length
   * it is drawn for: much longer and the line loses its middle behind the
   * drum, much shorter and it stops running off the edges.
   */
  display: "SELECTED WORK",

  /**
   * Size of the display line, in vw.
   *
   * The reference's 18.1vw is drawn for its own nine-character word. This
   * line is thirteen, so the same figure would push everything past "SEL"
   * off both edges - the word is meant to bleed, not to disappear. Scaled
   * by character count against that original, which keeps the bleed and
   * keeps the phrase readable.
   */
  displayVw: 12.4,

  /** The line in the header strip, matching the reference's register. */
  intro: {
    name: "shubhjadiya",
    rest: "is a developer and designer.",
  },

  /** Sub-label over the project name, in the bar's resting state. */
  barCaption: "Category",
  /** Sub-label while the pointer is over a step button. */
  barNextCaption: "Next",
  /** Label that grows out of the mode button when it is hovered. */
  modeLabel: "Mode",

  /** The pill that appears over a panel on hover. */
  viewLabel: "View",

  /**
   * The chromatic split on the display line.
   *
   * The reference never shows this on its heading, but it is unmistakably
   * the site's own language: its `::selection` rule is
   * `text-shadow: -.5px -.5px 0 cyan, .5px .5px 0 #f0f` - a cyan/magenta
   * separation at half a pixel on 16px type. Scaled to a heading two
   * hundred pixels tall, that same ratio is the offset below.
   *
   * Offsets are in vw so the split grows with the type rather than
   * vanishing on a large screen and swamping the letters on a small one.
   */
  chromatic: {
    cyan: "#2ad4e6",
    magenta: "#ff35c8",
    /** Offset at rest and at full hover, as a fraction of viewport width. */
    restVw: 0.04,
    hoverVw: 0.42,
    /** How far the ghosts fade up on hover. */
    opacity: 0.85,
    seconds: 0.55,
  },

  items: [
    {
      id: "prakriva",
      title: "Prakriva",
      category: "Product",
      note: "Ayurvedic nutrition platform — dosha profiling, tracking, and practitioner review.",
      href: "https://prakriva.vercel.app/",
      image: "/work/prakriva.jpg",
    },
    {
      id: "undercurrent",
      title: "Undercurrent",
      category: "Web",
      note: "A quiet, type-led site built around one long scroll.",
      href: "https://undercurrent-3yvm.onrender.com/",
      image: "/work/undercurrent.jpg",
    },
    {
      id: "leoparpeix",
      title: "Leoparpeix",
      category: "Interactive",
      note: "Interactive portfolio — a real-time 3D studio scene you move through.",
      href: "https://www.leoparpeix.com/",
      image: "/work/leoparpeix.jpg",
    },
  ],
} as const;

/**
 * Drum geometry, read off the reference's own stylesheet rather than
 * guessed from screenshots.
 *
 * It sizes a slide in two custom properties - `--app-slider-slide-width:
 * 65svw` and `--app-slider-slide-height: 26svw` - and a `--app-slider-gap`
 * of 30px. Both dimensions are a fraction of viewport *width*, so a panel
 * is a fixed 2.5:1 at every window shape and only grows and shrinks with
 * the width. That is the rule reproduced below, and it is why the flat card
 * keeps its proportion on a short window where fitting to height would
 * squash it.
 *
 * Both display modes are the *same* cylinder at a different radius - that
 * is the whole trick. At the arc radius the panels close into a drum;
 * stretch the radius far enough and the same panels flatten into a row of
 * cards, with the neighbours falling away at the sides. One animated number
 * drives the entire morph, so the two modes can never disagree.
 */
export const DRUM = {
  /** Panel size in world units. Width is arc length, so it survives the bend. */
  panelWidth: 5.4,
  /** 5.4 / 2.5, holding the reference's 65:26 slide exactly. */
  panelHeight: 2.16,

  /**
   * Space between panels, in the same units.
   *
   * The reference's 30px against a 65svw slide is 3% of the panel width at
   * its 1440px design width, which is this gap over this panel.
   */
  panelGap: 0.162,

  /**
   * Radius multipliers, relative to the radius that closes the panels into
   * a full circle. 1 is a closed drum. The flat value is large on purpose:
   * the reference's flat cards read as genuinely flat, not as a gentle
   * curve, which needs a radius an order of magnitude past the drum.
   */
  arcRadiusScale: 1,
  flatRadiusScale: 25,

  /**
   * Fractions of the viewport *width*, per mode: the whole drum across in
   * arc, one panel in flat. `flatWidthFraction` is the reference's 65svw
   * verbatim; the arc figure is what that slide width becomes once it is
   * wrapped into a cylinder and seen from the front.
   */
  arcWidthFraction: 0.425,
  flatWidthFraction: 0.65,

  /**
   * Camera elevation above the drum's centre, in degrees.
   *
   * This is what shows the top face. The reference's top ellipse is about
   * 12% as deep as the drum is wide, which is a shallow look-down - enough
   * to read as a solid object, not enough to look like a plan view.
   */
  cameraElevationDeg: 11,
  fov: 34,

  /**
   * How far the subject sits below the middle of the section.
   *
   * The reference centres the slide on the viewport and then hangs the
   * display word off the header above it, so the drum is not centred in
   * what is left. Expressed as a fraction of viewport height.
   */
  verticalOffset: 0,

  /**
   * Pointer parallax.
   *
   * How far the drum leans with the cursor, in world units at the edge of
   * the frame. Small on purpose: this is meant to be felt rather than
   * noticed, and anything past about a tenth of a unit starts to read as
   * the drum sliding around rather than as a camera that is alive.
   */
  parallax: 0.09,
  /** Fraction of the gap closed per second. Low, so it lags behind. */
  parallaxEase: 2.4,

  /** Seconds for the arc <-> flat morph and for a snap to settle. */
  morphSeconds: 0.9,
  snapSeconds: 0.7,

  /** Horizontal segments per panel. Enough that the curve has no facets. */
  segments: 72,

  /** Drag sensitivity, in radians of spin per pixel of cursor travel. */
  dragPerPixel: 0.0042,
  /** Trackpad swipe sensitivity, in radians of spin per unit of deltaX. */
  wheelPerUnit: 0.0018,

  /**
   * How far a surface turning away from the camera washes out.
   *
   * The reference fades the sides of the drum toward the page white, not
   * toward black: its drum reads as lit from everywhere and dissolving at
   * the edges, where a darkened side would read as a solid in a dark room.
   * 0 is the page colour, 1 the untouched image.
   */
  edgeWash: 0.06,
  /** Opacity of the reflection under the drum's foot. */
  reflectionOpacity: 0.26,
} as const;

export type WorkItem = (typeof WORK.items)[number];
