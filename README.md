# folio

Portfolio site. Next.js 16 (App Router) + three.js via react-three-fiber.

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

---

## The landing hero

Two layers, composited:

1. **Collage** (`src/components/hero/Collage.tsx`) — a drifting field of image
   and video cards behind everything else. Deliberately de-emphasised: it is
   atmosphere, not content.
2. **Character** (`src/components/hero/Character.tsx`) — a rigged `.glb`
   looping a dance clip through an `AnimationMixer`, on a transparent canvas
   layered in front.

Every tunable lives in [`src/config/hero.ts`](src/config/hero.ts).

### The clear zone

The one rule the hero is built around: **collage cards never cross the
character.**

[`src/lib/clear-zone.ts`](src/lib/clear-zone.ts) defines an ellipse over the
area the character occupies. Each frame, every card is tested against it:

- Cards **inside** the ellipse get pushed back out along its normal.
- Cards **near** the edge fade out across a band (`FADE_BAND`), so the
  boundary reads as soft rather than as a hard invisible cutoff.
- The ellipse is defined in **viewport-relative units** and recomputed on
  resize, so it stays locked to the character at any screen size.

Cards also spawn outside the zone, so nothing pops in on top of the character
on first paint.

### Motion: parallax, not drift

The collage is driven by **input**, not by a constant animation - matching the
mimosa reference, which was measured stable to the pixel with no cursor or
scroll movement.

- **Cursor** moves the whole field, eased toward the pointer. Amplitude is
  scaled per card by depth, so the field layers instead of sliding as one
  sheet. Measured on the reference: ~37px x / ~30px y across a full viewport
  traverse, with a 22-59px spread between cards.
- **Scroll** adds a slow parallax offset (~5% of scroll distance measured).
- **Ambient drift** is a small addition of ours, so the hero is not completely
  frozen while the character dances. Set `minSpeed`/`maxSpeed` to `0` in the
  config to match the reference exactly.

The cursor follow uses exponential smoothing on elapsed time
(`COLLAGE.pointerTau`) rather than a per-frame lerp - a per-frame lerp
converges more than twice as fast on a 144Hz display as on a 60Hz one.

### Swapping the character

The loader auto-normalises any model to a known height with its feet on the
floor plane, so you do not have to re-tune the camera when you change it.
Export scale does not matter — Mixamo centimetres, Blender metres, whatever.

Drop a rigged, animated `.glb` into `public/models/` and point the config at
it:

```bash
# .env.local
NEXT_PUBLIC_CHARACTER_MODEL=/models/your-character.glb
NEXT_PUBLIC_CHARACTER_CLIP=Dance
```

The committed default is `/models/nico.glb` playing its `hiphop` clip. The
bundled CC0 robot remains available as a fallback:

```bash
NEXT_PUBLIC_CHARACTER_MODEL=/models/RobotExpressive.glb
NEXT_PUBLIC_CHARACTER_CLIP=Dance
```

If the named clip is not in the file, the first available clip plays instead.

To get a character with a dance loop: [Mixamo](https://www.mixamo.com) is free
and its animations are royalty-free, including for commercial work. Upload a
rigged avatar (or use one of theirs), pick a dance, export as glb with skin.

### Model optimisation

Source models ship every clip their rig was authored with. The hero plays
one. On `nico.glb` the unused clips were **923 KB of a 1071 KB file - 86% of
the download** for animations that never run, and its 2048² texture cost
~22 MB of VRAM decoded.

```bash
npm run opt:model -- public/models/in.glb public/models/out.glb --keep hiphop --tex 1024
```

`--keep` takes a comma-separated clip list, `--tex` caps texture resolution.
This took nico.glb from **1071 KB to 218 KB**. The untouched original stays in
git history.

### Placeholder media

The collage ships with locally generated placeholders — flat SVG cards and
short silent gradient clips — so the hero has something to show before real
assets land. Nothing here is third-party.

**To use your own assets: drop them into `public/media/` and run:**

```bash
npm run gen:media
```

The script scans that folder, reads each file's real dimensions, and rewrites
the manifest at `src/data/collage-media.json`. Nothing else needs editing.
Supported: `svg png jpg jpeg webp gif` and `mp4 webm mov`.

Generated placeholders are prefixed `gen-`. Delete them once you have your own
media, or run `npm run gen:media -- --clean` to drop and rebuild them.
`--no-generate` scans your files without adding any.

Good sources that are free for commercial use:
[Unsplash](https://unsplash.com), [Pexels](https://pexels.com),
[Coverr](https://coverr.co) and [Mixkit](https://mixkit.co) for video.

## Assets

- `public/models/nico.glb` — **current default character.** Third-party
  asset, sourced from nic0martins.com. No license grant obtained; it is in
  this repo as a placeholder for demo purposes only. Replace it before this
  site is published anywhere public.
- `public/models/RobotExpressive.glb` — by Tomás Laulhé, modified by
  Don McCurdy. **CC0 / public domain.** From the three.js examples. Safe to
  ship; switch to it with `NEXT_PUBLIC_CHARACTER_MODEL`.
- `public/media/*` — generated by `scripts/gen-placeholders.mjs`. No
  third-party content.

## Notes

- The canvas is `pointer-events: none`, so the hero never eats scroll or clicks.
- `prefers-reduced-motion` halts the collage drift.
- Concurrent video playback is capped (`COLLAGE.maxVideos`) — each clip is a
  live decode pipeline and they stack up fast next to a WebGL scene.
