"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildShip, buildPortal, disposeObject } from "@/lib/game/meshes";
import {buildDestinationPlanet,buildStageBackground,stageEnvironment} from "@/lib/game/space-environment";
import { cloneModel, preloadModels } from "@/lib/game/assets";
import { createFlight, stepFlight, initializePhysics, disposeFlight, spawnObject, type Flight, type Input } from "@/lib/game/simulation";
import { FLEET, ARRIVAL_START, DURATION, CRUISE_SPEED, WARP_MAX_SPEED, type Hull, type Mission } from "@/lib/game/types";

import {portalLabelLayout,projectedBodyRect,overlaps,type ScreenRect} from "@/lib/game/portal-label";
import {buildEncounterVisual,updateEncounterVisual,buildEffectVisual,updateEffectVisual,createDamageTrail,updateShipDamage} from "@/lib/game/combat-visuals";

function addExhaust(root:THREE.Group,hull:Hull,enemy=false){
 root.updateMatrixWorld(true);const markers:THREE.Object3D[]=[];root.traverse(o=>{if(o.name.startsWith("exhaust_"))markers.push(o);});
 const exits=markers.length?markers.map(o=>root.worldToLocal(o.getWorldPosition(new THREE.Vector3()))):Array.from({length:hull.engines},(_,i)=>new THREE.Vector3((i-(hull.engines-1)/2)*1.13,.14,2.75));
 for(const point of exits){
  const plume=new THREE.Group();plume.position.copy(point);plume.name="engine_plume";
  const color=new THREE.Color(enemy?"#ff7855":"#49cfff").multiplyScalar(2.3);
  for(let i=0;i<2;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(i?.14:.27,i?1.35:2.05,16),new THREE.MeshBasicMaterial({color:i?new THREE.Color("#d7f8ff").multiplyScalar(3):color,transparent:true,opacity:i?.8:.25,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));cone.rotation.x=Math.PI/2;cone.position.z=i?.67:1.02;plume.add(cone);}root.add(plume);
 }
}
export default function SpaceScene({hull,mission,stage,playing,paused,input,onUpdate,onError,onReady}:{hull:Hull;mission:Mission;stage:number;playing:boolean;paused:boolean;input:React.RefObject<Input>;onUpdate:(s:Flight)=>void;onError:(s:string)=>void;onReady:(ready:boolean)=>void}){
 const container=useRef<HTMLDivElement>(null),portalLabel=useRef<HTMLDivElement>(null),pauseRef=useRef(paused),callback=useRef(onUpdate),errorRef=useRef(onError),readyRef=useRef(onReady);
 const [loading,setLoading]=useState(true);
 pauseRef.current=paused;callback.current=onUpdate;errorRef.current=onError;readyRef.current=onReady;
 useEffect(()=>{
  const el=container.current;if(!el)return;let renderer:THREE.WebGLRenderer;
  setLoading(true);readyRef.current(false);let disposed=false,ready=false;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});}catch{errorRef.current("Your browser could not start 3D graphics. Enable hardware acceleration or try another browser.");return;}
  const mobile=el.clientWidth<600;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,mobile?1.35:1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=!playing;renderer.shadowMap.type=THREE.PCFShadowMap;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-label",playing?"3D flight view":"Rotating 3D preview of "+hull.name);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2("#081522",playing?.0023:.008);
  const profile=stageEnvironment(stage),background=buildStageBackground(profile);scene.background=background;renderer.domElement.dataset.environment=profile.kind;renderer.domElement.dataset.environmentSeed=String(profile.seed);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.06);room.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=playing?.35:.4;
  const camera=new THREE.PerspectiveCamera(playing?65:40,1,.1,6000);camera.layers.enable(1);
  scene.add(new THREE.AmbientLight("#9eb9ce",.35));
  const sun=new THREE.DirectionalLight("#fff0db",2.4);sun.position.set(4,9,5);sun.castShadow=!playing;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:35});sun.shadow.normalBias=.025;sun.shadow.bias=-.0003;scene.add(sun);
  const fill=new THREE.DirectionalLight("#79b5ed",1.1);fill.position.set(-6,3,2);scene.add(fill);
  const rim=new THREE.DirectionalLight("#c4ecff",1.3);rim.position.set(-2,4,-8);scene.add(rim);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.25,.5,1.8);composer.addPass(bloom);composer.addPass(new OutputPass());
  const ship=new THREE.Group();scene.add(ship);const state=createFlight(hull);if(playing)ship.scale.setScalar(.55);
  const starCount=mobile?400:700,starCenters=new Float32Array(starCount*3),starLines=new Float32Array(starCount*6),starGeometry=new THREE.BufferGeometry();
  for(let i=0;i<starCount;i++){const angle=Math.random()*Math.PI*2,radius=12+Math.random()*115;starCenters[i*3]=Math.cos(angle)*radius;starCenters[i*3+1]=Math.sin(angle)*radius;starCenters[i*3+2]=-Math.random()*480;}
  starGeometry.setAttribute("position",new THREE.BufferAttribute(starLines,3));const starMaterial=new THREE.LineBasicMaterial({color:profile.star,transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false});const stars=new THREE.LineSegments(starGeometry,starMaterial);stars.frustumCulled=false;scene.add(stars);
  const destination=playing?buildDestinationPlanet(profile,mobile):null;if(destination)scene.add(destination.group);
  const station=new THREE.Group();
  if(playing){
   const terminal=buildPortal();terminal.scale.setScalar(2);station.add(terminal);station.name='checkpoint_gate';station.visible=false;scene.add(station);
   camera.position.set(0,3.5,12);camera.lookAt(0,0,-35);
  }else{
   const base=new THREE.Mesh(new THREE.CylinderGeometry(4.1,4.22,.25,96),new THREE.MeshStandardMaterial({color:"#10212a",roughness:.75,metalness:.15}));base.position.y=-1.4;base.receiveShadow=true;scene.add(base);
   for(const r of [3.9,4.1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.018,8,100),new THREE.MeshBasicMaterial({color:new THREE.Color("#80bbcb").multiplyScalar(1.3)}));ring.rotation.x=Math.PI/2;ring.position.y=-1.265;scene.add(ring);}
   const grid=new THREE.GridHelper(7.8,16,"#223e4b","#182e3a");grid.position.y=-1.263;scene.add(grid);camera.position.set(8,7.5,10);camera.lookAt(0,-.15,0);
  }
  Promise.all([preloadModels(),initializePhysics(),destination?.ready]).then(()=>{
   if(disposed)return;ship.add(hull.origin==="fleet"?cloneModel(hull.id):buildShip(hull));addExhaust(ship,hull);
   if(playing)for(let i=0;i<8;i++){const e=spawnObject(state,i%2?'ice-asteroid':'iron-asteroid',(i%2?1:-1)*(19+i%3*4),Math.sin(i*1.7)*11,-50-i*36,{x:Math.sin(i)*.2});e.radius=2+i%3;e.mass=12+i*2;}

   renderer.domElement.dataset.modelSource=hull.origin==="fleet"?"blender":"local-custom";ready=true;setLoading(false);readyRef.current(true);
  }).catch(()=>{if(!disposed)errorRef.current("The 3D models or physics engine could not load. Reload the game to try again.");});
  const meshes=new Map<number,THREE.Object3D>(),effects=new Map<number,THREE.Object3D>();const damageTrail=createDamageTrail();damageTrail.visible=playing;scene.add(damageTrail);let frame=0,last=performance.now(),elapsed=0,ui=0;
  let protectedUI:ScreenRect[]=[],aimingArea:ScreenRect|undefined;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();const origin=el.getBoundingClientRect();protectedUI=Array.from(el.parentElement?.querySelectorAll('.hud-top,.warp-status,.flight-message,.flight-bottom,.touch-controls,.aim-reticle')??[]).map(node=>{const r=node.getBoundingClientRect();const bounds={left:r.left-origin.left-6,right:r.right-origin.left+6,top:r.top-origin.top-6,bottom:r.bottom-origin.top+6};if(node.classList.contains('aim-reticle'))aimingArea=bounds;return bounds;}).filter(r=>r.right-r.left>12&&r.bottom-r.top>12);};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const loop=(now:number)=>{
   const dt=Math.min((now-last)/1000,.1);last=now;frame=requestAnimationFrame(loop);
   const active=ready&&!pauseRef.current;let advance=0;if(active)elapsed+=dt;
   if(playing&&ready){
    const before=state.progress;if(active)stepFlight(state,input.current,hull,mission,dt);advance=state.progress-before;
    destination?.update(state.progress,elapsed);station.visible=state.progress>ARRIVAL_START;station.position.z=-(DURATION-state.progress)*CRUISE_SPEED-18;station.rotation.z=.2;const terminalMembrane=station.getObjectByName('portal_membrane') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;terminalMembrane.material.uniforms.time.value=elapsed;
    ship.position.set(state.x,state.y,Math.exp(-state.shotAge*32)*.18);ship.rotation.z=THREE.MathUtils.lerp(ship.rotation.z,-state.vx*.026,.1);ship.rotation.x=THREE.MathUtils.lerp(ship.rotation.x,state.vy*.013,.1);updateShipDamage(ship,damageTrail,state,elapsed);
    const follow=camera.aspect<.8?.86:.43;camera.position.x=THREE.MathUtils.lerp(camera.position.x,state.x*follow,.08);camera.position.y=THREE.MathUtils.lerp(camera.position.y,3.5+state.y*.42,.08);camera.lookAt(state.x*follow,state.y*.3,-35);
    const desiredFov=65+Math.max(0,state.speed/state.cruise-1)*8;camera.fov=THREE.MathUtils.lerp(camera.fov,desiredFov,.1);camera.updateProjectionMatrix();bloom.strength=.25+(state.speed-1)*.18;
    const ids=new Set(state.entities.map(e=>e.id));for(const [id,obj] of meshes)if(!ids.has(id)){scene.remove(obj);disposeObject(obj);meshes.delete(id);}
    let nearestPortal:typeof state.entities[number]|undefined;
    for(const e of state.entities){let obj=meshes.get(e.id);if(!obj){obj=buildEncounterVisual(e);scene.add(obj);meshes.set(e.id,obj);}updateEncounterVisual(e,obj,elapsed,camera);if(e.kind==='portal'&&e.z< -8&&(!nearestPortal||e.z>nearestPortal.z))nearestPortal=e;}
    const fxIds=new Set(state.effects.map(e=>e.id));for(const [id,obj] of effects)if(!fxIds.has(id)){scene.remove(obj);disposeObject(obj);effects.delete(id);}
    for(const fx of state.effects){let obj=effects.get(fx.id);if(!obj){obj=buildEffectVisual(fx);scene.add(obj);effects.set(fx.id,obj);}updateEffectVisual(fx,obj);}
    if(portalLabel.current){
     const label=portalLabel.current;camera.updateMatrixWorld();
     const placement=nearestPortal?portalLabelLayout(nearestPortal,camera,el.clientWidth,el.clientHeight,aimingArea):null;
     const bodies=[{x:state.x,y:state.y,z:0,radius:1.8},...state.entities.filter(e=>e.kind!=='portal'&&e.kind!=='shot'&&e.hp>0)];
     const obscured=placement&&(protectedUI.some(r=>overlaps(placement.rect,r))||bodies.some(e=>{const r=projectedBodyRect(e,camera,el.clientWidth,el.clientHeight);return r&&overlaps(placement.rect,r);}));
     label.style.display=placement&&!obscured?'block':'none';
     if(placement){label.style.left=`${placement.x}px`;label.style.top=`${placement.bottom}px`;label.style.transform=`translate(-50%,-100%) scale(${placement.scale})`;label.style.opacity=String(placement.opacity);}
    }
    ui+=dt;if(ui>.08){ui=0;if(process.env.NODE_ENV==='development')renderer.domElement.dataset.flightState=JSON.stringify({x:state.x,y:state.y,progress:state.progress,speed:state.speed,entities:state.entities});renderer.domElement.dataset.progress=state.progress.toFixed(2);renderer.domElement.dataset.stage=String(mission.stage??1);renderer.domElement.dataset.seed=String(mission.seed??0);callback.current({...state,entities:[],effects:[]});}
   }else if(!playing){ship.rotation.y=2.0+elapsed*.08;ship.position.y=Math.sin(elapsed*.8)*.06;}
   const warp=THREE.MathUtils.clamp((state.speed/state.cruise-1)/(WARP_MAX_SPEED-1),0,1);
   for(let i=0;i<starCount;i++){const p=i*3,l=i*6;if(playing){starCenters[p+2]+=advance*42;if(starCenters[p+2]>25)starCenters[p+2]-=500;}
    const x=starCenters[p],y=starCenters[p+1],z=starCenters[p+2],length=playing?.35+warp*warp*62:.2;starLines[l]=x;starLines[l+1]=y;starLines[l+2]=z;starLines[l+3]=x;starLines[l+4]=y;starLines[l+5]=z-length;}
   starGeometry.attributes.position.needsUpdate=true;starMaterial.opacity=.6+warp*.4;
   ship.traverse(o=>{if(o.name==="engine_plume")o.scale.z=(playing?1:.28)*(.85+Math.sin(elapsed*32)*.035)*(1+warp*.9);});
   composer.render();
  };frame=requestAnimationFrame(loop);
  const lost=(e:Event)=>{e.preventDefault();errorRef.current("3D graphics were interrupted. Reload to return to the hangar.");};renderer.domElement.addEventListener("webglcontextlost",lost);
  return()=>{disposed=true;disposeFlight(state);cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("webglcontextlost",lost);disposeObject(scene);background.dispose();destination?.dispose();environment.dispose();bloom.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove();};
 },[hull,mission,stage,playing,input]);
 return <><div className="space-canvas" ref={container}/><div className="portal-label" ref={portalLabel} aria-hidden="true">JUMP GATE</div>{loading&&<div className="model-loading" role="status">Warming up flight systems…</div>}</>;
}
