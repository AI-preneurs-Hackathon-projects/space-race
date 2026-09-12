import {clamp,FLEET,type Hull,type Mission,type Encounter} from './types';
export type Upgrade='hull'|'cruise';
export const HULL_STEP=15,HULL_CAP=5,CRUISE_STEP=.05,CRUISE_CAP=4;
export type Campaign={stage:number;hullUpgrades:number;cruiseUpgrades:number;attempt:number;seed:number;status:'ready'|'flying'|'lost'|'cleared';lastPortals:{x:number;y:number}[]};
export const newCampaign=(seed:number):Campaign=>({stage:1,hullUpgrades:0,cruiseUpgrades:0,attempt:0,seed:seed>>>0,status:'ready',lastPortals:[]});
export function effectiveHull(base:Hull,c:Campaign):Hull{return {...base,armor:base.armor+c.hullUpgrades*HULL_STEP,cruise:1+c.cruiseUpgrades*CRUISE_STEP};}
export function difficulty(stage:number){const tier=clamp(Math.floor(stage),1,9),t=(tier-1)/8;return {tier,label:tier===1?'PATROL':tier<4?'CONTESTED':tier<7?'HOSTILE':'EXTREME',waves:20+Math.round(t*8),gapWidth:5.5-t,portalRadius:3.4-t*.75,pirateMotion:.35+t*1.25,pirateInterval:2.15-t*.65,volley:tier>=5?2:1};}
function random(seed:number){let n=seed>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
export function stageMission(stage:number,seed:number,previous:{x:number;y:number}[]=[],template?:Mission):Mission{
 const d=difficulty(stage),rand=random(seed),events:Encounter[]=[],portals:{x:number;y:number}[]=[];
 for(let i=0;i<2;i++){let p={x:0,y:0};for(let tries=0;tries<20;tries++){p={x:(rand()<.5?-1:1)*(4.6+rand()*1.6),y:(rand()*2-1)*2.8};if(!previous[i]||Math.hypot(p.x-previous[i].x,p.y-previous[i].y)>3)break;}if(previous[i]&&Math.hypot(p.x-previous[i].x,p.y-previous[i].y)<=3)p={x:-previous[i].x,y:-previous[i].y};portals.push(p);}
 let gapX=0,gapY=0;const portalIndices=[Math.round(d.waves*.19),Math.round(d.waves*.65)];
 const ai=template?.source==='openai'?template.events.filter(e=>e.kind!=='portal'):undefined;
 for(let i=0;i<d.waves;i++){
  const at=4+i*(118/(d.waves-1)),portalIndex=portalIndices.indexOf(i);
  if(portalIndex>=0){events.push({at,kind:'portal',...portals[portalIndex],count:1,portalRadius:d.portalRadius});continue;}
  const usePirate=ai?ai[i%ai.length]?.kind==='pirate':i%5===3||(d.tier>=5&&i%7===5);
  if(usePirate){events.push({at,kind:'pirate',x:(rand()*2-1)*6.8,y:(rand()*2-1)*3.3,count:d.tier>=4?2:1});continue;}
  const axis=i%3===0?'y':'x';gapX=clamp(gapX+(rand()*2-1)*5,-5.5,5.5);gapY=clamp(gapY+(rand()*2-1)*3,-2.3,2.3);
  const center=axis==='x'?gapX:gapY,half=d.gapWidth/2,radius=1.65,points:{x:number;y:number;radius:number}[]=[];
  // A continuous rock curtain has one broad, genuinely empty escape lane.
  const extent=axis==='x'?10:6.5,other=axis==='x'?[-6,-3,0,3,6]:[-10.5,-7.5,-4.5,-1.5,1.5,4.5,7.5,10.5];
  for(const sign of [-1,1])for(let p=center+sign*(half+radius);Math.abs(p)<=extent+radius;p+=sign*3){for(const q of other)points.push({x:axis==='x'?p:q,y:axis==='x'?q:p,radius});}
  // Early stages mix open pairs with gates; later stages consistently demand lane changes.
  const full=i%3!==1||d.tier>=4;
  events.push({at,kind:'asteroid',x:gapX,y:gapY,count:1,points:full?points:points.filter((_,j)=>j%3===0),gap:{axis,center,halfWidth:half,x:gapX,y:gapY}});
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
