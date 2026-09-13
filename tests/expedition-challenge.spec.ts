import {expect,test} from '@playwright/test';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createFlight} from './support';
import {evasivePilot} from './pilot';
import {disposeFlight,spawnObject,stepFlight,type Input} from '../lib/game/simulation';
import {initializeExpedition} from '../lib/game/expedition-runtime';
import {bindDeliveryTiming} from '../lib/game/delivery-timing';
import {CARGO,type Contract,type Risk} from '../lib/game/contracts';
import {difficulty,stageMission} from '../lib/game/progression';
import {CRUISE_SPEED,DURATION,FLEET,practiceMission,type DifficultySetting,type Mission} from '../lib/game/types';
import {isShip} from '../lib/game/objects';

const SETTINGS=['easy','normal','hard'] as const;
const SECTORS=[1,9] as const;
const RISKS=['low','high'] as const;
const MODES=['idle','fire','evasive'] as const;
const SEEDS=[1,3,7];
type Mode=typeof MODES[number];
/** A test-only fixed cargo across risk tiers isolates risk tuning from the cargo offer catalog. */
function fixedContract(sector:number,risk:Risk,setting:DifficultySetting):Contract {
  return bindDeliveryTiming({id:`pressure-${sector}-${risk}`,title:'Pressure benchmark',description:CARGO.high_value_technology.description,cargoType:'high_value_technology',destination:`Sector ${sector}`,sector,reward:4000,risk,urgency:'standard',minimumCargoIntegrity:null,modifiers:['valuable_cargo'],possibleThreats:['pirates','bounty_hunters','asteroids'],possibleObjectives:['AVOID_DAMAGE'],mystery:null},{cruise:1,difficulty:setting});
}
function route(sector:number,seed:number,setting:DifficultySetting,risk:Risk,template?:Mission):Mission {
  const contract=fixedContract(sector,risk,setting),mission=stageMission(sector,seed,[],{...(template??practiceMission()),contract},setting);
  mission.contract=contract;return mission;
}
const rounded=(number:number)=>Math.round(number*100)/100;
const mean=(values:number[])=>values.reduce((sum,value)=>sum+value,0)/values.length;

test('difficulty and contract risk retain measurable bounded encounter pressure even for calm AI routes',()=>{
  for(const sector of SECTORS)for(const seed of SEEDS){
    const counts=SETTINGS.map(setting=>{
      const challenge=difficulty(sector,setting),calm:Mission={...practiceMission(),source:'openai',director:{title:'Calm test template',beats:Array.from({length:challenge.waves-2},()=>({objectType:'ice-asteroid',pace:'calm'}))}};
      const low=route(sector,seed,setting,'low'),high=route(sector,seed,setting,'high'),guarded=route(sector,seed,setting,'high',calm);
      const armed=(mission:Mission)=>mission.events.filter(event=>event.objectType&&isShip(event.objectType)).length;
      expect(high.events.length).toBe(challenge.waves);expect(high.challenge!.gapWidth).toBeLessThan(low.challenge!.gapWidth);
      expect(armed(high)).toBeGreaterThanOrEqual(armed(low));expect(armed(guarded)).toBeGreaterThanOrEqual(3);
      expect(armed(guarded)/(guarded.events.length-2)).toBeGreaterThanOrEqual(setting==='easy'?.28:setting==='normal'?.36:.44);
      expect(guarded.events.filter(event=>event.kind==='portal')).toHaveLength(2);
      for(let i=1;i<guarded.events.length;i++)expect(guarded.events[i].arrival!-guarded.events[i-1].arrival!).toBeGreaterThanOrEqual(3.499);
      return {waves:challenge.waves,interval:challenge.pirateInterval,gap:challenge.gapWidth,armed:armed(high)};
    });
    expect(counts[1].waves).toBeGreaterThan(counts[0].waves);expect(counts[2].waves).toBeGreaterThan(counts[1].waves);
    expect(counts[1].interval).toBeLessThan(counts[0].interval);expect(counts[2].interval).toBeLessThan(counts[1].interval);
    expect(counts[1].armed).toBeGreaterThanOrEqual(counts[0].armed);expect(counts[2].armed).toBeGreaterThanOrEqual(counts[1].armed);
  }
});

test('higher risk produces more enemy fire without reducing projectile reaction room',()=>{
  for(const setting of SETTINGS){
    const observed=RISKS.map(risk=>{
      const mission={...route(1,1,setting,risk),events:[]},hull=FLEET[0],state=createFlight(hull),shots=new Set<number>();state.immune=1000;initializeExpedition(state,mission.contract!);
      spawnObject(state,'wedge-destroyer',4,2,-500);let minReaction=Infinity;
      for(let i=0;i<300;i++){
        stepFlight(state,{x:0,y:0,fire:false},hull,mission,.05);
        for(const entity of state.entities)if(entity.kind==='hostile'&&!shots.has(entity.id)){shots.add(entity.id);minReaction=Math.min(minReaction,-entity.z/((entity.vz??0)+CRUISE_SPEED*state.speed));}
      }
      disposeFlight(state);return {risk,shots:shots.size,minReaction};
    });
    expect(observed[0].shots).toBeGreaterThan(0);expect(observed[1].shots).toBeGreaterThan(observed[0].shots);
    for(const result of observed)expect(result.minReaction).toBeGreaterThan(1.28);
  }
});

