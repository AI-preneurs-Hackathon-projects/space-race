import {expect, test} from '@playwright/test';
import {createFlight} from './support';
import {CARGO, CARGO_TYPES, OBJECTIVE_TYPES, THREAT_TYPES, type CargoType, type Contract, type DirectorContext, type DirectorDecision, type ObjectiveCondition} from '../lib/game/contracts';
import {fallbackContracts, fallbackDecision, validateContracts, validateDecision, validateDirectorContext} from '../lib/game/contract-director';
import {cargoSuccessRate, finishRun, newRun, resolveDelivery} from '../lib/game/run-manager';
import {ContractDirector} from '../lib/game/director-client';
import {damage, disposeFlight, spawnObject, stepFlight, type Flight} from '../lib/game/simulation';
import {initializeExpedition, queueDirectorDecision, directorTrigger, markDirectorRequested, stepExpedition} from '../lib/game/expedition-runtime';
import {FLEET, practiceMission} from '../lib/game/types';
import {beginAttempt, departWithContract, finishAttempt, newCampaign} from '../lib/game/progression';
import {sectionContext,sectionPlanPrompt,validateDirectorContext as validateSectionContext} from '../lib/game/section-director';

const idle = {x:0, y:0, fire:false};
const empty = {...practiceMission(), events:[]};
const context = (patch:Partial<DirectorContext>={}):DirectorContext => ({
  sector:1, difficulty:'normal', hull:100, maxHull:100, cargoIntegrity:100,
  currentCargo:'medical_supplies', upgrades:{hull:0, cruise:0}, credits:0,
  performance:{damageTaken:0, kills:0, itemsCollected:0, objectivesCompleted:0, objectivesFailed:0},
  enemies:{active:0, bountyHunter:false}, notableEvents:[], recentBehavior:[], previousContracts:[], recentObjectives:[],
  elapsed:20, routeProgress:.2, instability:0, seed:173, ...patch,
});
const contract = (cargoType:CargoType='medical_supplies', sector=1):Contract => ({
  id:`test-${sector}-${cargoType}`, title:'Test delivery', description:CARGO[cargoType].description,
  cargoType, destination:`Sector ${sector}`, sector, reward:3000, risk:'medium',
  minimumCargoIntegrity:CARGO[cargoType].minimumIntegrity, modifiers:[...CARGO[cargoType].modifiers],
  possibleThreats:[...THREAT_TYPES], possibleObjectives:[...OBJECTIVE_TYPES], mystery:null,
});
function flight(cargoType:CargoType='medical_supplies') {
  const state=createFlight(FLEET[0]); initializeExpedition(state,contract(cargoType)); return state;
}
function advance(state:Flight, seconds:number, fire=false) {
  for(let i=0;i<Math.round(seconds*60);i++)stepFlight(state,{...idle,fire},FLEET[0],empty,1/60);
}
function objective(state:Flight, conditions:ObjectiveCondition[], event:DirectorDecision['event']=null) {
  const proposal:DirectorDecision={event,bonusObjective:{id:'qa-objective',conditions,reward:500,uiText:'Test objective'}};
  expect(queueDirectorDecision(state,proposal,state.expedition!.contract.id,'openai')).toBe(true);
  stepExpedition(state,0);
  return state.expedition!.objectives[0];
}

test('fallback contracts provide three distinct risk choices, respond to history, and use only cargo mechanics',()=>{
  const choices=fallbackContracts(context());
  expect(choices).toHaveLength(3); expect(choices.map(c=>c.risk)).toEqual(['low','medium','high']);
  expect(new Set(choices.map(c=>c.cargoType)).size).toBe(3);
  expect(choices[0].reward).toBeLessThan(choices[1].reward); expect(choices[1].reward).toBeLessThan(choices[2].reward);
  for(const choice of choices){expect(choice.sector).toBe(2);expect(choice.modifiers).toEqual(CARGO[choice.cargoType].modifiers);}
  const repeated=fallbackContracts(context({sector:5,seed:42,previousContracts:choices.map(c=>c.cargoType)}));
  expect(repeated.map(c=>c.cargoType)).not.toEqual(choices.map(c=>c.cargoType));
  expect(validateContracts({contracts:choices},context())).toHaveLength(3);
});

