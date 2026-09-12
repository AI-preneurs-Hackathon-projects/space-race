# Destination environment assets

Two original assets were generated for this update, once each, with OpenAI image generation. The exact prompts and inspection notes are retained alongside this file.

- `public/destination-planet-albedo.png`: 1774×887 diffuse map used on an actual Three.js sphere. Lighting, clouds and atmosphere are rendered in 3D, separately from the texture.
- `public/distant-space-panorama.png`: 1774×887 static distant star field, with detailed dusty edge regions and a quiet central flight corridor.

Both images have 2:1 proportions. These are the actual returned resolutions, below the requested dimensions. The maps are not mathematically seamless: the panorama is displayed as a static full-frame backdrop, and the planet's longitude seam is oriented away from the visible face during the short delivery. No runtime external image URL is required. The existing Blender ship and asteroid assets are unchanged.
