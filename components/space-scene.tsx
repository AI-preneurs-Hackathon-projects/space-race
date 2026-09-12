"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { buildShip, buildPortal, disposeObject } from "@/lib/game/meshes";
import { cloneModel, preloadModels } from "@/lib/game/assets";
import { createFlight, stepFlight, type Flight, type Input } from "@/lib/game/simulation";
import { FLEET, ARRIVAL_START, DURATION, CRUISE_SPEED, type Hull, type Mission } from "@/lib/game/types";

function addExhaust(root:THREE.Group,hull:Hull,enemy=false){
 root.updateMatrixWorld(true);const markers:THREE.Object3D[]=[];root.traverse(o=>{if(o.name.startsWith("exhaust_"))markers.push(o);});
 const exits=markers.length?markers.map(o=>root.worldToLocal(o.getWorldPosition(new THREE.Vector3()))):Array.from({length:hull.engines},(_,i)=>new THREE.Vector3((i-(hull.engines-1)/2)*1.13,.14,2.75));
 for(const point of exits){
  const plume=new THREE.Group();plume.position.copy(point);plume.name="engine_plume";
  const color=new THREE.Color(enemy?"#ff7855":"#49cfff").multiplyScalar(2.3);
  for(let i=0;i<2;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(i?.14:.27,i?1.35:2.05,16),new THREE.MeshBasicMaterial({color:i?new THREE.Color("#d7f8ff").multiplyScalar(3):color,transparent:true,opacity:i?.8:.25,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));cone.rotation.x=Math.PI/2;cone.position.z=i?.67:1.02;plume.add(cone);}root.add(plume);
 }
}
export default function SpaceScene({hull,mission,playing,paused,input,onUpdate,onError,onReady}:{hull:Hull;mission:Mission;playing:boolean;paused:boolean;input:React.RefObject<Input>;onUpdate:(s:Flight)=>void;onError:(s:string)=>void;onReady:(ready:boolean)=>void}){
 const container=useRef<HTMLDivElement>(null),portalLabel=useRef<HTMLDivElement>(null),pauseRef=useRef(paused),callback=useRef(onUpdate),errorRef=useRef(onError),readyRef=useRef(onReady);
 const [loading,setLoading]=useState(true);
 pauseRef.current=paused;callback.current=onUpdate;errorRef.current=onError;readyRef.current=onReady;
 useEffect(()=>{
  const el=container.current;if(!el)return;let renderer:THREE.WebGLRenderer;
  setLoading(true);readyRef.current(false);let disposed=false,ready=false;
  try{renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,powerPreference:"high-performance"});}catch{errorRef.current("Your browser could not start 3D graphics. Enable hardware acceleration or try another browser.");return;}
  const mobile=el.clientWidth<600;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio,mobile?1.35:1.65));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  renderer.shadowMap.enabled=!playing;renderer.shadowMap.type=THREE.PCFSoftShadowMap;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute("aria-label",playing?"3D flight view":"Rotating 3D preview of "+hull.name);
  const scene=new THREE.Scene();scene.fog=new THREE.FogExp2("#081522",playing?.0023:.008);
  const background=new THREE.TextureLoader().load("/nebula.png");background.colorSpace=THREE.SRGBColorSpace;scene.background=background;
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.06);room.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=playing?.35:.4;
  const camera=new THREE.PerspectiveCamera(playing?65:40,1,.1,900);
  scene.add(new THREE.AmbientLight("#9eb9ce",.35));
  const sun=new THREE.DirectionalLight("#fff0db",2.4);sun.position.set(4,9,5);sun.castShadow=!playing;sun.shadow.mapSize.set(1024,1024);Object.assign(sun.shadow.camera,{left:-8,right:8,top:8,bottom:-8,near:.1,far:35});sun.shadow.normalBias=.025;sun.shadow.bias=-.0003;scene.add(sun);
  const fill=new THREE.DirectionalLight("#79b5ed",1.1);fill.position.set(-6,3,2);scene.add(fill);
  const rim=new THREE.DirectionalLight("#c4ecff",1.3);rim.position.set(-2,4,-8);scene.add(rim);
  const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(800,600),.25,.5,1.8);composer.addPass(bloom);composer.addPass(new OutputPass());
  const ship=new THREE.Group();scene.add(ship);const state=createFlight(hull);if(playing)ship.scale.setScalar(.55);
  const starCount=mobile?400:700,starCenters=new Float32Array(starCount*3),starLines=new Float32Array(starCount*6),starGeometry=new THREE.BufferGeometry();
  for(let i=0;i<starCount;i++){const angle=Math.random()*Math.PI*2,radius=12+Math.random()*115;starCenters[i*3]=Math.cos(angle)*radius;starCenters[i*3+1]=Math.sin(angle)*radius;starCenters[i*3+2]=-Math.random()*480;}
  starGeometry.setAttribute("position",new THREE.BufferAttribute(starLines,3));const starMaterial=new THREE.LineBasicMaterial({color:"#91c3ed",transparent:true,opacity:.65,blending:THREE.AdditiveBlending,depthWrite:false});const stars=new THREE.LineSegments(starGeometry,starMaterial);stars.frustumCulled=false;scene.add(stars);
  const rings:THREE.Mesh[]=[],scenery:THREE.Group[]=[];const station=new THREE.Group();
  if(playing){
   const dock=new THREE.Mesh(new THREE.TorusGeometry(9,.45,12,80),new THREE.MeshStandardMaterial({color:"#536e79",metalness:.7,roughness:.35}));station.add(dock);
   const beacon=new THREE.Mesh(new THREE.TorusGeometry(8.5,.08,8,80),new THREE.MeshBasicMaterial({color:new THREE.Color("#a4ffe3").multiplyScalar(2)}));station.add(beacon);
   for(let i=0;i<4;i++){const arm=new THREE.Mesh(new THREE.BoxGeometry(3,2,5),new THREE.MeshStandardMaterial({color:"#273f4b",metalness:.5,roughness:.5}));const angle=i*Math.PI/2;arm.position.set(Math.cos(angle)*11,Math.sin(angle)*11,0);arm.rotation.z=angle;station.add(arm);}station.visible=false;scene.add(station);
   const planet=new THREE.Mesh(new THREE.SphereGeometry(23,48,32),new THREE.MeshStandardMaterial({color:"#234b62",roughness:1,metalness:0}));planet.position.set(-65,36,-220);scene.add(planet);
   const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(23.55,40,28),new THREE.MeshBasicMaterial({color:"#438aae",transparent:true,opacity:.16,side:THREE.BackSide}));atmosphere.position.copy(planet.position);scene.add(atmosphere);
   for(let i=0;i<6;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(15,.025,4,64),new THREE.MeshBasicMaterial({color:"#376277",transparent:true,opacity:.2}));ring.position.z=-i*60;scene.add(ring);rings.push(ring);}
   camera.position.set(0,3.5,12);camera.lookAt(0,0,-35);
  }else{
   const base=new THREE.Mesh(new THREE.CylinderGeometry(4.1,4.22,.25,96),new THREE.MeshStandardMaterial({color:"#10212a",roughness:.75,metalness:.15}));base.position.y=-1.4;base.receiveShadow=true;scene.add(base);
   for(const r of [3.9,4.1]){const ring=new THREE.Mesh(new THREE.TorusGeometry(r,.018,8,100),new THREE.MeshBasicMaterial({color:new THREE.Color("#80bbcb").multiplyScalar(1.3)}));ring.rotation.x=Math.PI/2;ring.position.y=-1.265;scene.add(ring);}
   const grid=new THREE.GridHelper(7.8,16,"#223e4b","#182e3a");grid.position.y=-1.263;scene.add(grid);camera.position.set(8,7.5,10);camera.lookAt(0,-.15,0);
  }
  preloadModels().then(()=>{
   if(disposed)return;ship.add(hull.origin==="fleet"?cloneModel(hull.id):buildShip(hull));addExhaust(ship,hull);
   if(playing)for(let i=0;i<(mobile?9:14);i++){const rock=cloneModel(`asteroid-${i%3+1}`);rock.scale.setScalar(2.5+i%4);rock.position.set((i%2?1:-1)*(20+i%5*7),Math.sin(i*1.7)*18,-40-i*31);rock.rotation.set(i*.7,i*.4,i);scene.add(rock);scenery.push(rock);}
   renderer.domElement.dataset.modelSource=hull.origin==="fleet"?"blender":"local-custom";ready=true;setLoading(false);readyRef.current(true);
  }).catch(()=>{if(!disposed)errorRef.current("The 3D models could not load. Refresh the game to try again.");});
  const meshes=new Map<number,THREE.Object3D>();let frame=0,last=performance.now(),elapsed=0,ui=0;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;renderer.setSize(w,h);composer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  const projected=new THREE.Vector3();
  const loop=(now:number)=>{
   const dt=Math.min((now-last)/1000,.05);last=now;frame=requestAnimationFrame(loop);
   const active=ready&&!pauseRef.current;let advance=0;if(active)elapsed+=dt;
   if(playing&&ready){
    const before=state.progress;if(active)stepFlight(state,input.current,hull,mission,dt);advance=state.progress-before;
    station.visible=state.progress>ARRIVAL_START;station.position.z=-(DURATION-state.progress)*CRUISE_SPEED-18;station.rotation.z=.2;
    ship.position.set(state.x,state.y,0);ship.rotation.z=THREE.MathUtils.lerp(ship.rotation.z,-input.current.x*.28,.1);ship.rotation.x=THREE.MathUtils.lerp(ship.rotation.x,input.current.y*.1,.1);ship.visible=state.immune<=0||Math.floor(elapsed*18)%2===0;
    const follow=camera.aspect<.8?.86:.43;camera.position.x=THREE.MathUtils.lerp(camera.position.x,state.x*follow,.08);camera.position.y=THREE.MathUtils.lerp(camera.position.y,3.5+state.y*.42,.08);camera.lookAt(state.x*follow,state.y*.3,-35);
    const desiredFov=65+(state.speed-1)*12;camera.fov=THREE.MathUtils.lerp(camera.fov,desiredFov,.1);camera.updateProjectionMatrix();bloom.strength=.25+(state.speed-1)*.18;
    for(const ring of rings){ring.position.z+=CRUISE_SPEED*advance;if(ring.position.z>15)ring.position.z-=360;}
    for(const rock of scenery){rock.position.z+=CRUISE_SPEED*advance;if(rock.position.z>30)rock.position.z-=490;if(active){rock.rotation.x+=dt*.035;rock.rotation.y+=dt*.02;}}
    const ids=new Set(state.entities.map(e=>e.id));for(const [id,obj] of meshes)if(!ids.has(id)){scene.remove(obj);disposeObject(obj);meshes.delete(id);}
    let nearestPortal:typeof state.entities[number]|undefined;
    for(const e of state.entities){let obj=meshes.get(e.id);if(!obj){
      if(e.kind==="asteroid"){obj=cloneModel(`asteroid-${e.id%3+1}`);obj.scale.setScalar(e.radius);}
      else if(e.kind==="portal")obj=buildPortal();
      else if(e.kind==="pirate"){const model=cloneModel("wraith");model.traverse(o=>{if(o instanceof THREE.Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];for(const m of materials)if(m instanceof THREE.MeshStandardMaterial&&/accent|engine_core/i.test(m.name)){m.color.set("#d65b44");if(/engine_core/i.test(m.name))m.emissive.set("#ff4b2c");}}});addExhaust(model,FLEET[1],true);obj=model;obj.rotation.y=Math.PI;obj.scale.setScalar(.6);}
      else obj=new THREE.Mesh(new THREE.CapsuleGeometry(e.kind==="shot"?.055:.13,e.kind==="shot"?2:1.4,2,6),new THREE.MeshBasicMaterial({color:new THREE.Color(e.kind==="shot"?"#99f9ff":"#ff604a").multiplyScalar(3)}));
      if(e.kind==="shot"||e.kind==="hostile")obj.rotation.x=Math.PI/2;scene.add(obj);meshes.set(e.id,obj);
     }
     obj.position.set(e.x,e.y,e.z);if(e.kind==="asteroid"){obj.rotation.x=e.id*.75+e.age*.14;obj.rotation.z=e.id+e.age*.09;}
     if(e.kind==="portal"){const membrane=obj.getObjectByName("portal_membrane") as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;membrane.material.uniforms.time.value=elapsed;if(e.z< -8&&(!nearestPortal||e.z>nearestPortal.z))nearestPortal=e;}
    }
    if(portalLabel.current){const label=portalLabel.current;if(nearestPortal){projected.set(nearestPortal.x,nearestPortal.y+6,nearestPortal.z).project(camera);label.style.display=Math.abs(projected.x)<.9&&Math.abs(projected.y)<.9?"block":"none";label.style.left=`${(projected.x*.5+.5)*el.clientWidth}px`;label.style.top=`${(-projected.y*.5+.5)*el.clientHeight}px`;}else label.style.display="none";}
    ui+=dt;if(ui>.08){ui=0;callback.current({...state,entities:[]});}
   }else if(!playing){ship.rotation.y=2.0+elapsed*.08;ship.position.y=Math.sin(elapsed*.8)*.06;}
   const warp=(state.speed-1)/1.2;
   for(let i=0;i<starCount;i++){const p=i*3,l=i*6;if(playing){starCenters[p+2]+=advance*42;if(starCenters[p+2]>25)starCenters[p+2]-=500;}
    const x=starCenters[p],y=starCenters[p+1],z=starCenters[p+2],length=playing?.35+warp*warp*62:.2;starLines[l]=x;starLines[l+1]=y;starLines[l+2]=z;starLines[l+3]=x;starLines[l+4]=y;starLines[l+5]=z-length;}
   starGeometry.attributes.position.needsUpdate=true;starMaterial.opacity=.6+warp*.4;
   ship.traverse(o=>{if(o.name==="engine_plume")o.scale.z=(playing?1:.28)*(.85+Math.sin(elapsed*32)*.035)*(1+warp*.9);});
   composer.render();
  };frame=requestAnimationFrame(loop);
  const lost=(e:Event)=>{e.preventDefault();errorRef.current("3D graphics were interrupted. Reload to return to the hangar.");};renderer.domElement.addEventListener("webglcontextlost",lost);
  return()=>{disposed=true;cancelAnimationFrame(frame);observer.disconnect();renderer.domElement.removeEventListener("webglcontextlost",lost);disposeObject(scene);background.dispose();environment.dispose();bloom.dispose();composer.dispose();renderer.dispose();renderer.domElement.remove();};
 },[hull,mission,playing,input]);
 return <><div className="space-canvas" ref={container}/><div className="portal-label" ref={portalLabel}>JUMP PORTAL<small>FLY THROUGH THE OPENING</small></div>{loading&&<div className="model-loading" role="status">Warming up flight systems…</div>}</>;
}
