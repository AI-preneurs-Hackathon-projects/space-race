# AI Contract Director implementation

## Existing game inspected before implementation

The application is React 19 served through Vinext/Vite with Next-style API routes on Cloudflare Workers. `components/cargo-game.tsx` owns hangar/flight/transfer state and input. `components/space-scene.tsx` renders existing Three.js models and advances `lib/game/simulation.ts`. The simulation owns a Rapier world, advances at a fixed 1/60 second timestep, and publishes throttled UI snapshots. Movement, shooting, gravity, impacts, pickups, and entity cleanup are local and synchronous.

`lib/game/progression.ts` already supplies endless numbered stages, seeded encounter formations, bounded difficulty growth, hull/cruise upgrades and attempt lifecycle guards. Each sector is 150 course units (4,350 world units); two optional cyan gates boost real movement. The final Warp Gate is a separate arrival boundary: the simulation stops, records arrival hull and repairs it. `gate-transit.tsx` provides a separate short transition without advancing the completed world. `stage-environment.ts` supplies repeating named destinations.

Before this change cargo was one percentage carried through every stage, either depleted cargo or hull ended an attempt, and retry preserved the stage and upgrades. No named racing rivals or protectable allies exist. Enemies are the armed ship types in `objects.ts`. The existing `/api/mission` planner selects validated encounter types before launch; `ai.ts` already calls the OpenAI Responses API with a strict JSON schema and server-only credentials.

## Smallest extension

Keep the engine, rendering, assets, formations, upgrades and gate transfer. Add opt-in contract state to missions and flights, pure contract/context validation and run accounting, and a bounded simulation adapter for cargo, events and objectives. Existing missions without contracts retain their prior behavior.

The expedition loop loads fresh cargo for each new contract. A failed integrity requirement forfeits the base delivery payment but does not stop a surviving ship from continuing. Hull destruction ends the expedition. Retry creates a new campaign at sector one and resets its upgrades and rewards, retaining the selected ship and difficulty.

The Director can only propose catalog entries and bounded objective parameters. It has no engine reference. Both server and browser validate proposals; the simulation checks current eligibility again before applying a queued decision. Objective completion and reward settlement are evaluated by code.

The existing prelaunch section planner also receives a validated contract summary (cargo, risk, integrity requirement, modifiers and possible threats). It uses the same bounded beat and pacing system to fit the delivery; seeded formations and physics remain unchanged. Expedition planning accounts for fresh manifests and tagged relief capsules, and permits a surviving ship with depleted cargo to resume toward the gate. Legacy missions retain their original cargo rules.

Implementation sequence: data and local contract choices; cargo effects; local objectives and contextual events; asynchronous AI selection through the existing server boundary; lifecycle/fallback verification and UI pacing. No new art, physics engine, permanent progression, rivals or unrestricted mechanics are required. The tracked prototype navigation-computer cargo draws pirate pursuers; there is no authority or inspection encounter system.

## Implemented boundaries

- `contracts.ts`: the five cargo definitions and legal contract, event, objective and snapshot types.
- `contract-director.ts`: contextual local choices, JSON schemas, prompts, canonical contract construction and defensive validation.
- `director-client.ts`: asynchronous Contract Director transport. No simulation imports or mutation.
- `expedition-context.ts`: detached summaries of current performance and recent run history.
- `expedition-runtime.ts`: cargo modifiers, queued event execution, real target ledgers, simulation-time objective evaluation and completion. Active delivery time survives same-contract hangar relaunches; new contracts and death retries reset it. Extra shortcut gates have a separate 0/1/2 urgency budget, reuse real portal collisions and boost physics, and require route room, lead distance and gate separation.
- `delivery-timing.ts`: engine-owned standard/priority/express terms based on current cruise, difficulty and scheduled gates; the model selects urgency, never arbitrary numeric deadlines. The bounded speed reward fades from its full deadline to zero at expiry and requires successful cargo.
- `run-manager.ts`: idempotent delivery settlement, separate base/speed/objective rewards, credits, success rate and expedition totals.
- `progression.ts`: existing sector/difficulty manager, with opt-in fresh-manifest departure and surviving zero-cargo resumption.
- `use-contract-director.ts`: a wall-clock scheduler outside the animation loop; requests are separated by at least 15 simulation seconds and normally 22 seconds. Flight advances while requests wait. Pause, death and changed flight identity cancel stale results.
- `/api/director`: server-only OpenAI calls with strict output schemas, contextual validation, a six-second deadline and local fallback. The browser validates again, and the engine validates once more when applying the queue on its next active tick.
- `cockpit-lines.ts`, `cockpit-voice.ts`, `use-cockpit-voice.ts` and `/api/speech`: a whitelisted observer of bottom readouts with server-only speech synthesis, bounded caches and cancellation. Narration never generates a gameplay decision or blocks a simulation tick.
- `contract-gate.tsx` and `contract-hud.tsx`: a paused gate with stable choices and a compact, noninteractive flight HUD. Gate choices are precomputed on final approach; an unfinished request resolves or falls back within 6.8 seconds. The existing 3.3-second transfer remains. Retry skips prelaunch network planning.

