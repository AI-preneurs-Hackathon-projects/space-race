import {clamp, CRUISE_SPEED, DURATION, MAX_PORTALS, WARP_DURATION, type Mission} from './types';
import {CARGO, EVENT_TYPES, OBJECTIVE_TYPES, RISKS, type Contract, type DirectorDecision, type EventProposal, type BonusObjective, type DirectorContext} from './contracts';
import {damage, spawnObject, courseStep, MAX_ENTITIES, type Flight, type Entity} from './simulation';
import type {ObjectType} from './objects';
import {validateDecision} from './contract-director';

export type DirectorSource = 'openai' | 'fallback';
export type DamageSource = 'impact' | 'projectile' | 'explosion' | 'field' | 'cargo';
export type AppliedEvent = EventProposal & {at:number; source:DirectorSource; targetId?:number};
export type TrackedObjective = {
  definition:BonusObjective; status:'active'|'completed'|'failed'; startedAt:number; source:DirectorSource;
  startDamage:number; startCargoDamage:number; startKills:number; startItems:number; targetId?:number; sawEnemies:boolean; conditionsComplete:boolean[];
};
export type ExpeditionRuntime = {
  contract:Contract; instability:number; damageTaken:number; cargoDamageTaken:number; enemyKills:number; itemsCollected:number;
  killedEnemyIds:number[]; collectedIds:number[]; objectives:TrackedObjective[]; events:AppliedEvent[];
  pending:{decision:DirectorDecision; contractId:string; source:DirectorSource; queuedAt:number; context?:DirectorContext}|null;
  lastRequestAt:number; requestHull:number; requestCargo:number; requestKills:number; requestObjectiveCount:number;
  lastEventAt:number; lastSurgeAt:number; announcement:string; announcementUntil:number; settled:boolean;
  elapsedOffset:number; extraGatesSpawned:number; extraGatesUsed:number; shortcutIds:number[]; shortcutArrivals:number[];
  scheduledGateArrivals:number[]; routeConfigured:boolean; baseGateCount:number; lastShortcutAt:number; lastShortcutCheckAt:number;
};

/** Opt-in state keeps the existing simulation and saved practice routes unchanged. */
export function initializeExpedition(s:Flight, contract:Contract, elapsedOffset=0):ExpeditionRuntime {
  if(s.expedition?.contract.id===contract.id)return s.expedition;
  const runtime:ExpeditionRuntime={contract, instability:0, damageTaken:0, cargoDamageTaken:0, enemyKills:0, itemsCollected:0,
    killedEnemyIds:[], collectedIds:[], objectives:[], events:[], pending:null,
    lastRequestAt:-10, requestHull:s.hull, requestCargo:s.cargo, requestKills:0, requestObjectiveCount:0,
    lastEventAt:-30, lastSurgeAt:-10, announcement:CARGO[contract.cargoType].label+' loaded', announcementUntil:6, settled:false,
    elapsedOffset:Number.isFinite(elapsedOffset)?Math.max(0,elapsedOffset):0,extraGatesSpawned:0,extraGatesUsed:0,shortcutIds:[],shortcutArrivals:[],scheduledGateArrivals:[],routeConfigured:false,baseGateCount:MAX_PORTALS,lastShortcutAt:-30,lastShortcutCheckAt:-30};
  s.expedition=runtime;
  return runtime;
}