test('AI validation rejects invented mechanics, unsupported targets, duplicate choices and non-finite values',()=>{
  const choices=fallbackContracts(context());
  expect(()=>validateContracts({contracts:[{...choices[0],cargoType:'teleporter'},...choices.slice(1)]},context())).toThrow();
  expect(()=>validateContracts({contracts:[choices[0],choices[0],choices[2]]},context())).toThrow();
  expect(()=>validateDecision({event:{type:'spawn_planet',intensity:'high'},bonusObjective:null},context())).toThrow();
  expect(()=>validateDecision({event:null,bonusObjective:{id:'bad',reward:200,uiText:'Win',conditions:[{type:'DESTROY_TARGET',target:'all_ships',successCondition:1,duration:30}]}},context())).toThrow();
  expect(()=>validateDecision({event:null,bonusObjective:{id:'bad',reward:200,uiText:'Win',conditions:[{type:'BEAT_RIVAL',target:'nova',successCondition:1,duration:30}]}},context())).toThrow();
  expect(()=>validateDirectorContext({...context(),hull:NaN})).toThrow();
  expect(()=>validateContracts({contracts:choices.map((c,i)=>({...c,reward:i?c.reward:Infinity}))},context())).toThrow();
  expect(()=>validateContracts({contracts:choices.map(c=>c.cargoType==='high_value_technology'?{...c,possibleThreats:['pirates']}:c)},context())).toThrow();
});

test('contextual fallback decisions are consequences of damaged cargo, valuable cargo and hostile behavior',()=>{
  expect(fallbackDecision(context({cargoIntegrity:24,hull:38})).event?.type).toBe('repair_opportunity');
  expect(fallbackDecision(context({currentCargo:'high_value_technology'})).event?.type).toBe('bounty_hunter');
  expect(fallbackDecision(context({currentCargo:'navigation_computers'})).event?.type).toBe('pirate_pursuit');
  expect(fallbackDecision(context({currentCargo:'volatile_fuel',instability:80})).event?.type).toBe('cargo_instability');
  for(const cargoType of CARGO_TYPES)expect(()=>validateDecision(fallbackDecision(context({currentCargo:cargoType})),context({currentCargo:cargoType}))).not.toThrow();
});

test('delivery rewards come from local integrity and completed objectives, resolve once, and retry resets the run',()=>{
  const delivery=contract(),metrics={cargoIntegrity:75.5,damageTaken:24.5,bonusReward:450,objectivesCompleted:['Clean flight']};
  const first=resolveDelivery(newRun(11),delivery,metrics);
  expect(first.result).toMatchObject({success:true,baseReward:3000,bonusReward:450,totalReward:3450,cargoIntegrity:75.5});
  expect(first.run).toMatchObject({sectorsCompleted:1,deliveriesCompleted:1,deliveriesAttempted:1,totalReward:3450});
  expect(resolveDelivery(first.run,delivery,metrics).run).toBe(first.run);
  const failed=resolveDelivery(first.run,contract('medical_supplies',2),{...metrics,cargoIntegrity:69.99,bonusReward:0});
  expect(failed.result).toMatchObject({success:false,baseReward:0,totalReward:0});
  expect(cargoSuccessRate(failed.run)).toBe(50);
  const over=finishRun(failed.run);expect(over.status).toBe('over');expect(over.bestSector).toBe(3);
  expect(over.deliveriesAttempted).toBe(3);expect(cargoSuccessRate(over)).toBe(33);expect(finishRun(over)).toBe(over);
  expect(resolveDelivery(over,contract('navigation_computers',3),metrics).run).toBe(over);
  expect(newRun(12)).toMatchObject({sectorsCompleted:0,deliveriesCompleted:0,totalReward:0,credits:0,score:0,history:[],status:'active'});
});

