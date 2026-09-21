/**
 * Builds the collage media manifest.
 *
 * Two jobs:
 *
 * 1. Scan public/media for real assets and record their true dimensions.
 *    Drop your own images, gifs or clips in there and re-run - nothing else
 *    needs editing. Aspect ratios come from the files themselves, so the
 *    scatter keeps its varied shapes.
 *
 * 2. Generate abstract placeholders (prefixed `gen-`) so the hero has
 *    something to show before real assets land. Everything generated here is
 *    produced locally - no third-party content, nothing to license.
 *
 * Usage:
 *   node scripts/gen-placeholders.mjs              # generate + scan
 *   node scripts/gen-placeholders.mjs --no-generate # scan only (your assets)
 *   node scripts/gen-placeholders.mjs --clean       # drop old gen-* first
 */
import {
  writeFileSync,
  mkdirSync,
  readdirSync,
  unlinkSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

const OUT = "public/media";
const args = process.argv.slice(2);
const noGenerate = args.includes("--no-generate");
const clean = args.includes("--clean");

mkdirSync(OUT, { recursive: true });

const IMAGE_EXT = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const VIDEO_EXT = new Set([".mp4", ".webm", ".mov"]);

if (clean) {
  for (const f of readdirSync(OUT)) {
    if (f.startsWith("gen-")) unlinkSync(path.join(OUT, f));
  }
}

/* ------------------------------------------------------------------ *
 * Generated placeholders
 *
 * Palette and motifs follow the reference board: misty water, fog,
 * soft landscape, a little lo-fi digital. Muted blues, greens and greys
 * with one warm accent, so the field reads as atmosphere behind the
 * character rather than competing with it.
 * ------------------------------------------------------------------ */

const SCENES = [
  { name: "haze-sea", sky: "#93a6b0", water: "#4e626d", horizon: 0.55 },
  { name: "deep-green", sky: "#5c6b42", water: "#252e1c", horizon: 0.38 },
  { name: "fog-city", sky: "#7b90a6", water: "#394c61", horizon: 0.62 },
  { name: "pale-field", sky: "#a8bb95", water: "#5d7247", horizon: 0.58 },
  { name: "dusk-blue", sky: "#5d87ad", water: "#1d3450", horizon: 0.5 },
  { name: "warm-sand", sky: "#d8c3a4", water: "#9c6a3f", horizon: 0.66 },
  { name: "slate-pond", sky: "#8d9a97", water: "#44514d", horizon: 0.45 },
  { name: "night-glass", sky: "#3f4a59", water: "#161c25", horizon: 0.52 },
  { name: "mist-grey", sky: "#b4b9b5", water: "#767c78", horizon: 0.6 },
  { name: "reed-green", sky: "#93a87c", water: "#4a5c37", horizon: 0.48 },
  { name: "cold-teal", sky: "#7fa8a8", water: "#2f5051", horizon: 0.57 },
  { name: "ember", sky: "#cfab88", water: "#7d4525", horizon: 0.64 },
];

// Varied aspect ratios keep the scatter from reading as a grid.
const SIZES = [
  [640, 400],
  [420, 560],
  [560, 560],
  [720, 405],
  [380, 520],
  [520, 340],
];

/** Soft drifting blobs, the way haze sits over water. */
function haze(w, h, i) {
  const blobs = [];
  for (let n = 0; n < 3; n++) {
    const cx = w * (0.2 + ((i + n * 3) % 5) * 0.16);
    const cy = h * (0.25 + ((i + n * 2) % 4) * 0.18);
    const r = Math.min(w, h) * (0.22 + ((i + n) % 3) * 0.1);
    blobs.push(
      `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(
        1
      )}" fill="url(#soft${i})" opacity="0.28"/>`
    );
  }
  return blobs.join("");
}

function scene(i) {
  const s = SCENES[i % SCENES.length];
  const [w, h] = SIZES[i % SIZES.length];
  const hy = h * s.horizon;

  return {
    name: `gen-${String(i + 1).padStart(2, "0")}.svg`,
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="sky${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${s.sky}"/>
      <stop offset="100%" stop-color="${s.sky}" stop-opacity="0.75"/>
    </linearGradient>
    <linearGradient id="wat${i}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${s.water}" stop-opacity="0.9"/>
      <stop offset="100%" stop-color="${s.water}"/>
    </linearGradient>
    <radialGradient id="soft${i}">
      <stop offset="0%" stop-color="#ffffff" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur${i}"><feGaussianBlur stdDeviation="${(
      Math.min(w, h) * 0.035
    ).toFixed(1)}"/></filter>
  </defs>

  <rect width="${w}" height="${h}" fill="url(#sky${i})"/>
  <rect y="${hy.toFixed(1)}" width="${w}" height="${(h - hy).toFixed(
      1
    )}" fill="url(#wat${i})"/>

  <g filter="url(#blur${i})">${haze(w, h, i)}</g>

  <!-- horizon glow, the thing that makes a flat gradient read as a place -->
  <rect y="${(hy - h * 0.012).toFixed(1)}" width="${w}" height="${(
      h * 0.024
    ).toFixed(1)}" fill="#ffffff" opacity="0.2" filter="url(#blur${i})"/>
