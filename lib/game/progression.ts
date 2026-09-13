import {clamp,FLEET,type Hull,type Mission,type Encounter} from './types';
import {OBJECTS,isField,isShip,type ObjectType} from './objects';
export type Upgrade='hull'|'cruise';
export const HULL_STEP=15,HULL_CAP=5,CRUISE_STEP=.05,CRUISE_CAP=4;
export type Campaign={stage:number;hullUpgrades:number;cruiseUpgrades:number;attempt:number;seed:number;status:'ready'|'flying'|'lost'|'cleared';lastPortals:{x:number;y:number}[]};
export const newCampaign=(seed:number):Campaign=>({stage:1,hullUpgrades:0,cruiseUpgrades:0,attempt:0,seed:seed>>>0,status:'ready',lastPortals:[]});
export function effectiveHull(base:Hull,c:Campaign):Hull{return {...base,armor:base.armor+c.hullUpgrades*HULL_STEP,cruise:1+c.cruiseUpgrades*CRUISE_STEP};}
/** A bounded curve keeps progressing after stage nine without exponential fire/health growth. */
export function difficulty(stage:number){
 const tier=Math.max(1,Math.floor(Number.isFinite(stage)?stage:1)),pressure=(tier-1)/(tier+11);
 return {tier,label:tier<3?'CONTESTED':tier<7?'HOSTILE':tier<13?'EXTREME':'DEEP SPACE',waves:32+Math.round(pressure*4),gapWidth:4.8-pressure*.8,portalRadius:3.25-pressure*.5,pirateMotion:.8+pressure*1.2,pirateInterval:1.9-pressure*.8,aimLead:.22+pressure*.28,bulletSpeed:30+pressure*12,volley:tier>=4?2:1};
}
function random(seed:number){let n=seed>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function stageMission(stage:number,seed:number,previous:{x:number;y:number}[]=[],template?:Mission):Mission{
 const d=difficulty(stage),rand=random(seed),events:Encounter[]=[],portals:{x:number;y:number}[]=[];
 for(let i=0;i<2;i++){let p={x:0,y:0};for(let tries=0;tries<20;tries++){p={x:(rand()<.5?-1:1)*(4.6+rand()*1.6),y:(rand()*2-1)*2.8};if(!previous[i]||Math.hypot(p.x-previous[i].x,p.y-previous[i].y)>3)break;}if(previous[i]&&Math.hypot(p.x-previous[i].x,p.y-previous[i].y)<=3)p={x:-previous[i].x,y:-previous[i].y};portals.push(p);}
 let gapX=0,gapY=0,objectIndex=0;const portalIndices=[5,19];
 const ai=template?.source==='openai'?template.events.filter(e=>e.kind!=='portal'):undefined;
 const roster:ObjectType[]=['ice-asteroid','pirate','fuel-tank','volatile-rock','repair-pod','moon','twinwing-fighter','cargo-crate','repulsor','saucer-cruiser','ice-asteroid','shield-buoy','blackhole','solar-satellite','missile','iron-asteroid','wedge-destroyer','pirate','twinwing-fighter','saucer-cruiser','wedge-destroyer'];
 for(let i=0;i<d.waves;i++){
  const at=3+i*(108/(d.waves-1)),portalIndex=portalIndices.indexOf(i);
  if(portalIndex>=0){events.push({at,kind:'portal',objectType:'portal',...portals[portalIndex],count:1,portalRadius:d.portalRadius});continue;}
  let id=roster[(objectIndex+++(stage-1)*5)%roster.length];
  // A model plan can vary extra waves; the core roster and safe coordinates stay local.
  if(ai&&i>=26&&ai[i%ai.length]?.kind==='pirate')id='pirate';
  const spec=OBJECTS[id],sign=rand()<.5?-1:1;
  if(isField(id)){events.push({at,kind:'object',objectType:id,x:sign*(spec.radius+5.6),y:(rand()-.5)*3,count:1});continue;}
  if(isShip(id)){events.push({at,kind:'pirate',objectType:id,x:sign*(1.5+rand()*2),y:(rand()-.5)*4,count:1,escort:i%2===0?'fuel-tank':'volatile-rock'});continue;}
  if(spec.family==='rock'){
   gapX=(gapX>=0?-1:1)*(2.3+rand()*.2);gapY=(rand()-.5)*(.6+Math.min(1,(stage-1)/12));
   const half=d.gapWidth/2,rad=spec.radius;
   const points=[{x:gapX-half-rad-.4,y:gapY,radius:rad},{x:gapX+half+rad+.4,y:gapY+(rand()-.5),radius:rad}];
   if(d.tier>=4&&rand()<.35+(d.tier-1)/(d.tier+11)*.65)points.push({x:gapX,y:gapY+(gapY>0?-1:1)*(half+rad+1),radius:rad});
   events.push({at,kind:'asteroid',objectType:id,x:gapX,y:gapY,count:1,points,gap:{axis:'x',center:gapX,halfWidth:half,x:gapX,y:gapY},drift:0});continue;
  }
  events.push({at,kind:'object',objectType:id,x:spec.collect?sign*(1.5+rand()*2):sign*(2.5+rand()*3),y:(rand()-.5)*4,count:1,drift:id==='missile'?0:(rand()-.5)*.7});
 }
 return {title:'The Kepler passage',source:ai?'openai':'practice',note:ai?'AI plan · local stage safety':'Seeded local stage',events,stage,seed,challenge:d};
}
export function beginAttempt(c:Campaign,template?:Mission){if(c.status==='cleared'||c.status==='flying')return null;const attempt=c.attempt+1,seed=(c.seed^Math.imul(attempt,0x9e3779b1)^Math.imul(c.stage,0x85ebca6b))>>>0;const mission=stageMission(c.stage,seed,c.lastPortals,template);mission.attempt=attempt;return {campaign:{...c,attempt,status:'flying' as const,lastPortals:mission.events.filter(e=>e.kind==='portal').map(({x,y})=>({x,y}))},mission};}
export function finishAttempt(c:Campaign,attempt:number,status:'delivered'|'lost'):Campaign{return c.status==='flying'&&attempt===c.attempt?{...c,status:status==='delivered'?'cleared':'lost'}:c;}
export function chooseUpgrade(c:Campaign,kind:Upgrade|'continue'):Campaign{
 if(c.status!=='cleared')return c;
 if(kind==='hull'&&c.hullUpgrades>=HULL_CAP||kind==='cruise'&&c.cruiseUpgrades>=CRUISE_CAP||kind==='continue'&&(c.hullUpgrades<HULL_CAP||c.cruiseUpgrades<CRUISE_CAP))return c;
 return {...c,stage:c.stage+1,status:'ready',hullUpgrades:c.hullUpgrades+(kind==='hull'?1:0),cruiseUpgrades:c.cruiseUpgrades+(kind==='cruise'?1:0)};
}
export function leaveFlight(c:Campaign):Campaign{return c.status==='flying'?{...c,status:'ready'}:c;}
