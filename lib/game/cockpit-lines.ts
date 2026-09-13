import {OBJECTS,isShip,type ObjectType} from './objects';

const fixed=new Set([
 'Steer with thrust. Shoot volatile rocks near enemies. Cyan gates boost real speed.',
 'Hull hit. Counter the drift and protect the cargo.',
 'Cyan jump gate ahead. Align with the opening.',
 'Shield online for 8 seconds.',
 'Jump complete. Returning to cruise.',
 'JUMP ENGAGED — accelerating to 3× cruise.',
 'Warp Gate reached. Hull repaired; remaining cargo secured.',
 'ASTEROID WAVE — keep a clear flight line',
 'REPAIR OPPORTUNITY — intercept the green relief capsule',
 'CARGO INSTABILITY — avoid hits while the fuel cools',
 'NEW ROUTE AVAILABLE — priority shortcut ahead',
 'CARGO SURGE — unstable fuel is damaging the ship',
 'RELIEF CAPSULE SECURED — hull and cargo stabilized',
 ...Object.entries(OBJECTS).filter(([id])=>id!=='repulsor'&&!isShip(id as ObjectType)).map(([,spec])=>`${spec.name} ahead. ${spec.description}`),
]);
const objective=/^(?:Reach the warp gate|Keep cargo ≥ \d{1,2}% to the warp gate|Destroy the marked (?:bounty hunter|target)|Destroy [1-3] hostile ships?|Survive for \d{1,3} seconds|Evade all nearby hostiles within \d{1,3} seconds|Collect 1 shield buoy before the gate|Take no (?:cargo|hull) damage for \d{1,3}s|Reach the gate within \d{1,3} seconds)$/;
/** Only authored bottom readouts and locally composed objective instructions may be voiced. */
export function cockpitLine(value:unknown):string|null {
 if(typeof value!=='string'||value.length>240)return null;
 if(fixed.has(value))return value;
 const match=/^(BONUS OBJECTIVE|BONUS COMPLETE|BONUS MISSED) — (.+)$/.exec(value);
 if(!match)return null;
 const conditions=match[2].split(' + ');
 return conditions.length<=2&&conditions.every(condition=>objective.test(condition))?value:null;
}
