import * as THREE from 'three';
import {loadPlanetMaps,hasAuthoredSurface} from './planet-maps';
import { CRUISE_SPEED, DURATION, clamp } from './types';
import { stageEnvironment, seededRandom, noise, terrainNoise, type StageEnvironment, type WorldType } from './stage-environment';
export { stageEnvironment } from './stage-environment';
export const PLANET_RADIUS = 175;
const APPROACH_DISTANCE = 1180;
const TAU = Math.PI * 2;
const smooth = (a: number, b: number, x: number) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Physical radius never changes. Route distance alone controls perspective growth. */
export function planetPosition(progress: number, profile = stageEnvironment(1)) {
 return { x: profile.position.x, y: profile.position.y, z: -(APPROACH_DISTANCE + (DURATION - clamp(progress, 0, DURATION)) * CRUISE_SPEED) };
}

/** Baked once: low-contrast structured dust and crisp stars, with a quiet aiming corridor. */
export function buildStageBackground(profile: StageEnvironment) {
 const random = seededRandom(profile.seed), canvas = document.createElement('canvas'); canvas.width = 1536; canvas.height = 864;
 const ctx = canvas.getContext('2d')!, small = document.createElement('canvas'); small.width = 384; small.height = 216;
 const c = small.getContext('2d')!, data = c.createImageData(small.width, small.height), color = new THREE.Color(profile.nebula).convertLinearToSRGB(), seed = (profile.seed & 1023) * .171;
 const angle = random() * Math.PI, ox = random() * 4, oy = random() * 4;
 for (let y = 0; y < small.height; y++) for (let x = 0; x < small.width; x++) {
  const u = x / small.width, v = y / small.height, dx = u - .5, dy = v - .5;
  const bend = noise(u * 3 + ox, v * 3 + oy, seed) - .5;
  const band = Math.exp(-(((dx * Math.sin(angle) + dy * Math.cos(angle) + bend * .19) / .24) ** 2));
  const f = terrainNoise(u * 4 + ox, v * 4 + oy, seed), filaments = terrainNoise(u * 11 + ox, v * 11 + oy, seed + 23);
  const corridor = .30 + .70 * Math.min(1, Math.hypot(dx, dy) * 2.7), light = Math.max(0, f - .30) ** 1.7 * 2 * band * corridor * (.45 + filaments);
  const i = (y * small.width + x) * 4;
  data.data[i] = 3 + light * (25 + color.r * 85); data.data[i + 1] = 6 + light * (25 + color.g * 85); data.data[i + 2] = 13 + light * (30 + color.b * 90); data.data[i + 3] = 255;
 }
 c.putImageData(data, 0, 0); ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
 for (let i = 0; i < 1500; i++) {
  const x = random() * canvas.width, y = random() * canvas.height, bright = random(), r = bright > .985 ? .95 : .22 + bright * .42;
  ctx.fillStyle = `rgba(${i % 7 === 0 ? '223,199,170' : i % 5 === 0 ? '173,203,233' : '220,229,236'},${.18 + bright * .65})`; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  if (bright > .997) { ctx.fillStyle = '#b9d6e522'; ctx.fillRect(x - 3.2, y - .35, 6.4, .7); ctx.fillRect(x - .35, y - 3.2, .7, 6.4); }
 }
 const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; return texture;
}

