import { clamp, DURATION, CRUISE_SPEED, WARP_MAX_SPEED, WARP_DURATION, MAX_PORTALS, type Hull, type Mission, type EncounterKind } from './types';
import { OBJECTS, DEFAULT_ROCK, isObjectType, type ObjectType, isField, isShip } from './objects';
import { FlightPhysics, PHYSICS_STEP } from './physics';
export { initializePhysics } from './physics';
export type Entity={id:number;kind:EncounterKind|'shot'|'hostile'|'debris';objectType?:ObjectType;x:number;y:number;z:number;vx:number;vy:number;vz?:number;radius:number;wave?:number;anchorX?:number;anchorY?:number;hp:number;maxHp?:number;age:number;fire:number;mass?:number;hitAge?:number;ttl?:number;credit?:boolean;ownerId?:number;qx?:number;qy?:number;qz?:number;qw?:number};
export type FlightEffect={id:number;kind:'hit'|'explosion'|'muzzle'|'collect'|'jump';x:number;y:number;z:number;age:number;life:number;size:number;color:string;seed:number};
export type Input={x:number;y:number;fire:boolean};
export type Flight={time:number;progress:number;cruise:number;speed:number;warpAge:number|null;portalsUsed:number;x:number;y:number;vx:number;vy:number;hull:number;maxHull:number;cargo:number;kills:number;shots:number;hits:number;immune:number;cooldown:number;next:number;lastEncounterArrival:number;serial:number;entities:Entity[];effects:FlightEffect[];status:'flying'|'delivered'|'lost';warning:string;shield:number;field:string;fieldX:number;fieldY:number;chainHits:number;collisions:number;distanceSaved:number;shotAge:number;arrivalHull:number|null};
type Runtime={physics:FlightPhysics;accumulator:number;contacts:Map<string,number>};
const runtimes=new WeakMap<Flight,Runtime>();
export function createFlight(hull:Hull,condition?:{hull:number;cargo:number}):Flight{return {time:0,progress:0,cruise:hull.cruise??1,speed:hull.cruise??1,warpAge:null,portalsUsed:0,x:0,y:0,vx:0,vy:0,hull:clamp(condition?.hull??hull.armor,0,hull.armor),maxHull:hull.armor,cargo:clamp(condition?.cargo??100,0,100),kills:0,shots:0,hits:0,immune:0,cooldown:0,next:0,lastEncounterArrival:0,serial:0,entities:[],effects:[],status:'flying',warning:'Steer with thrust. Shoot volatile rocks near enemies. Cyan gates boost real speed.',shield:0,field:'',fieldX:0,fieldY:0,chainHits:0,collisions:0,distanceSaved:0,shotAge:1,arrivalHull:null};}
export function disposeFlight(s:Flight){runtimes.get(s)?.physics.dispose();runtimes.delete(s);}
export function physicsBodyCount(s:Flight){return runtimes.get(s)?.physics.bodies.size??0;}
const smooth=(t:number)=>t*t*(3-2*t);
export function warpSpeed(age:number|null){if(age===null||age<0||age>=WARP_DURATION)return 1;return 1+(WARP_MAX_SPEED-1)*(age<1?smooth(age):age<6?1:1-smooth((age-6)/2));}
function warpIntegral(t:number){t=clamp(t,0,8);if(t<=1)return t*t*t-.5*t*t*t*t;if(t<=6)return .5+t-1;const u=(t-6)/2;return 5.5+2*(u-u*u*u+.5*u*u*u*u);}
export function courseStep(age:number|null,dt:number){return dt+(age===null?0:(WARP_MAX_SPEED-1)*(warpIntegral(age+dt)-warpIntegral(age)));}
export function damage(s:Flight,amount:number,cargo:number){if(s.immune>0||s.shield>0||s.status!=='flying')return;s.hull=Math.max(0,s.hull-amount);s.cargo=Math.max(0,s.cargo-cargo);s.immune=.85;s.hits++;s.warning='Hull hit. Counter the drift and protect the cargo.';if(!s.hull||!s.cargo)s.status='lost';}
export const typeOf=(e:Entity):ObjectType=>(isObjectType(e.objectType)?e.objectType:e.kind==='pirate'?'pirate':e.kind==='portal'?'portal':DEFAULT_ROCK);
export function isSolid(e:Entity){return e.kind!=='portal'&&e.kind!=='shot'&&e.kind!=='hostile';}
export function isThreat(e:Entity){return e.hp>0&&e.kind!=='shot'&&e.kind!=='portal'&&!OBJECTS[typeOf(e)].collect;}
export const MAX_DEBRIS=48,MAX_ENTITIES=150,MAX_EFFECTS=64;
function effect(s:Flight,kind:FlightEffect['kind'],e:{x:number;y:number;z:number},size:number,color:string){s.effects.push({id:s.serial++,kind,x:e.x,y:e.y,z:e.z,age:0,life:kind==='hit'?.4:kind==='muzzle'?.1:kind==='jump'?1.2:1.1,size,color,seed:s.serial});if(s.effects.length>MAX_EFFECTS)s.effects.splice(0,s.effects.length-MAX_EFFECTS);}
/** Earliest swept sphere entry in relative coordinates for fast projectiles. */
function sweptTime(a:{x:number;y:number;z:number},b:{x:number;y:number;z:number},c:{x:number;y:number;z:number},d:{x:number;y:number;z:number},r:number){
 const x=a.x-c.x,y=a.y-c.y,z=a.z-c.z,dx=b.x-d.x-x,dy=b.y-d.y-y,dz=b.z-d.z-z;
 const A=dx*dx+dy*dy+dz*dz,C=x*x+y*y+z*z-r*r;if(C<=0)return 0;if(A<1e-12)return Infinity;
 const B=2*(x*dx+y*dy+z*dz),disc=B*B-4*A*C;if(disc<0)return Infinity;const t=(-B-Math.sqrt(disc))/(2*A);return t>=0&&t<=1?t:Infinity;
}
function specEntity(s:Flight,id:ObjectType,x:number,y:number,z:number,wave?:number):Entity{const spec=OBJECTS[id];return {id:s.serial++,kind:isShip(id)?'pirate':id==='portal'?'portal':spec.family==='rock'?'asteroid':'object',objectType:id,x,y,z,vx:0,vy:0,vz:0,anchorX:x,anchorY:y,radius:spec.radius,hp:spec.hp,maxHp:spec.hp,mass:spec.mass,age:0,fire:spec.weapons?.warmup??1.2,wave};}
export function spawnObject(s:Flight,id:ObjectType,x:number,y:number,z:number,velocity:{x?:number;y?:number;z?:number}={}):Entity{const e=specEntity(s,id,x,y,z);e.vx=velocity.x??0;e.vy=velocity.y??0;e.vz=velocity.z??0;s.entities.push(e);return e;}
function detonate(s:Flight,e:Entity,p:FlightPhysics,credit:boolean){
 if(e.hp<=0)return;e.hp=0;e.credit=credit;if(e.kind==='debris'){effect(s,'hit',e,e.radius,'#ddbb99');return;}const id=typeOf(e),spec=OBJECTS[id];
 if(credit&&!isField(id))s.kills++;
 effect(s,'explosion',e,Math.max(e.radius*2,spec.blast??0),spec.color);
 const blast=spec.blast??e.radius*2.2,power=spec.blastDamage??.6;
 const source=p.bodies.get(e.id),worldPoint=source?.translation()??{x:e.x,y:e.y,z:p.player.translation().z+e.z};
 for(const other of [...s.entities]){if(other.id===e.id||other.hp<=0||other.kind==='portal'||other.kind==='shot'||other.kind==='hostile')continue;
  const b=p.bodies.get(other.id);if(!b)continue;const v=b.translation(),dx=v.x-worldPoint.x,dy=v.y-worldPoint.y,dz=v.z-worldPoint.z,dist=Math.hypot(dx,dy,dz);if(dist>blast+other.radius)continue;
  const falloff=clamp(1-Math.max(0,dist-other.radius)/blast,0,1),n=1/Math.max(.1,dist),kick=falloff*(spec.blastDamage??1)*5;
  b.applyImpulse({x:dx*n*kick,y:dy*n*kick,z:dz*n*kick},true);
  if(!isField(typeOf(other))){other.hp-=power*falloff;other.hitAge=.6;other.credit=credit||other.credit;if(credit&&other.kind==='pirate')s.chainHits++;if(other.hp<=0){other.hp=.001;detonate(s,other,p,!!other.credit);}}
 }
 const v=p.player.translation(),dx=v.x-worldPoint.x,dy=v.y-worldPoint.y,dz=v.z-worldPoint.z,dist=Math.hypot(dx,dy,dz);
 if(dist<blast+.65){const f=clamp(1-dist/(blast+.65),0,1),n=1/Math.max(dist,.1);p.player.applyImpulse({x:dx*n*f*35,y:dy*n*f*35,z:dz*n*f*35},true);damage(s,power*f*5,power*f*2);}
 if(!isField(id)&&s.entities.length<MAX_ENTITIES){
  const remaining=MAX_DEBRIS-s.entities.filter(a=>a.kind==='debris'&&a.hp>0).length,count=Math.min(remaining,MAX_ENTITIES-s.entities.length,id==='volatile-rock'||id==='fuel-tank'?7:4);
  for(let i=0;i<count;i++){const a=e.id*1.618+i*2.399,b=i*.87+e.id,dx=Math.cos(a),dy=Math.sin(a),dz=Math.sin(b),scale=e.radius+.4;const frag:Entity={id:s.serial++,kind:'debris',x:e.x+dx*scale,y:e.y+dy*scale,z:e.z+dz*scale,vx:e.vx+dx*(4+i),vy:e.vy+dy*(4+i),vz:(e.vz??0)+dz*(4+i),radius:.16+i%3*.08,mass:.18,hp:1,maxHp:1,age:0,fire:0,ttl:3.8,credit};s.entities.push(frag);p.add(frag,p.player.translation().z);}
 }
}
function hit(s:Flight,e:Entity,amount:number,p:FlightPhysics,credit:boolean){if(e.hp<=0)return;effect(s,'hit',e,e.radius,'#d9f8ff');if(isField(typeOf(e))&&e.kind!=='debris')return;e.hitAge=.65;e.credit=credit||e.credit;e.hp-=amount;if(e.hp<=0){e.hp=.001;detonate(s,e,p,!!e.credit);}}
function addBodies(s:Flight,p:FlightPhysics){for(const e of s.entities)if(e.hp>0&&e.kind!=='portal')p.add(e,p.player.translation().z);}
function spawnEncounters(s:Flight,mission:Mission,p:FlightPhysics){
 while(s.next<mission.events.length&&s.progress>=mission.events[s.next].at){const e=mission.events[s.next++];if(e.objectType!==undefined&&!isObjectType(e.objectType))continue;const id=(isObjectType(e.objectType)?e.objectType:e.kind==='pirate'?'pirate':e.kind==='portal'?'portal':DEFAULT_ROCK);
  if(s.warpAge===null)s.warning=id==='portal'?'Cyan jump gate ahead. Align with the opening.':`${OBJECTS[id].name} ahead. ${OBJECTS[id].description}`;
  const peak=s.warpAge===null?1:WARP_MAX_SPEED,lead=Math.max(145*s.cruise*peak,isShip(id)?((mission.challenge?.bulletSpeed??29)+29*s.cruise)*(1.4+(OBJECTS[id].weapons?.warmup??.6)+.85):0)+(id==='missile'?100:0),spacing=3.5;
  // Generated stages use fixed course positions, spawned 22 units ahead. Warp cannot queue or discard late waves.
  // Legacy practice/AI events retain reaction-lead scheduling.
  const arrival=e.arrival??Math.max(e.at+lead/CRUISE_SPEED,s.lastEncounterArrival+spacing);s.lastEncounterArrival=arrival;if(e.arrival===undefined&&mission.challenge&&arrival>138)continue;
  const pts=e.points??Array.from({length:e.count},(_,i)=>({x:e.x+i*3.5,y:e.y-i*2,radius:id==='portal'?(e.portalRadius??4.3):OBJECTS[id].radius}));
  for(let i=0;i<pts.length&&s.entities.length<MAX_ENTITIES-12;i++){const pt=pts[i],o=specEntity(s,id,pt.x,pt.y,-(arrival-s.progress)*CRUISE_SPEED-(e.points?0:i*15),s.next-1);o.radius=pt.radius;
   o.vx=e.drift??(!e.points&&!isField(id)?Math.sin(o.id)*.22:0);o.vy=!e.points&&!isField(id)?Math.cos(o.id)*.12:0;if(id==='missile')o.vz=20;s.entities.push(o);
  }
  if(e.escort&&isObjectType(e.escort)&&s.entities.length<MAX_ENTITIES-8)s.entities.push(specEntity(s,e.escort,e.x+3.6,e.y,-(arrival-s.progress)*CRUISE_SPEED+1,s.next-1));
 }
 addBodies(s,p);
}
function forces(s:Flight,input:Input,hull:Hull,mission:Mission,p:FlightPhysics){
 p.player.resetForces(true);for(const b of p.bodies.values())b.resetForces(true);
 const v=p.player.linvel(),position=p.player.translation(),mass=p.player.mass(),targetZ=-CRUISE_SPEED*s.cruise*warpSpeed(s.warpAge);
 const assist=s.field?2.6:9;
 const ax=clamp((clamp(input.x,-1,1)*10*hull.handling-v.x)*(Math.abs(input.x)>.1?9:assist),-45*hull.handling,45*hull.handling),ay=clamp((clamp(input.y,-1,1)*8*hull.handling-v.y)*(Math.abs(input.y)>.1?9:assist),-40*hull.handling,40*hull.handling);
 p.player.addForce({x:ax*mass,y:ay*mass,z:clamp((targetZ-v.z)*9,-120,90)*mass},true);
 if(Math.abs(position.x)>8.8||Math.abs(position.y)>4.8)p.player.addForce({x:-Math.sign(position.x)*Math.max(0,Math.abs(position.x)-8.8)*mass*160,y:-Math.sign(position.y)*Math.max(0,Math.abs(position.y)-4.8)*mass*160,z:0},true);
 s.field='';s.fieldX=0;s.fieldY=0;let strongest=0;
 const fields=s.entities.filter(e=>e.hp>0&&isField(typeOf(e))),entityMap=new Map(s.entities.map(e=>[e.id,e]));
 for(const field of fields){const spec=OBJECTS[typeOf(field)],source=p.bodies.get(field.id);if(!source)continue;const q=source.translation();
  for(const [id,b] of [[-1,p.player],...p.bodies.entries()] as const){if(id===field.id)continue;const target=entityMap.get(id);if(target&&target.hp<=0)continue;const v=b.translation(),dx=q.x-v.x,dy=q.y-v.y,dz=q.z-v.z,dist=Math.hypot(dx,dy,dz);if(dist>(spec.fieldRadius??0)||dist<.001)continue;
   const soft=Math.max(3,field.radius*1.5),a=clamp(3*(spec.gravity??0)/(dist*dist+soft*soft),-10,10)*(1-smooth(dist/(spec.fieldRadius??1))),f=b.mass()*a/dist,force={x:dx*f,y:dy*f,z:dz*f};b.addForce(force,true);source.addForce({x:-force.x,y:-force.y,z:-force.z},true);
   if(id===-1){s.fieldX+=dx*a/dist;s.fieldY+=dy*a/dist;if(Math.abs(a)>strongest){strongest=Math.abs(a);s.field=spec.name;}}
   if(typeOf(field)==='blackhole'&&dist<field.radius){if(target)target.hp=0;else damage(s,28,12);}
  }
 }
 for(const e of s.entities){if(e.hp<=0)continue;const b=p.bodies.get(e.id);if(!b)continue;const spec=OBJECTS[typeOf(e)];
  if(isShip(typeOf(e))&&e.kind==='pirate'){
   const amp=mission.challenge?.pirateMotion??.35,x=(e.anchorX??e.x)+Math.sin(e.age*1.15+e.id)*amp,y=(e.anchorY??e.y)+Math.sin(e.age*.8+e.id)*amp*.35,v=b.linvel();
   b.addForce({x:clamp((x-e.x)*3-v.x*1.5,-4,4)*b.mass(),y:clamp((y-e.y)*3-v.y*1.5,-3,3)*b.mass(),z:clamp(-v.z*.15,-2,2)*b.mass()},true);
  }else if(e.objectType==='missile'){const v=b.linvel();b.addForce({x:clamp((s.x-e.x)*1.3-v.x,-3,3)*b.mass(),y:clamp((s.y-e.y)*1.3-v.y,-3,3)*b.mass(),z:clamp((20-v.z)*2,-10,10)*b.mass()},true);}
  if(s.status==='flying'&&spec.collect==='shield'&&Math.hypot(e.x-s.x,e.y-s.y,e.z)<e.radius+1){s.shield=8;e.hp=0;s.warning='Shield online for 8 seconds.';effect(s,'collect',e,3,spec.color);}
 }
}
function weapons(s:Flight,input:Input,hull:Hull,mission:Mission,p:FlightPhysics){
 if(input.fire&&s.cooldown<=0&&s.entities.length<MAX_ENTITIES){s.cooldown=.16;s.shots++;s.shotAge=0;const v=p.player.linvel();
  const target=s.entities.filter(e=>e.kind==='pirate'&&e.hp>0&&e.z< -3&&Math.abs(e.x-s.x)<2.2&&Math.abs(e.y-s.y)<1.8).sort((a,b)=>b.z-a.z)[0],t=target?Math.max(.15,Math.abs(target.z)/180):1;
  const shot:Entity={id:s.serial++,kind:'shot',x:s.x,y:s.y,z:-2.6,vx:target?(target.x-s.x)/t:v.x*.2,vy:target?(target.y-s.y)/t:v.y*.2,vz:v.z-150,radius:.2,mass:.02,hp:1,age:0,fire:0,ttl:3};s.entities.push(shot);p.add(shot,p.player.translation().z);effect(s,'muzzle',{x:s.x,y:s.y,z:-2},.6,'#b6faff');
 }
 for(const e of [...s.entities]){if(e.hp<=0||e.kind!=='pirate')continue;e.fire-=PHYSICS_STEP;if(s.warpAge!==null)e.fire=Math.max(e.fire,1);
  const weapon=OBJECTS[typeOf(e)].weapons;if(!weapon)continue;
  const bulletSpeed=mission.challenge?.bulletSpeed??29,aim=mission.challenge?.aimLead??.15,closing=bulletSpeed+CRUISE_SPEED*s.speed,muzzleZ=e.z+e.radius+.6,volley=Math.max(weapon.volley,mission.challenge?.volley??1);
  // Aim from the visible muzzle and leave at least 1.4 seconds before a shot can arrive.
  if(s.warpAge===null&&e.z> -210&&muzzleZ< -closing*1.4&&e.fire<=0){e.fire=(mission.challenge?.pirateInterval??2.15)*weapon.cadence;const t=-muzzleZ/closing;
   for(let j=0;j<volley&&s.entities.length<MAX_ENTITIES;j++){const side=volley===2?(j?1:-1):0,x=e.x+side*Math.min(.6,e.radius*.3);const b:Entity={id:s.serial++,kind:'hostile',ownerId:e.id,x,y:e.y,z:muzzleZ,vx:(s.x+s.vx*aim+side*.8-x)/t,vy:(s.y+s.vy*aim-e.y)/t,vz:bulletSpeed,radius:.3,mass:.04,hp:1,age:0,fire:0,ttl:7};s.entities.push(b);p.add(b,p.player.translation().z);effect(s,'muzzle',b,.8,'#ff8060');}
  }
 }
}
function tick(s:Flight,input:Input,hull:Hull,mission:Mission,r:Runtime){
 const dt=PHYSICS_STEP,p=r.physics,oldProgress=s.progress,oldPlayer={x:s.x,y:s.y,z:0};
 s.time+=dt;s.immune=Math.max(0,s.immune-dt);s.shield=Math.max(0,s.shield-dt);s.cooldown-=dt;s.shotAge+=dt;
 if(s.warpAge!==null){s.warpAge+=dt;if(s.warpAge>=WARP_DURATION-1e-8){s.warpAge=null;s.warning='Jump complete. Returning to cruise.';}}
 spawnEncounters(s,mission,p);weapons(s,input,hull,mission,p);forces(s,input,hull,mission,p);
 const old=new Map(s.entities.map(e=>[e.id,{x:e.x,y:e.y,z:e.z}]));
 const velocities=new Map([...p.bodies.entries()].map(([id,b])=>[id,b.linvel()]));velocities.set(-1,p.player.linvel());
 const contacts:[number,number][]=[];p.step((a,b)=>contacts.push([a,b]));
 const pos=p.player.translation(),vel=p.player.linvel();s.x=pos.x;s.y=pos.y;s.vx=vel.x;s.vy=vel.y;s.speed=Math.max(0,-vel.z/CRUISE_SPEED);s.progress=clamp(-pos.z/CRUISE_SPEED,0,DURATION);
 const travel=(s.progress-oldProgress)*CRUISE_SPEED;s.distanceSaved=Math.max(0,s.progress-s.time*s.cruise)*CRUISE_SPEED;
 for(const e of s.entities){if(e.kind==='portal')e.z+=travel;else p.sync(e);e.age+=dt;e.hitAge=Math.max(0,(e.hitAge??0)-dt);}
 for(const fx of s.effects){fx.age+=dt;fx.z+=travel;}s.effects=s.effects.filter(f=>f.age<f.life);
 const map=new Map(s.entities.map(e=>[e.id,e]));
 for(const [a,b] of contacts){const key=a<b?`${a}:${b}`:`${b}:${a}`;if(s.time-(r.contacts.get(key)??-99)<.5)continue;r.contacts.set(key,s.time);
  const ea=map.get(a),eb=map.get(b);if((ea&&ea.hp<=0)||(eb&&eb.hp<=0))continue;const va=velocities.get(a),vb=velocities.get(b),impactSpeed=va&&vb?Math.hypot(va.x-vb.x,va.y-vb.y,va.z-vb.z):0;
  if(a===-1||b===-1){const e=ea??eb;if(!e||OBJECTS[typeOf(e)].collect)continue;const speed=impactSpeed;if(speed<4)continue;damage(s,e.kind==='debris'?4:clamp(8+speed*.4,10,28),e.kind==='debris'?1:12);effect(s,'hit',{x:s.x,y:s.y,z:0},1,'#ff9971');if(!isField(typeOf(e)))hit(s,e,e.kind==='debris'?1:1.2,p,false);s.collisions++;}
  else if(ea&&eb){const speed=impactSpeed;if(speed<2.5)continue;const da=ea.kind==='debris'?.7:clamp(speed*.15,.4,3),db=eb.kind==='debris'?.7:clamp(speed*.15,.4,3);hit(s,ea,db,p,!!eb.credit);hit(s,eb,da,p,!!ea.credit);s.collisions++;}
 }
 const player={x:s.x,y:s.y,z:0};
 for(const shot of [...s.entities]){if(shot.hp<=0||(shot.kind!=='shot'&&shot.kind!=='hostile'))continue;let nearest:Entity|undefined,time=Infinity;
  for(const target of s.entities){if(target.hp<=0||!isSolid(target)||target.id===shot.ownerId)continue;const t=sweptTime(old.get(shot.id)??shot,shot,old.get(target.id)??target,target,target.radius+shot.radius);if(t<time){time=t;nearest=target;}}
  const playerT=shot.kind==='hostile'?sweptTime(old.get(shot.id)??shot,shot,oldPlayer,player,.65+shot.radius):Infinity;
  if(playerT<time){damage(s,16,9);shot.hp=0;effect(s,'hit',player,1,'#ff7653');}
  else if(nearest&&time!==Infinity){shot.hp=0;const body=p.bodies.get(nearest.id),direction=shot.kind==='shot'?-1:1;body?.applyImpulse({x:shot.vx*.04,y:shot.vy*.04,z:direction*3.5},true);hit(s,nearest,1,p,shot.kind==='shot');}
 }
 for(const e of s.entities){if(e.kind!=='portal'||e.hp<=0)continue;const before=old.get(e.id);if(!before||before.z>=0||e.z<0)continue;const fraction=clamp(-before.z/(e.z-before.z),0,1),x=oldPlayer.x+(s.x-oldPlayer.x)*fraction,y=oldPlayer.y+(s.y-oldPlayer.y)*fraction;e.hp=0;
  if(s.status==='flying'&&Math.hypot(x-e.x,y-e.y)<=e.radius-.65&&s.warpAge===null&&s.portalsUsed<MAX_PORTALS){s.warpAge=0;s.portalsUsed++;s.warning='JUMP ENGAGED — accelerating to 3× cruise.';effect(s,'jump',{x:s.x,y:s.y,z:0},12,'#9ef1ff');s.shield=Math.max(s.shield,1.5);
   for(const threat of s.entities){if(threat.hp<=0||threat.kind==='portal'||threat.kind==='shot'||threat.z< -220*s.cruise||threat.z>25)continue;const body=p.bodies.get(threat.id);if(!body)continue;if(threat.kind==='hostile'){threat.hp=0;continue;}const dx=threat.x-s.x,dy=threat.y-s.y,n=Math.max(.1,Math.hypot(dx,dy));body.applyImpulse({x:(n<.2?1:dx/n)*Math.min(body.mass(),12)*20,y:dy/n*Math.min(body.mass(),12)*20,z:0},true);}
  }
 }
 const survivors=s.entities.filter(e=>e.hp>0&&e.z<32&&e.z> -800&&Math.abs(e.x)<85&&Math.abs(e.y)<65&&e.age<(e.ttl??38));const ids=new Set(survivors.map(e=>e.id));for(const id of p.bodies.keys())if(!ids.has(id))p.remove(id);s.entities=survivors;
 for(const [key,t] of r.contacts)if(s.time-t>2)r.contacts.delete(key);
 if(s.hull<=0||s.cargo<=0)s.status='lost';
 if(s.status==='flying'&&s.progress>=DURATION){s.progress=DURATION;s.arrivalHull=s.hull;s.hull=s.maxHull;s.status='delivered';s.warpAge=null;s.warning='Warp Gate reached. Hull repaired; remaining cargo secured.';}
}
export function stepFlight(s:Flight,input:Input,hull:Hull,mission:Mission,dt:number){
 if(s.hull<=0||s.cargo<=0){s.status='lost';disposeFlight(s);return;}
 if(s.status!=='flying'||!Number.isFinite(dt)||dt<=0)return;
 let r=runtimes.get(s);if(!r){r={physics:new FlightPhysics(s.x,s.y,s.progress*CRUISE_SPEED,s.cruise,hull.armor),accumulator:0,contacts:new Map()};runtimes.set(s,r);}
 r.accumulator+=Math.min(dt,.1);
 while(r.accumulator>=PHYSICS_STEP-1e-9&&s.status==='flying'){tick(s,input,hull,mission,r);r.accumulator-=PHYSICS_STEP;}
 if(s.status!=='flying')disposeFlight(s);
}