test('sustained high-risk volleys stay within the hostile projectile budget and resume as shots leave',()=>{
  const mission={...route(9,1,'hard','high'),events:[]},hull=FLEET[0],state=createFlight(hull),shots=new Set<number>();
  state.immune=1000;initializeExpedition(state,mission.contract!);
  for(const x of [-6,-2,2,6]){const enemy=spawnObject(state,'wedge-destroyer',x,2,-500);enemy.hp=enemy.maxHp=100;}
  let peak=0,minReaction=Infinity;
  for(let i=0;i<400;i++){
    stepFlight(state,{x:0,y:0,fire:false},hull,mission,.05);
    const active=state.entities.filter(entity=>entity.kind==='hostile');peak=Math.max(peak,active.length);
    expect(active.length).toBeLessThanOrEqual(48);
    for(const entity of active)if(!shots.has(entity.id)){shots.add(entity.id);minReaction=Math.min(minReaction,-entity.z/((entity.vz??0)+CRUISE_SPEED*state.speed));}
  }
  expect(peak).toBe(48);expect(shots.size).toBeGreaterThan(60);expect(minReaction).toBeGreaterThan(1.28);
  disposeFlight(state);
});

test('opening encounters leave more than four seconds before first damage',()=>{
  for(const setting of SETTINGS)for(const sector of SECTORS)for(const risk of RISKS)for(const seed of SEEDS){
    const hull=FLEET[0],mission=route(sector,seed,setting,risk),state=createFlight(hull);let firstHit=Infinity;
    for(let i=0;i<61&&!state.hits;i++){stepFlight(state,{x:0,y:0,fire:false},hull,mission,.1);if(state.hits)firstHit=state.time;}
    disposeFlight(state);expect(firstHit+1e-9,JSON.stringify({setting,sector,risk,seed,firstHit})).toBeGreaterThan(4);
  }
});

test('representative expeditions reward active steering while all difficulties and risks retain fair reaction windows',()=>{
  test.setTimeout(180000);
  const results:{setting:DifficultySetting;sector:number;risk:Risk;mode:Mode;seed:number;status:string;time:number;progress:number;hull:number;cargo:number;damage:number;enemyShots:number;playerShots:number;kills:number;armed:number;peak:number;minReaction:number|null;firstHit:number|null;portals:number}[]=[];
  for(const setting of SETTINGS)for(const sector of SECTORS)for(const risk of RISKS)for(const mode of MODES)for(const seed of SEEDS){
    const hull=FLEET[0],mission=route(sector,seed,setting,risk),state=createFlight(hull),shots=new Set<number>();
    let peak=0,minReaction=Infinity,firstHit=Infinity;
    for(let i=0;i<1600&&state.status==='flying';i++){
      const action:Input=mode==='evasive'?evasivePilot(state):{x:0,y:0,fire:mode==='fire'};
      stepFlight(state,action,hull,mission,.1);peak=Math.max(peak,state.entities.length);if(state.hits&&firstHit===Infinity)firstHit=state.time;
      for(const entity of state.entities)if(entity.kind==='hostile'&&!shots.has(entity.id)){shots.add(entity.id);minReaction=Math.min(minReaction,-entity.z/((entity.vz??0)+CRUISE_SPEED*state.speed));}
    }
    results.push({setting,sector,risk,mode,seed,status:state.status,time:rounded(state.time),progress:rounded(state.progress),hull:rounded(state.arrivalHull??state.hull),cargo:rounded(state.cargo),damage:rounded(state.expedition?.damageTaken??hull.armor-state.hull),enemyShots:shots.size,playerShots:state.shots,kills:state.expedition?.enemyKills??0,armed:mission.events.filter(event=>event.objectType&&isShip(event.objectType)).length,peak,minReaction:Number.isFinite(minReaction)?minReaction:null,firstHit:Number.isFinite(firstHit)?firstHit:null,portals:state.portalsUsed});
    disposeFlight(state);
  }
  const summaries=SETTINGS.flatMap(setting=>SECTORS.flatMap(sector=>RISKS.map(risk=>({setting,sector,risk,modes:Object.fromEntries(MODES.map(mode=>{const rows=results.filter(row=>row.setting===setting&&row.sector===sector&&row.risk===risk&&row.mode===mode);return [mode,{wins:rows.filter(row=>row.status==='delivered').length,runs:rows.length,meanProgress:rounded(mean(rows.map(row=>row.progress))),meanDamage:rounded(mean(rows.map(row=>row.damage))),meanEnemyShotsPerMinute:rounded(mean(rows.map(row=>row.enemyShots/row.time*60)))}];}))}))));
  mkdirSync('outputs',{recursive:true});writeFileSync('outputs/expedition-challenge-runs.json',JSON.stringify({notes:'Fixed high-value technology, no upgrades, standard urgency across risk tiers, no network calls or live event requests. The local pilot uses ordinary thrust/fire and does not deliberately chase optional boost gates.',settings:SETTINGS,sectors:SECTORS,seeds:SEEDS,summaries,results},null,2));
  console.log(JSON.stringify(summaries));
  const active=results.filter(row=>row.mode==='evasive'),stationary=results.filter(row=>row.mode==='fire'),idle=results.filter(row=>row.mode==='idle');
  const wins=(rows:typeof results)=>rows.filter(row=>row.status==='delivered').length;
  expect(wins(active)).toBeGreaterThan(wins(stationary));expect(wins(active)).toBeGreaterThan(wins(idle));
  expect(mean(active.map(row=>row.progress))).toBeGreaterThan(mean(idle.map(row=>row.progress))+15);
  expect(active.filter(row=>row.setting==='easy'&&row.sector===1&&row.risk==='low'&&row.status==='delivered').length).toBeGreaterThanOrEqual(2);
  for(const result of results){
    expect(result.progress).toBeLessThanOrEqual(DURATION);expect(result.peak).toBeLessThan(100);
    if(result.minReaction!==null)expect(result.minReaction,JSON.stringify(result)).toBeGreaterThan(1.28);
    if(result.firstHit!==null)expect(result.firstHit+1e-9,JSON.stringify(result)).toBeGreaterThan(4);
  }
});
