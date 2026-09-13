export type Hull = { id: string; name: string; role: string; color: string; widths: number[]; thickness: number; engines: number; handling: number; armor: number; cruise?:number; origin: "fleet" | "local" | "openai" };
export type DifficultySetting='easy'|'normal'|'hard';
export type FlightCondition={hull:number;cargo:number};
export type ArrivalCondition=FlightCondition&{maxHull:number;stage:number};
export type DirectorBeat={objectType:Exclude<ObjectType,'portal'>;pace:'calm'|'steady'|'intense'};
export type SectionPlan={title:string;beats:DirectorBeat[]};
export const FLEET: Hull[] = [
  { id:"kestrel",name:"Kestrel",role:"Balanced courier",color:"#f2a35c",widths:[.08,.32,.5,1.1,2,2.1,1.65,.8,.6],thickness:.42,engines:2,handling:1,armor:100,origin:"fleet" },
  { id:"wraith",name:"Wraith",role:"Light interceptor",color:"#7be4de",widths:[.06,.2,.35,.46,.65,1.95,2.15,.95,.4],thickness:.28,engines:2,handling:1.3,armor:80,origin:"fleet" },
  { id:"atlas",name:"Atlas",role:"Armored transporter",color:"#c3a4ef",widths:[.35,.65,.88,1.25,1.9,1.95,1.95,1.5,1.25],thickness:.68,engines:3,handling:.82,armor:125,origin:"fleet" },
];
import type { ObjectType } from './objects';
export type EncounterKind = "asteroid" | "pirate" | "portal" | "object";
/** at is a route-progress coordinate in normal-speed course-seconds, not wall time. */
export type Encounter = { at:number; arrival?:number; kind:EncounterKind; x:number; y:number; count:number; objectType?:ObjectType; escort?:ObjectType; drift?:number; points?:{x:number;y:number;radius:number}[]; gap?:{axis:string;center:number;halfWidth:number;x:number;y:number}; portalRadius?:number };
export type Mission = { deliveryElapsed?:number; deliveryShortcuts?:{spawned:number;used:number}; contract?:import('./contracts').Contract; title:string; events:Encounter[]; source:"openai"|"practice"; note:string;director?:SectionPlan;stage?:number;seed?:number;attempt?:number;challenge?:{tier:number;label:string;waves:number;gapWidth:number;portalRadius:number;pirateMotion:number;pirateInterval:number;aimLead?:number;bulletSpeed?:number;volley:number} };
export const DURATION = 150;
export const CRUISE_SPEED = 29;
export const WARP_MAX_SPEED = 3;
export const WARP_DURATION = 8;
export const MAX_PORTALS = 2;
export const ARRIVAL_START = DURATION - 12;
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function practiceMission():Mission {
  const events:Encounter[]=[];
  const times=[4,8,12,16,22,30,34,38,42,47,51,55,59,64,68,72,76,80,86,94,98,102,106,110,114,118,122,126,130,134];
  for(let i=0;i<times.length;i++){
    const portal=times[i]===22||times[i]===86;
    events.push({at:times[i],kind:portal?"portal":i%4===1||i%5===3?"pirate":"asteroid",x:portal?0:Math.sin(i*2.4)*6.2,y:portal?0:Math.cos(i*1.8)*3.1,count:portal?1:i%4===2?2:1});
  }
  return {title:"The Kepler passage",source:"practice",note:"Practice route · local encounters",events};
}
export function validateHull(value:unknown):Hull {
  const v=value as Record<string,unknown>;
  if(!v || !Array.isArray(v.widths)||v.widths.length!==9 || !v.widths.every(n=>typeof n==="number"&&Number.isFinite(n)) || typeof v.thickness!=="number"||!Number.isFinite(v.thickness)||typeof v.engines!=="number"||!Number.isFinite(v.engines)) throw new Error("The ship design was incomplete. Try another outline.");
  return { ...FLEET[0],id:"custom",name:typeof v.name==="string"?v.name.slice(0,24):"Your creation",role:"Custom courier",widths:v.widths.map(n=>clamp(n,.08,2.2)),thickness:clamp(v.thickness,.25,.8),engines:Math.round(clamp(v.engines,1,3)),color:"#80e6da",origin:"openai" };
}
export function validateMission(value:unknown):Mission {
  const v=value as Record<string,unknown>;
  if(!v||!Array.isArray(v.events)||v.events.length<10||v.events.length>40)throw new Error("The director returned an incomplete route.");
  // Accept saved first-version plans internally and expand them to the longer route.
  const legacy=v.events.some(e=>e?.kind==="blackhole") || (v.events.length<=20&&v.events.every(e=>e?.at<=64));
  const events:Encounter[]=v.events.map(e=>{
    if(!e||!["asteroid","pirate","portal","blackhole"].includes(e.kind)||![e.at,e.x,e.y,e.count].every(Number.isFinite))throw new Error("Invalid encounter plan.");
    const kind=e.kind==="blackhole"?"portal":e.kind;
    return {at:clamp(e.at*(legacy?2:1),4,134),kind,x:clamp(e.x,-7,7),y:clamp(e.y,-4,4),count:kind==="portal"?1:Math.round(clamp(e.count,1,2))};
  }).sort((a,b)=>a.at-b.at);
  let last=0,portals=0,lastPortal=-100;
  const safe=events.flatMap(e=>{
    e.at=Math.max(e.at,last+3.5);
    if(e.kind==="portal"){
      if(portals>=MAX_PORTALS||e.at>116||e.at-lastPortal<30)e.kind="asteroid";
      else {portals++;lastPortal=e.at;e.x=clamp(e.x,-4,4);e.y=clamp(e.y,-2,2);}
    }
    if(e.at>134)return [];last=e.at;return [e];
  });
  if(safe.length<10)throw new Error("The route did not leave enough reaction time.");
  return {title:typeof v.title==="string"?v.title.slice(0,45):"The Kepler passage",events:safe,source:"openai",note:"OpenAI director · route ready"};
}
