# Space Race · Cargo Run

A 3D cargo flight game with React, Three.js, Rapier rigid-body physics, and a Cloudflare Workers-compatible Vinext server. Fly medical supplies from Port Meridian through named planet checkpoints, earn hull/cruise upgrades, and jump onward into harder stages.

## Play

- Choose Kestrel (balanced), Wraith (agile), Atlas (armored), or your sketched hull. Select Easy, Normal (default), or Hard; the setting carries through your campaign.
- WASD/arrows steer with thrust; hold Space to fire; Escape pauses. Forward thrust is automatic.
- Touch: drag the steering pad and hold FIRE. Use the pause button to resume or return to the hangar.
- Flight assist slows lateral drift when controls are released. Within gravity wells, reduced assist makes the pull noticeable; counter it with thrust.
- Shoot fuel canisters and volatile rocks near enemies for blast damage and chain reactions. Keep your own ship outside the blast.
- Shield buoys grant temporary protection. Spent repair capsules and damaged cargo crates restore nothing. Hull repairs fully only at the final Warp Gate; cargo never replenishes during a continuing campaign. The run ends if either hull or cargo reaches zero. Damaged ships show smoke and, at critical hull, fire.
- Fly through cyan jump openings for a real 3× speed boost. Speed, distance gained, route progress and approaching scenery all agree with physical displacement.
- Clear a stage to choose +15 armor (five levels) or +5% cruise (four levels). Retry keeps earned upgrades; reload resets session progress and custom ships.
- Open the **Field guide · 17 objects** in the hangar for recognizable models and each object's behavior.

## Interacting space physics

The local simulation owns a Rapier world and advances at a fixed 1/60-second timestep. A bounded accumulator handles rendering down to 10 FPS without slowing the game clock; longer interruptions are bounded to avoid a catch-up spiral. No network call controls movement or combat.

The player, asteroids, enemy vessels, satellites, salvage, rockets, and fragments have mass and inertia. Contacts resolve momentum and restitution. Damage uses the pre-impact relative velocity, with cooldowns preventing resting contacts from draining health. Colliders are forgiving sphere approximations. Projectiles use swept tests to hit the nearest crossed target without tunneling.

Moon and black-hole fields attract nearby bodies, including projectiles, and a repulsor pushes them away. Forces have softened centers, finite range, acceleration caps and reaction forces on the source. Black-hole cores absorb matter. This is scaled arcade physics, not an astronomical or orbital simulator. The distant star panorama, holographic lane markers and destination backdrop are scenery; visible drifting encounter rocks are actual physical bodies.

Explosions apply distance-falloff damage and impulses, can set off nearby explosives, and create physical fragments. Fragments can collide and chip other objects, but do not create full-size explosions themselves. Runtime limits are 150 entities, 48 debris pieces and 64 short-lived effects. Expired bodies, effects and completed-flight worlds are released.

The jump command ramps from 1× to 3× over one second, holds for five seconds, and returns over two seconds. Engine thrust follows that command with finite acceleration; actual progress comes from the player's world position. In an unobstructed test, two jumps complete the 4,350-game-unit route in about 124 seconds, compared with 150 seconds at base cruise. Impacts, gravity and upgrades can change the result. Entry pushes nearby hazards aside and briefly protects the hull; a missed opening is harmless. During a jump, the normal ship and exhaust stay visible with star streaks; the enclosing shield sphere and radial jump burst are suppressed without removing protection. Regular pickup shields remain visible outside warp. Stage waves have bounded course positions from 8 to 146, spawned 22 course units ahead. Warp cannot postpone or discard final waves, leaving only about 116 km of terminal clearance.

All four hostile ships have explicit weapons: Raider and Vesper fighters fire early single pulses; Horizon cruisers and Bastion destroyers fire slower paired volleys. Higher-stage cadence and volley scaling remain. Shots aim from a visible muzzle outside the hull, retain at least 1.4 seconds of travel time at emission, and keep the existing 16-hull/9-cargo damage. Player death, cleared stages, pause and restart retain their existing lifecycle rules. `tests/cleanup.spec.ts` checks every ship at early/later difficulty and both cruise limits, dodgeability, lifecycle behavior, retired-object fallbacks, and all three preset views.

