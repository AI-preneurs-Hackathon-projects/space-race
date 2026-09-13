# Space Race · Cargo Run

A 3D cargo flight game with React, Three.js, Rapier rigid-body physics, and a Cloudflare Workers-compatible Vinext server. Fly cargo contracts through named sectors, respond to an adaptive Contract Director, earn hull/cruise upgrades, and jump onward until the ship is destroyed. The existing flight engine, assets and encounter formations remain in use.

## Play

- Choose Kestrel (balanced), Wraith (agile), Atlas (armored), or your sketched hull. Select Easy, Normal (default), or Hard; the setting carries through your campaign.
- WASD/arrows steer with thrust; hold Space to fire; Escape pauses. Forward thrust is automatic.
- Touch: drag the steering pad and hold FIRE. Use the pause button to resume or return to the hangar.
- Flight assist slows lateral drift when controls are released. Within gravity wells, reduced assist makes the pull noticeable; counter it with thrust.
- Shoot fuel canisters and volatile rocks near enemies for blast damage and chain reactions. Keep your own ship outside the blast.
- Shield buoys grant temporary protection. Ordinary spent repair capsules and damaged cargo crates remain debris; a Director-marked green relief capsule restores 18 hull and 8 cargo when intercepted. The final Warp Gate repairs the hull. Each new contract loads fresh cargo. A failed cargo requirement forfeits the base delivery reward; only ship destruction ends the expedition. Damaged ships retain smoke and fire effects.
- Deliver faster for a speed bonus: each manifest shows its full-bonus deadline and expiry. The bonus decreases to zero between those times; a late arrival keeps eligible base pay. Only active flight counts. Pause, planning, hangar time and gate transfer do not count, and returning to the hangar retains the same delivery’s elapsed time.
- Fly through cyan jump openings for a real 3× speed boost. Speed, distance gained, route progress and approaching scenery all agree with physical displacement. Standard contracts use the two route gates; priority and express deliveries may receive one or two additional contextual shortcut gates. They use the same boost and must be physically intercepted.
- At the final Warp Gate, flight pauses for delivery results and three distinct low/medium/high risk contracts. Select a contract and optionally +15 armor (five levels) or +5% cruise (four levels), then enter warp. Death shows expedition totals; Retry immediately starts sector one with the selected ship/difficulty, fresh cargo, zero rewards and no upgrades. There is no permanent progression.
- The optional cockpit voice reads authored bottom-of-screen guidance with a calm original pilot delivery. The Voice button mutes narration; the sound button mutes narration and game effects. Text remains available if audio cannot play.
- Open the **Field guide · 17 objects** in the hangar for recognizable models and each object's behavior.

## Interacting space physics

The local simulation owns a Rapier world and advances at a fixed 1/60-second timestep. A bounded accumulator handles rendering down to 10 FPS without slowing the game clock; longer interruptions are bounded to avoid a catch-up spiral. No network call controls movement or combat.

The player, asteroids, enemy vessels, satellites, salvage, rockets, and fragments have mass and inertia. Contacts resolve momentum and restitution. Damage uses the pre-impact relative velocity, with cooldowns preventing resting contacts from draining health. Colliders are forgiving sphere approximations. Projectiles use swept tests to hit the nearest crossed target without tunneling.

Moon and black-hole fields attract nearby bodies, including projectiles, and a repulsor pushes them away. Forces have softened centers, finite range, acceleration caps and reaction forces on the source. Black-hole cores absorb matter. This is scaled arcade physics, not an astronomical or orbital simulator. The distant star panorama, holographic lane markers and destination backdrop are scenery; visible drifting encounter rocks are actual physical bodies.

Explosions apply distance-falloff damage and impulses, can set off nearby explosives, and create physical fragments. Fragments can collide and chip other objects, but do not create full-size explosions themselves. Runtime limits are 150 entities, 48 debris pieces and 64 short-lived effects. Expired bodies, effects and completed-flight worlds are released.

