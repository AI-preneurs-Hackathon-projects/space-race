import {test,expect} from '@playwright/test';
import {createFlight} from './support';
import {stepFlight,spawnObject,typeOf,damage,disposeFlight,type Input} from '../lib/game/simulation';
import {FLEET,practiceMission,validateMission,type Mission} from '../lib/game/types';
import {OBJECT_TYPES,OBJECTS,SHIP_TYPES,ENCOUNTER_MODELS,type ObjectType} from '../lib/game/objects';
import {stageMission} from '../lib/game/progression';
const idle={x:0,y:0,fire:false};
const removed=['asteroid','crystal-cluster','sputnik','ring-station','proximity-mine','derelict','planet'];
function advance(s:ReturnType<typeof createFlight>,mission:Mission,seconds:number,input:Input=idle,hull=FLEET[0]){for(let i=0;i<Math.round(seconds*60);i++)stepFlight(s,input,hull,mission,1/60);}

test('the seven retired objects cannot enter stages, legacy fallbacks, or authored encounters',()=>{
 expect(OBJECT_TYPES).toHaveLength(18);expect(SHIP_TYPES).toHaveLength(4);expect(OBJECT_TYPES).toContain('fuel-tank');
 for(const id of removed){expect(OBJECT_TYPES).not.toContain(id);expect(Object.keys(OBJECTS)).not.toContain(id);}
 for(const id of ['asteroid-1','asteroid-2','asteroid-3',...removed.slice(1)])expect(ENCOUNTER_MODELS).not.toContain(id);
 for(const stage of [1,4,9,50])for(let seed=0;seed<30;seed++)for(const e of stageMission(stage,seed).events){expect(removed).not.toContain(e.objectType);expect(removed).not.toContain(e.escort);}
 for(const m of [practiceMission(),validateMission(practiceMission())]){const s=createFlight(FLEET[0]);advance(s,m,6);expect(s.entities.length).toBeGreaterThan(0);for(const e of s.entities)expect(removed).not.toContain(typeOf(e));}
 const s=createFlight(FLEET[0]),m:Mission={...practiceMission(),events:removed.map((objectType,i)=>({at:0,kind:'object',objectType:objectType as ObjectType,x:5,y:3,count:1}))};advance(s,m,.1);expect(s.entities).toHaveLength(0);expect(s.next).toBe(7);
});