test('section planning receives validated cargo rules and accepts surviving ships with a spent manifest',()=>{
  const manifest:Contract={...contract(),minimumCargoIntegrity:85,possibleThreats:['asteroids','pirates']},campaign={...newCampaign(31),hull:48,cargo:0};
  const summary=validateSectionContext(sectionContext(FLEET[1],campaign,manifest));
  expect(summary.condition).toEqual({hull:48,cargo:0});expect(summary.contract).toMatchObject({cargoType:'medical_supplies',minimumCargoIntegrity:85,risk:'medium',modifiers:['fragile_cargo']});
  const prompt=sectionPlanPrompt(summary);expect(prompt).toContain('Each new accepted contract loads fresh cargo');expect(prompt).toContain('Tagged relief capsules');expect(prompt).toContain('medium risk');expect(prompt).toContain('85');
  expect(()=>validateSectionContext({...summary,contract:{...summary.contract,cargoType:'teleporter'}})).toThrow();
  expect(()=>validateSectionContext({...summary,contract:{...summary.contract,modifiers:['unstable_fuel']}})).toThrow();
  expect(()=>validateSectionContext({...summary,contract:{...summary.contract,minimumCargoIntegrity:99}})).toThrow();
});

test('new manifests replace spent cargo at the gate and preserve existing bounded upgrades',()=>{
  const attempt=beginAttempt(newCampaign(11))!,state=flight();state.progress=149.99;state.cargo=0;
  advance(state,.05);expect(state.status).toBe('delivered');
  const gate=finishAttempt(attempt.campaign,attempt.campaign.attempt,'delivered',state,true);
  expect(gate.status).toBe('cleared');
  const upgraded=departWithContract(gate,'hull');expect(upgraded).toMatchObject({stage:2,cargo:100,hullUpgrades:1,status:'ready'});
  expect(departWithContract(gate,'continue')).toMatchObject({stage:2,cargo:100,hullUpgrades:0,status:'ready'});
});

test('cargo affects damage, instability and life support; cargo loss alone does not destroy an expedition ship',()=>{
  const normal=flight('high_value_technology'),medical=flight(),fuel=flight('volatile_fuel'),cryo=flight('cryogenic_passengers');
  for(const state of [normal,medical,fuel,cryo])damage(state,10,10);
  expect(normal.cargo).toBe(90);expect(medical.cargo).toBe(86.5);expect(cryo.cargo).toBe(88.5);
  expect(fuel.expedition!.instability).toBeGreaterThan(0);const instability=fuel.expedition!.instability;
  advance(fuel,3);expect(fuel.expedition!.instability).toBeLessThan(instability);
  const before=cryo.cargo;advance(cryo,2);expect(cryo.cargo).toBeLessThan(before);
  const cryoHazard=flight('cryogenic_passengers');damage(cryoHazard,10,10,'field');expect(cryoHazard.cargo).toBeCloseTo(83.9);
  medical.immune=0;damage(medical,1,200);expect(medical.cargo).toBe(0);expect(medical.status).toBe('flying');
  medical.immune=0;damage(medical,100,0);expect(medical.status).toBe('lost');
});

test('director cadence is bounded and queued proposals apply only on the next active simulation tick',()=>{
  const state=flight('high_value_technology');
  const proposal:DirectorDecision={event:{type:'bounty_hunter',intensity:'medium'},bonusObjective:null};
  expect(queueDirectorDecision(state,proposal,'wrong-contract','openai')).toBe(false);
  expect(queueDirectorDecision(state,proposal,state.expedition!.contract.id,'openai')).toBe(true);
  expect(state.expedition!.events).toHaveLength(0);stepFlight(state,idle,FLEET[0],empty,0);expect(state.expedition!.events).toHaveLength(0);
  advance(state,.05);expect(state.expedition!.events).toHaveLength(1);
  expect(state.expedition!.events[0]).toMatchObject({type:'bounty_hunter',source:'openai'});
  markDirectorRequested(state);expect(directorTrigger(state)).toBeNull();advance(state,1);expect(directorTrigger(state)).toBeNull();
  state.status='delivered';expect(queueDirectorDecision(state,proposal,state.expedition!.contract.id,'openai')).toBe(false);
  const dead=flight();dead.status='lost';expect(queueDirectorDecision(dead,proposal,dead.expedition!.contract.id,'openai')).toBe(false);
});

