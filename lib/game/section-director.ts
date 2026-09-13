import {OBJECT_TYPES,OBJECTS,isObjectType,isShip,isField} from './objects';
import {clamp,type SectionPlan,type Hull,type DifficultySetting,type FlightCondition,type ArrivalCondition} from './types';
import {difficulty,effectiveHull,launchCondition,type Campaign} from './progression';
import {stageEnvironment} from './stage-environment';

export type DirectorContext={stage:number;attempt:number;difficulty:DifficultySetting;destination:string;ship:Pick<Hull,'id'|'name'|'armor'|'handling'|'cruise'|'engines'|'origin'>;condition:FlightCondition;previousArrival:ArrivalCondition|null;upgrades:{hull:number;cruise:number}};
export function sectionContext(base:Hull,c:Campaign):DirectorContext{
 const ship=effectiveHull(base,c);
 return {stage:c.stage,attempt:c.attempt+1,difficulty:c.difficulty,destination:stageEnvironment(c.stage).name,ship:{id:ship.id,name:ship.name,armor:ship.armor,handling:ship.handling,cruise:ship.cruise??1,engines:ship.engines,origin:ship.origin},condition:launchCondition(c,ship),previousArrival:c.status==='lost'?null:c.arrival,upgrades:{hull:c.hullUpgrades,cruise:c.cruiseUpgrades}};
}
const number=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid section planning context.');return v;};
export function validateDirectorContext(value:unknown):DirectorContext{
 const v=value as DirectorContext;
 if(!v||!v.ship||!v.condition||!v.upgrades||!['easy','normal','hard'].includes(v.difficulty))throw new Error('Invalid section planning context.');
 const stage=number(v.stage,1,100000),attempt=number(v.attempt,1,100000),armor=number(v.ship.armor,1,300);
 if(!Number.isInteger(stage)||!Number.isInteger(attempt))throw new Error('Invalid section.');
 const previous=v.previousArrival;
 return {stage,attempt,difficulty:v.difficulty,destination:stageEnvironment(stage).name,
  ship:{id:String(v.ship.id).slice(0,32),name:String(v.ship.name).slice(0,40),armor,handling:number(v.ship.handling,.5,2),cruise:number(v.ship.cruise,1,1.25),engines:number(v.ship.engines,1,3),origin:['fleet','local','openai'].includes(v.ship.origin)?v.ship.origin:'local'},
  condition:{hull:number(v.condition.hull,0,armor),cargo:number(v.condition.cargo,0,100)},
  previousArrival:previous?{stage:number(previous.stage,1,100000),hull:number(previous.hull,0,300),maxHull:number(previous.maxHull,1,300),cargo:number(previous.cargo,0,100)}:null,
  upgrades:{hull:number(v.upgrades.hull,0,5),cruise:number(v.upgrades.cruise,0,4)}};
}
export function validateSectionPlan(value:unknown,waves:number):SectionPlan{
 const v=value as {title:unknown;beats:{objectType:unknown;pace:unknown}[]};
 if(!v||typeof v.title!=='string'||!Array.isArray(v.beats)||v.beats.length!==waves-2)throw new Error('The director returned an incomplete section plan.');
 const beats=v.beats.map(b=>{
  if(!b||!isObjectType(b.objectType)||b.objectType==='portal'||!['calm','steady','intense'].includes(String(b.pace)))throw new Error('The director returned an unsupported encounter.');
  return {objectType:b.objectType as Exclude<typeof b.objectType,'portal'>,pace:b.pace as 'calm'|'steady'|'intense'};
 });
 if(beats.filter(b=>isShip(b.objectType)).length<3||beats.filter(b=>OBJECTS[b.objectType].family==='rock').length<3||beats.filter(b=>b.pace==='calm').length<3||beats.filter(b=>isField(b.objectType)).length>Math.floor(beats.length*.2)||beats.filter(b=>b.objectType==='shield-buoy').length>Math.floor(beats.length*.1))throw new Error('The director plan did not leave a balanced playable route.');
 return {title:v.title.slice(0,60),beats};
}
export function sectionPlanSchema(context:DirectorContext){
 const count=difficulty(context.stage,context.difficulty).waves-2;
 return {type:'object',properties:{title:{type:'string'},beats:{type:'array',minItems:count,maxItems:count,items:{type:'object',properties:{objectType:{type:'string',enum:OBJECT_TYPES.filter(id=>id!=='portal')},pace:{type:'string',enum:['calm','steady','intense']}},required:['objectType','pace'],additionalProperties:false}}},required:['title','beats'],additionalProperties:false};
}
export function sectionPlanPrompt(context:DirectorContext){
 const challenge=difficulty(context.stage,context.difficulty),integrity=clamp(context.condition.hull/context.ship.armor,0,1);
 return `Plan this single section of Space Race. Author exactly ${challenge.waves-2} beats in chronological order. Your objectType choices govern encounters throughout the section; pace controls bounded arrival spacing (calm spreads encounters, intense compresses them). Local flight code supplies safe formations, two separate optional boost gates, weapon limits, and the final Warp Gate. Do not prescribe coordinates, stats, text overlays, or code.
Use the selected difficulty, current effective ship, actual remaining cargo, current launch hull and prior gate arrival condition in this authoritative game snapshot: ${JSON.stringify(context)}.
Launch hull integrity is ${Math.round(integrity*100)}%. A final Warp Gate repairs the hull fully; previousArrival records damage before that repair. Cargo never replenishes between sections or from objects. At low cargo or weak arrival hull, provide manageable pressure and recovery space without erasing the chosen difficulty. Easy should favor fragile rocks, shorter enemy sequences and calm spacing; Hard should feature tougher opponents and more intense sequences while retaining fair gaps. Each later section continues the local progression. Agile ships can face more directional variety; armored slow ships need room to steer. Never assume a named ship's default stats instead of the supplied effective stats.
Include rocks, at least three armed encounters and at least three calmer beats spread through the section. Avoid repeated fields and more than ${context.difficulty==='easy'?1:context.difficulty==='hard'?3:2} armed waves in a row. Fields are moon, blackhole and repulsor. Armed ships are pirate, twinwing-fighter, saucer-cruiser and wedge-destroyer. Fuel-tank and volatile-rock support chain reactions. Cargo-crate and repair-pod are spent solid debris and restore nothing. Shield-buoy gives temporary protection only. At most 10% of beats may be shield-buoy and at most 20% may be fields. Do not flood the route with pickups or fields. Keep variety across the opening, middle and final approach; the section has encounters from course position 8 through 146 and a final gate at 150. Return only the constrained JSON plan.`;
}
