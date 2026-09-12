# Blender asset sources

These assets were modeled, exported and rendered by running Blender 4.3.2 on 12 September 2026. They are actual Blender-authored meshes, not renamed procedural browser geometry.

- `fleet.blend` retains named editable construction parts for Kestrel, Wraith and Atlas, plus the presentation studio.
- `asteroids.blend` retains the three cratered, displaced rock meshes, packed surface texture and studio.
- `previews/` contains Blender renders of the fleet and asteroids.
- `asset-report.json` records final geometry counts, bounds, material groups and export sizes.
- `../../public/models/` holds the six runtime GLBs. Ship exports consolidate construction parts into 10 material meshes each; asteroids use one material mesh each.

Kestrel has 12,366 triangles, Wraith 12,322 and Atlas 21,198. Each asteroid has 9,830 triangles. The GLBs total approximately 5 MB. Both editable Blender sources are under 6 MB each and can be saved directly in GitHub without large-file storage.

## Reproduce

From the project root, with Blender 4.3 or later installed:

```sh
/Applications/Blender.app/Contents/MacOS/Blender --background --factory-startup --python scripts/generate-models.py -- --output outputs/blender-rebuilt --texture assets/textures/asteroid-surface-albedo.png
```

On another platform, substitute the Blender executable. The output folder receives six GLBs, two editable `.blend` files, previews, the optimized JPEG texture and a fresh geometry report. Rendering all previews can take several minutes. Review the results before replacing the checked-in source and runtime files. Do not retain Blender `.blend1` backups or intermediate build output in Git.

Run `python3 scripts/verify-models.py` from the project root to independently check the checked-in GLBs: binary structure, triangle/material budgets, finite vertex positions, unit normals, embedded images, vertex colors and nozzle markers. `glb-verification.json` retains the final verification report. The verifier accepts an alternative model directory and `--report` path for rebuilt assets.

The source albedo was generated with OpenAI image generation; its original PNG and prompt are in `../textures/`. The optimized 1024×1024 JPEG is retained there as well and embedded into each asteroid GLB. Vertex colors add crater and mineral variation. No remote texture URL is required at runtime.

## Runtime contract

Blender coordinates use nose +Y and up +Z. glTF export produces nose −Z and up +Y. Ship dimensions are about 4.3–4.6 units wide, 1.0–1.5 tall and 5.2–5.8 long; the flight renderer applies a 0.55 scale. Asteroid vertices fit a unit-radius sphere, scaled to each simulation collision radius.

Ship GLBs retain empty nodes named `exhaust_0`, `exhaust_1` and, for Atlas, `exhaust_2` at the nozzle exits. The renderer attaches animated plumes to those markers. Materials include `hull_armor`, `hull_secondary`, `accent`, `canopy`, `cockpit_frame`, `engine_nozzle`, `engine_core`, `structural`, `gunmetal` and `vent`. Pirate ships reuse the Wraith mesh with red accent and engine materials.

The browser loads the preset ships and asteroid assets before enabling launch. Optional sketched ships continue to use their existing browser-generated hulls. The jump portal, engine plumes, star streaks and destination effects remain real-time Three.js geometry and shaders.
