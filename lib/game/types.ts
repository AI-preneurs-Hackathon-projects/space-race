export type Hull = { id: string; name: string; role: string; color: string; widths: number[]; thickness: number; engines: number; handling: number; armor: number; origin: "fleet" | "local" | "openai" };
export const FLEET: Hull[] = [
  { id:"kestrel",name:"Kestrel",role:"Balanced courier",color:"#f2a35c",widths:[.08,.32,.5,1.1,2,2.1,1.65,.8,.6],thickness:.42,engines:2,handling:1,armor:100,origin:"fleet" },
  { id:"wraith",name:"Wraith",role:"Light interceptor",color:"#7be4de",widths:[.06,.2,.35,.46,.65,1.95,2.15,.95,.4],thickness:.28,engines:2,handling:1.3,armor:80,origin:"fleet" },
  { id:"atlas",name:"Atlas",role:"Armored transporter",color:"#c3a4ef",widths:[.35,.65,.88,1.25,1.9,1.95,1.95,1.5,1.25],thickness:.68,engines:3,handling:.82,armor:125,origin:"fleet" },
];
export type EncounterKind = "asteroid" | "pirate" | "blackhole";
export type Encounter = { at:number; kind:EncounterKind; x:number; y:number; count:number };
export type Mission = { title:string; events:Encounter[]; source:"openai"|"practice"; note:string };
export const DURATION=75;
export function practiceMission():Mission {
  return { title:"The Kepler passage",source:"practice",note:"Practice route · AI director offline",events:Array.from({length:19},(_,i)=>({
    at:4+i*3.2,kind: i===7||i===15 ? "blackhole" : i%3===2 ? "pirate" : "asteroid",
    x:Math.sin(i*2.4)*6.5,y:Math.cos(i*1.8)*3.2,count:i%4===0?2:1,
  })) };
}
export const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function validateHull(value:unknown):Hull {
  const v=value as Record<string,unknown>;
  if(!v || !Array.isArray(v.widths)||v.widths.length!==9 || !v.widths.every(n=>typeof n==="number"&&Number.isFinite(n)) || typeof v.thickness!=="number"||!Number.isFinite(v.thickness)||typeof v.engines!=="number"||!Number.isFinite(v.engines)) throw new Error("The ship design was incomplete. Try another outline.");
  return { ...FLEET[0],id:"custom",name:typeof v.name==="string"?v.name.slice(0,24):"Your creation",role:"Custom courier",widths:v.widths.map(n=>clamp(n,.08,2.2)),thickness:clamp(v.thickness,.25,.8),engines:Math.round(clamp(v.engines,1,3)),color:"#80e6da",origin:"openai" };
}
export function validateMission(value:unknown):Mission {
  const v=value as Record<string,unknown>;
  if(!v||!Array.isArray(v.events)||v.events.length<10||v.events.length>20)throw new Error("The director returned an incomplete route.");
  const events:Encounter[]=v.events.map(e=>{
    if(!e||!["asteroid","pirate","blackhole"].includes(e.kind)||![e.at,e.x,e.y,e.count].every(Number.isFinite))throw new Error("Invalid encounter plan.");
    return {at:clamp(e.at,4,64),kind:e.kind,x:clamp(e.x,-7,7),y:clamp(e.y,-4,4),count:e.kind==="blackhole"?1:Math.round(clamp(e.count,1,2))};
  }).sort((a,b)=>a.at-b.at);
  let last=.5,holes=0; const safe=events.flatMap(e=>{if(e.kind==="blackhole"&&++holes>2)e.kind="asteroid";e.at=Math.max(e.at,last+3);if(e.at>64)return [];last=e.at;return [e];});
  if(safe.length<10)throw new Error("The route did not leave enough reaction time.");
  return {title:typeof v.title==="string"?v.title.slice(0,45):"The Kepler passage",events:safe,source:"openai",note:"OpenAI director · route ready"};
}