test('a bounty objective credits only destruction of its exact target; despawn is failure',()=>{
  for(const destroy of [false,true]){
    const state=flight('high_value_technology'),goal=objective(state,[{type:'DESTROY_TARGET',target:'bounty_hunter',successCondition:1,duration:null}],{type:'bounty_hunter',intensity:'low'});
    const target=state.entities.find(entity=>entity.id===goal.targetId)!;
    expect(target.expeditionRole).toBe('bounty_hunter');target.x=0;target.y=0;target.anchorX=0;target.anchorY=0;target.z=destroy?-10:40;target.hp=1;
    advance(state,.3,destroy);
    expect(goal.status).toBe(destroy?'completed':'failed');
    expect(state.expedition!.killedEnemyIds.includes(target.id)).toBe(destroy);
  }
});

test('timed objectives use simulation time and cannot earn rewards after their deadline',()=>{
  const clean=flight('high_value_technology'),cleanGoal=objective(clean,[{type:'AVOID_DAMAGE',target:'cargo',successCondition:1,duration:12}]);
  advance(clean,11.9);expect(cleanGoal.status).toBe('active');advance(clean,.1);expect(cleanGoal.status).toBe('completed');
  const hit=flight(),hitGoal=objective(hit,[{type:'AVOID_DAMAGE',target:'cargo',successCondition:1,duration:12}]);
  advance(hit,11.9);damage(hit,1,1);advance(hit,.1);expect(hitGoal.status).toBe('failed');
  const late=flight('high_value_technology');late.progress=120;
  const lateGoal=objective(late,[{type:'COMPLETE_WITHIN_TIME',target:'gate',successCondition:1,duration:20}]);
  advance(late,20.1);expect(lateGoal.status).toBe('failed');
  disposeFlight(late);late.progress=149.99;advance(late,.05);expect(late.status).toBe('delivered');expect(lateGoal.status).toBe('failed');
});

test('composed timed and gate conditions latch completed parts and settle only when all conditions hold',()=>{
  const state=flight('high_value_technology'),goal=objective(state,[
    {type:'AVOID_DAMAGE',target:'cargo',successCondition:1,duration:12},
    {type:'MAINTAIN_CARGO_INTEGRITY',target:'cargo',successCondition:80,duration:null},
  ]);
  advance(state,12.1);expect(goal.status).toBe('active');
  damage(state,1,5);advance(state,.1);expect(goal.status).toBe('active');
  disposeFlight(state);state.progress=149.99;advance(state,.05);expect(state.status).toBe('delivered');expect(goal.status).toBe('completed');
  const failed=flight(),failedGoal=objective(failed,[{type:'MAINTAIN_CARGO_INTEGRITY',target:'cargo',successCondition:90,duration:null}]);
  damage(failed,1,10);advance(failed,.05);disposeFlight(failed);failed.cargo=100;failed.progress=149.99;advance(failed,.05);expect(failedGoal.status).toBe('failed');
});

test('contextual relief pods restore resources, while unstable fuel creates bounded damaging surges',()=>{
  const relief=flight();relief.hull=40;relief.cargo=40;
  expect(queueDirectorDecision(relief,{event:{type:'repair_opportunity',intensity:'low'},bonusObjective:null},relief.expedition!.contract.id,'fallback')).toBe(true);
  stepExpedition(relief,0);const pod=relief.entities.find(entity=>entity.expeditionRole==='repair')!;pod.x=0;pod.y=0;pod.z=-1;
  advance(relief,.1);expect(relief.hull).toBe(58);expect(relief.cargo).toBe(48);
  const fuel=flight('volatile_fuel');fuel.expedition!.instability=90;advance(fuel,.1);
  expect(fuel.hull).toBeLessThan(100);expect(fuel.hull).toBeGreaterThan(90);expect(fuel.cargo).toBeLessThan(100);
});