type RGB = [number, number, number];
const COLORS: Record<WorldType, readonly string[]> = {
 temperate: ['#08243b', '#176078', '#2d5036', '#89846a', '#e3e7df'],
 moon: ['#34363a', '#85837b', '#bab7ac', '#53575b', '#ddd5c3'],
 desert: ['#553329', '#a7623e', '#c99762', '#e0be8c', '#e2d8be'],
 ice: ['#203b51', '#73949b', '#d1e3df', '#f0f3e7', '#697375'],
 gas: ['#77624f', '#c3966a', '#e3cc9c', '#f0e2be', '#9d644a'],
 volcanic: ['#151a1e', '#3b3c3a', '#67594c', '#9c7460', '#ed7627'],
 ocean: ['#061c37', '#0a365a', '#176b7d', '#739783', '#d4d9ba'],
 cloud: ['#8f7448', '#c5a76d', '#e5cf96', '#f0dfb6', '#aa8853'],
 'ice-giant': ['#153b6a', '#316898', '#6099bc', '#a3c4d4', '#164265'],
 salt: ['#414e4d', '#819386', '#d5d8c4', '#eee9d0', '#3e817d'],
};
type Crater = { x: number; y: number; z: number; radius: number; cutoff: number; depth: number; young: boolean; basin: boolean; tx: number; ty: number; tz: number; bx: number; by: number; bz: number; phase: number };
type Fracture = { cx: number; cy: number; cz: number; tx: number; ty: number; tz: number; nx: number; ny: number; nz: number; half: number; cutoff: number; width: number; phase: number };
type SurfaceContext = { profile: StageEnvironment; palette: RGB[]; sx: number; sy: number; sz: number; craters: Crater[]; fractures: Fracture[] };
function surfaceContext(profile: StageEnvironment): SurfaceContext {
 const rand = seededRandom(profile.seed ^ 0x1f23abc7), sx = rand() * 137 + .37, sy = rand() * 137 + .71, sz = rand() * 137 + .19;
 const lunar = profile.kind === 'moon', count = lunar ? 225 : profile.kind === 'ice' ? 36 : profile.kind === 'desert' ? 13 : 0;
 const craters = Array.from({ length: count }, (_, i) => {
  const y = rand() * 2 - 1, a = rand() * TAU, r = Math.sqrt(1 - y * y), x = r * Math.cos(a), z = r * Math.sin(a);
  const basin = lunar && i < 5, young = lunar && !basin && i % 9 === 0, radius = basin ? .24 + rand() * .24 : i < 18 ? .08 + rand() * .105 : .012 + rand() ** 1.5 * .076;
  // Local tangent axes make ejecta rays radiate from each impact in spherical coordinates.
  const tx = -Math.sin(a), ty = 0, tz = Math.cos(a), bx = y * tz, by = z * tx - x * tz, bz = -y * tx;
  return { x, y, z, radius, cutoff: 1 - (radius * (young ? 3.8 : 1.55)) ** 2 / 2, depth: (basin ? .045 : .065) + radius * .24, young, basin, tx, ty, tz, bx, by, bz, phase: rand() * TAU };
 });
 const fractures: Fracture[] = [];
 const fracture = (center: THREE.Vector3, tangent: THREE.Vector3, half: number, width: number) => {
  const normal = new THREE.Vector3().crossVectors(center, tangent).normalize();
  const f = { cx: center.x, cy: center.y, cz: center.z, tx: tangent.x, ty: tangent.y, tz: tangent.z, nx: normal.x, ny: normal.y, nz: normal.z, half, cutoff: Math.cos(half + .05), width, phase: rand() * TAU };
  fractures.push(f); return f;
 };
 if (profile.kind === 'ice' || profile.kind === 'volcanic') {
  const icy = profile.kind === 'ice';
  for (let i = 0; i < (icy ? 19 : 11); i++) {
   const y = rand() * 2 - 1, a = rand() * TAU, r = Math.sqrt(1 - y * y), center = new THREE.Vector3(r * Math.cos(a), y, r * Math.sin(a));
   const tangent = new THREE.Vector3(-Math.sin(a), 0, Math.cos(a)).applyAxisAngle(center, rand() * TAU), half = .19 + rand() * (icy ? .59 : .46), width = (icy ? .0018 : .0014) + rand() * (icy ? .0023 : .0017);
   fracture(center, tangent, half, width);
   for (let branch = 0; branch < 2; branch++) {
    const along = (rand() - .5) * half, branchStart = center.clone().multiplyScalar(Math.cos(along)).addScaledVector(tangent, Math.sin(along));
    const direction = tangent.clone().multiplyScalar(Math.cos(along)).addScaledVector(center, -Math.sin(along)).applyAxisAngle(branchStart, (rand() < .5 ? -1 : 1) * (.28 + rand() * .58));
    const branchHalf = .06 + rand() * .16, branchCenter = branchStart.clone().multiplyScalar(Math.cos(branchHalf)).addScaledVector(direction, Math.sin(branchHalf)), branchTangent = direction.clone().multiplyScalar(Math.cos(branchHalf)).addScaledVector(branchStart, -Math.sin(branchHalf));
    fracture(branchCenter, branchTangent, branchHalf, width * .58);
   }
  }
 }
 return { profile, palette: COLORS[profile.kind].map(c => new THREE.Color(c).toArray() as RGB), sx, sy, sz, craters, fractures };
}
function colorMix(out: Float64Array, a: RGB, b: RGB, t: number) { const f = clamp(t, 0, 1); out[0] = lerp(a[0], b[0], f); out[1] = lerp(a[1], b[1], f); out[2] = lerp(a[2], b[2], f); }
function tint(out: Float64Array, color: RGB, t: number) { const f = clamp(t, 0, 1); for (let k = 0; k < 3; k++) out[k] = lerp(out[k], color[k], f); }