Enemy introduction/name popups and repulsor notifications are removed without removing their objects or mechanics. Shield bubbles are absent during cruise, pickups, jumps, loading and transfer; shield protection still works.

Both named-rival racing and protect-an-ally objectives remain unavailable because no such actors exist. Collection and hunter objectives require real available targets. Optional manifest flags describe existing cargo properties and cannot introduce hidden code or a new mechanic.

## Verification notes

On 2026-09-13, the approved project credential was verified through the running local Worker and browser. Real OpenAI outputs passed server validation in about 2.4 seconds for a live decision and 3.3 seconds for three contracts. A separate browser integration applied an OpenAI-selected relief event and integrity objective to the simulation, resolved delivery, displayed three actual provider contracts, and launched sector two with the selected cargo. The final browser rerun after the speed/difficulty changes again applied a real relief event and integrity objective, then selected high-value technology for sector two. These measurements are observations, not latency guarantees; local fallbacks remain active.

`tests/expedition.spec.ts` covers legal structures, cargo effects, objective evaluation, exact target credit, settlement and failed/slow requests. `tests/expedition-lifecycle.spec.ts` covers zero-cargo resumption and preserving relief repairs. `tests/expedition-ui.spec.ts` covers the playable offline/AI loop, delayed responses, gate pacing, keyboard controls and short mobile layouts. Its additional real-provider test is explicitly enabled with `EXPEDITION_REAL_AI=1`; normal test runs do not require paid provider success. `tests/voice.spec.ts` uses actual browser audio decoding with local WAV fixtures for deduplication, cache and stale-response coverage, plus an opt-in provider MP3 decode/playback check.

The subsequent difficulty revision was evaluated with 108 matched expeditions across three settings, two sectors, two contract risks, three seeds and three control styles. Evasive pilots delivered 36/36; idle and stationary-fire pilots delivered 0/36 each. The original 72-flight suite now also passes, with steering 24/24 and both inactive-control styles 0/24. Earliest measured damage was 4.3 seconds and peak entities were 88. Projectile admission is separately capped at 48 hostiles; total entity and reaction-time checks remain enforced. A revised test pilot evades until final gate approach, then aligns using ordinary bounded thrust; all nine gate runs intercepted both scheduled boosts and delivered. Full telemetry is in the ignored `outputs/expedition-challenge-runs.json` report.

The new strict urgency schema also produced a real OpenAI response in 4.245 seconds: standard medical cargo, priority cryogenic cargo and express navigation computers, all with locally derived speed windows. An uncached authored cockpit readout returned a 64,896-byte MP3 in 1.666 seconds; repeated readouts use the server cache. The actual in-flight hook decoded and played a 3.48-second gate readout through the real speech endpoint while movement and shooting continued, and the Voice control stopped playback. These timings describe the tested local provider session, not a guarantee.

## API reference

The existing Responses API integration uses `text.format` with `type: json_schema`, `strict: true`, required fields and `additionalProperties: false`. Application validation remains necessary for contextual legality and numerical limits. See [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs). The fixed cockpit voice uses the [OpenAI Text-to-Speech API](https://developers.openai.com/api/docs/guides/text-to-speech), with server-side style instructions and MP3 output.