test('collection objectives have a real collectible and award only a pickup after activation',()=>{
  const state=flight('high_value_technology');
  spawnObject(state,'shield-buoy',0,0,-1);advance(state,.1);expect(state.expedition!.itemsCollected).toBe(1);
  spawnObject(state,'shield-buoy',0,0,-220);
  const goal=objective(state,[{type:'COLLECT_ITEM',target:'shield_buoy',successCondition:1,duration:null}]);
  expect(goal.status).toBe('active');
  const pickup=state.entities.find(entity=>entity.objectType==='shield-buoy'&&entity.hp>0)!;expect(pickup).toBeDefined();
  disposeFlight(state);pickup.x=state.x;pickup.y=state.y;pickup.z=-1;advance(state,.1);
  expect(state.expedition!.itemsCollected).toBe(2);expect(goal.status).toBe('completed');
});

test('director client returns validated fallback on provider errors, malformed JSON and illegal proposals',async()=>{
  const original=globalThis.fetch,director=new ContractDirector(true),signal=new AbortController().signal;
  try{
    for(const response of [new Response('provider down',{status:503}),new Response('not json'),Response.json({decision:{event:{type:'spawn_planet',intensity:'high'},bonusObjective:null}})]){
      globalThis.fetch=async()=>response;
      const result=await director.live(context(),signal);expect(result.source).toBe('fallback');expect(result.value.event).not.toBeNull();
    }
    globalThis.fetch=async()=>Response.json({contracts:[{cargoType:'arbitrary'}],source:'openai'});
    expect((await director.contracts(context(),2,signal)).value).toHaveLength(3);
    const controller=new AbortController();controller.abort();
    globalThis.fetch=async()=>{throw new DOMException('Aborted','AbortError');};
    await expect(director.live(context(),controller.signal)).rejects.toMatchObject({name:'AbortError'});
  }finally{globalThis.fetch=original;}
});

test('a stalled director request times out to playable local decisions without blocking the caller',async()=>{
  const original=globalThis.fetch,start=Date.now();let ticks=0;
  const clock=setInterval(()=>ticks++,20);
  try{
    globalThis.fetch=async(_input,init)=>new Promise((_resolve,reject)=>init!.signal!.addEventListener('abort',()=>reject(new DOMException('Timed out','TimeoutError')),{once:true}));
    const result=await new ContractDirector(true).live(context(),new AbortController().signal);
    expect(result.source).toBe('fallback');expect(result.value.event).not.toBeNull();
    expect(ticks).toBeGreaterThan(100);expect(Date.now()-start).toBeLessThan(8000);
  }finally{globalThis.fetch=original;clearInterval(clock);}
});

test('intercepting a relief capsule at speed repairs the ship without treating the pickup as collision damage',()=>{
  const state=flight();state.hull=40;state.cargo=40;
  expect(queueDirectorDecision(state,{event:{type:'repair_opportunity',intensity:'low'},bonusObjective:null},state.expedition!.contract.id,'fallback')).toBe(true);
  stepExpedition(state,0);
  const pod=state.entities.find(entity=>entity.expeditionRole==='repair')!;
  pod.x=state.x;pod.y=state.y;pod.z=-(pod.radius+1.05);
  advance(state,.2);
  expect(state.hits).toBe(0);expect(state.hull).toBe(58);expect(state.cargo).toBe(48);
  expect(state.expedition!.collectedIds).toContain(pod.id);
});

test('local contracts keep the actual next sector beyond the remote planning limit',()=>{
  const summary=context({sector:100000});
  const choices=fallbackContracts(summary,100001);
  expect(choices.every(choice=>choice.sector===100001)).toBe(true);
  expect(validateContracts({contracts:choices},summary,100001).map(choice=>choice.sector)).toEqual([100001,100001,100001]);
});
