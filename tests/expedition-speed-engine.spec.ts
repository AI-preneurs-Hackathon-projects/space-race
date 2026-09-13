import {expect,test} from '@playwright/test';
import {createFlight} from './support';
import {FLEET,practiceMission,type Mission} from '../lib/game/types';
import {CARGO,type Contract,type DeliveryUrgency} from '../lib/game/contracts';
import {bindDeliveryTiming} from '../lib/game/delivery-timing';
import {canUseBoostGate,configureExpeditionRoute,deliveryElapsed,extraShortcutLimit,gateAvailability,initializeExpedition,queueDirectorDecision,shortcutPlacement} from '../lib/game/expedition-runtime';
import {disposeFlight,spawnObject,stepFlight,type Flight} from '../lib/game/simulation';
import {difficulty} from '../lib/game/progression';
import * as THREE from 'three';
import {buildEffectVisual,createDamageTrail,updateShipDamage} from '../lib/game/combat-visuals';
import {buildPortal,buildShip,disposeObject} from '../lib/game/meshes';

const idle={x:0,y:0,fire:false},empty={...practiceMission(),events:[]} as Mission;
function contract(urgency:DeliveryUrgency='express'):Contract{
  return bindDeliveryTiming({id:'speed-'+urgency,title:'Urgent prototypes',description:'Transport prototypes',cargoType:'high_value_technology',destination:'Verdant',sector:1,reward:9000,risk:'high',minimumCargoIntegrity:null,modifiers:[...CARGO.high_value_technology.modifiers],possibleThreats:['pirates','bounty_hunters','asteroids'],possibleObjectives:['AVOID_DAMAGE'],mystery:null,urgency},{cruise:1,difficulty:'normal'});
}
function flight(urgency:DeliveryUrgency='express'){const s=createFlight(FLEET[0]);initializeExpedition(s,contract(urgency));return s;}
function advance(s:Flight,seconds:number,mission:Mission=empty){for(let i=0;i<Math.round(seconds*60)&&s.status==='flying';i++)stepFlight(s,idle,FLEET[0],mission,1/60);}
function offer(s:Flight){return queueDirectorDecision(s,{event:{type:'shortcut_available',intensity:'low'},bonusObjective:null},s.expedition!.contract.id,'openai');}

test('urgency grants only bounded extra gates, counted separately from the two base gates',()=>{
  const s=flight();s.progress=40;s.portalsUsed=2;
  expect(offer(s)).toBe(true);advance(s,.05);
  let gate=s.entities.find(e=>e.expeditionRole==='shortcut')!;expect(gate).toBeDefined();gate.x=s.x;gate.y=s.y;gate.z=-.1;
  advance(s,.05);expect(s.portalsUsed).toBe(3);expect(s.expedition!.extraGatesUsed).toBe(1);
  advance(s,12.2);expect(s.warpAge).toBeNull();expect(offer(s)).toBe(true);advance(s,.05);
  gate=s.entities.find(e=>e.expeditionRole==='shortcut')!;gate.x=s.x;gate.y=s.y;gate.z=-.1;
  advance(s,.05);expect(s.portalsUsed).toBe(4);expect(s.expedition!.extraGatesUsed).toBe(2);
  expect(gateAvailability(s)).toMatchObject({baseUsed:2,extraSpawned:2,extraUsed:2,extraLimit:2,totalUsed:4,totalAvailable:4});
  expect(offer(s)).toBe(false);
  const forged=spawnObject(s,'portal',0,0,-1);forged.expeditionRole='shortcut';expect(canUseBoostGate(s,forged)).toBe(false);
  const standard=flight('standard');standard.progress=40;expect(offer(standard)).toBe(false);
  const priority=flight('priority');priority.expedition!.contract.speedBonus!.extraGateLimit=500;expect(extraShortcutLimit(priority)).toBe(1);
});