/** The delivery clock survives a hangar relaunch; the sector's physics clock does not. */
export function deliveryElapsed(s:Flight):number{return (s.expedition?.elapsedOffset??0)+s.time;}
export function configureExpeditionRoute(s:Flight,mission:Mission){
  const r=s.expedition;if(!r||r.routeConfigured)return;
  r.scheduledGateArrivals=mission.events.filter(e=>e.kind==='portal'||e.objectType==='portal').slice(0,MAX_PORTALS).map(e=>e.arrival??e.at+5*s.cruise);
  r.baseGateCount=r.scheduledGateArrivals.length;r.routeConfigured=true;
  if(Number.isFinite(mission.deliveryElapsed))r.elapsedOffset=Math.max(0,mission.deliveryElapsed!);
  if(mission.deliveryShortcuts){
    const carried=mission.deliveryShortcuts,limit=extraShortcutLimit(s);
    r.extraGatesSpawned=Number.isFinite(carried.spawned)?Math.floor(clamp(carried.spawned,0,limit)):0;
    r.extraGatesUsed=Number.isFinite(carried.used)?Math.floor(clamp(carried.used,0,r.extraGatesSpawned)):0;
    s.portalsUsed+=r.extraGatesUsed;
  }
}
export function extraShortcutLimit(s:Flight):number{
  const contract=s.expedition?.contract;if(!contract)return 0;
  const cap=contract.urgency==='express'?2:contract.urgency==='priority'?1:0,value=contract.speedBonus?.extraGateLimit??0;
  return Number.isFinite(value)?Math.floor(clamp(value,0,cap)):0;
}
export function gateAvailability(s:Flight){
  const r=s.expedition,extraUsed=r?.extraGatesUsed??0,baseUsed=Math.max(0,s.portalsUsed-extraUsed),baseLimit=MAX_PORTALS;
  const extraSpawned=r?.extraGatesSpawned??0,baseAvailable=r?.routeConfigured?r.baseGateCount:baseLimit;
  return {baseUsed,baseLimit,extraSpawned,extraUsed,extraLimit:extraShortcutLimit(s),totalUsed:s.portalsUsed,totalAvailable:Math.max(baseUsed,baseAvailable)+extraSpawned};
}
export function canUseBoostGate(s:Flight,e:Entity):boolean{
  const r=s.expedition;
  if(e.expeditionRole==='shortcut')return !!r&&r.shortcutIds.includes(e.id)&&r.extraGatesUsed<Math.min(r.extraGatesSpawned,extraShortcutLimit(s));
  return s.portalsUsed-(r?.extraGatesUsed??0)<MAX_PORTALS;
}
export function recordBoostGateUsed(s:Flight,e:Entity){if(s.expedition&&e.expeditionRole==='shortcut')s.expedition.extraGatesUsed++;}

/** A whole boost plus recovery space separates entrances, even at upgraded cruise. */
export function shortcutPlacement(s:Flight):{x:number;y:number;z:number;arrival:number}|null {
  const r=s.expedition;if(!r||s.status!=='flying'||r.settled||s.warpAge!==null||r.extraGatesSpawned>=extraShortcutLimit(s)||s.progress<DURATION*.2||s.progress>DURATION-24||s.time-r.lastShortcutAt<12||s.entities.length>MAX_ENTITIES-16)return null;
  const liveGates=s.entities.filter(e=>e.kind==='portal'&&e.hp>0).map(e=>s.progress-e.z/CRUISE_SPEED);
  const occupied=[...r.scheduledGateArrivals,...r.shortcutArrivals,...liveGates];
  const separation=(courseStep(0,WARP_DURATION)+2)*s.cruise,minLead=Math.max(7*s.cruise,205/CRUISE_SPEED),maxArrival=Math.min(DURATION-16,s.progress+760/CRUISE_SPEED);
  const side=s.x>0?-1:1;
  for(let arrival=s.progress+minLead;arrival<=maxArrival;arrival+=1){
    if(occupied.some(other=>Math.abs(other-arrival)<separation))continue;
    const z=-(arrival-s.progress)*CRUISE_SPEED;
    for(const direction of [side,-side]){
      const x=clamp(s.x+direction*3,-6.2,6.2),y=clamp(s.y,-2.8,2.8);
      if(s.entities.some(e=>e.hp>0&&e.kind!=='portal'&&e.kind!=='shot'&&e.kind!=='hostile'&&Math.abs(e.z-z)<55&&Math.hypot(e.x-x,e.y-y)<e.radius+2.2))continue;
      return {x,y,z,arrival};
    }
  }
  return null;
}

export function cargoDamageMultiplier(s:Flight, source:DamageSource):number {
  const cargo=s.expedition&&CARGO[s.expedition.contract.cargoType];
  return cargo?cargo.damageMultiplier*(source==='field'||source==='explosion'?cargo.hazardMultiplier:1):1;
}
export function cargoTargetPressure(s:Flight):number{return s.expedition?CARGO[s.expedition.contract.cargoType].targetPressure*({low:1,medium:1.15,high:1.3}[s.expedition.contract.risk]):1;}
export function recordExpeditionDamage(s:Flight, hullDamage:number, cargoDamage:number, source:DamageSource){
  const r=s.expedition;if(!r)return;
  r.damageTaken+=hullDamage;r.cargoDamageTaken+=cargoDamage;
  if(source!=='cargo')r.instability=clamp(r.instability+(hullDamage+cargoDamage*.5)*CARGO[r.contract.cargoType].instabilityPerDamage,0,100);
}
export function recordEnemyDestroyed(s:Flight, e:Entity, credited:boolean){
  const r=s.expedition;if(!r||!credited||e.kind!=='pirate'||r.killedEnemyIds.includes(e.id))return;
  r.enemyKills++;r.killedEnemyIds.push(e.id);
}
export function recordItemCollected(s:Flight,e:Entity){
  const r=s.expedition;if(!r||r.collectedIds.includes(e.id))return;
  r.collectedIds.push(e.id);if(e.objectType==='shield-buoy')r.itemsCollected++;
}
const nearbyEnemies=(s:Flight)=>s.entities.filter(e=>e.hp>0&&e.kind==='pirate'&&e.z<20&&e.z> -240);