/** All patterns sample one continuous 3D field, never longitude or a cropped source image. */
function sampleSurface(x: number, y: number, z: number, context: SurfaceContext, out: Float64Array) {
 const { profile, palette: p, sx, sy, sz } = context;
 const warp = noise(x * 2.3 + sx, y * 2.3 + sy, z * 2.3 + sz) - .5;
 const n = terrainNoise(x * 3.1 + sx + warp * .65, y * 3.1 + sy, z * 3.1 + sz - warp * .65);
 const detail = terrainNoise(x * 19 + sx, y * 19 + sy, z * 19 + sz), grain = noise(x * 155 + sx, y * 155 + sy, z * 155 + sz);
 const ridge = 1 - Math.abs(detail * 2 - 1), latitude = Math.abs(y);
 let h = .35 + n * .35 + detail * .055, rough = .9, emission = 0, brightness = .95 + grain * .085;
 if (profile.kind === 'ocean') {
  // One elevation field defines sharp shorelines, drowned shelves and coastal island chains.
  const coast = n + (detail - .5) * .067 + (grain - .5) * .006;
  const shelfCrests = ridge ** 7 * .020 * smooth(.57, .61, n) * (1 - smooth(.66, .70, n));
  const elevation = coast + shelfCrests, sea = .634, land = smooth(sea - .0018, sea + .0025, elevation);
  const shelf = smooth(sea - .038, sea - .003, elevation), shallows = smooth(sea - .011, sea - .001, elevation);
  colorMix(out, p[0], p[1], .30 + shelf * .55); tint(out, p[2], (1 - land) * (shelf * .18 + shallows * .42));
  const green = .48 + detail * .36;
  out[0] = lerp(out[0], p[3][0] * green, land); out[1] = lerp(out[1], p[3][1] * green, land); out[2] = lerp(out[2], p[3][2] * green, land);
  const beach = land * (1 - smooth(sea + .0025, sea + .008, elevation)); tint(out, p[4], beach * .62);
  const snow = smooth(.928 + (detail - .5) * .025, .978, latitude); tint(out, p[4], snow);
  h = lerp(.36 + grain * .0007, .36 + Math.max(0, elevation - sea) * .62 + detail * .021, land);
  rough = lerp(.20, .91, Math.max(land, snow)); brightness = lerp(.985 + grain * .023, .93 + grain * .10, land);
 } else if (profile.kind === 'temperate') {
  const sea = .495, land = smooth(sea - .009, sea + .018, n), shore = smooth(sea - .055, sea, n);
  colorMix(out, p[0], p[1], shore * .72 + detail * .15);
  const arid = smooth(.36, .70, detail + (1 - latitude) * .13), mountain = smooth(.59, .75, n + ridge * .07);
  const landR = lerp(p[2][0], p[3][0], arid), landG = lerp(p[2][1], p[3][1], arid), landB = lerp(p[2][2], p[3][2], arid);
  out[0] = lerp(out[0], landR, land); out[1] = lerp(out[1], landG, land); out[2] = lerp(out[2], landB, land); tint(out, p[4], mountain * land * .65);
  const ice = smooth(.83 + (detail - .5) * .11, .94, latitude); tint(out, p[4], ice);
  h = lerp(.36 + grain * .0015, .36 + Math.max(0, n - sea) * .58 + detail * .037, land); rough = lerp(.23, .92, Math.max(land, ice)); } else if (profile.kind === 'moon') {
  // Restrained highland variation leaves impacts readable instead of painting cloud-like blobs.
  colorMix(out, p[1], p[2], .16 + detail * .32 + (grain - .5) * .18);
  tint(out, p[3], smooth(.58, .75, n) * .12); h = .42 + n * .06 + detail * .07 + grain * .023;
  brightness = .91 + grain * .15;
 } else if (profile.kind === 'desert') {
  const canyon = (1 - smooth(.035, .13, Math.abs(noise(x * 5 + sx + warp, y * 5 + sy, z * 5 + sz) - .5))) * smooth(.4, .65, n);
  const dunes = Math.sin((x * .65 + z * .76) * 160 + detail * 34 + n * 22) * .5 + .5;
  colorMix(out, p[1], p[2], clamp((n - .3) * 2 + dunes * .12, 0, 1)); tint(out, p[0], canyon * .62); tint(out, p[3], smooth(.56, .74, n) * .5);
  tint(out, p[4], smooth(.92 + (detail - .5) * .04, .987, latitude)); h = .36 + n * .27 + dunes * .011 - canyon * .09;
 } else if (profile.kind === 'ice') {
  colorMix(out, p[2], p[3], .22 + n * .32); tint(out, p[1], smooth(.56, .75, n) * .17 + (1 - detail) * .04);
  h = .50 + detail * .045 + grain * .012; rough = .68 + detail * .18;
 } else if (profile.kind === 'gas' || profile.kind === 'ice-giant' || profile.kind === 'cloud') {
  const gas = profile.kind === 'gas', venus = profile.kind === 'cloud', frequency = gas ? 36 : venus ? 12 : 20;
  const shear = noise(x * 7 + sx, y * 7 + sy, z * 7 + sz), band = Math.sin(y * frequency + (n - .5) * (gas ? 6 : 10) + (detail - .5) * 2);
  const filaments = Math.sin(y * (gas ? 128 : 91) + n * 22 + shear * 14);
  const tone = clamp(.49 + band * (venus ? .16 : .29) + filaments * .055 + (detail - .5) * .30, 0, 1);
  colorMix(out, p[0], p[2], tone); tint(out, p[3], smooth(.66, .84, tone) * .63);
  // A continuous spherical ellipse creates a vortex without a longitude seam or hemisphere cut.
  const cx = .50, cy = gas ? -.20 : .26, cz = Math.sqrt(1 - cx * cx - cy * cy), dot = x * cx + y * cy + z * cz;
  const longitudeDistance = (x * cz - z * cx) / .19, latitudeDistance = (y - cy * dot) / .08;
  const storm = Math.exp(-(longitudeDistance * longitudeDistance + latitudeDistance * latitudeDistance)) * smooth(.65, .9, dot);
  tint(out, p[4], storm * (venus ? .28 : .82)); h = .5 + (venus ? detail * .0015 : 0); rough = .98; brightness = .98 + grain * .025;
 } else if (profile.kind === 'volcanic') {
  const fresh = smooth(.50, .72, detail);
  colorMix(out, p[0], p[1], .20 + n * .44 + detail * .22); tint(out, p[2], fresh * .28);
  h = .37 + n * .13 + ridge * .065 + grain * .018; rough = .94;
 } else {
  // Flat evaporite pans have crisp, eroded margins; no continuous dark contour outlines.
  const elevation = n + (detail - .5) * .074 + (grain - .5) * .006;
  const upland = smooth(.488, .498, elevation), brine = 1 - smooth(.382, .389, elevation), damp = 1 - smooth(.403, .417, elevation);
  colorMix(out, p[2], p[3], .58 + grain * .10);
  tint(out, p[1], upland * (.72 + detail * .18)); tint(out, p[0], upland * smooth(.65, .85, ridge) * .23);
  tint(out, p[4], brine * .83 + (1 - upland) * damp * .13);
  // Low-contrast wind-aligned salt ribs retain structure without a jigsaw/noise pattern.
  const ribs = Math.sin((x * .61 + y * .22 + z * .76) * 310 + detail * 9 + n * 5) * .5 + .5;
  brightness = .975 + grain * .035 + (1 - upland) * (ribs - .5) * .020;
  h = .39 + Math.max(0, elevation - .488) * .52 + detail * .013 * upland + grain * .004;
  rough = lerp(.83, .93, upland); rough = lerp(rough, .26, brine);
 }
 // Finite, gently distorted geodesic faults have endpoints and branches, not closed noise contours.
 for (const fault of context.fractures) {
  const axis = x * fault.cx + y * fault.cy + z * fault.cz; if (axis < fault.cutoff) continue;
  const across = x * fault.nx + y * fault.ny + z * fault.nz; if (Math.abs(across) > .04) continue;
  const along = Math.atan2(x * fault.tx + y * fault.ty + z * fault.tz, axis); if (Math.abs(along) > fault.half) continue;
  const end = 1 - smooth(fault.half * .73, fault.half, Math.abs(along));
  const bend = Math.sin(along * 21 + fault.phase) * .0028 + Math.sin(along * 57 + fault.phase * 1.7) * .0011 + (detail - .5) * .003;
  const width = fault.width * (.8 + .2 * Math.sin(along * 47 + fault.phase));
  const distance = Math.abs(across + bend), core = (1 - smooth(width * .30, width * 1.25, distance)) * end, shoulder = (1 - smooth(width * 1.2, width * 4.5, distance)) * end;
  if (profile.kind === 'ice') {
   // Muted mineral-dark seams with pale frost shoulders; no near-black plate outlines.
   tint(out, p[1], shoulder * .23); tint(out, p[4], core * .50); h += shoulder * .007 - core * .037; rough += core * .12;
  } else {
   const activity = .57 + .43 * smooth(.34, .64, n + Math.sin(along * 17 + fault.phase) * .075);
   const lava = core * activity; tint(out, p[3], shoulder * .24); tint(out, p[4], lava); h -= core * .032; rough -= lava * .25; emission = Math.max(emission, lava * lava);
  }
 }
 for (const crater of context.craters) {
  const dot = x * crater.x + y * crater.y + z * crater.z; if (dot < crater.cutoff) continue;
  const d = Math.sqrt(Math.max(0, 2 - 2 * dot)) / crater.radius;
  const bowl = d < 1 ? (1 - d * d) ** 2 : 0, rim = Math.exp(-(((d - 1) * 12) ** 2)), ejecta = Math.exp(-(((d - 1.15) * 3.1) ** 2));
  const peak = crater.radius > .055 && !crater.basin ? Math.exp(-((d * 8) ** 2)) * .18 : 0;
  h += crater.depth * (-bowl + rim * .56 + peak); brightness *= 1 - bowl * .08 + rim * .20 + ejecta * .045;
  if (profile.kind === 'moon') {
   tint(out, p[0], crater.basin ? bowl * .54 : bowl * .13); tint(out, p[4], rim * (crater.young ? .48 : .25) + ejecta * .055);
   if (crater.young && d > .78) {
    const angle = Math.atan2(x * crater.bx + y * crater.by + z * crater.bz, x * crater.tx + y * crater.ty + z * crater.tz);
    const streaks = Math.max(0, Math.sin(angle * 17 + crater.phase + d * .8)) ** 10, fade = (1 - smooth(1.15, 3.8, d)) * smooth(.78, 1.1, d);
    tint(out, p[4], streaks * fade * .38 + ejecta * .10);
   }
  }
 }
 for (let k = 0; k < 3; k++) out[k] = clamp(out[k] * brightness, 0, 1);
 out[3] = clamp(h, 0, 1); out[4] = clamp(rough, 0, 1); out[5] = emission;
}

