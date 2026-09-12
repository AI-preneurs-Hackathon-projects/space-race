import { clamp, DURATION, CRUISE_SPEED, WARP_MAX_SPEED, WARP_DURATION, MAX_PORTALS, type Hull, type Mission, type EncounterKind } from "./types";
export type Entity={id:number;kind:EncounterKind|"shot"|"hostile";x:number;y:number;z:number;vx:number;vy:number;radius:number;hp:number;age:number;fire:number};
export type Input={x:number;y:number;fire:boolean};
export type Flight={time:number;progress:number;speed:number;warpAge:number|null;portalsUsed:number;x:number;y:number;hull:number;cargo:number;kills:number;shots:number;hits:number;immune:number;cooldown:number;next:number;lastEncounterArrival:number;serial:number;entities:Entity[];status:"flying"|"delivered"|"lost";warning:string};
export function createFlight(hull:Hull):Flight{return {time:0,progress:0,speed:1,warpAge:null,portalsUsed:0,x:0,y:0,hull:hull.armor,cargo:100,kills:0,shots:0,hits:0,immune:0,cooldown:0,next:0,lastEncounterArrival:0,serial:0,entities:[],status:"flying",warning:"Deliver the supplies. Fly through cyan jump portals for a speed boost."};}
const smooth=(t:number)=>t*t*(3-2*t);
export function warpSpeed(age:number|null){if(age===null||age<0||age>=WARP_DURATION)return 1;return 1+(WARP_MAX_SPEED-1)*(age<1?smooth(age):age<6?1:1-smooth((age-6)/2));}
function warpIntegral(t:number){t=clamp(t,0,8);if(t<=1)return t*t*t-.5*t*t*t*t;if(t<=6)return .5+t-1;const u=(t-6)/2;return 5.5+2*(u-u*u*u+.5*u*u*u*u);}
export function courseStep(age:number|null,dt:number){return dt+(age===null?0:(WARP_MAX_SPEED-1)*(warpIntegral(age+dt)-warpIntegral(age)));}
export function damage(s:Flight,amount:number,cargo:number){if(s.immune>0||s.status!=="flying")return;s.hull=Math.max(0,s.hull-amount);s.cargo=Math.max(0,s.cargo-cargo);s.immune=.85;s.hits++;s.warning="Impact! Cargo damaged — keep moving.";if(!s.hull||!s.cargo)s.status="lost";}
/** Swept relative motion avoids tunnelling and entity-order dependent hits during a jump. */
function sweptHit(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},c:{x:number;y:number;z:number},d:{x:number;y:number;z:number},radius:number){
 const x=a.x-c.x,y=a.y-c.y,z=a.z-c.z,dx=b.x-d.x-x,dy=b.y-d.y-y,dz=b.z-d.z-z;
 const length=dx*dx+dy*dy+dz*dz,t=length?clamp(-(x*dx+y*dy+z*dz)/length,0,1):0;
 return (x+dx*t)**2+(y+dy*t)**2+(z+dz*t)**2<radius*radius;
}
export function stepFlight(s:Flight,input:Input,hull:Hull,mission:Mission,dt:number){
 if(s.status!=="flying")return;
 dt=clamp(dt,0,.05);const previousProgress=s.progress,travel=courseStep(s.warpAge,dt),oldPlayer={x:s.x,y:s.y,z:0};
 s.time+=dt;s.progress=Math.min(DURATION,s.progress+travel);
 if(s.warpAge!==null){s.warpAge+=dt;if(s.warpAge>=WARP_DURATION-1e-8){s.warpAge=null;s.warning="Jump complete. Cruise speed restored.";}}
 s.speed=warpSpeed(s.warpAge);s.immune=Math.max(0,s.immune-dt);s.cooldown-=dt;
 s.x=clamp(s.x+input.x*10*hull.handling*dt,-9,9);s.y=clamp(s.y+input.y*8*hull.handling*dt,-5,5);
 const oldPositions=new Map(s.entities.map(e=>[e.id,{x:e.x,y:e.y,z:e.z}]));
 // Spawning at cruise or warp always leaves at least five seconds at peak closing speed.
 while(s.next<mission.events.length&&s.progress>=mission.events[s.next].at){const e=mission.events[s.next++];
  if(s.warpAge===null)s.warning=e.kind==="portal"?"Jump portal ahead. Aim for the cyan opening.":e.kind==="pirate"?"Pirates inbound. Protect the shipment.":"Asteroid field. Find a clear line.";
  const lead=145*(s.warpAge===null?1:WARP_MAX_SPEED);
  // Keep wave arrivals ordered when the larger warp lead returns to normal.
  const arrival=Math.max(e.at+lead/CRUISE_SPEED,s.lastEncounterArrival+3.5);s.lastEncounterArrival=arrival;
  for(let i=0;i<e.count;i++){const entity:Entity={id:s.serial++,kind:e.kind,x:clamp(e.x+i*3.5,-8,8),y:clamp(e.y-i*2,-4,4),z:-(arrival-s.progress)*CRUISE_SPEED-i*15,vx:0,vy:0,radius:e.kind==="portal"?4.3:e.kind==="pirate"?1.3:1.35+(s.serial%3)*.3,hp:e.kind==="pirate"?3:2,age:0,fire:1.2};s.entities.push(entity);}
 }
 if(input.fire&&s.cooldown<=0){s.cooldown=.16;s.shots++;
  const target=s.entities.filter(e=>e.kind==="pirate"&&e.z< -3&&Math.abs(e.x-s.x)<2.2&&Math.abs(e.y-s.y)<1.8).sort((a,b)=>b.z-a.z)[0];
  const t=target?Math.max(.2,Math.abs(target.z)/(150+CRUISE_SPEED*s.speed)):1;
  const shot:Entity={id:s.serial++,kind:"shot",x:s.x,y:s.y,z:-2.6,vx:target?(target.x-s.x)/t:0,vy:target?(target.y-s.y)/t:0,radius:.3,hp:1,age:0,fire:0};s.entities.push(shot);oldPositions.set(shot.id,{x:shot.x,y:shot.y,z:shot.z});
 }
 for(const e of [...s.entities]){
  const old=oldPositions.get(e.id);e.age+=dt;
  if(old)e.z+=e.kind==="shot"?-150*dt:e.kind==="hostile"?58*dt+(travel-dt)*CRUISE_SPEED:CRUISE_SPEED*(s.progress-previousProgress);
  else oldPositions.set(e.id,{x:e.x,y:e.y,z:e.z});
  e.x+=e.vx*dt;e.y+=e.vy*dt;
  if(e.kind==="pirate"){
   e.fire-=dt;
   if(s.warpAge!==null)e.fire=Math.max(e.fire,1);
   if(s.warpAge===null&&e.z> -95&&e.z< -8&&e.fire<=0){e.fire=2.15;const t=Math.max(.3,-e.z/58);s.entities.push({id:s.serial++,kind:"hostile",x:e.x,y:e.y,z:e.z+2,vx:(s.x-e.x)/t,vy:(s.y-e.y)/t,radius:.55,hp:1,age:0,fire:0});}
  }
 }
 // A portal is a crossing plane, not a damaging sphere. Consume it once, even if missed.
 for(const e of s.entities){if(e.kind!=="portal"||e.hp<=0)continue;const old=oldPositions.get(e.id);if(!old||old.z>=0||e.z<0)continue;
  const fraction=clamp(-old.z/(e.z-old.z),0,1),x=oldPlayer.x+(s.x-oldPlayer.x)*fraction,y=oldPlayer.y+(s.y-oldPlayer.y)*fraction;e.hp=0;
  if(Math.hypot(x-e.x,y-e.y)<=e.radius-.65&&s.warpAge===null&&s.portalsUsed<MAX_PORTALS){s.warpAge=0;s.portalsUsed++;s.warning="JUMP ENGAGED — corridor cleared. Hold your course.";
   // The entry pulse clears imminent obstacles/projectiles; further encounters retain safe lead time.
   for(const threat of s.entities)if(threat.kind!=="portal"&&threat.kind!=="shot"&&threat.z> -220&&threat.z<25)threat.hp=0;
  }
 }
 const player={x:s.x,y:s.y,z:0};
 for(const e of s.entities){if(e.hp<=0||e.kind==="shot"||e.kind==="portal")continue;const old=oldPositions.get(e.id)??e;
  if(sweptHit(old,e,oldPlayer,player,e.radius+.65)){damage(s,e.kind==="hostile"?16:26,e.kind==="hostile"?9:16);e.hp=0;}
 }
 for(const shot of s.entities){if(shot.kind!=="shot"||shot.hp<=0)continue;for(const target of s.entities){if(target.hp<=0||(target.kind!=="pirate"&&target.kind!=="asteroid"))continue;
  if(sweptHit(oldPositions.get(shot.id)??shot,shot,oldPositions.get(target.id)??target,target,target.radius+.3)){shot.hp=0;target.hp--;if(target.hp<=0){s.kills++;if(s.warpAge===null)s.warning=target.kind==="pirate"?"Pirate neutralized. Cargo secure.":"Path cleared.";}break;}
 }}
 s.entities=s.entities.filter(e=>e.hp>0&&e.z<25&&e.z> -550&&e.age<24);
 if(s.status==="flying"&&s.progress>=DURATION){s.progress=DURATION;s.status="delivered";s.speed=1;s.warpAge=null;s.warning="Delivery complete.";}
}