## Stage environments and pressure

Ten named fictional destinations share one fully wrapped sphere: Verdant, Selene, Ares, Nivalis, Aurelia, Pyra, Pelagia, Vesper, Nereid and Salar. Every surface has original invented geography, and cloud/storm structures are fictional. Orientation, atmosphere and positions vary deterministically with the full stage number and remain stable on retries; the open-ended sequence repeats the ten themes with numbered names. The fixed-radius sphere approaches with real route distance. Original opaque 1774×887 generated masters are preserved with their prompts, encoded as runtime JPEGs and sampled into 2048×1024 desktop / 1024×512 mobile material maps. Narrow seam and polar filtering ensures full-sphere continuity. Relief/roughness and selected cloud/emission maps are prepared once and disposed with the scene. Planet-only lighting keeps the day/night boundary readable. No real-world planetary maps remain in the active assets. See `assets/planets/README.md` for provenance and reproduction.

A completed delivery names its destination checkpoint. Choose an earned upgrade (or Continue when fully upgraded) to enter a separate, pausable terminal-gate transfer, then start the next stage with fully repaired hull and exactly the remaining cargo. Damage before gate repair is recorded for the next director request. Failure from depleted hull or cargo is resolved before arrival and cannot be revived by the gate. Returning to the hangar preserves the actual current simulation condition; a retry explicitly starts with fresh hull and cargo. The transfer displays the selected normal ship, exhaust and streaks through open gate rings, with no membrane or enclosing shield. The loading shield begins hidden. This presentation never advances a disposed physics world or consumes either optional in-course jump. The optional bottom route-map panel has been removed; named checkpoint progression remains. There are no mid-stage checkpoints or persistent saves.

Difficulty uses `pressure = (stage - 1) / (stage + 11)`, continuing past nine toward safe limits. Normal stages begin with 32 waves, growing to at most 36; Easy uses four fewer waves with wider lanes and slower firing, while Hard uses two more with narrower lanes and faster firing. These bounded settings apply to both AI and fallback routes; the roster gives armed ships more frequent appearances. Alternating rock lanes require steering from the start. Gap width narrows from 4.8 toward 4 units, enemy motion increases, base firing interval falls from 1.9 toward 1.1 seconds, limited predictive aim increases from .22 toward .5 seconds, and bullet speed rises from 30 toward 42. Individual ship cadences and the 1.4-second muzzle reaction floor still apply. Projectile damage and upgrade caps remain bounded. Gate-only hull repair and persistent cargo apply equally to every difficulty.

Pending upgrades replace the mission briefing. Ship stats, both reward choices, fleet selection and controls fit at normal zoom in 1280×720, 1330×768 and 1440×900 viewports. Small/mobile layouts keep stats and all actions accessible by natural scrolling. Fully upgraded ships receive a compact summary and Continue action.

Before this visual update, a 72-run tuning study established steering-dependent difficulty. A focused eight-seed stage-one check of the revised course schedule lost 8/8 idle runs and 5/8 stationary-fire runs, while evasive steering delivered 8/8. This is automated evidence of a viable steering route, not human difficulty calibration. Twelve scheduling checks across stages 1/9/25, cruise 1/1.2 and both gate strategies confirm every wave appears and encounters persist through the final 500 km. Body/effect caps remain in effect; only shield protection remains collectible. Test reports are written to ignored `outputs/`. Browser checks cover actual keyboard steering/fire, model rendering, representative environments, desktop bounds and mobile access. The test-only browser response fixtures never add a production campaign-state shortcut.

## Per-section director

Each launch requests a new validated section plan after the ship and upgrade choice are final. Its context contains stage, attempt, Easy/Normal/Hard, effective ship armor/handling/cruise, current launch hull, actual fractional cargo, and the previous gate arrival condition before repair. Planning is bounded and cancelable; stale responses cannot launch a run or change the active simulation. The availability check also times out into fallback.

