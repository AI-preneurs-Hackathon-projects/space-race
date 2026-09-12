import {test,expect} from '@playwright/test';
import {writeFileSync} from 'node:fs';
import {createFlight} from './support';
import {stepFlight,disposeFlight,type Input} from '../lib/game/simulation';
import {FLEET,type Hull} from '../lib/game/types';
import {difficulty,stageMission} from '../lib/game/progression';
import {evasivePilot} from './pilot';
test('both optional portals remain reachable during faster late-stage runs',()=>{
 for(const stage of [1,9,25])for(const seed of [1,3,7]){
  const hull={...FLEET[2],armor:200,cruise:1.2},s=createFlight(hull),m=stageMission(stage,seed),portals=new Set<number>();let peak=0;
  for(let i=0;i<1600&&s.status==='flying';i++){
   const gate=s.entities.find(e=>e.kind==='portal'&&e.z<0);if(gate)portals.add(gate.id);
   const action=gate?{x:Math.max(-1,Math.min(1,(gate.x-s.x)*2)),y:Math.max(-1,Math.min(1,(gate.y-s.y)*2)),fire:true}:evasivePilot(s);
   stepFlight(s,action,hull,m,.1);peak=Math.max(peak,s.entities.length);
  }
  expect(portals.size,JSON.stringify({stage,seed,status:s.status,progress:s.progress,hull:s.hull,next:s.next,arrival:s.lastEncounterArrival})).toBe(2);expect(s.portalsUsed).toBe(2);expect(s.status).toBe('delivered');expect(peak).toBeLessThan(100);disposeFlight(s);
 }
});
test('difficulty increases beyond nine with bounded cadence, formations and reaction time',()=>{
 for(const stage of [1,2,9,10,25,50,100,1000]){const d=difficulty(stage),next=difficulty(stage+1);expect(next.pirateInterval).toBeLessThan(d.pirateInterval);expect(next.aimLead).toBeGreaterThan(d.aimLead);expect(d.waves).toBeLessThanOrEqual(36);expect(d.pirateInterval).toBeGreaterThan(1.1);expect(d.portalRadius).toBeGreaterThanOrEqual(2.75);expect(d.bulletSpeed).toBeLessThan(42);}
});
test('seeded baseline and later runs reward steering rather than idle or stationary fire',()=>{
 test.setTimeout(180000);const results=[];
 for(const stage of [1,9,25])for(const mode of ['idle','fire','steer'])for(let seed=1;seed<=8;seed++){
  const hull:Hull={...FLEET[0]},s=createFlight(hull),m=stageMission(stage,seed),seenShots=new Set<number>(),waves=new Set<number>();let peak=0,minReaction=Infinity,action:Input={x:0,y:0,fire:mode==='fire'},firstHit=Infinity;
  for(let i=0;i<1600&&s.status==='flying';i++){
   if(mode==='steer')action=evasivePilot(s);stepFlight(s,action,hull,m,.1);
   if(s.hits&&firstHit===Infinity)firstHit=s.time;peak=Math.max(peak,s.entities.length);
   for(const e of s.entities){if(e.wave!==undefined)waves.add(e.wave);if(e.kind==='hostile'&&!seenShots.has(e.id)){seenShots.add(e.id);minReaction=Math.min(minReaction,-e.z/((e.vz??0)+29*s.speed));}}
  }
  results.push({stage,mode,seed,status:s.status,hull:Math.round(s.hull),cargo:Math.round(s.cargo),shots:seenShots.size,waves:waves.size,authored:m.events.length,peak,minReaction,firstHit,time:s.time,portals:s.portalsUsed});disposeFlight(s);
 }
 writeFileSync('outputs/difficulty-runs.json',JSON.stringify(results,null,2));
 for(const stage of [1,9,25])for(const mode of ['idle','fire','steer']){const rows=results.filter(r=>r.stage===stage&&r.mode===mode);console.log(JSON.stringify({stage,mode,wins:rows.filter(r=>r.status==='delivered').length,meanShots:Math.round(rows.reduce((n,r)=>n+r.shots,0)/8),meanHull:Math.round(rows.reduce((n,r)=>n+r.hull,0)/8),peak:Math.max(...rows.map(r=>r.peak))}));}
 const baseline=results.filter(r=>r.stage===1);expect(baseline.filter(r=>r.mode==='idle'&&r.status==='lost').length).toBeGreaterThanOrEqual(7);expect(baseline.filter(r=>r.mode==='fire'&&r.status==='lost').length).toBeGreaterThanOrEqual(4);expect(baseline.filter(r=>r.mode==='steer'&&r.status==='delivered').length).toBeGreaterThanOrEqual(6);
 for(const r of results){expect(r.peak).toBeLessThan(100);expect(r.minReaction).toBeGreaterThan(1.28);expect(r.firstHit).toBeGreaterThan(4);}
});
