"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { buildShip, buildAsteroid, buildBlackhole, disposeObject } from "@/lib/game/meshes";
import { createFlight, stepFlight, type Flight, type Input } from "@/lib/game/simulation";
import { FLEET, type Hull, type Mission } from "@/lib/game/types";
export default function SpaceScene({hull,mission,playing,paused,input,onUpdate,onError}:{hull:Hull;mission:Mission;playing:boolean;paused:boolean;input:React.RefObject<Input>;onUpdate:(s:Flight)=>void;onError:(s:string)=>void}){
 const container=useRef<HTMLDivElement>(null),pauseRef=useRef(paused),callback=useRef(onUpdate),errorRef=useRef(onError);
 pauseRef.current=paused;callback.current=onUpdate;errorRef.current=onError;
 useEffect(()=>{
  const el=container.current;if(!el)return;let renderer:THREE.WebGLRenderer;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:"high-performance"});}catch{errorRef.current("Your browser could not start 3D graphics. Enable hardware acceleration or try another browser.");return;}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,1.8));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.setClearColor(0x000000,0);el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-label",playing?"3D flight view":"Rotating 3D preview of "+hull.name);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2("#06131b",playing?.0038:.012);
  const camera=new THREE.PerspectiveCamera(playing?65:40,1,.1,700);
  scene.add(new THREE.AmbientLight("#a5dbe9",2));const sun=new THREE.DirectionalLight("#fff1d6",4.2);sun.position.set(8,13,-3);scene.add(sun);
  const fill=new THREE.DirectionalLight("#58cfff",3);fill.position.set(-6,3,8);scene.add(fill);const rim=new THREE.DirectionalLight("#ff9445",2.5);rim.position.set(0,1,-9);scene.add(rim);
  const ship=buildShip(hull);scene.add(ship);const state=createFlight(hull);if(playing)ship.scale.setScalar(.55);
  const starGeometry=new THREE.BufferGeometry(),starPositions=new Float32Array(1800);
  for(let i=0;i<600;i++){starPositions[i*3]=(Math.random()-.5)*230;starPositions[i*3+1]=(Math.random()-.5)*120;starPositions[i*3+2]=-Math.random()*350;}
  starGeometry.setAttribute("position",new THREE.BufferAttribute(starPositions,3));const stars=new THREE.Points(starGeometry,new THREE.PointsMaterial({color:"#c5edee",size:.14,transparent:true,opacity:.8}));scene.add(stars);
  const rings:THREE.Mesh[]=[];const station=new THREE.Group();
  if(playing){const dock=new THREE.Mesh(new THREE.TorusGeometry(9,.45,8,48),new THREE.MeshStandardMaterial({color:"#536e79",metalness:.7,roughness:.4}));station.add(dock);const beacon=new THREE.Mesh(new THREE.TorusGeometry(8.5,.08,6,64),new THREE.MeshBasicMaterial({color:"#a4ffe3"}));station.add(beacon);for(let i=0;i<4;i++){const arm=new THREE.Mesh(new THREE.BoxGeometry(3,2,5),new THREE.MeshStandardMaterial({color:"#273f4b",metalness:.5,roughness:.5}));const angle=i*Math.PI/2;arm.position.set(Math.cos(angle)*11,Math.sin(angle)*11,0);arm.rotation.z=angle;station.add(arm);}station.position.z=-320;station.visible=false;scene.add(station);}
  if(!playing){
   const base=new THREE.Mesh(new THREE.CylinderGeometry(4.6,4.9,.22,64),new THREE.MeshStandardMaterial({color:"#091b23",roughness:.55,metalness:.8}));base.position.y=-1.5;scene.add(base);
   for(const r of [4.5,4.7]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.018,6,96),new THREE.MeshBasicMaterial({color:"#529a9d",transparent:true,opacity:.65}));ring.rotation.x=Math.PI/2;ring.position.y=-1.35;scene.add(ring);}
   const grid=new THREE.GridHelper(10,20,"#29505a","#152e38");grid.position.y=-1.36;scene.add(grid);camera.position.set(8,6.8,10);camera.lookAt(0,-.15,0);
  }else{
   const planet=new THREE.Mesh(new THREE.SphereGeometry(23,40,32),new THREE.MeshStandardMaterial({color:"#16434e",roughness:1,metalness:.1}));planet.position.set(-65,36,-200);scene.add(planet);
   const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(23.5,32,24),new THREE.MeshBasicMaterial({color:"#419ca9",transparent:true,opacity:.13,side:THREE.BackSide}));atmosphere.position.copy(planet.position);scene.add(atmosphere);
   for(let i=0;i<7;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(14,.04,4,48),new THREE.MeshBasicMaterial({color:"#30656e",transparent:true,opacity:.36}));ring.position.z=-i*45;scene.add(ring);rings.push(ring);}
   camera.position.set(0,3.5,12);camera.lookAt(0,0,-35);
  }
  const meshes=new Map<number,THREE.Object3D>();let frame=0,last=performance.now(),elapsed=0,ui=0;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const loop=(now:number)=>{const dt=Math.min((now-last)/1000,.05);last=now;frame=requestAnimationFrame(loop);
   if(!pauseRef.current)elapsed+=dt;
   if(playing){
    if(!pauseRef.current)stepFlight(state,input.current,hull,mission,dt);
    station.visible=state.time>63;station.position.z=-330+Math.max(0,state.time-63)*26;station.rotation.z=.2;
    ship.position.set(state.x,state.y,0);ship.rotation.z=THREE.MathUtils.lerp(ship.rotation.z,-input.current.x*.28,.1);ship.rotation.x=THREE.MathUtils.lerp(ship.rotation.x,input.current.y*.1,.1);ship.visible=state.immune<=0||Math.floor(elapsed*18)%2===0;
    const follow=camera.aspect<.8?.86:.43;camera.position.x=THREE.MathUtils.lerp(camera.position.x,state.x*follow,.08);camera.position.y=THREE.MathUtils.lerp(camera.position.y,3.5+state.y*.42,.08);camera.lookAt(state.x*follow,state.y*.3,-35);
    if(!pauseRef.current&&state.status==="flying"){
     for(const ring of rings){ring.position.z+=29*dt;if(ring.position.z>15)ring.position.z-=315;}
     for(let i=0;i<600;i++){starPositions[i*3+2]+=42*dt;if(starPositions[i*3+2]>15)starPositions[i*3+2]=-340;}starGeometry.attributes.position.needsUpdate=true;
    }
    const active=new Set(state.entities.map(e=>e.id));
    for(const [id,obj] of meshes)if(!active.has(id)){scene.remove(obj);disposeObject(obj);meshes.delete(id);}
    for(const e of state.entities){let obj=meshes.get(e.id);if(!obj){
     if(e.kind==="asteroid")obj=buildAsteroid(e.radius);else if(e.kind==="blackhole")obj=buildBlackhole();else if(e.kind==="pirate"){obj=buildShip({...FLEET[1],color:"#ff5d58"});obj.rotation.y=Math.PI;obj.scale.setScalar(.65);}else{obj=new THREE.Mesh(new THREE.BoxGeometry(e.kind==="shot"?.09:.24,.12,e.kind==="shot"?2.3:1.5),new THREE.MeshBasicMaterial({color:e.kind==="shot"?"#9cfff0":"#ff6353"}));}
     scene.add(obj);meshes.set(e.id,obj);
    }obj.position.set(e.x,e.y,e.z);if(e.kind==="asteroid"){obj.rotation.x=e.age*.3;obj.rotation.z=e.age*.17;}}
    ui+=dt;if(ui>.08){ui=0;callback.current({...state,entities:[]});}
   }else{ship.rotation.y=-.5+elapsed*.12;ship.position.y=Math.sin(elapsed*.9)*.12;}
   ship.traverse(o=>{if(o.name==="engine")o.scale.y=.8+Math.sin(elapsed*36)*.15;});renderer.render(scene,camera);
  };frame=requestAnimationFrame(loop);
  const lost=(e:Event)=>{e.preventDefault();errorRef.current("3D graphics were interrupted. Reload to return to the hangar.");};renderer.domElement.addEventListener("webglcontextlost",lost);
  return()=>{cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("webglcontextlost",lost);disposeObject(scene);renderer.dispose();renderer.domElement.remove();};
 },[hull,mission,playing,input]);
 return <div className="space-canvas" ref={container}/>;
}