const SRGB = Uint8Array.from({ length: 8193 }, (_, i) => { const c = i / 8192; return Math.round((c <= .0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - .055) * 255); });
const colorByte = (linear: number) => SRGB[Math.round(clamp(linear, 0, 1) * 8192)];
function configureTexture(texture: THREE.DataTexture, color = false) {
 texture.wrapS = THREE.RepeatWrapping; texture.wrapT = THREE.ClampToEdgeWrapping; texture.flipY = false;
 texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter; texture.generateMipmaps = true; texture.anisotropy = 4;
 texture.colorSpace = color ? THREE.SRGBColorSpace : THREE.NoColorSpace; texture.needsUpdate = true; return texture;
}

/** Texel-center mapping agrees with THREE.SphereGeometry UVs; both polar rows are constant. */
function sphereDirection(i: number, j: number, width: number, height: number, out: Float64Array) {
 if (j === 0 || j === height - 1) { out[0] = 0; out[1] = j === 0 ? -1 : 1; out[2] = 0; return; }
 const theta = (1 - (j + .5) / height) * Math.PI, phi = (i + .5) / width * TAU, r = Math.sin(theta);
 out[0] = -r * Math.cos(phi); out[1] = Math.cos(theta); out[2] = r * Math.sin(phi);
}
function surfaceTextures(profile: StageEnvironment, mobile: boolean) {
 const width = hasAuthoredSurface(profile.kind) ? 4 : mobile ? 1024 : 2048, height = width / 2, albedo = new Uint8Array(width * height * 4), detail = new Uint8Array(albedo.length);
 const emission = profile.kind === 'volcanic' ? new Uint8Array(albedo.length) : null, context = surfaceContext(profile), direction = new Float64Array(3), sample = new Float64Array(6);
 for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
  sphereDirection(i, j, width, height, direction); sampleSurface(direction[0], direction[1], direction[2], context, sample); const k = (j * width + i) * 4;
  for (let c = 0; c < 3; c++) albedo[k + c] = colorByte(sample[c]); albedo[k + 3] = 255;
  // Bump reads R; Three's roughness map reads G. One linear texture holds both.
  detail[k] = Math.round(sample[3] * 255); detail[k + 1] = Math.round(sample[4] * 255); detail[k + 2] = 0; detail[k + 3] = 255;
  if (emission) { emission[k] = colorByte(sample[5]); emission[k + 1] = colorByte(sample[5] * .15); emission[k + 2] = colorByte(sample[5] * .016); emission[k + 3] = 255; }
 }
 return { texture: configureTexture(new THREE.DataTexture(albedo, width, height), true), detail: configureTexture(new THREE.DataTexture(detail, width, height)), emission: emission ? configureTexture(new THREE.DataTexture(emission, width, height), true) : null };
}
function cloudTexture(profile: StageEnvironment, mobile: boolean) {
 const detailedWeather = profile.kind === 'ocean' || profile.kind === 'salt';
 const width = detailedWeather ? (mobile ? 512 : 1024) : (mobile ? 256 : 512), height = width / 2, data = new Uint8Array(width * height * 4), context = surfaceContext(profile), direction = new Float64Array(3);
 const warm = profile.kind === 'desert' || profile.kind === 'volcanic', threshold = .66 - profile.cloudCover * .26;
 for (let j = 0; j < height; j++) for (let i = 0; i < width; i++) {
  sphereDirection(i, j, width, height, direction); const [x, y, z] = direction;
  let alpha: number;
  if (detailedWeather) {
   // Latitude-dependent advection stretches coherent weather into fronts and cirrus ribbons.
   const drift = noise(x * 3 + context.sx, y * 3 + context.sy, z * 3 + context.sz) - .5;
   const angle = y * y * 3.6 + drift * .34, cs = Math.cos(angle), sn = Math.sin(angle), ax = x * cs - z * sn, az = x * sn + z * cs;
   const front = terrainNoise(ax * 8 + context.sx, y * 12 + context.sy, az * 8 + context.sz);
   const streak = terrainNoise(ax * 34 + context.sx, y * 85 + context.sy, az * 34 + context.sz);
   const coverage = profile.kind === 'ocean' ? .523 : .598;
   const mass = smooth(coverage, coverage + .060, front * .78 + streak * .22);
   const striation = smooth(.34, .69, streak);
   alpha = mass * (.45 + striation * .55) * (profile.kind === 'ocean' ? .86 : .50);
  } else {
   const warp = noise(x * 4 + context.sx, y * 4 + context.sy, z * 4 + context.sz) - .5;
   const f = terrainNoise(x * 9 + context.sx + warp * 2, y * 9 + context.sy, z * 9 + context.sz - warp * 2), wisps = terrainNoise(x * 26 + context.sx, y * 26 + context.sy, z * 26 + context.sz);
   const jets = .84 + .16 * Math.sin(y * 14 + warp * 5); alpha = smooth(threshold, threshold + .16, f * .83 + wisps * .17) * jets * .82;
  }
  const k = (j * width + i) * 4;
  data[k] = warm ? 222 : 233; data[k + 1] = warm ? 204 : 239; data[k + 2] = warm ? 175 : 240; data[k + 3] = Math.round(alpha * 255);
 }
 return configureTexture(new THREE.DataTexture(data, width, height), true);
}