export function expeditionSnapshot(s:Flight):Pick<DirectorContext,'hull'|'maxHull'|'cargoIntegrity'|'currentCargo'|'performance'|'enemies'|'notableEvents'|'recentBehavior'|'recentObjectives'|'elapsed'|'routeProgress'|'instability'|'activeContract'|'availableTargets'|'effectiveCruise'|'shortcutBudget'|'deliveryTiming'> {
  const r=s.expedition, completed=r?.objectives.filter(o=>o.status==='completed')??[], failed=r?.objectives.filter(o=>o.status==='failed')??[];
  return {hull:s.hull,maxHull:s.maxHull,cargoIntegrity:s.cargo,currentCargo:r?.contract.cargoType??null,
    performance:{damageTaken:r?.damageTaken??s.maxHull-s.hull,kills:r?.enemyKills??0,itemsCollected:r?.itemsCollected??0,objectivesCompleted:completed.length,objectivesFailed:failed.length},
    enemies:{active:nearbyEnemies(s).length,bountyHunter:s.entities.some(e=>e.hp>0&&e.expeditionRole==='bounty_hunter'&&e.z<20)},
    notableEvents:r?.events.slice(-6).map(e=>e.type)??[],recentBehavior:[...(r&&r.enemyKills>=3?['aggressive_combat']:[]),...(r&&r.damageTaken<10&&s.time>20?['careful_flying']:[]),...(s.portalsUsed?['used_shortcut']:[]),...(s.cargo<45?['cargo_in_danger']:[])],
    recentObjectives:r?.objectives.slice(-5).flatMap(o=>o.definition.conditions.map(c=>c.type))??[],elapsed:s.time,routeProgress:clamp(s.progress/DURATION,0,1),instability:r?.instability??0,
    availableTargets:{shieldBuoys:s.entities.filter(e=>e.hp>0&&e.objectType==='shield-buoy'&&e.z< -120).length},
    effectiveCruise:s.cruise,
    ...(r?{shortcutBudget:{spawned:r.extraGatesSpawned,used:r.extraGatesUsed,limit:extraShortcutLimit(s)},
      ...(r.contract.speedBonus?{deliveryTiming:{elapsed:deliveryElapsed(s),fullBonusSeconds:r.contract.speedBonus.fullBonusSeconds,expiresSeconds:r.contract.speedBonus.expiresSeconds,extraGatesRemaining:Math.max(0,extraShortcutLimit(s)-r.extraGatesSpawned),shortcutEligible:shortcutPlacement(s)!==null}}:{}),
      activeContract:{risk:r.contract.risk,possibleThreats:r.contract.possibleThreats,possibleObjectives:r.contract.possibleObjectives,minimumCargoIntegrity:r.contract.minimumCargoIntegrity,...(r.contract.urgency?{urgency:r.contract.urgency}:{}),...(r.contract.speedBonus?{speedBonus:r.contract.speedBonus}:{})}}:{})};
}

