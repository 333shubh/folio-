/**
 * Hero navigation content.
 *
 * Pill styling follows the same measured language as the info card:
 * 30px tall, 100px radius, 12.8px / 600 weight, #252525 on #dedede.
 */

export const NAV = {
  brand: "shubhjadiya",
  /** Small status pill next to the brand. */
  status: "currently cooking",

  /**
   * The "+" toggle reveals this panel. Point `href` at a real file in
   * /public (e.g. /resume.pdf) when you have one.
   */
  resume: {
    label: "RESUME",
    href: "/resume.pdf",
    lines: [
      "Developer & designer — software, agentic AI, blockchain.",
      "Open to interesting problems and collaborations.",
    ],
  },

  links: [
    { label: "WORK", href: "#work" },
    { label: "ABOUT", href: "#about" },
    { label: "CONTACT", href: "#contact" },
  ],
} as const;