The jump command ramps from 1× to 3× over one second, holds for five seconds, and returns over two seconds. Engine thrust follows that command with finite acceleration; actual progress comes from the player's world position. In an unobstructed test, two jumps complete the 4,350-game-unit route in about 124 seconds, compared with 150 seconds at base cruise. Impacts, gravity and upgrades can change the result. Entry pushes nearby hazards aside and briefly protects the hull; a missed opening is harmless. The normal ship and exhaust stay visible during cruise, pickup protection and jumps. Enclosing shield bubbles and radial jump bursts are not constructed; temporary shield protection still works. Enemy arrival/name popups and repulsor notifications are removed while their ships, weapons and field forces remain active. Stage waves have bounded course positions from 8 to 146, spawned 22 course units ahead. Warp cannot postpone or discard final waves, leaving only about 116 km of terminal clearance.

All four hostile ships have explicit weapons: Raider and Vesper fighters fire early single pulses; Horizon cruisers and Bastion destroyers fire slower paired volleys. Higher-stage cadence and volley scaling remain. Shots aim from a visible muzzle outside the hull, retain at least 1.4 seconds of travel time at emission, and keep the existing 16-hull/9-cargo damage. Pause, collision handling and world disposal retain their existing lifecycle rules; expedition death and restart follow the contract loop above. `tests/cleanup.spec.ts` checks every ship at early/later difficulty and both cruise limits, dodgeability, lifecycle behavior, retired-object fallbacks, and all three preset views.

## Stage environments and pressure

Ten named fictional destinations share one fully wrapped sphere: Verdant, Selene, Ares, Nivalis, Aurelia, Pyra, Pelagia, Vesper, Nereid and Salar. Every surface has original invented geography, and cloud/storm structures are fictional. Orientation, atmosphere and positions vary deterministically with the full stage number and remain stable on retries; the open-ended sequence repeats the ten themes with numbered names. The fixed-radius sphere approaches with real route distance. Original opaque 1774×887 generated masters are preserved with their prompts, encoded as runtime JPEGs and sampled into 2048×1024 desktop / 1024×512 mobile material maps. Narrow seam and polar filtering ensures full-sphere continuity. Relief/roughness and selected cloud/emission maps are prepared once and disposed with the scene. Planet-only lighting keeps the day/night boundary readable. No real-world planetary maps remain in the active assets. See `assets/planets/README.md` for provenance and reproduction.

A gate arrival names its destination and stops the physics world. Results show final cargo integrity, earned base, speed and objective rewards, completed/failed objectives, damage and delivery total. Missing the cargo threshold is a failed delivery, but a surviving ship may accept another contract. Three next-sector manifests are available immediately from local rules and can be replaced by a validated precomputed AI offer before selection; accepted choices are never replaced. Select an optional earned upgrade, then enter the separate, pausable terminal-gate transfer. The next sector starts with fully repaired hull and fresh cargo for the chosen manifest. Damage before gate repair and recent decisions inform the next Director request. Ship destruction takes precedence over arrival; retry starts a new expedition at sector one. Returning to the hangar preserves the current ship/cargo condition and earned upgrades; only a death retry resets the expedition. The transfer displays the selected normal ship, exhaust and streaks through open gate rings, with no membrane or enclosing shield. Loading does not construct an enclosing shield bubble. This presentation never advances a disposed physics world or consumes either optional in-course jump. The optional bottom route-map panel has been removed; named checkpoint progression remains. There are no mid-stage checkpoints or persistent saves.

Difficulty uses `pressure = (stage - 1) / (stage + 11)`, continuing past nine toward bounded limits. Normal starts at 34 waves and grows to 38; Easy uses 30–34 with wider lanes and slower fire, and Hard uses 36–40 with narrower lanes, quicker fire and earlier paired volleys. Sector pressure increases motion, aim and projectile speed while narrowing flight gaps. Contract risk adds bounded targeting/fire pressure; high risk can add a third projectile to an existing volley and slightly narrows rock lanes. An engine-owned combat-density floor and cap keep both AI-authored and fallback routes consistent with the selected challenge. Hostile pulses retain a 1.4-second minimum muzzle reaction window and enough lifetime to reach their intended path. Cargo properties, local events and urgency rewards create additional strategic tradeoffs without changing the difficulty selector or upgrade caps.

The gate panel presents delivery results, three cargo choices and the existing optional upgrades together. During flight, compact cargo, event and objective status uses the HUD; no contract menu interrupts steering or shooting. Desktop and mobile gate panels scroll when needed.

