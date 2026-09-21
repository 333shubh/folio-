/**
 * Strips a character .glb down to what the hero actually renders.
 *
 * The source model ships every clip its rig was authored with. The hero plays
 * exactly one, and the unused clips dominate the download - on nico.glb they
 * were ~923 KB of a 1.07 MB file, 86% of the payload, for animations that
 * never run.
 *
 * Also caps texture resolution. A 2048x2048 base colour map costs ~22 MB of
 * VRAM decoded, which is the part that hurts on mobile, and the character is
 * only ever a few hundred pixels tall on screen.
 *
 * Usage:
 *   node scripts/optimize-model.mjs <in.glb> <out.glb> [--keep clip,clip] [--tex 1024]
 *
 * Nothing is lost permanently - the untouched original stays in git history.
 */
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { textureCompress } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";
import { statSync } from "node:fs";

const args = process.argv.slice(2);
const [input, output] = args;

if (!input || !output) {
  console.error(
    "usage: node scripts/optimize-model.mjs <in.glb> <out.glb> [--keep a,b] [--tex 1024]"
  );
  process.exit(1);
}

const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
};

const keep = flag("keep", "hiphop")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const texMax = Number(flag("tex", "1024"));

const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.decoder": MeshoptDecoder,
    "meshopt.encoder": MeshoptEncoder,
  });

const doc = await io.read(input);
const root = doc.getRoot();

// --- animations -----------------------------------------------------------

const animations = root.listAnimations();
const before = animations.map((a) => a.getName());
const missing = keep.filter((k) => !before.includes(k));

if (missing.length) {
  console.error(
    `error: clip(s) not in model: ${missing.join(", ")}\n` +
      `available: ${before.join(", ")}`
  );
  process.exit(1);
}

for (const anim of animations) {
  if (keep.includes(anim.getName())) continue;
  // Samplers and their accessors go too, or the data stays in the buffer.
  for (const sampler of anim.listSamplers()) sampler.dispose();
  for (const channel of anim.listChannels()) channel.dispose();
  anim.dispose();
}

// --- textures -------------------------------------------------------------

const texBefore = root
  .listTextures()
  .map((t) => (t.getSize() ?? [0, 0]).join("x"));

await doc.transform(
  textureCompress({
    encoder: sharp,
    resize: [texMax, texMax],
    // Keep whatever codec the source used; re-encoding webp gains little.
    targetFormat: "webp",
  })
);

// Drop accessors and buffers left unreferenced by the removals above.
const { prune, dedup } = await import("@gltf-transform/functions");
await doc.transform(dedup(), prune());

await io.write(output, doc);

const kb = (p) => (statSync(p).size / 1024).toFixed(1);
console.log(
  [
    `clips:    ${before.length} -> ${keep.length} (${keep.join(", ")})`,
    `textures: ${texBefore.join(", ")} -> capped at ${texMax}`,
    `size:     ${kb(input)} KB -> ${kb(output)} KB`,
  ].join("\n")
);
