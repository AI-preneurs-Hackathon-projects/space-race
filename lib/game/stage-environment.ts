/** One destination profile supplies the renderer, checkpoint names and route map. */
export const WORLD_TYPES = ['temperate', 'moon', 'desert', 'ice', 'gas', 'volcanic', 'ocean', 'cloud', 'ice-giant', 'salt'] as const;
export type WorldType = typeof WORLD_TYPES[number];
const WORLDS = [
 { name: 'Verdant', description: 'Ocean planet · forested continents and polar ice', nebula: '#477caa', star: '#c2d9e9', mapColor: '#4d8da7', atmosphereColor: '#5eacdf', cloudCover: .51, atmosphereStrength: .40 },
 { name: 'Selene', description: 'Airless moon · ancient maria and overlapping impact basins', nebula: '#88715c', star: '#e7d8c3', mapColor: '#adaaa2', atmosphereColor: '#000000', cloudCover: 0, atmosphereStrength: 0 },
 { name: 'Ares', description: 'Desert planet · eroded canyons, dunes and frost caps', nebula: '#9c6262', star: '#e5c5af', mapColor: '#c28259', atmosphereColor: '#d39767', cloudCover: .12, atmosphereStrength: .20 },
 { name: 'Nivalis', description: 'Ice moon · fractured plates and buried impact scars', nebula: '#4d8499', star: '#b9e7eb', mapColor: '#afd5d9', atmosphereColor: '#77aeba', cloudCover: 0, atmosphereStrength: .07 },
 { name: 'Aurelia', description: 'Gas giant · turbulent ochre belts and long-lived storms', nebula: '#8b718a', star: '#e4d2ae', mapColor: '#cfad83', atmosphereColor: '#d6b78c', cloudCover: 0, atmosphereStrength: .32 },
 { name: 'Pyra', description: 'Volcanic moon · basalt shields and active lava rifts', nebula: '#995c4a', star: '#e7bea7', mapColor: '#995b42', atmosphereColor: '#b57450', cloudCover: 0, atmosphereStrength: .11 },
 { name: 'Pelagia', description: 'Water planet · deep ocean, island arcs and cyclone systems', nebula: '#3d7a85', star: '#c3e3e5', mapColor: '#276f91', atmosphereColor: '#559fdd', cloudCover: .60, atmosphereStrength: .48 },
 { name: 'Vesper', description: 'Cloud planet · dense sulfur-colored atmospheric currents', nebula: '#8f7b4d', star: '#e8dfb9', mapColor: '#d0b584', atmosphereColor: '#d5b277', cloudCover: 0, atmosphereStrength: .52 },
 { name: 'Nereid', description: 'Ice giant · cobalt methane bands and dark vortices', nebula: '#4c6496', star: '#c7d8f3', mapColor: '#527faa', atmosphereColor: '#76afd7', cloudCover: 0, atmosphereStrength: .37 },
 { name: 'Salar', description: 'Mineral moon · bright salt deposits, scarps and impact basins', nebula: '#647d78', star: '#dbe7da', mapColor: '#b9c6b6', atmosphereColor: '#a0bfb8', cloudCover: 0, atmosphereStrength: .20 },
] as const;

export function stageEnvironment(stage: number) {
 const level = Math.max(1, Math.floor(Number.isFinite(stage) ? stage : 1));
 const index = (level - 1) % WORLD_TYPES.length, cycle = Math.floor((level - 1) / WORLD_TYPES.length);
 const seed = Math.imul(level, 0x45d9f3b) >>> 0, random = seededRandom(seed ^ 0x6c8e9cf5), world = WORLDS[index];
 const name = cycle ? `${world.name} ${cycle + 1}` : world.name;
 return {
  ...world, stage: level, kind: WORLD_TYPES[index], seed, name, gateName: `${name} Gate`,
  atmosphere: world.atmosphereStrength > 0, clouds: world.cloudCover > 0,
  rotation: random() * Math.PI * 2, axialTilt: (random() - .5) * .34,
  // Above the aiming corridor; alternating sides plus a full-stage seed vary the composition.
  position: { x: (index % 2 ? -1 : 1) * (105 + random() * 50), y: 185 + random() * 48 },
 };
}
export type StageEnvironment = ReturnType<typeof stageEnvironment>;
export function seededRandom(seed: number) { let n = seed >>> 0; return () => { n += 0x6d2b79f5; let t = n; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function hash(x: number, y: number, z: number) { let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1442695041); n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967295; }
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
/** Quintic interpolation keeps the surface gradient continuous across lattice cells. */
export function noise(x: number, y: number, z: number) {
 const a = Math.floor(x), b = Math.floor(y), c = Math.floor(z), u = fade(x - a), v = fade(y - b), w = fade(z - c);
 return mix(mix(mix(hash(a, b, c), hash(a + 1, b, c), u), mix(hash(a, b + 1, c), hash(a + 1, b + 1, c), u), v), mix(mix(hash(a, b, c + 1), hash(a + 1, b, c + 1), u), mix(hash(a, b + 1, c + 1), hash(a + 1, b + 1, c + 1), u), v), w);
}
export function terrainNoise(x: number, y: number, z: number) { return noise(x, y, z) * .53 + noise(x * 2.03, y * 2.03, z * 2.03) * .27 + noise(x * 4.11, y * 4.11, z * 4.11) * .135 + noise(x * 8.21, y * 8.21, z * 8.21) * .065; }
