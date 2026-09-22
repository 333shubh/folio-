# Portfolio — Inspiration & Spec

Running notes. One entry per reference site: what we're taking, what we're
leaving, and how hard it is to build.

---

## Landing page — the concept

**Two references fused into one hero:**

A rigged 3D character looping a dance animation, centre stage, with a slow
drifting collage of images and short videos floating behind it.

Foreground text (name, role, links) pinned to the corners in small type.

---

## Ref 1 — nic0martins.com

**Taking:** the dancing 3D character.

**How it's built (inspected):**
- Next.js + three.js (`__THREE__` present, almost certainly react-three-fiber + drei)
- Single `/models/nico.glb` — rigged character with a **baked looping dance clip**
  inside the file, played via `AnimationMixer` / drei `useAnimations`
- The dance is animation data in the model, NOT code. Almost certainly a Mixamo
  clip retargeted onto a custom avatar.
- Flat `#e8e8e6` background, soft studio lighting, contact shadow under the feet
- Character is the only thing in the scene. Background is deliberately empty.
- Page is 2x viewport tall; section 2 is a flat electric-blue panel

**NOT taking:** `nico.glb` itself — that's his own likeness and copyrighted.
We use our own avatar or a free rigged model.

**Build difficulty:** Low-medium. Standard R3F. The work is in sourcing/rigging
the character, not the code.

---

## Ref 2 — mimosaagency.com

**Taking:** the floating background media field.

**How it's built (inspected):**
- Framer site (`framerusercontent.com`, `framer-*-container` classes)
- **18 `<video>` + 43 `<img>`** scattered as cards across a plane much larger
  than the viewport (measured card positions ran x: -80 → 2040, y: -82 → 1313)
- Cards drift slowly and continuously — a looping/infinite scattered canvas
- Videos autoplay, muted, looping, small (~184x104 to 261x147)
- Mixed content: photos, short video clips, UI screenshots, colour palettes,
  little text cards ("Hopecore", "INFOGRAPHS")
- Rounded corners, varied sizes, irregular scatter — deliberately un-gridded
- Headline text layered on top, centred
- Has a preloader ("Shifting paradigms") before the hero resolves

**Build difficulty:** Medium. The drift + infinite wrap is the fiddly part.
Asset weight is the real cost, not the animation.

---

## ✅ DECIDED — landing hero hierarchy

**Character is the hero. Collage is atmosphere. They never overlap.**

- Both elements present — not one or the other
- Collage is visually de-emphasised (pushed back: lower contrast/opacity,
  smaller cards, slow drift). Should read as texture, not content.
- **Hard rule: a clear zone around the dancing character.** Cards drift
  around the edges and route around him — nothing ever passes in front of
  the dance. This is the main constraint to engineer for.
- **No corner text yet** (name / role / links). Hero is character + collage
  only for now. Text comes later.

Implementation note: the clear zone needs to be defined in viewport-relative
units and re-evaluated on resize, otherwise it breaks at other screen sizes.
Cards near the boundary need to fade rather than hard-clip.

---

## ⚠ Open tension to resolve — RESOLVED (see above)

The two references work for **opposite** reasons:

- nic0martins works because the background is **completely empty** — nothing
  competes with the character.
- mimosa works because there is **no single focal subject** — the collage
  *is* the subject.

Stacking a busy drifting collage directly behind a dancing character risks both
losing. Needs a deliberate hierarchy decision — see options in chat.

## ⚠ Performance note

18 autoplaying videos + a rigged glb + WebGL on one page is heavy. Will need
lazy-loading, capped concurrent video playback, and a mobile fallback.

---


---

## Ref 2 follow-up - measured, not guessed

Drove the live site and measured card positions. The mechanic is **not** what
it looks like:

| Input | Card response |
|---|---|
| No input, 1.5s | **zero movement** - stable to the pixel |
| Cursor, full viewport traverse | avg (+37, -30) px, per-card spread 22-59px |
| Scroll 198px | ~10px (~5% of scroll) |

**There is no autonomous drift.** The field moves only on cursor and scroll.
The per-card spread is depth layering, not noise.

This is the opposite of the first implementation (constant drift), so the
collage was rewritten around input-driven parallax.

Open question for the user: the reference collage is **full colour and
prominent**, which pulls against the earlier "less focus on the media collage"
note. Currently held back with `saturate(0.85)` and capped opacity. One CSS
line either way.

---

## Ref 2 follow-up 2 - the nav and the landing -> section transition

Driven and measured at 1536px.

**Nav.** Not one bar. Two independent `position: fixed` groups, `top: 4px`,
one at `left: 4px` and one at `right: 4px`, `gap: 4px`, `z-index: 9`.

| Property | Measured |
|---|---|
| Pill box | 26px tall, `padding: 8px 12px`, `border-radius: 100px` |
| Pill fill | `#f1f1f1` |
| Type | 12.8px / 600, `letter-spacing: -0.384px`, `#252525` |
| Hover | inverts - black fill, white text |
| Toggle pill | 32px wide, `+` <-> `-` |

The `+` expands extra pills **inline, to its own left**, and the links to its
right never move. That is what makes it read as the bar widening rather than
as a menu opening. Ours was already built this way; only the measurements
changed.

**The transition.** The hero never scrolls. Structure:

```
wrapper (overflow: clip)
  div     100vh, in flow          <- the runway, empty
  div     position: fixed, z 1    <- the whole hero
  section position: relative, z 2 <- opaque, climbs over it
```

Scrolling moves the *next section over a hero that has not moved*. The cards
appear to be sliced by a horizontal line because that line is the top edge of
section 2. Scrolling the hero away instead reads completely differently -
things leave the frame rather than being covered.

Implemented, plus one thing the reference does not do: once the cover is
complete we set `visibility: hidden` on the hero, which stops r3f rendering
and pauses the collage videos for the rest of the page.

---

## Ref 3 - aikawakenichi.com

**Taking:** the Selected Work showcase.

**How it's built (inspected):** one `<canvas>`, three.js, lenis smooth
scroll. All text is drawn into the canvas; the DOM copies are transparent
(`rgba(255,255,255,0)`) and exist for measurement and a11y.

**The mechanic.** Three categories (Work / Fashion / Journey) as panels on a
cylinder, with a bottom control bar: thumbnail, current label, prev/next, and
a MODE button. MODE switches between:

- **ARC** - a closed drum, seen slightly from above so the top face shows
- **FLAT** - the same panels unrolled into a wide row, neighbours edge-on

The important observation: those are not two layouts. **They are one cylinder
at two radii.** Stretch the radius and the front panel flattens while its
neighbours swing out to the sides. One animated number drives the whole
morph, and the two modes cannot drift apart.

**Not taking:** the preloader, the full-page WebGL type, lenis. Our section
lives in a page that scrolls normally.

**Built as:** `src/components/work/Drum.tsx`. The bend is a vertex shader
(`position.x` is read as arc length, so the panel keeps its width at every
radius) rather than rebuilt geometry. Panels wrap at `count * step`, not at
2pi - at the flat radius three panels only span ~129 degrees, so wrapping at
pi would bunch them all on one side of the frame. Titles are DOM over the
canvas, not baked into it.

Placeholders: `node scripts/gen-work-placeholders.mjs` writes three 8:3
panoramas to `public/work/`. Swap the files, keep the shape.

## Still to come

- More reference sites (user is sharing one by one)
- Real projects to replace Work #1-#3
