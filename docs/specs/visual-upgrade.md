# Visual upgrade spec: make the pseudo-3D racer look premium

Owner: Qwen4 (via Hermes). Reviewer/verifier: Claude.

## Context
NEON REDLINE is a mobile-first (portrait phone, 375x812 CSS px) arcade racer:
React + HTML5 Canvas 2D, TypeScript, Vite. The previous projected-3D scene was
replaced by a retro pseudo-3D road renderer. The user says the new look is
WORSE than before. Your job is to make it look clearly better: polished, high
quality, readable, exciting. Original art only; do not imitate any existing game.

Files you own:
- `src/game/PseudoRoadCanvas.tsx`  renderer + game loop (main target)
- `src/game/roadArt.ts`            procedural billboard art + backdrops
- `src/game/pseudoRoad.ts`         pure road core (keep API; tests depend on it)
Do not change game rules/economy in `src/game/rules.ts`, `src/game/missions.ts`,
or the HUD/menus in `src/App.tsx` except where a fix truly needs it.
Reuse `src/game/pixelSprites.ts` (hero/traffic sprites) and `src/game/skyArt.ts`.

## Problems seen in the current build (fix all)
1. Everything is rendered into a tiny buffer (~420 px tall) and upscaled with
   nearest-neighbour, so on a phone it looks blocky and cheap. Render at a much
   higher internal resolution (target ~ device px / 1.5, cap ~1200 px tall) with
   crisp sprite scaling. Keep 60 fps on mid-range phones.
2. Grass is flat high-contrast horizontal stripes; thin light seam lines show
   between road segments. Remove seams (overlap polys by 1 px) and make the
   ground read as terrain: subtle alternating tones, texture/noise, distance
   colour falloff.
3. The world feels empty and flat: no guardrails, no barriers, no depth cues.
   Add continuous roadside guardrails/barriers (posts + rail), distance
   haze/atmospheric perspective, denser and more varied props per biome
   (alpine pines + snow, canyon mesas/cacti, neon city towers with lit windows,
   sakura trees + petals), and ambient particles per biome (biome.ambientParticle).
4. Road surface is plain: add asphalt texture/variation, better kerbs, lane
   markings, light road-edge glow at night (neon biome), headlight cones at night.
5. Hero car looks oversized and pixel-blurry; size it so it sits naturally on
   the road (about 30-36% of screen width in portrait), add contact shadow,
   tilt/lean into steering, drift smoke from rear tyres, tail-light glow.
6. Sky/backdrop: smoother gradients, layered mountains/skyline with proper
   parallax and haze between layers, sun/moon glow.
7. Juice should feel premium, not noisy: tune speed lines, shake, popups
   (nicer font sizing for phone), fever/boost post-effects.

## Skills to read and apply (read these files first)
- C:\Users\Elie\.claude\skills\game-feel\SKILL.md
- C:\Users\Elie\.claude\skills\2d-sprite-animation\SKILL.md
- C:\Users\Elie\.claude\skills\camera-systems\SKILL.md
- C:\Users\Elie\.claude\skills\procedural-gen\SKILL.md
- C:\Users\Elie\.claude\skills\game-ui-design\SKILL.md
- C:\Users\Elie\.claude\skills\performance-optimization\SKILL.md
- C:\Users\Elie\.claude\skills\shader-programming\SKILL.md (canvas-friendly ideas only)
- C:\Users\Elie\.claude\plugins\cache\claude-plugins-official\frontend-design\1.1.1\skills\frontend-design\SKILL.md

## Hard constraints
- Keep the exported `SceneCanvas` component, its props, `GamePhase` and
  `LiveTelemetry` types unchanged (App.tsx depends on them).
- Keep the dev-only `?bgloop` loop hook and touch/keyboard behaviour.
- No new npm dependencies. Canvas 2D only (no WebGL, no three.js).
- No per-frame allocation storms (reuse arrays/objects; cache gradients/strings).

## Acceptance (run these, all must pass)
- `npx tsc --noEmit` exits 0
- `npx tsx --test src/game/*.test.ts` all pass (45+ tests)
- `npx vite build` succeeds
- Report a short list of what you changed per problem number above.
