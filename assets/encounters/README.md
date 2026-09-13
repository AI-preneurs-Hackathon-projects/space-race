# Editable Space Race encounter models

The active encounter models are generated in Blender 4.3.2. The three preset fleet
ships are unchanged. The four natural bodies use 12,320 triangles, smooth normals,
a complete spherical UV chart, and packed albedo, tangent-normal and roughness maps.
The volatile rock also has a thermal fissure map. Rogue Moon is the interactive
field object, separate from the shared procedural destination planet.

Nine manufactured objects retain their original silhouettes with attached fittings,
beveled edges and weighted panel normals. Export merges the evaluated geometry into
4–7 material batches. Runtime scales and all collision radii remain unchanged.

## Reproduce

```sh
blender -b --python assets/encounters/build_blender.py
python assets/encounters/verify_assets.py
# With the local development server running:
node assets/encounters/render_previews.mjs after
node assets/encounters/render_previews.mjs thumbnails
```

Blender includes NumPy. The verification script requires NumPy. Each source file in
`blender/` contains editable named parts/modifiers or the sculpt and packed surface
maps. `build_blender.py` is the reproducible geometry/material recipe;
`hard_surface_details.py` supplies attached fittings; `legacy_geometry.py` retains
original silhouette construction, including archival functions that are not exported.
`generate_encounters.py` forwards to the Blender pipeline so it cannot accidentally
restore the old low-detail exports.

`blender-report.json` records current export sizes and triangle budgets. GLBs are
self-contained, centered on their axis-aligned bounds and normalized to radius one.
Game nose is −Z and up is +Y. Blender sources use +Y forward and +Z up, transformed
by the glTF exporter. Normal maps and roughness stay in linear color space.

The renderer helper uses actual loaded GLBs and runtime field/portal geometry with
Three.js and the game lighting. Its before/after images use matching cameras.
Guide portraits are transparent 256-pixel renders, not illustrations or CPU proxies.
Retired object files are archival and never loaded by the active catalog.