The updated 108-flight study spans Easy/Normal/Hard, sectors 1/9, low/high risk with the same cargo, three seeds and three control styles. Evasive steering delivered 36/36; idle and stationary-fire pilots delivered 0/36 each. The separate 72-flight legacy study also passed: steering delivered 24/24 while idle and stationary fire delivered 0/24 each. These are automated control comparisons, not a substitute for player feedback. First hull damage occurred no earlier than 4.3 seconds in the 108-flight sample. Peak entity count was 88, and a separate saturation test verifies the 48-hostile-projectile admission cap and refill behavior. Nine gate-controller flights intercepted both scheduled gates and delivered successfully. Scheduling and cleanup tests retain terminal-wave, physics and entity-budget checks. Full reports are written to ignored `outputs/`. Browser checks cover keyboard steering/fire, speech, model rendering, desktop bounds, mobile access and the contract loop; test fixtures only instrument development responses.

## Existing section planning

The existing prelaunch planner can still request a validated section plan after ship and upgrade choices are final. Its context contains stage, attempt, Easy/Normal/Hard, effective ship armor/handling/cruise, current launch hull, actual fractional cargo, and the previous gate arrival condition before repair. Planning has a six-second request deadline and is cancelable; stale responses cannot launch a run or change the active simulation. The availability check also times out into fallback.

