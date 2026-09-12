# Space Race · Cargo Run

A 3D cargo flight game with React, Three.js, Rapier rigid-body physics, and a Cloudflare Workers-compatible Vinext server. Fly medical supplies from Port Meridian to Kepler Outpost, earn hull/cruise upgrades, and continue into harder stages.

## Play

- Choose Kestrel (balanced), Wraith (agile), Atlas (armored), or your sketched hull.
- WASD/arrows steer with thrust; hold Space to fire; Escape pauses. Forward thrust is automatic.
- Touch: drag the steering pad and hold FIRE. Use the pause button to resume or return to the hangar.
- Flight assist slows lateral drift when controls are released. Within gravity wells, reduced assist makes the pull noticeable; counter it with thrust.
- Shoot fuel canisters and volatile rocks near enemies for blast damage and chain reactions. Keep your own ship outside the blast.
- Collect repair capsules, cargo caches, and shield buoys. Damaged ships show scorched panels, smoke, and, at critical hull, fire.
- Fly through cyan jump openings for a real 3× speed boost. Speed, distance gained, route progress and approaching scenery all agree with physical displacement.
- Clear a stage to choose +15 armor (five levels) or +5% cruise (four levels). Retry keeps earned upgrades; reload resets session progress and custom ships.
- Open the **Field guide · 25 objects** in the hangar for recognizable models and each object's behavior.

## Interacting space physics

The local simulation owns a Rapier world and advances at a fixed 1/60-second timestep. A bounded accumulator handles rendering down to 10 FPS without slowing the game clock; longer interruptions are bounded to avoid a catch-up spiral. No network call controls movement or combat.

The player, asteroids, enemy vessels, satellites, salvage, rockets, and fragments have mass and inertia. Contacts resolve momentum and restitution. Damage uses the pre-impact relative velocity, with cooldowns preventing resting contacts from draining health. Colliders are forgiving gameplay approximations: mostly spheres, with a compound hollow station ring. Projectiles use swept tests to hit the nearest crossed target without tunneling; station shots query its compound colliders.

Moon, planetoid and black-hole fields attract nearby bodies, including projectiles, and a repulsor pushes them away. Forces have softened centers, finite range, acceleration caps and reaction forces on the source. Black-hole cores absorb matter. This is scaled arcade physics, not an astronomical or orbital simulator. The distant star panorama, holographic lane markers and destination backdrop are scenery; visible drifting encounter rocks are actual physical bodies.

Explosions apply distance-falloff damage and impulses, can set off nearby explosives, and create physical fragments. Fragments can collide and chip other objects, but do not create full-size explosions themselves. Runtime limits are 150 entities, 48 debris pieces and 64 short-lived effects. Expired bodies, effects and completed-flight worlds are released.

The jump command ramps from 1× to 3× over one second, holds for five seconds, and returns over two seconds. Engine thrust follows that command with finite acceleration; actual progress comes from the player's world position. In an unobstructed test, two jumps complete the 4,350-game-unit route in about 124 seconds, compared with 150 seconds at base cruise. Impacts, gravity and upgrades can change the result. Entry pushes nearby hazards aside and briefly shields the hull; a missed opening is harmless. Spawn spacing accounts for peak jump speed, with at least five seconds of lead and a quiet final approach.

## Objects and assets

The catalog in `lib/game/objects.ts` drives physics, encounters, rendering and the field guide. Its 25 types are basalt, iron and ice asteroids; volatile rock; crystal cluster; comet; wreck; cargo cache; fuel tank; mine; repair pod; shield buoy; survey satellite; solar relay; seeker rocket; raider; saucer cruiser; twin-wing fighter; wedge destroyer; orbital relay; moon; ringed planetoid; black hole; repulsor; and jump gate.

The original Blender fleet and three asteroid GLBs are preserved. Eighteen new original GLBs add 7,598 triangles and about 702 KB in total, with 2–7 material draw calls each. New enemy silhouettes use familiar science-fiction archetypes with original geometry and no third-party models or logos. Fields, smoke, weapon flashes, hit sparks, blast rings and shield effects are rendered locally in Three.js.

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

The 25 browser-free tests cover physics, gravity/repulsion, mass/rebound, chain damage, fragment limits, nearest-hit sweeps, hollow-ring collisions, pickups, mines, acceleration, frame-step equivalence, lifecycle cleanup, all object types, stage generation and progression. Run only these when browser graphics are unavailable:

```sh
npx playwright test --grep-invert 'hangar, drawing|mobile layout|failed delivery reaches|AI service failure|a late AI plan|real delivery advances'
```

Six additional browser tests cover the hangar, sketching, controls, pause/retry, mobile UI, API fallback and full delivery/upgrade flow. The long-flight controller uses development-only read-only canvas telemetry, absent from the production build. A browser without WebGL cannot validate flight rendering or touch gameplay; see [DEPLOYMENT.md](DEPLOYMENT.md) for the actual verification boundary.

## OpenAI and local fallbacks

OpenAI remains optional and is not configured for this Site. No key from another project is used. `/api/ai-status` reports only whether a server credential exists; this does not prove generation works. `/api/ship` requests a constrained mirrored nine-section hull; `/api/mission` requests a prelaunch plan. The local stage generator retains bounded coordinates and the interactive object roster. No in-flight AI director is claimed.

Missing credentials or failed requests leave seeded practice missions and the local outline-to-mesh builder available with explicit offline labels. Sketch hulls retain their baseline gameplay stats; unrestricted geometry and functional ship-design tradeoffs are future work.

For live AI, use the supported OpenAI Developers secure key workflow and set `OPENAI_API_KEY` as a server-side Site secret. Never put keys in chat, source, a frontend variable, or `.openai/hosting.json`. Verify an actual model response before calling AI connected.

## Source and deployment

GitHub origin remains `https://github.com/AI-preneurs-Hackathon-projects/space-race.git`. This track uses `yerzhan/space-race`. The hosting manifest identifies Yerzhan's private Site `appgprj_6aa5346ba83c8191b546394c9e32a84e`; reuse it for future updates. Hadrien's hosting identity on shared `main` is unchanged.

Fetch and integrate teammate updates through normal Git operations, preserving this track's hosting identity. Commit the source, push to the dedicated GitHub branch when integration access permits, and push the exact commit to the separate Sites source repository. Save the build archive with that complete source SHA, deploy privately, and confirm terminal success. Never force-push shared history or register another Site for an update.