for(const id of SHIP_TYPES){
 test(`${id} fires aimed damaging shots early at both difficulty and cruise limits`,()=>{
  for(const tier of [1,9])for(const cruise of [1,1.2]){
   const hull={...FLEET[0],cruise},s=createFlight(hull),m={...stageMission(tier,17),events:[]};const enemy=spawnObject(s,id,4,1.2,-145),seen=new Set<number>();let first=Infinity;
   for(let i=0;i<200;i++){
    stepFlight(s,idle,hull,m,1/60);
    for(const shot of s.entities)if(shot.kind==='hostile'&&!seen.has(shot.id)){seen.add(shot.id);first=Math.min(first,s.time);expect(shot.ownerId).toBe(enemy.id);expect(-shot.z/((m.challenge?.bulletSpeed??29)+29*s.speed)).toBeGreaterThan(1.37);expect(s.effects.some(f=>f.kind==='muzzle'&&f.z>enemy.z+enemy.radius)).toBe(true);}
   }
   expect(first).toBeLessThan(.8);expect(seen.size).toBeGreaterThanOrEqual(OBJECTS[id].weapons!.volley);expect(s.hull).toBeLessThan(100);expect(s.cargo).toBeLessThan(100);expect(enemy.hp).toBe(OBJECTS[id].hp);
  }
 });
 test(`${id} attacks can be dodged and stop correctly across lifecycle transitions`,()=>{
  const m={...stageMission(1,17),events:[]},s=createFlight(FLEET[0]);spawnObject(s,id,4,1.2,-145);
  advance(s,m,.7);const paused=JSON.stringify(s);stepFlight(s,{x:1,y:1,fire:true},FLEET[0],m,0);expect(JSON.stringify(s)).toBe(paused);
  // Move after the telegraphed first volley, before it reaches the player.
  advance(s,m,2.4,{x:-.7,y:-.45,fire:false});expect(s.hull).toBe(100);expect(s.cargo).toBe(100);
  const destroyed=createFlight(FLEET[0]),enemy=spawnObject(destroyed,id,4,1,-145);enemy.hp=0;advance(destroyed,m,1);expect(destroyed.entities.filter(e=>e.kind==='hostile')).toHaveLength(0);
  for(const status of ['lost','delivered'] as const){const ended=createFlight(FLEET[0]);spawnObject(ended,id,4,1,-145);ended.status=status;const before=JSON.stringify(ended);advance(ended,m,1);expect(JSON.stringify(ended)).toBe(before);}
  const jumping=createFlight(FLEET[0]);spawnObject(jumping,id,4,1,-145);jumping.warpAge=0;advance(jumping,m,1);expect(jumping.entities.filter(e=>e.kind==='hostile')).toHaveLength(0);
  const retry=createFlight(FLEET[0]);expect(retry.entities).toHaveLength(0);expect(retry.hull).toBe(100);expect(retry.cargo).toBe(100);const fresh=spawnObject(retry,id,4,1,-145);expect(fresh.fire).toBe(OBJECTS[id].weapons!.warmup);advance(retry,m,.8);expect(retry.entities.some(e=>e.kind==='hostile')).toBe(true);
 });
}

test('all preset ships render cleanly in hangar and flight, retain firing, and show the reduced guide',async({page})=>{
 const errors:string[]=[],models=new Set<string>();page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.ok()&&r.url().endsWith('.glb'))models.add(new URL(r.url()).pathname);});
 await page.goto('/');
 for(const name of ['Kestrel','Wraith','Atlas']){
  await page.getByRole('button',{name:new RegExp(name+' ')}).click();await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');await page.waitForTimeout(250);await page.locator('.hangar-viewport').screenshot({path:`outputs/after-${name.toLowerCase()}.png`});
  await page.getByRole('button',{name:'Launch delivery'}).click();await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');await page.waitForTimeout(250);await page.screenshot({path:`outputs/after-${name.toLowerCase()}-flight.png`});
  await page.keyboard.down('Space');await page.waitForTimeout(350);const raw=await page.locator('canvas').getAttribute('data-flight-state');expect(JSON.parse(raw!).entities.some((e:{kind:string})=>e.kind==='shot')).toBe(true);await page.keyboard.up('Space');
  await page.getByRole('button',{name:'Pause game'}).click();await page.waitForTimeout(150);const p=await page.locator('canvas').getAttribute('data-progress');await page.waitForTimeout(200);expect(await page.locator('canvas').getAttribute('data-progress')).toBe(p);await page.getByRole('button',{name:'Return to hangar'}).click();
 }
 await page.getByRole('button',{name:/Field guide · 18 objects/}).click();await expect(page.locator('.guide-grid article')).toHaveCount(18);
 for(const name of ['Crystal cluster','Basalt asteroid','Survey satellite','Orbital relay','Proximity mine','Drifting wreck','Ringed planetoid'])await expect(page.locator('.guide-grid')).not.toContainText(name);
 for(const id of SHIP_TYPES)await expect(page.locator('.guide-grid')).toContainText(OBJECTS[id].name);
 for(const model of ['asteroid-1','asteroid-2','asteroid-3',...removed.slice(1)])expect(models).not.toContain(`/models/${model}.glb`);
 expect(models.size).toBe(16);expect(errors).toEqual([]);await page.screenshot({path:'outputs/cleanup-guide-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'outputs/cleanup-guide-mobile.png'});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
});
