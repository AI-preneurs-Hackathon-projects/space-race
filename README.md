# Space Race · Cargo Run

A 3D cargo flight game with React, Three.js, Rapier rigid-body physics, and a Cloudflare Workers-compatible Vinext server. Fly medical supplies from Port Meridian to Kepler Outpost, earn hull/cruise upgrades, and continue into harder stages.

## Play

- Choose Kestrel (balanced), Wraith (agile), Atlas (armored), or your sketched hull.
- WASD/arrows steer with thrust; hold Space to fire; Escape pauses. Forward thrust is automatic.
- Touch: drag the steering pad and hold FIRE. Use the pause button to resume or return to the hangar.
- Flight assist slows lateral drift when controls are released. Within gravity wells, reduced assist makes the pull noticeable; counter it with thrust.
- Shoot fuel canisters and volatile rocks near enemies for blast damage and chain reactions. Keep your own ship outside the blast.
- Collect repair capsules, cargo caches, and shield buoys. Damaged ships show smoke and, at critical hull, fire; black overlay patches and detached front lights are removed.
- Fly through cyan jump openings for a real 3× speed boost. Speed, distance gained, route progress and approaching scenery all agree with physical displacement.
- Clear a stage to choose +15 armor (five levels) or +5% cruise (four levels). Retry keeps earned upgrades; reload resets session progress and custom ships.
- Open the **Field guide · 18 objects** in the hangar for recognizable models and each object's behavior.

## Interacting space physics

The local simulation owns a Rapier world and advances at a fixed 1/60-second timestep. A bounded accumulator handles rendering down to 10 FPS without slowing the game clock; longer interruptions are bounded to avoid a catch-up spiral. No network call controls movement or combat.

The player, asteroids, enemy vessels, satellites, salvage, rockets, and fragments have mass and inertia. Contacts resolve momentum and restitution. Damage uses the pre-impact relative velocity, with cooldowns preventing resting contacts from draining health. Colliders are forgiving sphere approximations. Projectiles use swept tests to hit the nearest crossed target without tunneling.

Moon and black-hole fields attract nearby bodies, including projectiles, and a repulsor pushes them away. Forces have softened centers, finite range, acceleration caps and reaction forces on the source. Black-hole cores absorb matter. This is scaled arcade physics, not an astronomical or orbital simulator. The distant star panorama, holographic lane markers and destination backdrop are scenery; visible drifting encounter rocks are actual physical bodies.

Explosions apply distance-falloff damage and impulses, can set off nearby explosives, and create physical fragments. Fragments can collide and chip other objects, but do not create full-size explosions themselves. Runtime limits are 150 entities, 48 debris pieces and 64 short-lived effects. Expired bodies, effects and completed-flight worlds are released.

The jump command ramps from 1× to 3× over one second, holds for five seconds, and returns over two seconds. Engine thrust follows that command with finite acceleration; actual progress comes from the player's world position. In an unobstructed test, two jumps complete the 4,350-game-unit route in about 124 seconds, compared with 150 seconds at base cruise. Impacts, gravity and upgrades can change the result. Entry pushes nearby hazards aside and briefly shields the hull; a missed opening is harmless. Spawn spacing accounts for peak jump speed, with at least five seconds of lead and a quiet final approach.

All four hostile ships have explicit weapons: Raider and Vesper fighters fire early single pulses; Horizon cruisers and Bastion destroyers fire slower paired volleys. Higher-stage cadence and volley scaling remain. Shots aim from a visible muzzle outside the hull, retain at least 1.4 seconds of travel time at emission, and keep the existing 16-hull/9-cargo damage. Player death, cleared stages, pause and restart retain their existing lifecycle rules. `tests/cleanup.spec.ts` checks every ship at early/later difficulty and both cruise limits, dodgeability, lifecycle behavior, retired-object fallbacks, and all three preset views.

## Stage environments and pressure

Every stage has a deterministic destination and background independent of its retry seed. Temperate oceans, cratered moons, dune-covered deserts, fissured ice worlds, banded gas giants and volcanic worlds cycle with new geography and nebula/star positions derived from the full stage number. The destination remains a fixed-radius, separately lit 3D sphere; its real route distance produces the approach effect. Surface/background textures are generated once per scene and explicitly disposed. Mobile uses smaller surface maps.

Difficulty uses `pressure = (stage - 1) / (stage + 11)`, continuing past nine toward safe limits. Stages begin with 32 waves, growing to at most 36; the roster gives armed ships more frequent appearances. Alternating rock lanes require steering from the start. Gap width narrows from 4.8 toward 4 units, enemy motion increases, base firing interval falls from 1.9 toward 1.1 seconds, limited predictive aim increases from .22 toward .5 seconds, and bullet speed rises from 30 toward 42. Individual ship cadences and the 1.4-second muzzle reaction floor still apply. Projectile damage, player armor, repair, upgrade caps and per-run restoration rules are unchanged.

