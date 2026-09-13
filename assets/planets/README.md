# Ten destination appearances

The ten names, themes, repeat-cycle suffixes and deterministic positions come from
`lib/game/stage-environment.ts`. The scene, checkpoint arrival, onward gate and
removable footer route map consume that one profile.

`lib/game/space-environment.ts` generates complete spherical terrain for the fictional ocean
world and provides the shared geometry, atmosphere and lighting. `planet-maps.ts`
loads nine sharper source-based surface sets and two cloud shells from vendored maps.
Original sources and license attribution are retained in `public/planet-maps/CREDITS.md`
and visible in the field guide. No third-party network request occurs during play.

Desktop surfaces are 2048×1024 and mobile surfaces 1024×512. Only the current world is
loaded, and flight readiness waits for its maps. Each body remains an opaque sphere
with full azimuth/elevation, wrapping longitude, clamped latitude and constant polar
texels. Disposed scenes release generated maps, including maps that finish loading
after navigation. Planet light targets are local to the moving group; the body is
positioned before the first frame, with restrained night illumination.

Generate reproducible close-up, full-rotation, north/south-pole and mobile comparisons
with the development server running:

```sh
node assets/encounters/render_worlds.mjs
```

The helper captures actual game materials for all ten worlds, checks complete surface
alpha, both pole rows and distinct texture hashes, and creates an HTML/PNG contact sheet
in ignored `outputs/destination-worlds`. Physical approach and retry behavior are
covered by `tests/environments-layout.spec.ts`; checkpoint flow by
`tests/checkpoints.spec.ts`. These are visual assets for a fictional arcade game.
