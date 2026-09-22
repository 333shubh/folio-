/**
 * Builds the placeholder panoramas for the Selected Work drum.
 *
 * Each project wraps a third of a cylinder, so the texture has to be a wide
 * panorama rather than a card - anything close to square gets stretched
 * across 120 degrees of arc and reads as a smear. 8:3 at 2048px wide is the
 * smallest that still holds up on a 2x display once it is curved.
 *
 * These are generated locally on purpose: nothing here is third-party, so
 * there is nothing to license and nothing to swap out before shipping. Drop
 * real images at the same paths when you have them and delete this script.
 *
 * Usage:
 *   node scripts/gen-work-placeholders.mjs
 */
import { mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const OUT = "public/work";
const W = 2048;
const H = 768;

mkdirSync(OUT, { recursive: true });

/**
 * One entry per project. The hues are deliberately far apart: on the drum
 * you see parts of two panels at once, and neighbouring panels that share a
 * hue read as one continuous image rather than two works.
 */
const PLATES = [
  { file: "work-1.jpg", from: "#cfe6ff", via: "#8fc2f0", to: "#5b8fd6" },
  { file: "work-2.jpg", from: "#f6e3c9", via: "#e0b483", to: "#b87f4a" },
  { file: "work-3.jpg", from: "#fbdcea", via: "#efaac9", to: "#d3749f" },
];

/**
 * A soft three-stop diagonal wash with a few blurred blobs over it.
 *
 * A flat linear gradient curves badly - with no internal detail there is
 * nothing to show the bend, so the panel looks like flat paint rather than
 * a surface. The blobs give the eye something to track around the arc.
 */
const plate = ({ from, via, to }) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}"/>
      <stop offset="55%" stop-color="${via}"/>
      <stop offset="100%" stop-color="${to}"/>
    </linearGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="90"/></filter>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <g filter="url(#soft)" opacity="0.5">
    <ellipse cx="${W * 0.18}" cy="${H * 0.28}" rx="${W * 0.14}" ry="${H * 0.3}" fill="${from}"/>
    <ellipse cx="${W * 0.52}" cy="${H * 0.78}" rx="${W * 0.2}" ry="${H * 0.34}" fill="${to}"/>
    <ellipse cx="${W * 0.84}" cy="${H * 0.34}" rx="${W * 0.16}" ry="${H * 0.28}" fill="${via}"/>
  </g>
</svg>`;

for (const p of PLATES) {
  const out = path.join(OUT, p.file);
  await sharp(Buffer.from(plate(p)))
    /*
     * A little grain, to stop the gradient banding on a panel this large.
     *
     * The strength is set by sigma rather than by an opacity option -
     * sharp's composite has no opacity, so a low sigma over `soft-light`
     * is the only way to get grain this faint.
     */
    .composite([
      {
        input: {
          create: {
            width: W,
            height: H,
            channels: 3,
            noise: { type: "gaussian", mean: 128, sigma: 4 },
          },
        },
        blend: "soft-light",
      },
    ])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(out);
  console.log("wrote", out);
}
