import { clamp, DURATION, type Hull, type Mission, type EncounterKind } from "./types";
export type Entity={id:number;kind:EncounterKind|"shot"|"hostile";x:number;y:number;z:number;vx:number;vy:number;radius:number;hp:number;age:number;fire:number};
export type Input={x:number;y:number;fire:boolean};
export type Flight={time:number;x:number;y:number;hull:number;cargo:number;kills:number;shots:number;hits:number;immune:number;cooldown:number;next:number;serial:number;entities:Entity[];status:"flying"|"delivered"|"lost";warning:string};
export function createFlight(hull:Hull):Flight{return {time:0,x:0,y:0,hull:hull.armor,cargo:100,kills:0,shots:0,hits:0,immune:0,cooldown:0,next:0,serial:0,entities:[],status:"flying",warning:"Keep the cargo intact. Kepler Outpost is counting on you."};}
export function damage(s:Flight,amount:number,cargo:number){if(s.immune>0||s.status!=="flying")return;s.hull=Math.max(0,s.hull-amount);s.cargo=Math.max(0,s.cargo-cargo);s.immune=.85;s.hits++;s.warning="Impact! Cargo damaged — keep moving.";if(!s.hull||!s.cargo)s.status="lost";}
export function stepFlight(s:Flight,input:Input,hull:Hull,mission:Mission,dt:number){
  if(s.status!=="flying")return;
  dt=clamp(dt,0,.05);s.time+=dt;s.immune=Math.max(0,s.immune-dt);s.cooldown-=dt;
  s.x=clamp(s.x+input.x*10*hull.handling*dt,-9,9);s.y=clamp(s.y+input.y*8*hull.handling*dt,-5,5);
  while(s.next<mission.events.length&&s.time>=mission.events[s.next].at){const e=mission.events[s.next++];
    s.warning=e.kind==="blackhole"?"Gravity well ahead. Keep your distance.":e.kind==="pirate"?"Pirates inbound. Protect the shipment.":"Asteroid field. Find a clear line.";
    for(let i=0;i<e.count;i++)s.entities.push({id:s.serial++,kind:e.kind,x:clamp(e.x+i*3.5,-8,8),y:clamp(e.y-i*2,-4,4),z:-145-i*15,vx:0,vy:0,radius:e.kind==="blackhole"?2.3:e.kind==="pirate"?1.3:1.4+(s.serial%3)*.3,hp:e.kind==="pirate"?3:2,age:0,fire:1.2});
  }
  if(input.fire&&s.cooldown<=0){s.cooldown=.16;s.shots++;
    const target=s.entities.filter(e=>e.kind==="pirate"&&e.z< -3&&Math.abs(e.x-s.x)<2.2&&Math.abs(e.y-s.y)<1.8).sort((a,b)=>b.z-a.z)[0];
    const travel=target?Math.max(.2,Math.abs(target.z)/150):1;
    s.entities.push({id:s.serial++,kind:"shot",x:s.x,y:s.y,z:-2.6,vx:target?(target.x-s.x)/travel:0,vy:target?(target.y-s.y)/travel:0,radius:.3,hp:1,age:0,fire:0});
  }
  for(const e of [...s.entities]){
    e.age+=dt;const oldZ=e.z;e.z+=(e.kind==="shot"?-150:e.kind==="hostile"?58:29)*dt;e.x+=e.vx*dt;e.y+=e.vy*dt;
    if(e.kind==="pirate"){
      e.fire-=dt;
      if(e.z> -95&&e.z< -8&&e.fire<=0){e.fire=2.15;const t=Math.max(.3,-e.z/58);s.entities.push({id:s.serial++,kind:"hostile",x:e.x,y:e.y,z:e.z+2,vx:(s.x-e.x)/t,vy:(s.y-e.y)/t,radius:.55,hp:1,age:0,fire:0});}
    }
    if(e.kind==="blackhole"&&Math.abs(e.z)<38){const d=Math.hypot(e.x-s.x,e.y-s.y);if(d>1){const force=dt*5*(1-Math.abs(e.z)/38)/Math.max(1,d*.3);s.x=clamp(s.x+(e.x-s.x)/d*force,-9,9);s.y=clamp(s.y+(e.y-s.y)/d*force,-5,5);}}
    if(e.kind!=="shot"&&e.hp>0&&oldZ<e.radius+.65&&e.z> -e.radius-.65&&Math.hypot(e.x-s.x,e.y-s.y)<e.radius+.65){damage(s,e.kind==="blackhole"?55:e.kind==="hostile"?16:26,e.kind==="blackhole"?35:e.kind==="hostile"?9:16);if(e.kind!=="blackhole")e.hp=0;}
    if(e.kind==="shot"&&e.hp>0){for(const target of s.entities){if((target.kind!=="pirate"&&target.kind!=="asteroid")||target.hp<=0)continue;if(e.z-target.radius<target.z&&oldZ+target.radius>target.z&&Math.hypot(e.x-target.x,e.y-target.y)<target.radius+.4){e.hp=0;target.hp--;if(target.hp<=0){s.kills++;s.warning=target.kind==="pirate"?"Pirate neutralized. Cargo secure.":"Path cleared.";}break;}}}
  }
  s.entities=s.entities.filter(e=>e.hp>0&&e.z<22&&e.z> -230&&e.age<12);
  if(s.status==="flying"&&s.time>=DURATION){s.time=DURATION;s.status="delivered";s.warning="Delivery complete.";}
}
