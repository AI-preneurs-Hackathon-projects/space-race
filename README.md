# Space Race · Cargo Run

A playable 3D browser game built with React, Three.js and a Cloudflare Workers-compatible Vinext server. Deliver medical supplies from Port Meridian to Kepler Outpost in continuous, numbered delivery stages. The base route takes 150 seconds; cruise upgrades and optional jump portals shorten the journey.

## Play

- Choose Kestrel (balanced), Wraith (agile), Atlas (armored), or draw an optional custom ship.
- WASD / arrows: steer left, right, up and down. Space: fire pulse cannons. Escape: pause.
- On touchscreens, drag the steering pad and hold FIRE.
- Avoid asteroids and pirate fire. Impacts damage hull and cargo. Cyan jump portals are safe: fly through the opening for a brief hyperspace boost.
- Reach the destination with hull and cargo remaining. Choose a hull or cruise upgrade after a clear, then launch the next harder stage. Failure retries the current stage with earned upgrades preserved. Pause or return to the hangar at any time.

## Local development

```sh
npm ci
npm run dev
```

The local URL is printed by the server. Production build: `npm run build`. Type check: `npx tsc --noEmit`. Tests: `npx playwright test` (the configuration uses Chrome on macOS; adapt `executablePath` for another platform). Start the local server before browser tests.

## AI setup and truthful fallbacks

Live AI is implemented but requires a server-side OpenAI API key. Use the OpenAI Developers plugin's `openai-platform-api-key` workflow with owner approval to create/reuse a key, then set `OPENAI_API_KEY` as a secret in the existing Site's runtime environment. Do not put it in chat, source, the hosting manifest, or a client-prefixed variable. Optional server variable `OPENAI_MODEL` defaults to `gpt-4.1-mini`.

For local development, copy `.env.example` to ignored `.env` and configure the key there using a secure credential workflow. Both endpoints use the OpenAI Responses API with strict JSON schema, no response storage, input size limits, timeouts, and validated geometry/gameplay bounds. The API key is accessed only by server routes.

- `/api/ship`: sends the top-down sketch image to OpenAI vision, obtains nine half-widths, thickness and engine count, then validates the blueprint. The same real extruded 3D mesh appears in preview and in flight. This is a constrained, mirrored stylized hull, not unrestricted mesh reconstruction.
- `/api/mission`: asks OpenAI for encounters before launch. The plan enforces spacing, coordinates, counts and portal limits. Legacy short routes are expanded and old gravity-hazard entries are converted internally to jump portals. All movement, spawning, collision detection and combat run locally. No per-frame model calls.
- `/api/ai-status`: reports only whether the server credential is configured.

When a key is absent or a model call fails, the game offers an explicitly labeled seeded practice stage and a local outline-to-mesh builder. These fallbacks do not claim to use live AI. Sketches/custom ships live in the current browser session only. Site access is controlled through its sharing panel; preserve the current audience and collaborator grants during publication. The lightweight per-isolate request limit is not a substitute for public-service abuse controls.

## Source and assets

The GitHub `origin` is preserved. `.openai/hosting.json` identifies the existing ChatGPT Site and must be reused for updates. Sites' separate source repository is used for deployment. Never create a second Site for this checkout.

Preset ships and three asteroid variants are authored through reproducible Blender scripts, exported as GLB, and rendered in the hangar and flight. Custom sketched ships remain browser-generated meshes. The jump portal, exhaust plumes and hyperspace star streaks are real-time Three.js effects. The space panorama, destination-planet albedo and asteroid albedo textures were generated with OpenAI image generation. No external text-to-3D provider is required.

Editable sources, Blender preview renders, asset counts and the exact reproduction command are documented in [assets/blender/README.md](assets/blender/README.md). Runtime models live in `public/models`; the portable generator is `scripts/generate-models.py`.