export function buildDestinationPlanet(profile = stageEnvironment(1), mobile = false) {
 const group = new THREE.Group(); group.name = 'destination_planet';group.visible=false;
 const { texture, detail, emission } = surfaceTextures(profile, mobile), ownedTextures: THREE.Texture[] = [texture, detail]; if (emission) ownedTextures.push(emission);
 const smoothWorld = profile.kind === 'gas' || profile.kind === 'ice-giant' || profile.kind === 'cloud';
 const material = new THREE.MeshStandardMaterial({ map: texture, bumpMap: detail, roughnessMap: detail, bumpScale: smoothWorld ? .03 : profile.kind === 'moon' ? 6.2 : profile.kind === 'ice' ? 2.6 : 2.4, roughness: 1, metalness: 0, envMapIntensity: .025, fog: false, transparent: false, opacity: 1, side: THREE.FrontSide, depthWrite: true });
 if (emission) { material.emissive.set('#ffffff'); material.emissiveMap = emission; material.emissiveIntensity = .45; }
 // Explicit full azimuth/elevation; one opaque sphere is shared by every appearance.
 const geometry = new THREE.SphereGeometry(PLANET_RADIUS, 96, 64, 0, TAU, 0, Math.PI);
 const globe = new THREE.Mesh(geometry, material); globe.name = 'destination_surface'; globe.layers.set(1); globe.rotation.z = profile.axialTilt; group.add(globe);
 const sunlight = new THREE.Vector3(-.65, .36, .69).normalize();
 let clouds: THREE.Mesh | null = null;
 if (profile.clouds) {
  const map = cloudTexture(profile, mobile); ownedTextures.push(map);
  clouds = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ map, color: '#ffffff', roughness: 1, metalness: 0, transparent: true, depthWrite: false, fog: false, envMapIntensity: .02, side: THREE.FrontSide }));
  clouds.name = 'destination_clouds'; clouds.scale.setScalar(1.009); clouds.layers.set(1); clouds.rotation.z = profile.axialTilt; clouds.renderOrder = 1; group.add(clouds);
 }
 if (profile.atmosphere) {
  const atmosphere = new THREE.Mesh(geometry, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, side: THREE.BackSide, blending: THREE.AdditiveBlending,
   uniforms: { sun: { value: sunlight }, tint: { value: new THREE.Color(profile.atmosphereColor) }, strength: { value: profile.atmosphereStrength } },
   vertexShader: 'varying vec3 vWorld; varying vec3 vNormal; void main(){vWorld=(modelMatrix*vec4(position,1.0)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.0);}',
   fragmentShader: 'varying vec3 vWorld;varying vec3 vNormal;uniform vec3 sun;uniform vec3 tint;uniform float strength;void main(){vec3 n=normalize(vNormal),v=normalize(cameraPosition-vWorld);float rim=pow(1.0-abs(dot(n,v)),3.4);float day=smoothstep(-.20,.55,dot(n,sun));float a=rim*strength*(.12+.88*day);gl_FragColor=vec4(tint*a*1.15,a);}' }));
  atmosphere.name = 'destination_atmosphere'; atmosphere.scale.setScalar(1.018 + profile.atmosphereStrength * .024); atmosphere.layers.set(1); atmosphere.renderOrder = 2; group.add(atmosphere);
 }
 // Planet-only lighting. A restrained fill keeps the opaque night hemisphere legible.
 const target = new THREE.Object3D(); target.name = 'destination_light_target'; group.add(target);
 const key = new THREE.DirectionalLight('#fff3df', 2.0); key.position.copy(sunlight).multiplyScalar(1400); key.target = target; key.layers.set(1); group.add(key);
 const fill = new THREE.DirectionalLight('#6b87a3', .18); fill.position.set(.6, -.15, -.8).normalize().multiplyScalar(1400); fill.target = target; fill.layers.set(1); group.add(fill);
 const ambient = new THREE.AmbientLight('#8591a2', .10); ambient.layers.set(1); group.add(ambient);
 group.userData.environment = profile.kind; group.userData.destinationName = profile.name; group.userData.stage = profile.stage;
 let disposed = false;
 const ready=loadPlanetMaps(profile,mobile).then(maps=>{
  if(disposed){for(const map of maps.owned)map.dispose();return;}
  ownedTextures.push(...maps.owned);group.visible=true;
  if(maps.map&&maps.detail){material.map=maps.map;material.bumpMap=maps.detail;material.roughnessMap=maps.detail;material.bumpScale=profile.kind==='moon'?1.6:profile.kind==='ice'||profile.kind==='salt'?1.4:profile.kind==='volcanic'?1.5:profile.kind==='desert'?1:profile.kind==='temperate'?.6:0;material.needsUpdate=true;}
  if(maps.emission){material.emissiveMap=maps.emission;material.emissiveIntensity=.7;material.needsUpdate=true;}
  if(maps.cloud&&clouds){const cm=clouds.material as THREE.MeshStandardMaterial;cm.map=maps.cloud;cm.needsUpdate=true;}
 });
 const update = (progress: number, time: number) => { const p = planetPosition(progress, profile); group.position.set(p.x, p.y, p.z); globe.rotation.y = profile.rotation + time * .0011; if (clouds) clouds.rotation.y = profile.rotation + time * .00165; };
 // Prevent a first frame with the camera inside a sphere accidentally left at the origin.
 update(0, 0); group.updateMatrixWorld(true);
 return { group, update, ready, dispose() { if (disposed) return; disposed = true; for (const map of ownedTextures) map.dispose(); } };
}
