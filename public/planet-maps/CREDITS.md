# Planet map attribution

The ten `2k_*.jpg` files in this directory are by **Solar System Scope / INOVE**,
distributed under [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/).
Source and license declaration: <https://www.solarsystemscope.com/textures/>.

Original downloaded JPEG pixels are retained. The game adapts these complete
equirectangular maps for fictional destinations. At runtime it scales mobile maps,
averages converging pole texels, derives approximate relief/roughness from the source
and converts the grayscale cloud map to alpha. The fictional names and game do not
imply endorsement by Solar System Scope, INOVE or NASA.

- `2k_ceres_fictional.jpg` — Salar mineral terrain (fictional source map)
- `2k_eris_fictional.jpg` — Nivalis ice terrain (fictional source map)
- `2k_venus_surface.jpg` — Pyra volcanic terrain, with a charcoal palette and emission derived from bright source ridges
- `2k_earth_daymap.jpg` — Verdant terrain
- `2k_moon.jpg` — Selene surface
- `2k_mars.jpg` — Ares surface
- `2k_jupiter.jpg` — Aurelia atmosphere
- `2k_venus_atmosphere.jpg` — Vesper atmosphere
- `2k_neptune.jpg` — Nereid atmosphere
- `2k_earth_clouds.jpg` — cloud layer for Verdant and Pelagia

Each original is available at `https://www.solarsystemscope.com/textures/download/`
followed by the filename above. Retrieved 13 September 2026. Solar System Scope
describes these maps as NASA-data-based illustrations, with fictional terrain filling
unmapped regions and some color enhancement. They are art assets, not scientific
measurement products. The Pelagia surface recipe is original
project-authored code in `lib/game/space-environment.ts`.
