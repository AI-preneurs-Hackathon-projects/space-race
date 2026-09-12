import {test,expect} from '@playwright/test';
import {createFlight} from './support';
import {stepFlight,spawnObject,damage,disposeFlight,physicsBodyCount,MAX_DEBRIS,MAX_ENTITIES,MAX_EFFECTS,type Flight} from '../lib/game/simulation';
import {OBJECTS,OBJECT_TYPES} from '../lib/game/objects';
import {FLEET,practiceMission,type Hull} from '../lib/game/types';
import {stageMission} from '../lib/game/progression';
const idle={x:0,y:0,fire:false},empty={...practiceMission(),events:[]};
function advance(s:Flight,seconds:number,input=idle,hull:Hull=FLEET[0]){for(let i=0;i<Math.round(seconds*60);i++)stepFlight(s,input,hull,empty,1/60);}

test('rigid bodies exchange momentum, rebound and take damage from impact speed',()=>{
 const s=createFlight(FLEET[0]);const a=spawnObject(s,'iron-asteroid',-2,3,-70,{x:6}),b=spawnObject(s,'iron-asteroid',2,3,-70,{x:-6});advance(s,.3);
 expect(a.vx).toBeLessThan(0);expect(b.vx).toBeGreaterThan(0);expect(a.hp).toBeLessThan(5);expect(b.hp).toBeLessThan(5);expect(s.collisions).toBeGreaterThan(0);
 const t=createFlight(FLEET[0]);const heavy=spawnObject(t,'iron-asteroid',2,3,-70),light=spawnObject(t,'ice-asteroid',-2,3,-70,{x:6});advance(t,.4);expect(heavy.vx).toBeGreaterThan(0);expect(light.vx).toBeLessThan(heavy.vx);
});
test('gravity and repulsion affect player and objects; black holes consume matter',()=>{
 const attract=createFlight(FLEET[0]),repel=createFlight(FLEET[0]);spawnObject(attract,'moon',7,0,-20);spawnObject(repel,'repulsor',7,0,-20);
 const rockA=spawnObject(attract,'iron-asteroid',-1,0,-20),rockB=spawnObject(repel,'iron-asteroid',-1,0,-20);advance(attract,.4);advance(repel,.4);
 expect(attract.vx).toBeGreaterThan(.05);expect(repel.vx).toBeLessThan(-.05);expect(rockA.vx).toBeGreaterThan(0);expect(rockB.vx).toBeLessThan(0);
 const hole=createFlight(FLEET[0]);spawnObject(hole,'blackhole',5,0,-50);const victim=spawnObject(hole,'iron-asteroid',5,0,-54,{z:20});advance(hole,.3);expect(hole.entities.some(e=>e.id===victim.id)).toBe(false);expect(Number.isFinite(hole.progress)).toBe(true);
});
test('explosives damage enemies, push rocks, chain once and leave distant targets alone',()=>{
 const s=createFlight(FLEET[0]);spawnObject(s,'fuel-tank',0,0,-25);const fuel2=spawnObject(s,'fuel-tank',2.6,0,-25),pirate=spawnObject(s,'pirate',5.5,0,-25),rock=spawnObject(s,'iron-asteroid',-5,0,-25),far=spawnObject(s,'iron-asteroid',25,0,-25);
 advance(s,.18,{...idle,fire:true});expect(fuel2.hp).toBeLessThanOrEqual(0);expect(pirate.hp).toBeLessThan(3);expect(rock.vx).toBeLessThan(0);expect(far.hp).toBe(5);expect(s.chainHits).toBeGreaterThan(0);expect(s.kills).toBeGreaterThanOrEqual(2);expect(s.effects.some(e=>e.kind==='explosion')).toBe(true);expect(s.entities.filter(e=>e.kind==='debris').length).toBeLessThanOrEqual(MAX_DEBRIS);
 const count=s.kills;advance(s,.2);expect(s.kills).toBeLessThanOrEqual(count+1);
});
test('swept projectiles hit the nearest solid and impart impulse',()=>{
 const s=createFlight(FLEET[0]),far=spawnObject(s,'iron-asteroid',0,0,-17),near=spawnObject(s,'iron-asteroid',0,0,-10);
 advance(s,.07,{...idle,fire:true});expect(near.hp).toBe(4);expect(far.hp).toBe(5);advance(s,.02);expect(near.vz).toBeLessThan(0);expect(near.hitAge).toBeGreaterThan(0);expect(s.effects.some(e=>e.kind==='hit')).toBe(true);
});
test('debris produces collision damage without becoming another full explosion',()=>{
 const s=createFlight(FLEET[0]),rock=spawnObject(s,'iron-asteroid',0,3,-20);s.entities.push({id:s.serial++,kind:'debris',x:-2,y:3,z:-20,vx:12,vy:0,vz:0,radius:.2,mass:.18,hp:1,maxHp:1,age:0,fire:0,ttl:3.8,credit:true});advance(s,.3);expect(rock.hp).toBeLessThan(5);expect(s.effects.filter(e=>e.kind==='explosion')).toHaveLength(0);
});
test('repair, cargo and shield pickups change actual survivability',()=>{
 const s=createFlight(FLEET[0]);damage(s,50,40);s.immune=0;spawnObject(s,'repair-pod',0,0,-1);advance(s,.03);expect(s.hull).toBe(72);
 spawnObject(s,'cargo-crate',s.x,s.y,-1);advance(s,.03);expect(s.cargo).toBe(72);
 spawnObject(s,'shield-buoy',s.x,s.y,-1);advance(s,.03);expect(s.shield).toBeGreaterThan(7);damage(s,100,100);expect(s.hull).toBe(72);expect(s.cargo).toBe(72);
});
test('real jump displacement, acceleration and engine clocks agree',()=>{
 const normal=createFlight(FLEET[0]),boost=createFlight(FLEET[0]);boost.warpAge=0;advance(normal,8,{x:.05,y:.04,fire:true});advance(boost,8,{x:.05,y:.04,fire:true});
 expect(boost.progress-normal.progress).toBeGreaterThan(12.8);expect(boost.distanceSaved).toBeGreaterThan(370);expect(boost.shots).toBe(normal.shots);expect(boost.x).toBeCloseTo(normal.x,3);expect(boost.y).toBeCloseTo(normal.y,3);
 const ramp=createFlight(FLEET[0]);ramp.warpAge=0;advance(ramp,.2);const early=ramp.speed;advance(ramp,.8);expect(early).toBeGreaterThan(1);expect(early).toBeLessThan(1.3);expect(ramp.speed).toBeGreaterThan(2.8);expect(ramp.speed).toBeLessThan(3.01);
});
test('fixed stepping is independent of 10, 20, 30 and 60 FPS and zero-time pauses',()=>{
 const states=[.1,.05,1/30,1/60].map(dt=>{const s=createFlight(FLEET[0]);for(let i=0;i<Math.round(2/dt);i++)stepFlight(s,{x:.2,y:-.2,fire:true},FLEET[0],empty,dt);return s;});
 for(const s of states.slice(1)){expect(s.x).toBeCloseTo(states[0].x,5);expect(s.y).toBeCloseTo(states[0].y,5);expect(s.progress).toBeCloseTo(states[0].progress,5);expect(s.shots).toBe(states[0].shots);}
 const before=JSON.stringify(states[0]);stepFlight(states[0],{x:1,y:1,fire:true},FLEET[0],empty,0);expect(JSON.stringify(states[0])).toBe(before);
});
test('the active object catalog is reachable and has valid bounded physics',()=>{
 const seen=new Set<string>();for(let stage=1;stage<=3;stage++)for(const e of stageMission(stage,73).events){if(e.objectType)seen.add(e.objectType);if(e.escort)seen.add(e.escort);}expect([...seen].sort()).toEqual([...OBJECT_TYPES].sort());
 for(const id of OBJECT_TYPES){const s=createFlight(FLEET[0]);spawnObject(s,id,5,3,-60);advance(s,.1);expect(Number.isFinite(s.progress)).toBe(true);expect(s.entities.length).toBeGreaterThan(0);for(const e of s.entities)expect([e.x,e.y,e.z,e.vx,e.vy,e.vz??0].every(Number.isFinite)).toBe(true);expect(OBJECTS[id].radius).toBeGreaterThan(0);disposeFlight(s);expect(physicsBodyCount(s)).toBe(0);}
});
test('entity, debris and effect lifetime cleanup stays bounded',()=>{
 const s=createFlight(FLEET[0]);for(let i=0;i<8;i++)spawnObject(s,'fuel-tank',i*2.5,0,-25);advance(s,5,{...idle,fire:true});expect(s.entities.length).toBeLessThanOrEqual(MAX_ENTITIES);expect(s.effects.length).toBeLessThanOrEqual(MAX_EFFECTS);expect(s.entities.filter(e=>e.kind==='debris').length).toBeLessThanOrEqual(MAX_DEBRIS);expect(physicsBodyCount(s)).toBe(s.entities.filter(e=>e.kind!=='portal').length);disposeFlight(s);expect(physicsBodyCount(s)).toBe(0);
});
