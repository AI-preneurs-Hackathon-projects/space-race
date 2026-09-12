# Yerzhan's physics and encounters update

Historical report for the September 12 physics delivery. Current gameplay, validation and deployment routing are documented in README.md; the publication and GitHub limitations below describe that earlier run.

Prepared September 12, 2026. The freshly fetched GitHub `main` still resolves to `bbac61dc8db8a16269e2406b571477d42a112c57`; the previous private baseline is `b51c2b090ee62a2e5f5f887eaa2f4468ebe0836b`.

- Dedicated checkout/branch: `yerzhan/space-race`.
- Private Site: `appgprj_6aa5346ba83c8191b546394c9e32a84e`.
- URL: https://space-race-cargo-run.yerzhan452067.chatgpt.site
- Selected account ownership was confirmed. A publication-time access check found a restricted custom audience with the owner and two invited external viewers (policy revision 2). That current audience is preserved; it requires the standard deployment operation rather than owner-only deployment.
- Shared `main`, original GitHub origin, Hadrien's deployment configuration and original assets are unchanged.

## Delivered scope

Rapier rigid bodies; inertia and counter-thrust; mass-dependent collision response; gravity/repulsion and black-hole absorption; true 3× jump acceleration and physical route progress; nearest-hit projectiles; impact health bars; chain blasts and physical debris; damaged-ship scorch/smoke/fire; repair/cargo/shield pickups; mines and seeker rockets; 25 encounter types with an optional illustrated field guide. Eighteen new original GLBs and their generators/previews are committed with the game.

## Verification and limits

- Production Worker build and TypeScript check.
- 25 browser-free physics/gameplay tests, including multiple seeded complete deliveries, real travel timing, interaction chains, collision geometry, body cleanup and equal stepping at 10/20/30/60 FPS.
- The final combined runner reports 25 passed and six browser tests blocked at launch because its Chromium executable is unavailable. The supported cloud browser check below is separate.
- Original six GLB validators and all 18 new GLB/thumbnail validators.
- New model contact sheet rendered and inspected from the exact source triangles using a CPU renderer.
- Supervised preview loads the updated hangar, roster guide trigger and correct offline labels.
- The cloud browser reports `GL_VENDOR = Disabled` / `GL_RENDERER = Disabled`. Screenshot inspection confirms the existing graphics-error screen. Therefore this environment cannot certify rendered flight, visual effects, shader appearance, touch controls, or a complete browser delivery. Browser tests are retained for a WebGL-capable environment; simulation and CPU previews are not substitutes for that check.
- Live OpenAI remains unconfigured and unverified. Existing local fallback behavior is retained.

## Source publishing

The exact deployed revision is recorded by the Site's saved version and Git source branch. GitHub account repository permissions and the connected integration's write access are separate. The earlier connected GitHub write attempt was rejected with `Resource not accessible by integration`; the ordinary Git push of this physics update also failed because no GitHub credentials were available. The dedicated GitHub branch still needs an authenticated push once repository write access is connected. Site source saving and publishing are independent and remain available.

Future updates reuse this Site and URL, preserve GitHub history, and deploy an archive built from the exact saved source revision. No credentials belong in these files. The user authorized this physics iteration after the baseline playtest; spaceship customization and meaningful in-flight AI remain subsequent product directions.