Official API references: [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs), [vision inputs](https://developers.openai.com/api/docs/guides/images-vision).

## Longer route and jump portals

The route covers 4,350 game distance units (displayed as km), requiring 150 active seconds at normal speed. Encounter spawn coordinates follow course progress, while steering, shooting cooldowns and damage immunity use elapsed real time. Each local stage has 20–28 seeded encounter waves and two optional offset portals, with a quiet final approach. Every launch and retry changes both portal positions; pause/resume keeps the current plan fixed.

Crossing a portal opening consumes that gate once and engages the jump drive: a smooth one-second ramp from 1× to 2.2×, five seconds at 2.2×, then a smooth two-second return to 1×. Each complete jump saves 7.8 seconds relative to that ship’s cruise-only time. Two jumps normally finish the base route in about 134.4 seconds; maximum cruise upgrades make that about 109.4 seconds. A missed gate causes no damage or gravity pull. Entry clears imminent threats from the forward corridor. Encounters spawned during a jump appear farther ahead for at least five seconds of reaction time at peak speed, including earned cruise bonuses; pirates cannot acquire a firing lock during the jump. Steering and player cannons continue to work normally. Progress, scenery movement, portal effects and destination approach all use the same travel distance.

Encounter waves preserve their arrival order and minimum course spacing across a boost's return to cruise. Each flight keeps the route selected at launch, so a delayed AI-planning response cannot reset an active delivery.

The renderer uses physically based material lighting, environment reflections, hangar shadows, restrained bloom, engine plumes and stretched 3D star trails with a bounded field-of-view transition. It caps pixel density and uses fewer distant rocks/stars on smaller displays.

See [TODO.md](TODO.md) for the user's deferred sketch-designer issue and live AI setup. Both remain deferred during this stage and environment update.

## Stages and upgrades

Each completed delivery is one stage. Numbering can continue indefinitely; difficulty increases through stage 9 and then stays bounded. There are no internal checkpoints, segment transitions, currencies or accounts. Session progress stays in memory until the page reloads or closes; returning to the hangar or changing vessels preserves it.

- Hull reward: +15 real maximum/starting armor, up to five selections (+75). Cargo still starts at 100 and remains vulnerable.
- Cruise reward: +5% of base forward speed, up to four selections (+20%). Maximum cruise covers the same distance in 125 seconds without portals. Steering, firing cooldowns and immunity retain their real-time clocks.
- Earn exactly one reward choice per cleared stage. Capped choices are disabled; when both are capped, continue without an additional reward. Attempt IDs and synchronous state transitions prevent duplicate-click and stale-completion rewards.
- Failure earns no reward and retries the current stage with fully repaired hull, replenished cargo and existing upgrades. Fleet base objects are never mutated; the same earned bonus applies once to any selected preset or local sketch hull.

Later stages increase gate frequency, formation density and moving pirate pressure. Rock curtains leave physical openings narrowing from 5.5 to 4.5 units; consecutive lane targets change by at most 5 horizontal and 3 vertical units, reachable by Atlas. Wave arrival spacing also accounts for maximum boosted cruise speed. Pirates progress to paired moving attackers, modest predictive aim and two-shot volleys, with at least 1.4 seconds of projectile reaction time at emission. Health inflation is not used for enemies. The final approach suppresses any delayed wave that would arrive after course coordinate 138.

The bounded generator is deterministic for a seed, stage and attempt. Portal centers are at x = ±4.6–6.2 and y = ±2.8, preventing automatic center entry. Their acceptance radius narrows modestly with difficulty, remains visible through matching portal geometry, and requires reachable alignment. Consecutive attempts move each portal by more than 3 units. With a configured AI endpoint, its encounter-kind plan is adapted through these same local stage and safety rules; it never replaces a launched mission.

## Planet and distant background

The destination is a textured 3D sphere with surface relief, a separately lit day/night boundary, procedural cloud cover and atmospheric scattering-style rim shading. Its world radius is fixed. Its z position is `-(720 + remainingCourse * 29)`, so normal flight, cruise upgrades and portal travel all advance the same perspective approach. The planet grows smoothly over the delivery, resets to its distant position on a new attempt, and stays offset from the main obstacle corridor. A sharper, restrained static space panorama keeps the central flight path dark and readable. Asset prompts and inspection details are in `assets/background/`.

`tests/stages.spec.ts` covers deterministic variation, retry/reward guards, capped stats, physical cruise timing, geometric lane clearance, multiple simulated stages, safe portal alignment/projectile lead, perspective growth, and a real browser delivery followed by mobile upgrade and retry flows. Browser-only flight telemetry is emitted in development for read-only test steering; it is removed from the production build.