The plan chooses every nonportal encounter type and pacing weight, rather than only a handful of late pirate waves. Local code retains safe formations, progressive weapon limits, two optional portals and at least 3.5 course-seconds between wave arrivals. Composition validation requires armed encounters, rocks and calmer beats and caps fields/shields; invalid plans use the seeded fallback at the chosen difficulty. The mission and starting condition are frozen before mounting the flight scene. No provider call controls a running physics frame.

## Objects and assets

The catalog in `lib/game/objects.ts` drives physics, encounters, rendering and the field guide. Its 17 active types are iron and ice asteroids; volatile rock; damaged cargo crate; fuel tank; spent repair pod; shield buoy; solar relay; seeker rocket; raider; saucer cruiser; twin-wing fighter; wedge destroyer; moon; black hole; repulsor; and jump gate. Basalt asteroid, crystal cluster, survey satellite, orbital relay, proximity mine, drifting wreck, ringed planetoid and ice comet have been retired from the catalog, authored stages and fallback spawning. Ice Asteroids and Fuel Canisters remain active. The former comet encounter slot uses an Ice Asteroid, preserving wave timing and encounter pressure. Retired source art remains archived; runtime model loading uses only the active types and preset fleet.

The original Blender fleet design and exhaust are unchanged; the original three asteroid GLBs remain inactive archive assets. Thirteen active encounter exports now have editable Blender sources: four detailed natural bodies with packed PBR maps and nine manufactured objects with bevels, weighted normals and attached fittings. Natural bodies use 12,320 triangles and one material batch; hardware uses roughly 5,700–13,600 triangles and 4–7 batches. Each export fits its original unit collision sphere. The interactive Rogue Moon field asset is distinct from the destination sphere. Non-gate field orbit arcs and decorative flight-corridor hoops are removed; black-hole accretion uses diffuse dust. All 17 active guide portraits are real game-model renders. Regular boost-gate labels are compact, scale smoothly with distance, sit above the projected rim, avoid the aiming area/HUD/hazards and fade before close passage. Final checkpoint gates say exactly “Warp Gate” above the rim, using the same compact distance scaling; ordinary boost gates retain “JUMP GATE”.

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

OpenAI remains optional. Hadrien's Site uses a separate server-side secret for the prelaunch director, with `gpt-4.1-mini` as the default model. No key from another project is used. `/api/ai-status` reports only whether a server credential exists; this does not prove generation works. `/api/ship` requests a constrained mirrored nine-section hull; `/api/mission` requests a prelaunch plan. The director plans every section using the chosen difficulty, ship and actual campaign condition. Its validated plan determines all nonportal encounter types and bounded timing; local code retains safe coordinates, difficulty budgets and both optional gates. Planning happens before launch; the active flight keeps its selected plan. There is no adaptive in-flight AI director. The existing sketch endpoint has not been expanded or revalidated in this activation.

Missing credentials or failed requests leave seeded practice missions and the local outline-to-mesh builder available with explicit offline labels. Sketch hulls retain their baseline gameplay stats; unrestricted geometry and functional ship-design tradeoffs are future work.

For another deployment, provide its own approved key and set `OPENAI_API_KEY` as a server-side Site secret. Never put keys in chat, source, a frontend variable, or `.openai/hosting.json`. Verify an actual model response before calling AI connected.

## Source and deployment

GitHub origin remains `https://github.com/AI-preneurs-Hackathon-projects/space-race.git`. Shared source preserves its checked-in Yerzhan Site target. Hadrien's existing Site is published from an isolated checkout with its own hosting manifest; gameplay changes are shared through normal Git commits without changing the collaborator's deployment target.

Use the appropriate existing Site identity, preserve its audience/runtime settings, and never force-push shared history. Build and push the exact source to that Site's repository before saving its archive and publishing. Confirm terminal deployment success and the actual target URL.
