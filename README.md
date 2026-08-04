# P.T. — 2

**Insanely scary.** A web-based, cinematic horror game modeled on Konami's *P.T.* —
the endlessly **looping L-shaped hallway**, oppressive atmosphere, and a lot more
scares. Built from scratch with **Three.js + TypeScript + Vite**.

> ⚠️ **Content warning.** This is designed to frighten. It contains sudden loud
> noises, jump scares, flashing/strobing lights, blood and gore, and intense
> psychological horror. Not suitable for children or anyone with photosensitive
> epilepsy, heart conditions, or anxiety disorders. Play with headphones, in the
> dark, at your own risk.

---

## Run it

```bash
npm install
npm run dev      # play at http://localhost:5173
```

Build a static bundle:

```bash
npm run build    # type-checks (tsc --noEmit) then bundles to dist/
npm run preview  # serve the production build
```

Any static host can serve `dist/` (the build uses relative paths).

## Controls

| Action        | Key |
|---------------|-----|
| Move          | `W` `A` `S` `D` (or arrows) |
| Look          | Mouse (click the screen to capture the pointer) |
| Interact      | `E`, `Space`, or left-click |
| Pause / menu  | `Esc` |

Walk to the end of the hall and **open the door** — you'll find yourself back at
the start of the same hallway, one loop deeper and more wrong. It does not end.

## What's inside

- **The looping hallway** — a single L-shaped corridor whose end door teleports
  you back to the start, swapping in a new, more disturbing *variant* each loop.
- **Cinematic rendering** — ACES tone mapping, SSAO, bloom, and a combined grade
  pass (vignette, chromatic aberration, film grain, "fear" desaturation) over
  procedurally-generated PBR materials, warm practical lighting, and volumetric
  fog. Four quality presets (Low → Ultra), auto-detected on first launch.
- **Hyper-real atmosphere** — a swinging pendant lamp that drags its
  shadow-casting light so shadows crawl across the hall, a real live mirror
  reflection (`Reflector`, gated to High/Ultra), dust motes drifting and
  thickening in the light, a faint volumetric god-ray cone, wet mirror-slick
  blood pools, and layered architectural trim (wainscot, chair rails, door
  casings, crown molding).
- **A broad scare system** — Lisa-style apparitions (including behind you when you
  turn), total blackouts with flash-reveals, a charging figure that resets the
  loop on contact, changing portraits, a face in the bathroom mirror, wrong-hour
  clocks, banging in the walls, a ringing phone with voice lines, radio
  broadcasts, and blood that floods the hall — scheduled by loop and by where you
  are in the corridor, over a continuously-intensifying bed of ambient dread.
- **Fully procedural audio** — the entire soundscape (drone bed, whispers,
  stingers, knocks, heartbeat, footsteps, phone, radio) is synthesized live with
  the Web Audio API. No audio files required.

## Project layout

```
src/
  core/        Engine, PostProcessing, Input, AudioManager, AssetManager, Quality
  world/       layout, Hallway, Materials (procedural PBR), Lighting, Props
  gameplay/    Player, Interaction, LoopManager, ScareSystem, scares/
  ui/          Ui (menus, HUD, content warning, full-screen effects)
  main.ts      wiring + game loop + state machine
```

## Pushing fidelity further (dropping in real assets)

The game ships with **zero image/audio assets** — everything is generated at
runtime so it always renders. The architecture is built so real, higher-fidelity
assets can replace the procedural ones with no structural changes:

- **PBR textures** — replace the canvas generators in `src/world/Materials.ts`
  with `TextureLoader` calls (albedo / normal / roughness / AO maps under
  `public/textures/`). The materials already wire up normal maps and env-map
  intensity.
- **Environment / reflections** — swap the generated env map in
  `src/core/AssetManager.ts` for an HDRI loaded via `RGBELoader`.
- **Audio** — feed real recordings into `PositionalAudio` and call them from
  `src/core/AudioManager.ts`; the one-shot API (`stinger`, `whisper`, `knock`,
  `footstep`, …) is the seam to hook into.

## Notes

"Hyper-realistic / AAA" in a browser is an *approximation*: the dread comes from
lighting, post-processing, and sound design rather than raw Unreal-grade asset
fidelity. This gets as close as the web realistically allows, and the seams above
are where you raise the ceiling.