test('using an extra gate does not consume a scheduled gate, and legacy flights keep their two-gate cap',()=>{
  const s=flight();s.progress=40;expect(offer(s)).toBe(true);advance(s,.05);
  const extra=s.entities.find(e=>e.expeditionRole==='shortcut')!;extra.x=0;extra.y=0;extra.z=-.1;advance(s,.05);
  for(let i=0;i<3;i++){s.warpAge=null;spawnObject(s,'portal',s.x,s.y,-.1);advance(s,.05);}
  expect(s.portalsUsed).toBe(3);expect(gateAvailability(s).baseUsed).toBe(2);
  const legacy=createFlight(FLEET[0]);
  for(let i=0;i<3;i++){legacy.warpAge=null;spawnObject(legacy,'portal',legacy.x,legacy.y,-.1);advance(legacy,.05);}
  expect(legacy.portalsUsed).toBe(2);
});

test('extra entrance placement leaves full boost separation from planned and already live gates',()=>{
  const s=flight();s.progress=40;
  const mission:Mission={...empty,events:[{at:8,arrival:30,kind:'portal',x:6,y:0,count:1},{at:71,arrival:93,kind:'portal',x:-6,y:0,count:1}]};
  configureExpeditionRoute(s,mission);const placement=shortcutPlacement(s)!;
  expect(placement).not.toBeNull();expect(placement.arrival-30).toBeGreaterThanOrEqual(23);expect(93-placement.arrival).toBeGreaterThanOrEqual(23);
  expect(-placement.z/29).toBeGreaterThanOrEqual(7);expect(placement.z).toBeGreaterThan(-800);
  spawnObject(s,'portal',0,0,placement.z);expect(shortcutPlacement(s)).toBeNull();
  s.entities=[];s.warpAge=0;expect(shortcutPlacement(s)).toBeNull();
});

test('the local safety net supplies a finite urgent opportunity when the model supplies none',()=>{
  const s=flight(),mission:Mission={...empty,events:[{at:8,arrival:30,kind:'portal',x:6,y:3,count:1},{at:71,arrival:93,kind:'portal',x:-6,y:3,count:1}]};
  advance(s,145,mission);
  expect(s.expedition!.extraGatesSpawned).toBe(2);expect(s.expedition!.events.filter(e=>e.type==='shortcut_available')).toHaveLength(2);
  expect(s.expedition!.events.every(e=>e.source==='fallback')).toBe(true);expect(s.expedition!.extraGatesUsed).toBe(0);
  const standard=flight('standard');advance(standard,145,mission);expect(standard.expedition!.extraGatesSpawned).toBe(0);
});

test('delivery elapsed and spent extra budget survive relaunch, while pauses do not advance time',()=>{
  const s=flight(),mission:Mission={...empty,deliveryElapsed:18.25,deliveryShortcuts:{spawned:1,used:1}};
  advance(s,2,mission);expect(deliveryElapsed(s)).toBeCloseTo(20.25,5);expect(gateAvailability(s)).toMatchObject({baseUsed:0,extraSpawned:1,extraUsed:1,extraLimit:2});
  const before=deliveryElapsed(s);stepFlight(s,idle,FLEET[0],mission,0);expect(deliveryElapsed(s)).toBe(before);
  const fresh=flight();advance(fresh,.1);expect(deliveryElapsed(fresh)).toBeCloseTo(.1);expect(fresh.expedition!.extraGatesSpawned).toBe(0);
  disposeFlight(s);s.progress=149.99;advance(s,.1,mission);const delivered=deliveryElapsed(s);advance(s,10,mission);expect(deliveryElapsed(s)).toBe(delivered);
});

test('repulsor encounters remain physical fields without a spawn notification',()=>{
  const s=createFlight(FLEET[0]),warning=s.warning;
  const mission:Mission={...empty,events:[{at:0,arrival:1,kind:'object',objectType:'repulsor',x:7,y:0,count:1}]};
  advance(s,.5,mission);
  expect(s.warning).toBe(warning);expect(s.fieldType).toBe('repulsor');expect(s.field).toContain('Repulsor');expect(s.vx).toBeLessThan(0);
  expect(s.entities.some(e=>e.objectType==='repulsor')).toBe(true);
});