/** A request may be made outside the frame loop; only a later physics tick applies it. */
export function queueDirectorDecision(s:Flight, decision:DirectorDecision, expectedContractId:string, source:DirectorSource, context?:DirectorContext):boolean {
  const r=s.expedition;if(!r||r.contract.id!==expectedContractId||s.status!=='flying'||r.settled||r.pending)return false;
  if(!decision||typeof decision!=='object'||(!decision.event&&!decision.bonusObjective))return false;
  if(decision.event&&(!EVENT_TYPES.includes(decision.event.type)||!RISKS.includes(decision.event.intensity)))return false;
  const o=decision.bonusObjective;
  if(o&&(!Array.isArray(o.conditions)||!o.conditions.length||o.conditions.length>2||!Number.isFinite(o.reward)||o.reward<0||o.reward>5000||typeof o.id!=='string'||typeof o.uiText!=='string'||o.conditions.some(c=>!c||typeof c!=='object'||!OBJECTIVE_TYPES.includes(c.type)||!Number.isFinite(c.successCondition)||c.duration!==null&&(!Number.isFinite(c.duration)||c.duration<5||c.duration>150))))return false;
  let validated:DirectorDecision;
  try{
    validated=validateDecision(decision,{sector:r.contract.sector,difficulty:'normal',upgrades:{hull:0,cruise:0},credits:0,previousContracts:[],seed:0,...context,...expeditionSnapshot(s)});
    if(validated.bonusObjective)validated.bonusObjective.id=o!.id.slice(0,120);
  }catch{return false;}
  // Copy the proposal so a pending response cannot later mutate engine decisions by reference.
  r.pending={decision:JSON.parse(JSON.stringify(validated)),contractId:expectedContractId,source,queuedAt:s.time,context};return true;
}
export function directorTrigger(s:Flight):string|null {
  const r=s.expedition;if(!r||s.status!=='flying'||r.settled||r.pending||s.time<8||s.progress>DURATION-20||s.time-r.lastRequestAt<15)return null;
  if(!r.events.length)return 'sector_entry';
  if(r.requestHull-s.hull>=15)return 'significant_damage';
  if(r.requestCargo-s.cargo>=15||s.cargo<35&&r.requestCargo>=35)return 'cargo_damaged';
  if(r.enemyKills-r.requestKills>=3)return 'aggressive_combat';
  if(r.objectives.filter(o=>o.status!=='active').length>r.requestObjectiveCount)return 'objective_resolved';
  return s.time-r.lastRequestAt>=22?'route_update':null;
}
export function markDirectorRequested(s:Flight){const r=s.expedition;if(!r)return;r.lastRequestAt=s.time;r.requestHull=s.hull;r.requestCargo=s.cargo;r.requestKills=r.enemyKills;r.requestObjectiveCount=r.objectives.filter(o=>o.status!=='active').length;}

function announce(s:Flight,text:string){const r=s.expedition;if(!r)return;r.announcement=text;r.announcementUntil=s.time+7;s.warning=text;}
function eventIsRelevant(s:Flight,event:EventProposal):boolean {
  const r=s.expedition!;if(s.progress>DURATION-16||s.time-r.lastEventAt<12||s.entities.length>MAX_ENTITIES-16)return false;
  if(event.type===r.events.at(-1)?.type&&event.type!=='shortcut_available')return false;
  if(event.type==='bounty_hunter')return r.contract.cargoType==='high_value_technology'&&!s.entities.some(e=>e.hp>0&&e.expeditionRole==='bounty_hunter');
  if(event.type==='pirate_pursuit')return r.contract.cargoType==='navigation_computers';
  if(event.type==='cargo_instability')return r.contract.cargoType==='volatile_fuel';
  if(event.type==='repair_opportunity')return s.cargo<85||s.hull<s.maxHull*.8;
  if(event.type==='enemy_reinforcement')return r.enemyKills>=2;
  if(event.type==='shortcut_available')return shortcutPlacement(s)!==null;
  return true;
}
function applyEvent(s:Flight,event:EventProposal,source:DirectorSource){
  const r=s.expedition!;if(!eventIsRelevant(s,event))return false;
  const level=RISKS.indexOf(event.intensity),lead=-clamp(CRUISE_SPEED*s.speed*7,205,560),side=s.x>0?-1:1;
  const spawn=(type:ObjectType,x:number,y:number,z=lead)=>spawnObject(s,type,clamp(x,-6.5,6.5),clamp(y,-3.5,3.5),z);
  let targetId:number|undefined;
  switch(event.type){
    case 'pirate_ambush':case 'enemy_reinforcement':
      spawn(level===2?'saucer-cruiser':'pirate',s.x+side*3,s.y+1);if(level>0)spawn('twinwing-fighter',s.x-side*3,s.y-1,lead-85);
      break;
    case 'asteroid_wave':
      spawn('ice-asteroid',s.x-3.5,s.y);spawn(level===2?'volatile-rock':'iron-asteroid',s.x+3.5,s.y+.5,lead-65);announce(s,'ASTEROID WAVE — keep a clear flight line');break;
    case 'bounty_hunter':{
      const e=spawn(level===2?'wedge-destroyer':'pirate',s.x+side*2,s.y);e.expeditionRole='bounty_hunter';targetId=e.id;break;}
    case 'pirate_pursuit':{
      const e=spawn('twinwing-fighter',s.x+side*3,s.y);e.expeditionRole='pursuer';targetId=e.id;break;}
    case 'repair_opportunity':{
      const e=spawn('repair-pod',s.x+side*2,s.y,Math.max(lead,-260));e.expeditionRole='repair';targetId=e.id;announce(s,'REPAIR OPPORTUNITY — intercept the green relief capsule');break;}
    case 'cargo_instability':
      r.instability=clamp(r.instability+20+level*10,0,100);announce(s,'CARGO INSTABILITY — avoid hits while the fuel cools');break;
    case 'shortcut_available':{
      const placement=shortcutPlacement(s);if(!placement)return false;
      const e=spawn('portal',placement.x,placement.y,placement.z);e.radius=3.1;e.expeditionRole='shortcut';targetId=e.id;
      r.extraGatesSpawned++;r.shortcutIds.push(e.id);r.shortcutArrivals.push(placement.arrival);r.lastShortcutAt=s.time;
      announce(s,'NEW ROUTE AVAILABLE — priority shortcut ahead');break;}
  }
  r.events.push({...event,at:s.time,source,...(targetId!==undefined?{targetId}:{})});r.lastEventAt=s.time;
  return true;
}

