/**
 * Content for the hero info panel.
 *
 * Layout follows the mimosaagency.com card measured at 1440x900:
 * 420x262px, 4px inset from the top-left, #f1f1f1, 8px radius, no border
 * or shadow. Tag pills are 30px tall at 100px radius, 12.8px / 600 weight.
 *
 * Everything here is text - edit freely without touching the component.
 */

export const INFO_CARD = {
  /** Small label in the header strip. */
  fileLabel: "INFO.MP3",
  /** Right-hand side of the header strip. */
  fileMeta: "1:21",

  /** Lead word, set in bold at the start of the paragraph. */
  name: "shubhjadiya",

  body:
    "Developer, designer, and curious builder exploring software, agentic AI, " +
    "blockchain, and digital experiences. Shubh Jadiya likes turning " +
    "interesting ideas into things you can actually use.",

  playLabel: "PLAY",

  /**
   * Three pills. The first is the accent one - mimosa uses
   * rgb(44, 197, 249) there.
   */
  tags: ["AI", "WEB3", "DESIGN"],
} as const;