test('high risk volleys have three distinct lanes without reducing projectile reaction time',()=>{
  const s=flight(),mission:Mission={...empty,challenge:{...difficulty(4),volley:2}};
  const enemy=spawnObject(s,'pirate',5,1,-180);enemy.fire=0;advance(s,.02,mission);
  const shots=s.entities.filter(e=>e.kind==='hostile');expect(shots).toHaveLength(3);
  expect(new Set(shots.map(e=>e.vx)).size).toBe(3);
  for(const shot of shots)expect(-shot.z/((shot.vz??0)+29*s.speed)).toBeGreaterThan(1.35);
});

test('enemy introductions remain silent while scheduled and contextual pirates still spawn',()=>{
  for(const objectType of ['pirate','twinwing-fighter','saucer-cruiser','wedge-destroyer'] as const){
    const s=createFlight(FLEET[0]),warning=s.warning;
    advance(s,.05,{...empty,events:[{at:0,arrival:6,kind:'pirate',objectType,x:4,y:2,count:1}]});
    expect(s.warning).toBe(warning);expect(s.entities.some(e=>e.objectType===objectType)).toBe(true);
  }
  for(const type of ['pirate_ambush','enemy_reinforcement','bounty_hunter','pirate_pursuit'] as const){
    const s=flight(),r=s.expedition!,warning=s.warning,announcement=r.announcement;r.enemyKills=3;
    if(type==='pirate_pursuit')r.contract={...r.contract,cargoType:'navigation_computers',modifiers:[...CARGO.navigation_computers.modifiers],possibleThreats:['pirates','pirate_pursuers','asteroids']};
    expect(queueDirectorDecision(s,{event:{type,intensity:'low'},bonusObjective:null},r.contract.id,'openai')).toBe(true);
    advance(s,.05);expect(r.events.at(-1)?.type).toBe(type);expect(s.entities.some(e=>e.kind==='pirate')).toBe(true);
    expect(s.warning).toBe(warning);expect(r.announcement).toBe(announcement);
  }
});

test('no enclosing shield or warp mesh exists at startup, pickup, jump, expiry, damage or transfer',()=>{
  const s=createFlight(FLEET[0]),ship=buildShip(FLEET[0]),trail=createDamageTrail();
  for(const state of [{shield:0,warpAge:null},{shield:8,warpAge:null},{shield:1.5,warpAge:0},{shield:1,warpAge:4},{shield:0,warpAge:7.99},{shield:0,warpAge:null}]){
    Object.assign(s,state);updateShipDamage(ship,trail,s,1);expect(trail.getObjectByName('shield')).toBeUndefined();
    expect(trail.children.every(child=>child instanceof THREE.Points)).toBe(true);
  }
  s.hull=25;updateShipDamage(ship,trail,s,3);expect(trail.children[0].visible).toBe(true);
  const jump=buildEffectVisual({id:1,kind:'jump',x:0,y:0,z:0,age:0,life:1.2,size:12,color:'#9ef1ff',seed:1});expect(jump.children).toHaveLength(0);
  const gate=buildPortal();expect(gate.getObjectsByProperty('type','Mesh').some(mesh=>(mesh as THREE.Mesh).geometry.type==='TorusGeometry')).toBe(true);
  // The transfer reuses this normal ship and ring gate. Small cockpit/cargo/gun parts remain.
  ship.traverse(object=>{if(object instanceof THREE.Mesh){const geometry=object.geometry as THREE.SphereGeometry|THREE.BoxGeometry;if(geometry.type==='SphereGeometry')expect((geometry as THREE.SphereGeometry).parameters.radius).toBeLessThan(1);if(geometry.type==='BoxGeometry')expect(Math.max(...Object.values((geometry as THREE.BoxGeometry).parameters))).toBeLessThanOrEqual(1.3);}});
  for(const object of [ship,trail,jump,gate])disposeObject(object);
});