function activateObjective(s:Flight,definition:BonusObjective,source:DirectorSource){
  const r=s.expedition!;if(r.objectives.length>=8||r.objectives.filter(o=>o.status==='active').length>=2||r.objectives.some(o=>o.definition.id===definition.id))return;
  const target=s.entities.find(e=>e.expeditionRole==='bounty_hunter'&&e.hp>0&&e.z<0);
  if(definition.conditions.some(c=>c.target==='bounty_hunter')&&!target)return;
  if(definition.conditions.some(c=>c.type==='COLLECT_ITEM')&&!s.entities.some(e=>e.hp>0&&e.objectType==='shield-buoy'&&e.z< -120))return;
  r.objectives.push({definition,status:'active',startedAt:s.time,source,startDamage:r.damageTaken,startCargoDamage:r.cargoDamageTaken,startKills:r.enemyKills,startItems:r.itemsCollected,targetId:target?.id,sawEnemies:nearbyEnemies(s).length>0,conditionsComplete:definition.conditions.map(()=>false)});
  if(target&&definition.conditions.some(c=>c.type==='DESTROY_TARGET'&&c.target==='bounty_hunter'))target.objectiveTarget=true;
  announce(s,'BONUS OBJECTIVE — '+definition.uiText);
}

function evaluateObjectives(s:Flight){
  const r=s.expedition!;
  for(const objective of r.objectives){
    if(objective.status!=='active')continue;
    const elapsed=s.time-objective.startedAt;objective.sawEnemies ||= nearbyEnemies(s).length>0;
    let failed=s.status==='lost', complete=true;
    for(const [index,condition] of objective.definition.conditions.entries()){
      if(objective.conditionsComplete[index])continue;
      const {type,target,successCondition,duration}=condition;const expired=duration!==null&&elapsed+1e-6>=duration;let done=false;
      switch(type){
        case 'REACH_WARP_GATE':done=s.status==='delivered';break;
        case 'MAINTAIN_CARGO_INTEGRITY':failed ||= s.cargo+1e-6<successCondition;done=duration===null?s.status==='delivered':expired;break;
        case 'DESTROY_TARGET':
          done=target==='bounty_hunter'?objective.targetId!==undefined&&r.killedEnemyIds.includes(objective.targetId):r.enemyKills-objective.startKills>=successCondition;
          if(target==='bounty_hunter'&&!done&&objective.targetId!==undefined&&!s.entities.some(e=>e.id===objective.targetId&&e.hp>0))failed=true;
          break;
        case 'SURVIVE_DURATION':done=expired;break;
        case 'AVOID_DAMAGE':failed ||= (target==='cargo'?r.cargoDamageTaken-objective.startCargoDamage:r.damageTaken-objective.startDamage)>1e-6;done=expired;break;
        case 'COMPLETE_WITHIN_TIME':done=s.status==='delivered'&&(duration===null||elapsed<=duration+1e-6);failed ||= expired&&!done;break;
        case 'ESCAPE_ENEMIES':done=objective.sawEnemies&&(expired||s.status==='delivered')&&nearbyEnemies(s).length<=successCondition;failed ||= expired&&!done;break;
        case 'COLLECT_ITEM':done=r.itemsCollected-objective.startItems>=successCondition;break;
      }
      if(expired&&!done&&type!=='MAINTAIN_CARGO_INTEGRITY')failed=true;
      if(done)objective.conditionsComplete[index]=true;
      complete &&= done;
    }
    if(s.status!=='flying'&&!complete)failed=true;
    if(failed)objective.status='failed';else if(complete)objective.status='completed';
    if(objective.status!=='active'&&objective.targetId!==undefined&&!r.objectives.some(o=>o!==objective&&o.status==='active'&&o.targetId===objective.targetId)){
      const target=s.entities.find(e=>e.id===objective.targetId);if(target)target.objectiveTarget=false;
    }
    if(objective.status!=='active')announce(s,objective.status==='completed'?'BONUS COMPLETE — '+objective.definition.uiText:'BONUS MISSED — '+objective.definition.uiText);
  }
}