The plan proposes nonportal encounter types and pacing weights throughout the sector. The engine adjusts insufficient or excessive pirate density to the selected difficulty and contract risk, while retaining legal choices that fit those bounds. Local code retains safe formations, progressive weapon limits, two optional portals and at least 3.5 course-seconds between wave arrivals. Composition validation requires armed encounters, rocks and calmer beats and caps fields/shields; invalid plans use the seeded fallback at the chosen difficulty. The mission and starting condition are frozen before mounting the flight scene. No provider call controls a running physics frame.

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
npx playwright test tests/physics.spec.ts tests/difficulty.spec.ts tests/expedition.spec.ts
npx playwright test tests/stages.spec.ts --grep-invert 'real delivery'
```

Expedition tests cover distinct contracts, validation and clamps, cargo effects, contextual events, objective accounting, stale decisions, gate settlement and reset. Delivery timing/reward tests cover exact bonus boundaries and cargo eligibility; speed engine/browser tests cover active clocks, genuine extra gates, unchanged boost limits, quiet field behavior and short mobile layouts. Browser tests cover the hangar, sketching, controls, pause/retry, mobile UI, API fallback and the delivery/contract/upgrade flow. The long-flight controller uses development-only read-only canvas telemetry, absent from the production build. A browser without WebGL cannot validate flight rendering or touch gameplay; the earlier deployment report is retained in [DEPLOYMENT.md](DEPLOYMENT.md) as historical context.

## AI Contract Director

The expedition layer is opt-in on `Mission.contract`, preserving standalone practice/simulation behavior. `lib/game/contracts.ts` owns the whitelisted cargo, contract, event, objective and summarized-state types. `contract-director.ts` supplies pure local selection, strict schemas, prompts, context checks, clamps and fallbacks. `expedition-runtime.ts` adapts validated proposals to existing objects, tracks local counters and evaluates objectives. `delivery-timing.ts` binds local urgency deadlines and bounded speed rewards to the selected loadout; `run-manager.ts` resolves delivery payments once per contract and maintains run totals. The existing progression module remains responsible for numbered sectors, difficulty, upgrades and transition guards. See [docs/contract-director.md](docs/contract-director.md) for the inspection and architecture notes.

Five manifests change flight strategy:

- **Medical supplies:** 1.35× cargo damage; deliver at 70% integrity or the contract's stated higher threshold.
- **Volatile fuel:** hits build instability, clean flight cools it, and high instability causes bounded damaging surges.
- **High-value technology:** pirates target more aggressively; bounty hunters may pursue the shipment.
- **Prototype navigation computers:** a tracked signal draws pirate pursuers, rewarding evasive flight.
- **Cryogenic passengers:** life support drains gradually, field/explosion damage is more dangerous, and delivery requires at least 50% integrity or the stated higher threshold.

The supported event library is pirate ambush, enemy reinforcement, asteroid wave, repair opportunity, bounty hunter, pirate pursuit, cargo instability and shortcut available. Cargo, health, combat, route position, recent events and the accepted contract's threat list determine eligibility; event intensity is capped by contract risk. Model proposals cannot remove a manifest's signature threat or introduce a mechanic. Optional manifest flags describe the existing cargo signature, not an undisclosed gameplay system.

Objectives combine at most two engine-evaluated conditions with one reward. Supported primitives are reach gate, maintain cargo integrity until gate, destroy actual hostiles or a marked hunter, survive a duration, escape nearby enemies, collect an actual shield buoy, avoid hull/cargo damage for a duration, and reach gate within a deadline. Collection is offered only when a live target is available ahead; hunter objectives bind to an actual local entity ID. Timed conditions latch on completion so later damage cannot retroactively undo an already completed condition. A composed objective pays once when every condition succeeds. Named-rival and ally-protection objectives are deliberately absent because those actors do not exist in the current engine.

The Director uses a summarized snapshot, never an engine reference: sector/difficulty, hull/cargo/instability, accepted contract, upgrades/credits, kills/damage/pickups, active enemies/targets, route progress, delivery timing, effective cruise, remaining shortcut budget and recent contracts/events/objectives. Calls run asynchronously on a 22-second cadence or a meaningful trigger, with a minimum 15 seconds between requests. The first evaluation occurs after sector entry. A response is validated on the server, against fresh client state, and again at the simulation boundary. Paused, finished, replaced or restarted flights reject stale work. Physics, weapons and rendering do not wait for the network.

## OpenAI and local fallbacks

OpenAI is optional. The existing server-only `OPENAI_API_KEY` and `OPENAI_MODEL` configuration is reused, retaining `gpt-4.1-mini` as the default. `/api/ai-status` reports credential presence only, not proof that generation succeeds. `/api/ship` continues to request a constrained mirrored nine-section hull; `/api/mission` supplies the existing prelaunch encounter plan. `/api/director` accepts `{mode: "contracts" | "live", context, targetSector?}` and returns validated `{contracts, source}` or `{decision, source}`. It uses the OpenAI Responses API with strict structured JSON and a six-second deadline, forwards cancellation, and restricts input to 24 KB. Keys never enter browser state or responses.

Local rules supply three distinct contracts and contextual events/objectives before any successful AI call. Next contracts are precomputed after 68% route progress. The gate briefly shows a receiving state if that request is still pending; the client falls back within 6.8 seconds, so cards never change underneath a selection. Provider errors, rate limits, refusals, timeouts, malformed JSON, illegal enums or impossible targets produce a validated local fallback. Invalid incoming requests receive an error instead of invoking the provider. The client also bounds requests and rejects stale responses. Missing credentials leave the complete expedition loop and local outline-to-mesh builder playable. There is no conversational dialogue, generated asset, permanent economy or unrestricted gameplay generation in this MVP.

`/api/speech` voices only the authored readout whitelist using `gpt-4o-mini-tts` and the fixed Cedar voice. It accepts no client-selected voice, prompt, free-form dialogue or microphone input. The server bounds synthesis to 5.5 seconds and caches up to 48 lines for an hour; the browser decodes and caches up to 32 clips. Each exact line is spoken once per sector, requests are spaced by four seconds, and a changed readout, pause, mute, death, departure or restart cancels stale narration. Speech runs independently of physics and rendering. The hangar identifies the voice as AI-generated.

For another deployment, provide its own approved key and set `OPENAI_API_KEY` as a server-side Site secret. Never put keys in chat, source, a frontend variable, or `.openai/hosting.json`. Verify an actual model response before calling AI connected. Browser and engine fixtures cover the selected-AI path without consuming live provider requests; those tests do not establish live account/quota availability.

For this checkout's local Cloudflare preview, load the approved ignored server environment file and explicitly allow Wrangler to receive the process environment:

```sh
CLOUDFLARE_INCLUDE_PROCESS_ENV=true node --env-file=.env.space-race.local scripts/run-framework.mjs dev --host 127.0.0.1 --port 5173
```

This flag is for the local Worker. Hosted secrets continue to use the existing Site configuration; no client environment variable is needed.

## Source and deployment

GitHub origin remains `https://github.com/AI-preneurs-Hackathon-projects/space-race.git`. Shared source preserves its checked-in Yerzhan Site target. Hadrien's existing Site is published from an isolated checkout with its own hosting manifest; gameplay changes are shared through normal Git commits without changing the collaborator's deployment target.

Use the appropriate existing Site identity, preserve its audience/runtime settings, and never force-push shared history. Build and push the exact source to that Site's repository before saving its archive and publishing. Confirm terminal deployment success and the actual target URL.
