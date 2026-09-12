import RAPIER from '@dimforge/rapier3d-compat';
import { OBJECTS, type ObjectType } from './objects';

let initialized=false;
let pending:Promise<void>|undefined;
export function initializePhysics(){return pending??(pending=RAPIER.init().then(()=>{initialized=true;}));}
export const PHYSICS_STEP=1/60;
export type BodyState={x:number;y:number;z:number;vx:number;vy:number;vz?:number;radius:number;id:number;kind:string;objectType?:ObjectType;mass?:number;qx?:number;qy?:number;qz?:number;qw?:number};
export class FlightPhysics {
 readonly world:RAPIER.World;
 readonly queue:RAPIER.EventQueue;
 readonly player:RAPIER.RigidBody;
 readonly bodies=new Map<number,RAPIER.RigidBody>();
 readonly colliderIds=new Map<number,number>();
 private freed=false;
 constructor(x:number,y:number,distance:number,cruise:number,armor:number){
  if(!initialized)throw new Error('Flight physics is still loading.');
  this.world=new RAPIER.World({x:0,y:0,z:0});this.queue=new RAPIER.EventQueue(true);
  this.player=this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(x,y,-distance).setLinvel(0,0,-29*cruise).setCcdEnabled(true).lockRotations().setCanSleep(false));
  const c=this.world.createCollider(RAPIER.ColliderDesc.ball(.65).setMass(armor/12.5).setRestitution(.35).setFriction(.05).setCollisionGroups((1<<16)|26).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS),this.player);
  this.colliderIds.set(c.handle,-1);
 }
 add(e:BodyState,playerZ:number){
  if(this.bodies.has(e.id))return;
  const spec=e.objectType?OBJECTS[e.objectType]:undefined,projectile=e.kind==='shot'||e.kind==='hostile';
  const mass=e.mass??spec?.mass??(e.kind==='debris'?.25:7);
  const desc=RAPIER.RigidBodyDesc.dynamic().setTranslation(e.x,e.y,playerZ+e.z).setLinvel(e.vx,e.vy,e.vz??0).setCcdEnabled(true).setCanSleep(false).setLinearDamping(0).setAngularDamping(.05);
  if(projectile)desc.lockRotations();else if(e.kind==='pirate'||e.objectType==='missile')desc.setAngularDamping(2);else desc.setAngvel({x:Math.sin(e.id*3)*.25,y:Math.cos(e.id*2)*.3,z:.12});
  const b=this.world.createRigidBody(desc);
  const group=projectile?(e.kind==='shot'?4:8):e.kind==='debris'?16:2;
  const filter=projectile?0:19;
  const base=RAPIER.ColliderDesc.ball(e.radius).setMass(mass).setRestitution(spec?.bounce??.5).setFriction(.04).setCollisionGroups((group<<16)|filter).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  const c=this.world.createCollider(base.setSensor(projectile||!!spec?.collect||e.objectType==='blackhole'),b);this.colliderIds.set(c.handle,e.id);
  this.bodies.set(e.id,b);
 }
 remove(id:number){const b=this.bodies.get(id);if(!b)return;for(let i=0;i<b.numColliders();i++)this.colliderIds.delete(b.collider(i).handle);this.world.removeRigidBody(b);this.bodies.delete(id);}
 sync(e:BodyState){const b=this.bodies.get(e.id);if(!b)return;const p=b.translation(),v=b.linvel(),q=b.rotation();e.x=p.x;e.y=p.y;e.z=p.z-this.player.translation().z;e.vx=v.x;e.vy=v.y;e.vz=v.z;e.qx=q.x;e.qy=q.y;e.qz=q.z;e.qw=q.w;}
 step(onContact:(a:number,b:number)=>void){this.world.timestep=PHYSICS_STEP;this.world.step(this.queue);this.queue.drainCollisionEvents((a,b,started)=>{if(started){const x=this.colliderIds.get(a),y=this.colliderIds.get(b);if(x!==undefined&&y!==undefined&&x!==y)onContact(x,y);}});}
 dispose(){if(this.freed)return;this.freed=true;this.queue.free();this.world.free();this.bodies.clear();this.colliderIds.clear();}
}