/** Called exactly once per fixed physics tick; all durations use simulation time. */
export function stepExpedition(s:Flight,dt:number){
  const r=s.expedition;if(!r||r.settled)return;
  if(s.status==='flying'){
    const pending=r.pending;r.pending=null;
    if(pending&&pending.contractId===r.contract.id&&s.time-pending.queuedAt<25){
      const context:DirectorContext={sector:r.contract.sector,difficulty:'normal',upgrades:{hull:0,cruise:0},credits:0,previousContracts:[],seed:0,...pending.context,...expeditionSnapshot(s)};
      try{
        const decision=validateDecision(pending.decision,context);
        const eventApplied=!decision.event||applyEvent(s,decision.event,pending.source);
        if(eventApplied&&decision.bonusObjective){decision.bonusObjective.id=pending.decision.bonusObjective!.id.slice(0,120);activateObjective(s,decision.bonusObjective,pending.source);}
      }catch{/* A stale or illegal proposal has no authority to change a running flight. */}
    }
    // Urgent deliveries retain a bounded local opportunity if the model never offers one.
    // The same placement and event-budget checks apply; only active flight time advances this check.
    if(r.contract.speedBonus&&s.time>=20&&s.time-r.lastShortcutCheckAt>=1&&s.time-r.lastRequestAt>=7){
      r.lastShortcutCheckAt=s.time;
      const projected=deliveryElapsed(s)+(DURATION-s.progress)/s.cruise;
      if(projected>r.contract.speedBonus.fullBonusSeconds&&deliveryElapsed(s)<r.contract.speedBonus.expiresSeconds&&shortcutPlacement(s)){
        const context:DirectorContext={sector:r.contract.sector,difficulty:'normal',upgrades:{hull:0,cruise:0},credits:0,previousContracts:[],seed:0,...expeditionSnapshot(s)};
        try{const decision=validateDecision({event:{type:'shortcut_available',intensity:'low'},bonusObjective:null},context);if(decision.event)applyEvent(s,decision.event,'fallback');}catch{/* Context has changed; retry only after the next bounded check. */}
      }
    }
    const cargo=CARGO[r.contract.cargoType];r.instability=Math.max(0,r.instability-dt*(s.time-r.lastSurgeAt<1?.3:1.1));
    if(r.instability>=65&&s.time-r.lastSurgeAt>=4){r.lastSurgeAt=s.time;damage(s,2+r.instability/25,1.5,'cargo');announce(s,'CARGO SURGE — unstable fuel is damaging the ship');}
    if(cargo.lifeSupportDrain)s.cargo=Math.max(0,s.cargo-cargo.lifeSupportDrain*dt*(s.field?cargo.hazardMultiplier*5:1));
    for(const e of s.entities){if(e.hp>0&&e.expeditionRole==='repair'&&Math.hypot(e.x-s.x,e.y-s.y,e.z)<e.radius+1){e.hp=0;s.hull=Math.min(s.maxHull,s.hull+18);s.cargo=Math.min(100,s.cargo+8);recordItemCollected(s,e);announce(s,'RELIEF CAPSULE SECURED — hull and cargo stabilized');}}
  }
  // Objective outcomes are evaluated after collision handling in settleExpedition.
}

/** Terminal gate evaluation happens after the simulation decides arrival versus death. */
export function settleExpedition(s:Flight){const r=s.expedition;if(!r||r.settled)return;evaluateObjectives(s);if(s.status!=='flying'){r.pending=null;r.settled=true;}}
