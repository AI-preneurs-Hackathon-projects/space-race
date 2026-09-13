import {test,expect} from '@playwright/test';
import {createFlight} from './support';
import {FLEET,practiceMission,type DifficultySetting,type SectionPlan} from '../lib/game/types';
import {stepFlight,type Entity} from '../lib/game/simulation';
import {newCampaign,beginAttempt,finishAttempt,chooseUpgrade,launchCondition,effectiveHull,leaveFlight,stageMission,difficulty} from '../lib/game/progression';
import {sectionContext,validateDirectorContext,validateSectionPlan,sectionPlanPrompt} from '../lib/game/section-director';
const idle={x:0,y:0,fire:false},empty={...practiceMission(),events:[]};
const plan=(waves:number,variant=0):SectionPlan=>({title:'Test section',beats:Array.from({length:waves-2},(_,i)=>({objectType:(i%4===0?'pirate':i%4===1?'ice-asteroid':variant?'solar-satellite':'fuel-tank'),pace:i%4===0?'calm':i%3===0?'intense':'steady'}))});

test('gate repairs hull once, preserves fractional cargo, and upgrades carry condition into the next section',()=>{
 let c={...newCampaign(17),difficulty:'hard' as const},run=beginAttempt(c)!;
 const s=createFlight(FLEET[0],{hull:34,cargo:47.25});s.progress=149.97;stepFlight(s,idle,FLEET[0],empty,.1);
 expect(s.status).toBe('delivered');expect(s.hull).toBe(100);expect(s.arrivalHull).toBe(34);expect(s.cargo).toBe(47.25);
 c=finishAttempt(run.campaign,run.campaign.attempt,'delivered',s) as typeof c;
 expect(c.arrival).toEqual({stage:1,hull:34,maxHull:100,cargo:47.25});
 const next=chooseUpgrade(c,'hull'),hull=effectiveHull(FLEET[0],next),context=sectionContext(FLEET[0],next);
 expect(next.difficulty).toBe('hard');expect(launchCondition(next,hull)).toEqual({hull:115,cargo:47.25});expect(context.condition).toEqual({hull:115,cargo:47.25});expect(context.previousArrival?.hull).toBe(34);
 const started=beginAttempt(next)!,flight=createFlight(hull,launchCondition(started.campaign,hull));expect(flight.cargo).toBe(47.25);
 const departed=leaveFlight(started.campaign,{hull:71,cargo:21.5});expect(launchCondition(departed,hull)).toEqual({hull:71,cargo:21.5});
 expect(launchCondition(departed,effectiveHull(FLEET[2],departed))).toEqual({hull:71,cargo:21.5});
 const failed=finishAttempt(started.campaign,started.campaign.attempt,'lost',{hull:0,maxHull:115,cargo:21.5,arrivalHull:null});expect(chooseUpgrade(failed,'hull')).toBe(failed);expect(launchCondition(beginAttempt(failed)!.campaign,hull)).toEqual({hull:115,cargo:100});
});

for(const resource of ['hull','cargo'] as const)test(`${resource} depletion on the arrival tick wins over gate repair`,()=>{
 const s=createFlight(FLEET[0]);s.progress=149.996;s[resource]=1;s.entities=[{id:1,kind:'hostile',x:0,y:0,z:-.3,vx:0,vy:0,vz:30,radius:.3,mass:.04,hp:1,age:0,fire:0,ttl:7} as Entity];s.serial=2;
 stepFlight(s,idle,FLEET[0],empty,.05);expect(s.status).toBe('lost');expect(s[resource]).toBe(0);expect(s.arrivalHull).toBeNull();
 const run=beginAttempt(newCampaign(9))!,c=finishAttempt(run.campaign,1,'lost',s);expect(c.status).toBe('lost');expect(chooseUpgrade(c,'hull')).toBe(c);
 const already=createFlight(FLEET[0]);already.progress=150;already[resource]=0;stepFlight(already,idle,FLEET[0],empty,.05);expect(already.status).toBe('lost');expect(already.arrivalHull).toBeNull();
});

test('difficulty governs AI context, consumed composition and timing, fallback combat, and later progression',()=>{
 const modes:DifficultySetting[]=['easy','normal','hard'];
 const counts:number[]=[];
 for(const mode of modes){
  const c={...newCampaign(93),stage:4,difficulty:mode,hull:39,cargo:28.5,hullUpgrades:2,cruiseUpgrades:1},ctx=validateDirectorContext(sectionContext(FLEET[1],c)),d=difficulty(c.stage,mode);
  expect(ctx.difficulty).toBe(mode);expect(ctx.ship.armor).toBe(110);expect(ctx.condition).toEqual({hull:39,cargo:28.5});expect(sectionPlanPrompt(ctx)).toContain(`"difficulty":"${mode}"`);
  const authored=validateSectionPlan(plan(d.waves),d.waves),other=validateSectionPlan(plan(d.waves,1),d.waves),a=stageMission(4,93,[],{...empty,source:'openai',director:authored},mode),b=stageMission(4,93,[],{...empty,source:'openai',director:other},mode),fallback=stageMission(4,93,[],undefined,mode);
  expect(a.challenge).toEqual(fallback.challenge);expect(a.source).toBe('openai');expect(a.events).toHaveLength(d.waves);counts.push(a.events.length);
  const core=a.events.filter(e=>e.kind!=='portal');for(const i of [2,14,core.length-1])expect(core[i].objectType).toBe(authored.beats[i].objectType);
  expect(core.filter((e,i)=>e.objectType!==b.events.filter(x=>x.kind!=='portal')[i].objectType).length).toBeGreaterThan(10);
  expect(a.events.some((e,i)=>Math.abs(e.arrival!-fallback.events[i].arrival!)>.2)).toBe(true);
  expect(a.events[0].arrival).toBe(8);expect(a.events.at(-1)!.arrival).toBeCloseTo(146,6);
  a.events.slice(1).forEach((e,i)=>expect(e.arrival!-a.events[i].arrival!).toBeGreaterThanOrEqual(3.499));expect(a.events.filter(e=>e.kind==='portal')).toHaveLength(2);
  expect(difficulty(20,mode).pirateInterval).toBeLessThan(d.pirateInterval);expect(difficulty(20,mode).waves).toBeGreaterThanOrEqual(d.waves);
  expect(()=>validateSectionPlan({title:'No challenge',beats:Array.from({length:d.waves-2},()=>({objectType:'shield-buoy',pace:'calm'}))},d.waves)).toThrow();
 }
 expect(counts[0]).toBeLessThan(counts[1]);expect(counts[1]).toBeLessThan(counts[2]);
 expect(difficulty(4,'easy').pirateInterval).toBeGreaterThan(difficulty(4,'normal').pirateInterval);expect(difficulty(4,'hard').gapWidth).toBeLessThan(difficulty(4,'normal').gapWidth);
});
