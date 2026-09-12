# Yerzhan's baseline deployment

Prepared on September 12, 2026 from the freshly fetched upstream `main` commit `bbac61dc8db8a16269e2406b571477d42a112c57`.

- GitHub branch: `yerzhan/space-race`; original GitHub origin and history preserved.
- Site: `appgprj_6aa5346ba83c8191b546394c9e32a84e`; selected account confirmed Yerzhan Karatayev as owner, with owner-only access.
- Shared `main` and Hadrien's deployment configuration are unchanged.
- Scope: dedicated deployment identity, portable Playwright configuration and continuation documentation. Gameplay, dependencies, assets and sketch builder are preserved.

## Verification

- Locked dependency installation, production Worker build and TypeScript check passed.
- All 13 existing browser-free tests passed: steering, firing, collisions, hull/cargo damage, loss/reset, delivery, portal timing/safety, progression guards, upgrade caps, retry variation, reachable lanes and multiple completed simulated stages.
- All six real GLBs passed the repository's binary/geometry/material verification. Blender sources and generated textures are retained.
- The supervised browser loaded the hangar interface and explicit offline AI labels. A screenshot confirmed the existing graphics-error screen. Console evidence reports `GL_VENDOR = Disabled` and `GL_RENDERER = Disabled`; the cloud browser cannot create WebGL.
- Therefore rendered ship appearance, interactive flight, pause/resume, hangar return, failure/retry UI, completion/upgrade UI and mobile/tablet touch layout are **not visually verified in this environment**. Simulation tests do not establish browser rendering success. Use a WebGL-capable browser for the baseline playtest.
- No OpenAI credential from another project was used. Live generation is not verified. The existing server code returns an explicit unavailable response without a key and retains the seeded practice route and local outline builder.

## Continuing this track

Reuse this Site identifier. Fetch `origin` before work and integrate teammates' changes through normal merges or rebases of unshared commits; retain this branch's hosting identity. Do not merge this identity into shared `main` or force-push shared history.

Build and verify the desired source, commit and push to this GitHub branch, and push the identical commit to the separate Sites source repository's configured branch. Save the build archive using the complete pushed commit SHA, deploy that saved version privately, and confirm the terminal deployment result. The live URL remains the same for subsequent updates.

Wait for Yerzhan's baseline playtest before feature work. Spaceship creation is the first priority. The existing builder makes a mirrored, nine-section extruded hull with fixed baseline gameplay stats; it is not unrestricted 3D generation. Meaningful in-flight AI adaptation remains future work. Progress and custom ships reset on reload.
