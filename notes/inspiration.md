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

## Still to come

- More reference sites (user is sharing one by one)
