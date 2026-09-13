import {clamp,FLEET,DURATION,type Hull,type Mission,type Encounter,type DifficultySetting,type ArrivalCondition,type FlightCondition} from './types';
import {stageEnvironment} from './stage-environment';
import {OBJECTS,isField,isShip,type ObjectType} from './objects';
export type Upgrade='hull'|'cruise';
export const HULL_STEP=15,HULL_CAP=5,CRUISE_STEP=.05,CRUISE_CAP=4;
export type Campaign={stage:number;hullUpgrades:number;cruiseUpgrades:number;attempt:number;seed:number;status:'ready'|'flying'|'lost'|'cleared';lastPortals:{x:number;y:number}[];difficulty:DifficultySetting;cargo:number;hull:number|null;arrival:ArrivalCondition|null};
export const newCampaign=(seed:number):Campaign=>({stage:1,hullUpgrades:0,cruiseUpgrades:0,attempt:0,seed:seed>>>0,status:'ready',lastPortals:[],difficulty:'normal',cargo:100,hull:null,arrival:null});
export function effectiveHull(base:Hull,c:Campaign):Hull{return {...base,armor:base.armor+c.hullUpgrades*HULL_STEP,cruise:1+c.cruiseUpgrades*CRUISE_STEP};}
/** A bounded curve keeps progressing after stage nine without exponential fire/health growth. */
export function difficulty(stage:number,setting:DifficultySetting='normal'){
 const tier=Math.max(1,Math.floor(Number.isFinite(stage)?stage:1)),pressure=(tier-1)/(tier+11),level=setting==='easy'?-1:setting==='hard'?1:0;
 return {tier,label:tier<3?'CONTESTED':tier<7?'HOSTILE':tier<13?'EXTREME':'DEEP SPACE',waves:32+Math.round(pressure*4)+(level<0?-4:level*2),gapWidth:4.8-pressure*.8-level*.3,portalRadius:3.25-pressure*.5-level*.15,pirateMotion:(.8+pressure*1.2)*(1+level*.12),pirateInterval:(1.9-pressure*.8)*(1-level*.12),aimLead:(.22+pressure*.28)*(1+level*.1),bulletSpeed:(30+pressure*12)*(1+level*.08),volley:tier>=(level<0?7:level>0?3:4)?2:1};
}
function random(seed:number){let n=seed>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function stageMission(stage:number,seed:number,previous:{x:number;y:number}[]=[],template?:Mission,setting:DifficultySetting='normal'):Mission{
 const d=difficulty(stage,setting),rand=random(seed),events:Encounter[]=[],portals:{x:number;y:number}[]=[];
 for(let i=0;i<2;i++){let p={x:0,y:0};for(let tries=0;tries<20;tries++){p={x:(rand()<.5?-1:1)*(4.6+rand()*1.6),y:(rand()*2-1)*2.8};if(!previous[i]||Math.hypot(p.x-previous[i].x,p.y-previous[i].y)>3)break;}if(previous[i]&&Math.hypot(p.x-previous[i].x,p.y-previous[i].y)<=3)p={x:-previous[i].x,y:-previous[i].y};portals.push(p);}
 let gapX=0,gapY=0,objectIndex=0;const portalIndices=[5,19];
 const ai=template?.source==='openai'&&template.director?.beats.length===d.waves-2?template.director.beats:undefined;
 const weights=Array.from({length:d.waves-1},(_,i)=>{const pace=ai?.[Math.min(ai.length-1,i)]?.pace;return pace==='calm'?2:pace==='intense'?.25:1;});
 const extra=DURATION-12-3.5*(d.waves-1),weightSum=weights.reduce((a,b)=>a+b,0);let plannedArrival=8,shipStreak=0,fieldStreak=0;
 const maxShipStreak=setting==='easy'?1:setting==='hard'?3:2;
 const roster:ObjectType[]=['ice-asteroid','pirate','fuel-tank','volatile-rock','repair-pod','moon','twinwing-fighter','cargo-crate','repulsor','saucer-cruiser','ice-asteroid','shield-buoy','blackhole','solar-satellite','missile','iron-asteroid','wedge-destroyer','pirate','twinwing-fighter','saucer-cruiser','wedge-destroyer'];
 for(let i=0;i<d.waves;i++){
  if(i>0)plannedArrival+=3.5+extra*weights[i-1]/weightSum;
  const arrival=ai?plannedArrival:8+i*((DURATION-12)/(d.waves-1)),at=Math.max(0,arrival-22),portalIndex=portalIndices.indexOf(i);
  if(portalIndex>=0){events.push({at,arrival,kind:'portal',objectType:'portal',...portals[portalIndex],count:1,portalRadius:d.portalRadius});continue;}
  let id=ai?.[objectIndex]?.objectType??roster[(objectIndex+(stage-1)*5)%roster.length];objectIndex++;
  // The director controls composition throughout the section; local formations and bounded streaks preserve escape space.
  if(isShip(id)&&shipStreak>=maxShipStreak||isField(id)&&fieldStreak>=1)id='ice-asteroid';
  shipStreak=isShip(id)?shipStreak+1:0;fieldStreak=isField(id)?fieldStreak+1:0;
  const spec=OBJECTS[id],sign=rand()<.5?-1:1;
  if(isField(id)){events.push({at,arrival,kind:'object',objectType:id,x:sign*(spec.radius+5.6),y:(rand()-.5)*3,count:1});continue;}
  if(isShip(id)){events.push({at,arrival,kind:'pirate',objectType:id,x:sign*(1.5+rand()*2),y:(rand()-.5)*4,count:1,escort:i%2===0?'fuel-tank':'volatile-rock'});continue;}
  if(spec.family==='rock'){
   gapX=(gapX>=0?-1:1)*(2.3+rand()*.2);gapY=(rand()-.5)*(.6+Math.min(1,(stage-1)/12));
   const half=d.gapWidth/2,rad=spec.radius;
   const points=[{x:gapX-half-rad-.4,y:gapY,radius:rad},{x:gapX+half+rad+.4,y:gapY+(rand()-.5),radius:rad}];
   if(d.tier>=4&&rand()<.35+(d.tier-1)/(d.tier+11)*.65)points.push({x:gapX,y:gapY+(gapY>0?-1:1)*(half+rad+1),radius:rad});
   events.push({at,arrival,kind:'asteroid',objectType:id,x:gapX,y:gapY,count:1,points,gap:{axis:'x',center:gapX,halfWidth:half,x:gapX,y:gapY},drift:0});continue;
  }
  events.push({at,arrival,kind:'object',objectType:id,x:spec.collect?sign*(1.5+rand()*2):sign*(2.5+rand()*3),y:(rand()-.5)*4,count:1,drift:id==='missile'?0:(rand()-.5)*.7});
 }
 return {title:`${stageEnvironment(stage).name} passage`,source:ai?'openai':'practice',note:ai?'AI section plan · bounded flight lanes':'Seeded local stage',director:ai?template?.director:undefined,events,stage,seed,challenge:d};
}
export function launchCondition(c:Campaign,hull:Hull):FlightCondition{return {hull:c.status==='lost'?hull.armor:Math.min(hull.armor,c.hull??hull.armor),cargo:c.status==='lost'?100:c.cargo};}
export function beginAttempt(c:Campaign,template?:Mission){
 if(c.status==='cleared'||c.status==='flying')return null;
 const ready=c.status==='lost'?{...c,hull:null,cargo:100,arrival:null}:c;
 if(ready.cargo<=0||ready.hull!==null&&ready.hull<=0)return null;
 const attempt=ready.attempt+1,seed=(ready.seed^Math.imul(attempt,0x9e3779b1)^Math.imul(ready.stage,0x85ebca6b))>>>0;
 const mission=stageMission(ready.stage,seed,ready.lastPortals,template,ready.difficulty);mission.attempt=attempt;
 return {campaign:{...ready,attempt,status:'flying' as const,lastPortals:mission.events.filter(e=>e.kind==='portal').map(({x,y})=>({x,y}))},mission};
}
export function finishAttempt(c:Campaign,attempt:number,status:'delivered'|'lost',condition?:FlightCondition&{maxHull:number;arrivalHull:number|null}):Campaign{
 if(c.status!=='flying'||attempt!==c.attempt)return c;
 const cargo=Math.min(c.cargo,condition?.cargo??c.cargo),hull=condition?.hull??c.hull;
 const cleared=status==='delivered'&&cargo>0&&(hull===null||hull>0);
 return {...c,cargo,hull:cleared?null:hull,status:cleared?'cleared':'lost',arrival:cleared&&condition?{stage:c.stage,hull:condition.arrivalHull??condition.hull,maxHull:condition.maxHull,cargo}:c.arrival};
}
export function chooseUpgrade(c:Campaign,kind:Upgrade|'continue'):Campaign{
 if(c.status!=='cleared'||c.cargo<=0)return c;
 if(kind==='hull'&&c.hullUpgrades>=HULL_CAP||kind==='cruise'&&c.cruiseUpgrades>=CRUISE_CAP||kind==='continue'&&(c.hullUpgrades<HULL_CAP||c.cruiseUpgrades<CRUISE_CAP))return c;
 return {...c,stage:c.stage+1,status:'ready',hull:null,hullUpgrades:c.hullUpgrades+(kind==='hull'?1:0),cruiseUpgrades:c.cruiseUpgrades+(kind==='cruise'?1:0)};
}
export function leaveFlight(c:Campaign,condition?:FlightCondition):Campaign{
 if(c.status!=='flying')return c;
 const cargo=Math.min(c.cargo,condition?.cargo??c.cargo),hull=condition?.hull??c.hull;
 return {...c,hull,cargo,status:cargo<=0||hull!==null&&hull<=0?'lost':'ready'};
}