Pending upgrades replace the mission briefing. Ship stats, both reward choices, fleet selection and controls fit at normal zoom in 1280×720, 1330×768 and 1440×900 viewports. Small/mobile layouts keep stats and all actions accessible by natural scrolling. Fully upgraded ships receive a compact summary and Continue action.

Focused tuning runs use eight fixed seeds at stages 1, 9 and 25 with identical unupgraded Kestrel stats. Idle and stationary-fire controllers lost all runs; a responsive look-ahead steering controller delivered all runs. That demonstrates a need to steer and a viable escape path, not human difficulty calibration. Typical hostile shot counts rise substantially in later stages; body/effect caps and pickups remain in effect. Test reports are written to ignored `outputs/`. Browser checks cover actual keyboard steering/fire, model rendering, representative environments, desktop bounds and mobile access. The test-only browser response fixtures never add a production campaign-state shortcut.

## Objects and assets

The catalog in `lib/game/objects.ts` drives physics, encounters, rendering and the field guide. Its 18 active types are iron and ice asteroids; volatile rock; comet; cargo cache; fuel tank; repair pod; shield buoy; solar relay; seeker rocket; raider; saucer cruiser; twin-wing fighter; wedge destroyer; moon; black hole; repulsor; and jump gate. Basalt asteroid, crystal cluster, survey satellite, orbital relay, proximity mine, drifting wreck and ringed planetoid have been retired from the catalog, authored stages and fallback spawning. Their source art remains archived; runtime model loading uses only the active types and preset fleet.

The original Blender fleet design and exhaust are unchanged; the original three asteroid GLBs remain as inactive source assets. Eighteen new original GLBs add 7,598 triangles and about 702 KB in total, with 2–7 material draw calls each. New enemy silhouettes use familiar science-fiction archetypes with original geometry and no third-party models or logos. Fields, smoke, weapon flashes, hit sparks, blast rings and shield effects are rendered locally in Three.js.

- Original editable Blender assets: [assets/blender/README.md](assets/blender/README.md).
- New GLB generator, previews and validation: [assets/encounters/README.md](assets/encounters/README.md).
- Runtime models: `public/models`; model thumbnails: `public/object-previews`.
- Existing generated background textures and prompts: `assets/background`.

## Develop and test

```sh
npm ci
npm run dev
npm run build
npx tsc --noEmit
npx playwright test
python scripts/verify-models.py
python assets/encounters/verify_assets.py
```

The Playwright configuration uses bundled Chromium by default. Optional variables are `PLAYWRIGHT_EXECUTABLE_PATH` and `PLAYWRIGHT_BASE_URL`. Start the local server before browser tests. In managed ChatGPT environments, use the supported supervised Sites preview and Browser workflow.

Browser-free tests cover physics, gravity/repulsion, mass/rebound, chain damage, fragment limits, nearest-hit sweeps, pickups, acceleration, frame-step equivalence, lifecycle cleanup, all object types, stage generation and progression. Run only these when browser graphics are unavailable:

```sh
npx playwright test tests/physics.spec.ts tests/difficulty.spec.ts
npx playwright test tests/stages.spec.ts --grep-invert 'real delivery'
```

Browser tests cover the hangar, sketching, controls, pause/retry, mobile UI, API fallback and full delivery/upgrade flow. The long-flight controller uses development-only read-only canvas telemetry, absent from the production build. A browser without WebGL cannot validate flight rendering or touch gameplay; the earlier deployment report is retained in [DEPLOYMENT.md](DEPLOYMENT.md) as historical context.

## OpenAI and local fallbacks

OpenAI remains optional and is not configured for this Site. No key from another project is used. `/api/ai-status` reports only whether a server credential exists; this does not prove generation works. `/api/ship` requests a constrained mirrored nine-section hull; `/api/mission` requests a prelaunch plan. The local stage generator retains bounded coordinates and the interactive object roster. No in-flight AI director is claimed.

Missing credentials or failed requests leave seeded practice missions and the local outline-to-mesh builder available with explicit offline labels. Sketch hulls retain their baseline gameplay stats; unrestricted geometry and functional ship-design tradeoffs are future work.

For live AI, use the supported OpenAI Developers secure key workflow and set `OPENAI_API_KEY` as a server-side Site secret. Never put keys in chat, source, a frontend variable, or `.openai/hosting.json`. Verify an actual model response before calling AI connected.

## Source and deployment

GitHub origin remains `https://github.com/AI-preneurs-Hackathon-projects/space-race.git`. Shared source preserves its checked-in Yerzhan Site target. Hadrien's existing Site is published from an isolated checkout with its own hosting manifest; gameplay changes are shared through normal Git commits without changing the collaborator's deployment target.

Use the appropriate existing Site identity, preserve its audience/runtime settings, and never force-push shared history. Build and push the exact source to that Site's repository before saving its archive and publishing. Confirm terminal deployment success and the actual target URL.
