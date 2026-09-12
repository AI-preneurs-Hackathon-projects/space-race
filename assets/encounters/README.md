# Space Race encounter assets

Eighteen original, lightweight models for the Space Race interactive encounter update.
All assets are self-contained binary glTF 2.0 files with standard metallic/roughness PBR
materials, emissive accents, flat vertex normals, and no external textures or extensions.
The three new hostile vessels use familiar science-fiction shape archetypes with original
geometry. No third-party meshes, textures, logos, or image references were used.

## Generate

```sh
python assets/encounters/generate_encounters.py
python assets/encounters/verify_assets.py
```

Requires Python 3, NumPy, and Pillow. Blender is not required. Generation is deterministic.
`public/models/` contains the GLBs. `public/object-previews/` contains transparent 256 × 256 PNGs of the exact
generated geometry. `encounter-contact-sheet.png` shows all eighteen designs using a
deterministic orthographic CPU render. `asset-report.json` records bounds, triangle counts,
byte sizes, source component counts, and the number of material draw calls per object.

## Load in Three.js

```ts
const { scene } = await gltfLoader.loadAsync('/models/iron-asteroid.glb');
scene.scale.setScalar(collisionRadius);
world.add(scene);
```

Every model is centered on its axis-aligned bounding box and normalized so its maximum
vertex distance from the origin is exactly 1. The full geometry fits inside a sphere of
radius 1. All spaceship/missile noses point in local **−Z**, and up is **+Y**. Rotating the
model has no effect on the enclosing collision radius. The game controls model scale,
velocity, collisions, health, destruction, and runtime effects separately.

Pieces sharing a material are merged on export to reduce draw calls. Static parts have
no skeleton or animation; runtime hit flashes, fragments, and damage effects can be
attached by the encounter renderer. There are no baked glow textures: emissive materials
work in standard Three.js lighting and can additionally benefit from a bloom pass.

The thumbnails are CPU-rendered previews, not browser/WebGL validation. They do verify the
actual source triangles and material identities, and are suitable for an in-game guide.

## Asset catalog

`iron-asteroid`, `ice-asteroid`, `volatile-rock`, `crystal-cluster`, `comet`, `derelict`,
`cargo-crate`, `fuel-tank`, `proximity-mine`, `repair-pod`, `shield-buoy`, `sputnik`,
`solar-satellite`, `missile`, `saucer-cruiser`, `twinwing-fighter`, `wedge-destroyer`,
`ring-station`.
