import { aiFailure,generateJSON,readInput } from "@/lib/game/ai";
import { validateMission } from "@/lib/game/types";
export async function POST(request:Request){try{
 await readInput(request);
 const event={type:"object",properties:{at:{type:"number"},kind:{type:"string",enum:["asteroid","pirate","blackhole"]},x:{type:"number"},y:{type:"number"},count:{type:"integer"}},required:["at","kind","x","y","count"],additionalProperties:false};
 const schema={type:"object",properties:{title:{type:"string"},events:{type:"array",items:event,minItems:10,maxItems:20}},required:["title","events"],additionalProperties:false};
 const result=await generateJSON("cargo_mission",schema,"Direct a fair, exciting 75-second space cargo run from Port Meridian to Kepler Outpost. Return 16 to 19 varied encounters planned before play. Each at is a spawn time in seconds from 4 to 64, sorted with at least 3 seconds between events; they appear 145 units ahead and approach at 29 units/sec, leaving 5 seconds of reaction time. kind asteroid, pirate or blackhole. Use all three, maximum 2 blackholes. x between -7 and 7, y between -4 and 4. count 1 or 2 for asteroids/pirates, always 1 for blackhole. Leave clear lateral escape lanes; never wall off the flight corridor x[-9,9] y[-5,5]. Open gently, build to a pirate ambush, include breathers, end with an asteroid escape and quiet approach to the destination. Choose varied timing/positions each call. Keep only the constrained encounter plan; no code.");
 return Response.json({mission:validateMission(result)},{headers:{"Cache-Control":"no-store"}});
 }catch(e){return aiFailure(e);}}
