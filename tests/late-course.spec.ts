import {test,expect} from '@playwright/test';
import {createFlight} from './support';
import {stepFlight,disposeFlight,physicsBodyCount,type Entity} from '../lib/game/simulation';
import {CRUISE_SPEED,DURATION,FLEET} from '../lib/game/types';
import {stageMission} from '../lib/game/progression';
import {evasivePilot} from './pilot';

// Copy into tests/ after the stage Encounter.arrival scheduling change.
// Twelve deterministic physics runs; balance and weapon tuning stay in difficulty.spec.ts.
const LATE_SAMPLES=[DURATION-500/CRUISE_SPEED,DURATION-12,DURATION-7];
const clamp=(n:number)=>Math.max(-1,Math.min(1,n));
const authoredAhead=(e:Entity)=>e.wave!==undefined&&e.hp>0&&e.kind!=='portal'&&e.z<0&&e.z> -650;

for(const stage of [1,9,25])for(const cruise of [1,1.2])for(const gates of ['miss','take'] as const){
 test(`stage ${stage}, cruise ${cruise}, ${gates} gates: every wave reaches the late course`,()=>{
  test.setTimeout(30000);
  const hull={...FLEET[2],armor:200,cruise},s=createFlight(hull),mission=stageMission(stage,1);
  const seenWaves=new Set<number>(),seenGates=new Set<number>();
  const samples:{progress:number;remainingKm:number;waves:number[]}[]=[];
  let nextSample=0,lastAhead=0,peak=0;

  // Isolate scheduling from an early combat death without changing thrust, bodies,
  // authored coordinates, weapon clocks, entity lifetimes, or gate interaction.
  s.immune=1000;
  try{
   expect(mission.events.filter(e=>e.kind==='portal')).toHaveLength(2);
   for(let i=0;i<1800&&s.status==='flying';i++){
    const gate=s.entities.filter(e=>e.kind==='portal'&&e.hp>0&&e.z<0).sort((a,b)=>b.z-a.z)[0];
    const action=gate?{
     x:clamp(((gates==='take'?gate.x:-Math.sign(gate.x||1)*7)-s.x)*2),
     y:clamp(((gates==='take'?gate.y:0)-s.y)*2),
     fire:true,
    }:evasivePilot(s);
    stepFlight(s,action,hull,mission,.1);
    peak=Math.max(peak,s.entities.length);
    for(const e of s.entities){
     if(e.wave!==undefined)seenWaves.add(e.wave);
     if(e.kind==='portal')seenGates.add(e.id);
    }
    const ahead=s.entities.filter(authoredAhead);
    if(ahead.length)lastAhead=s.progress;
    while(nextSample<LATE_SAMPLES.length&&s.progress>=LATE_SAMPLES[nextSample]){
     samples.push({progress:s.progress,remainingKm:Math.ceil((DURATION-s.progress)*CRUISE_SPEED),waves:[...new Set(ahead.map(e=>e.wave!))]});
     nextSample++;
    }
   }

   const detail=JSON.stringify({stage,cruise,gates,status:s.status,progress:s.progress,next:s.next,authored:mission.events.length,seen:[...seenWaves].sort((a,b)=>a-b),lastAhead,peak,samples});
   // next alone is insufficient: the old arrival cutoff consumed skipped waves.
   expect([...seenWaves].sort((a,b)=>a-b),detail).toEqual(mission.events.map((_,i)=>i));
   expect(s.next,detail).toBe(mission.events.length);
   expect(seenGates.size,detail).toBe(2);
   expect(s.portalsUsed,detail).toBe(gates==='take'?2:0);
   expect(samples,detail).toHaveLength(LATE_SAMPLES.length);
   for(const sample of samples)expect(sample.waves.length,JSON.stringify(sample)).toBeGreaterThan(0);
   expect(lastAhead,detail).toBeGreaterThanOrEqual(DURATION-5);
   expect(s.status,detail).toBe('delivered');
   expect(s.progress,detail).toBe(DURATION);
   expect(s.warpAge,detail).toBeNull();
   expect(peak,detail).toBeLessThan(100);
   expect(physicsBodyCount(s),detail).toBe(0);
  }finally{
   disposeFlight(s);
  }
 });
}
