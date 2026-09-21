/**
 * Generates placeholder collage media so the hero has something to show
 * before real assets land. Everything here is produced locally - no
 * third-party images, nothing to license.
 *
 * Run: node scripts/gen-placeholders.mjs
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";

const OUT = "public/media";
mkdirSync(OUT, { recursive: true });

// Muted palette - these sit behind the character, so nothing saturated.
const PALETTES = [
  ["#d9d6cf", "#b8b2a6"], ["#cdd2d4", "#9aa4a8"], ["#e0d7cc", "#c2ae97"],
  ["#d2d4cb", "#a8ad9c"], ["#dcd5d8", "#b3a6ac"], ["#d6dbd9", "#a9b4b0"],
  ["#e2ddd3", "#c4b9a5"], ["#cfd3da", "#a2a9b8"], ["#dbd8d2", "#b0aaa0"],
  ["#d4dcd8", "#9fb0a9"],
];

const SHAPES = ["arc", "bars", "grid", "blob", "rings"];

function shape(kind, w, h, fg) {
  const cx = w / 2, cy = h / 2;
  switch (kind) {
    case "arc":
      return `<path d="M ${w * 0.1} ${h * 0.8} Q ${cx} ${h * -0.1} ${w * 0.9} ${h * 0.8}"
        fill="none" stroke="${fg}" stroke-width="${h * 0.06}" stroke-linecap="round" opacity="0.5"/>`;
    case "bars":
      return Array.from({ length: 5 }, (_, i) =>
        `<rect x="${w * (0.14 + i * 0.16)}" y="${h * (0.25 + (i % 3) * 0.08)}"
          width="${w * 0.07}" height="${h * (0.5 - (i % 3) * 0.12)}" rx="${w * 0.02}"
          fill="${fg}" opacity="0.45"/>`).join("");
    case "grid":
      return Array.from({ length: 9 }, (_, i) =>
        `<circle cx="${w * (0.25 + (i % 3) * 0.25)}" cy="${h * (0.25 + Math.floor(i / 3) * 0.25)}"
          r="${Math.min(w, h) * 0.045}" fill="${fg}" opacity="0.4"/>`).join("");
    case "blob":
      return `<ellipse cx="${cx}" cy="${cy}" rx="${w * 0.3}" ry="${h * 0.3}"
        fill="${fg}" opacity="0.4"/>`;
    default:
      return Array.from({ length: 3 }, (_, i) =>
        `<circle cx="${cx}" cy="${cy}" r="${Math.min(w, h) * (0.14 + i * 0.12)}"
          fill="none" stroke="${fg}" stroke-width="${Math.min(w, h) * 0.018}" opacity="0.4"/>`).join("");
  }
}

// Varied aspect ratios keep the scatter from reading as a grid.
const SIZES = [[600, 400], [400, 520], [560, 560], [520, 340], [380, 500]];

const images = PALETTES.map((pal, i) => {
  const [w, h] = SIZES[i % SIZES.length];
  const [bg, fg] = pal;
  const name = `card-${String(i + 1).padStart(2, "0")}.svg`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g${i}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg}"/><stop offset="100%" stop-color="${fg}"/>
    </linearGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="url(#g${i})"/>
  ${shape(SHAPES[i % SHAPES.length], w, h, "#5c5a55")}
</svg>`;
  writeFileSync(`${OUT}/${name}`, svg);
  return { src: `/media/${name}`, type: "image", w, h };
});

// A few short silent loops so the video path is exercised, not just theorised.
const CLIPS = [
  { name: "clip-01.mp4", c0: "0xd9d6cf", c1: "0x9aa4a8", size: "480x270" },
  { name: "clip-02.mp4", c0: "0xe0d7cc", c1: "0xa8ad9c", size: "360x480" },
  { name: "clip-03.mp4", c0: "0xcfd3da", c1: "0xb3a6ac", size: "420x420" },
  { name: "clip-04.mp4", c0: "0xd4dcd8", c1: "0xc2ae97", size: "480x270" },
];

const videos = [];
for (const c of CLIPS) {
  try {
    execFileSync("ffmpeg", [
      "-y", "-v", "error",
      "-f", "lavfi",
      "-i", `gradients=s=${c.size}:c0=${c.c0}:c1=${c.c1}:d=8:speed=0.012:nb_colors=2`,
      "-t", "8",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
      "-crf", "30", "-movflags", "+faststart", "-an",
      `${OUT}/${c.name}`,
    ], { stdio: "pipe" });
    const [w, h] = c.size.split("x").map(Number);
    videos.push({ src: `/media/${c.name}`, type: "video", w, h });
  } catch (err) {
    console.warn(`skipped ${c.name}: ffmpeg unavailable or failed`);
  }
}

writeFileSync(
  "src/data/collage-media.json",
  JSON.stringify([...images, ...videos], null, 2)
);

console.log(`generated ${images.length} images, ${videos.length} videos`);
