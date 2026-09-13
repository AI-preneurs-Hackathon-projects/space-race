import {OBJECT_TYPES,OBJECTS,isObjectType,isShip,isField} from './objects';
import {clamp,type SectionPlan,type Hull,type DifficultySetting,type FlightCondition,type ArrivalCondition} from './types';
import {difficulty,effectiveHull,launchCondition,type Campaign} from './progression';
import {stageEnvironment} from './stage-environment';
import {CARGO,CARGO_TYPES,RISKS,THREAT_TYPES,type Contract} from './contracts';

export type SectionContract=Pick<Contract,'cargoType'|'risk'|'minimumCargoIntegrity'|'modifiers'|'possibleThreats'>;
export type DirectorContext={stage:number;attempt:number;difficulty:DifficultySetting;destination:string;ship:Pick<Hull,'id'|'name'|'armor'|'handling'|'cruise'|'engines'|'origin'>;condition:FlightCondition;previousArrival:ArrivalCondition|null;upgrades:{hull:number;cruise:number};contract?:SectionContract};
export function sectionContext(base:Hull,c:Campaign,contract?:Contract):DirectorContext{
 const ship=effectiveHull(base,c);
 return {stage:c.stage,attempt:c.attempt+1,difficulty:c.difficulty,destination:stageEnvironment(c.stage).name,ship:{id:ship.id,name:ship.name,armor:ship.armor,handling:ship.handling,cruise:ship.cruise??1,engines:ship.engines,origin:ship.origin},condition:launchCondition(c,ship),previousArrival:c.status==='lost'?null:c.arrival,upgrades:{hull:c.hullUpgrades,cruise:c.cruiseUpgrades},...(contract?{contract:{cargoType:contract.cargoType,risk:contract.risk,minimumCargoIntegrity:contract.minimumCargoIntegrity,modifiers:[...contract.modifiers],possibleThreats:[...contract.possibleThreats]}}:{})};
}
const number=(v:unknown,min:number,max:number)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<min||v>max)throw new Error('Invalid section planning context.');return v;};
function validateSectionContract(value:unknown):SectionContract|undefined {
 if(value===undefined)return undefined;
 if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('Invalid contract planning context.');
 const v=value as SectionContract;
 if(Object.keys(v).some(key=>!['cargoType','risk','minimumCargoIntegrity','modifiers','possibleThreats'].includes(key))||!CARGO_TYPES.includes(v.cargoType)||!RISKS.includes(v.risk))throw new Error('Invalid contract planning context.');
 const cargo=CARGO[v.cargoType];
 if(!Array.isArray(v.modifiers)||v.modifiers.length!==cargo.modifiers.length||new Set(v.modifiers).size!==v.modifiers.length||v.modifiers.some(modifier=>!cargo.modifiers.includes(modifier)))throw new Error('Cargo modifiers do not match the manifest.');
 if(!Array.isArray(v.possibleThreats)||v.possibleThreats.length<1||v.possibleThreats.length>4||new Set(v.possibleThreats).size!==v.possibleThreats.length||v.possibleThreats.some(threat=>!THREAT_TYPES.includes(threat)))throw new Error('Unsupported contract threat.');
 const minimum=cargo.minimumIntegrity===null?null:number(v.minimumCargoIntegrity,cargo.minimumIntegrity,Math.min(90,cargo.minimumIntegrity+15));
 if(minimum===null?v.minimumCargoIntegrity!==null:!Number.isInteger(minimum))throw new Error('Invalid cargo delivery requirement.');
 return {cargoType:v.cargoType,risk:v.risk,minimumCargoIntegrity:minimum,modifiers:[...v.modifiers],possibleThreats:[...v.possibleThreats]};
}
export function validateDirectorContext(value:unknown):DirectorContext{
 const v=value as DirectorContext;
 if(!v||!v.ship||!v.condition||!v.upgrades||!['easy','normal','hard'].includes(v.difficulty))throw new Error('Invalid section planning context.');
 const stage=number(v.stage,1,100000),attempt=number(v.attempt,1,100000),armor=number(v.ship.armor,1,300);
 if(!Number.isInteger(stage)||!Number.isInteger(attempt))throw new Error('Invalid section.');
 const previous=v.previousArrival,contract=validateSectionContract(v.contract);
 return {stage,attempt,difficulty:v.difficulty,destination:stageEnvironment(stage).name,...(contract?{contract}:{}),
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
 const cargoRules=context.contract?'Each new accepted contract loads fresh cargo at the Warp Gate; a resumed flight keeps its actual remaining cargo. Tagged relief capsules from the live Contract Director can repair hull and cargo, while ordinary route repair-pods and cargo-crates remain spent debris. Zero cargo forfeits this delivery but a live ship can still reach the gate.':'Cargo never replenishes between sections or from objects.';
 const contractRules=context.contract?`The accepted contract is ${context.contract.risk} risk with ${CARGO[context.contract.cargoType].label}${context.contract.minimumCargoIntegrity===null?'':` requiring at least ${context.contract.minimumCargoIntegrity}% cargo integrity`}. Within the selected difficulty and fixed encounter limits, low risk favors calm spacing and lighter armed ships; medium risk mixes pressure with recovery gaps; high risk can use stronger armed encounters and more intense beats with fair escape lanes. Fragile medicine needs space to avoid unnecessary combat; volatile fuel needs separated explosive hazards and cooling gaps; valuable technology can face purposeful armed pressure; classified cargo needs room to evade patrols; cryogenic passengers need recoverable field approaches. Reflect the supplied cargo modifiers and declared contextual threats. Existing mandatory baseline rocks and armed encounters remain, and only the live Contract Director schedules the named contextual events. Do not invent new physics or pickups.`:'';
 return `Plan this single section of Space Race. Author exactly ${challenge.waves-2} beats in chronological order. Your objectType choices govern encounters throughout the section; pace controls bounded arrival spacing (calm spreads encounters, intense compresses them). Local flight code supplies safe formations, two separate optional boost gates, weapon limits, and the final Warp Gate. Do not prescribe coordinates, stats, text overlays, or code.
Use the selected difficulty, current effective ship, actual remaining cargo, current launch hull and prior gate arrival condition in this authoritative game snapshot: ${JSON.stringify(context)}.
Launch hull integrity is ${Math.round(integrity*100)}%. A final Warp Gate repairs the hull fully; previousArrival records damage before that repair. ${cargoRules} At low cargo or weak arrival hull, provide manageable pressure and recovery space without erasing the chosen difficulty. Easy should favor fragile rocks, shorter enemy sequences and calm spacing; Hard should feature tougher opponents and more intense sequences while retaining fair gaps. Each later section continues the local progression. Agile ships can face more directional variety; armored slow ships need room to steer. Never assume a named ship's default stats instead of the supplied effective stats.
${contractRules}
Include rocks, at least three armed encounters and at least three calmer beats spread through the section. Avoid repeated fields and more than ${context.difficulty==='easy'?1:context.difficulty==='hard'?3:2} armed waves in a row. Fields are moon, blackhole and repulsor. Armed ships are pirate, twinwing-fighter, saucer-cruiser and wedge-destroyer. Fuel-tank and volatile-rock support chain reactions. Cargo-crate and repair-pod are spent solid debris and restore nothing. Shield-buoy gives temporary protection only. At most 10% of beats may be shield-buoy and at most 20% may be fields. Do not flood the route with pickups or fields. Keep variety across the opening, middle and final approach; the section has encounters from course position 8 through 146 and a final gate at 150. Return only the constrained JSON plan.`;
}