</svg>`,
  };
}

if (!noGenerate) {
  for (let i = 0; i < SCENES.length; i++) {
    const { name, svg } = scene(i);
    writeFileSync(path.join(OUT, name), svg);
  }

  // A few short silent loops, so the video path is exercised not theorised.
  const CLIPS = [
    { name: "gen-clip-01.mp4", c0: "0xc3ccd1", c1: "0x8b9aa2", size: "640x360" },
    { name: "gen-clip-02.mp4", c0: "0x9fb0c2", c1: "0x33506d", size: "420x560" },
    { name: "gen-clip-03.mp4", c0: "0xb6c4a4", c1: "0x3f4a33", size: "480x480" },
    { name: "gen-clip-04.mp4", c0: "0xefe7d9", c1: "0xa5714f", size: "640x360" },
  ];

  for (const c of CLIPS) {
    try {
      execFileSync(
        "ffmpeg",
        [
          "-y", "-v", "error",
          "-f", "lavfi",
          "-i", `gradients=s=${c.size}:c0=${c.c0}:c1=${c.c1}:d=10:speed=0.008:nb_colors=2`,
          "-t", "10",
          "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "veryfast",
          "-crf", "31", "-movflags", "+faststart", "-an",
          path.join(OUT, c.name),
        ],
        { stdio: "pipe" }
      );
    } catch {
      console.warn(`skipped ${c.name}: ffmpeg unavailable or failed`);
    }
  }
}

/* ------------------------------------------------------------------ *
 * Scan and build the manifest
 * ------------------------------------------------------------------ */

async function imageSize(file) {
  const meta = await sharp(file).metadata();
  return [meta.width ?? 600, meta.height ?? 400];
}

function videoSize(file) {
  const out = execFileSync(
    "ffprobe",
    [
      "-v", "error",
      "-select_streams", "v:0",
      "-show_entries", "stream=width,height",
      "-of", "csv=p=0:s=x",
      file,
    ],
    { encoding: "utf8" }
  ).trim();
  const [w, h] = out.split("x").map(Number);
  return [w || 640, h || 360];
}

const entries = [];

for (const file of readdirSync(OUT).sort()) {
  const ext = path.extname(file).toLowerCase();
  const abs = path.join(OUT, file);

  try {
    if (IMAGE_EXT.has(ext)) {
      const [w, h] = await imageSize(abs);
      entries.push({ src: `/media/${file}`, type: "image", w, h });
    } else if (VIDEO_EXT.has(ext)) {
      const [w, h] = videoSize(abs);
      entries.push({ src: `/media/${file}`, type: "video", w, h });
    }
  } catch (err) {
    console.warn(`skipped ${file}: ${err.message.split("\n")[0]}`);
  }
}

if (!entries.length) {
  console.error(`no media found in ${OUT} - nothing written`);
  process.exit(1);
}

mkdirSync("src/data", { recursive: true });
writeFileSync("src/data/collage-media.json", JSON.stringify(entries, null, 2));

const own = entries.filter((e) => !path.basename(e.src).startsWith("gen-"));
console.log(
  [
    `manifest: ${entries.length} items ` +
      `(${entries.filter((e) => e.type === "image").length} image, ` +
      `${entries.filter((e) => e.type === "video").length} video)`,
    own.length
      ? `your own assets: ${own.length}`
      : `your own assets: none yet - drop files into ${OUT} and re-run`,
  ].join("\n")
);
