"use client";
import {useEffect,useRef,useState} from 'react';
import * as THREE from 'three';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {buildPortal,buildShip,disposeObject} from '@/lib/game/meshes';
import {cloneModel,preloadModels} from '@/lib/game/assets';
import {addExhaust} from '@/lib/game/ship-exhaust';
import {portalLabelLayout} from '@/lib/game/portal-label';
import {stageEnvironment} from '@/lib/game/stage-environment';
import type {Hull} from '@/lib/game/types';
import styles from './gate-transit.module.css';

/** A normal ship crosses an open physical gate; no enclosure or gameplay world is created. */
export default function GateTransit({from,to,hull,cargo,planning,paused,onComplete,onPause}:{from:number;to:number;hull:Hull;cargo:number;planning:boolean;paused:boolean;onComplete:()=>void;onPause:()=>void}){
 const mount=useRef<HTMLDivElement>(null),label=useRef<HTMLDivElement>(null),pausedRef=useRef(paused),complete=useRef(onComplete),[error,setError]=useState(false);
 pausedRef.current=paused;complete.current=onComplete;
 useEffect(()=>{
  const el=mount.current!;const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Checkpoint gate warp');const scene=new THREE.Scene();scene.background=new THREE.Color('#06141f');const camera=new THREE.PerspectiveCamera(65,1,.1,1200);camera.position.set(0,3.5,12);camera.lookAt(0,0,-35);
  const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.06);room.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=.4;
  const gate=buildPortal();gate.getObjectByName('portal_membrane')!.visible=false;gate.scale.setScalar(2);scene.add(gate);scene.add(new THREE.AmbientLight('#a4cfff',.7));const light=new THREE.DirectionalLight('#fff0db',2.4);light.position.set(4,7,5);scene.add(light);
  const ship=new THREE.Group();ship.name='transfer_ship';ship.scale.setScalar(.55);ship.position.y=.6;scene.add(ship);let ready=false,disposed=false;
  preloadModels().then(()=>{if(disposed)return;ship.add(hull.origin==='fleet'?cloneModel(hull.id):buildShip(hull));addExhaust(ship,hull);ready=true;renderer.domElement.dataset.ship=hull.id;renderer.domElement.dataset.ready='true';}).catch(()=>{if(!disposed){setError(true);ship.add(buildShip(hull));addExhaust(ship,hull);ready=true;}});
  const a=new Float32Array(240*6);for(let i=0;i<240;i++){const t=i*2.39996,r=10+(i%29)*.8,z=-5-(i%71)*2;a.set([Math.cos(t)*r,Math.sin(t)*r,z,Math.cos(t)*r,Math.sin(t)*r,z-18],i*6);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(a,3));const stars=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#7bdcf1',transparent:true,opacity:.65}));scene.add(stars);
  const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  let raf=0,elapsed=0,last=performance.now(),done=false;
  const loop=(now:number)=>{const dt=Math.min(.06,(now-last)/1000);last=now;if(ready&&!pausedRef.current)elapsed+=dt;
   gate.position.z=-64+elapsed*26;gate.rotation.z=elapsed*.13;gate.visible=gate.position.z<20;stars.position.z=(elapsed*90)%140;
   ship.traverse(o=>{if(o.name==='engine_plume')o.scale.z=1.8+Math.sin(elapsed*32)*.04;});
   camera.updateMatrixWorld();const placement=gate.visible?portalLabelLayout({x:0,y:0,z:gate.position.z,radius:8.6},camera,el.clientWidth,el.clientHeight):null;
   if(label.current){label.current.style.display=placement?'block':'none';if(placement){Object.assign(label.current.style,{left:`${placement.x}px`,top:`${placement.bottom}px`,transform:`translate(-50%,-100%) scale(${placement.scale})`,opacity:String(placement.opacity)});}}
   renderer.render(scene,camera);if(elapsed>=3.3&&!done){done=true;complete.current();}raf=requestAnimationFrame(loop);
  };raf=requestAnimationFrame(loop);
  return()=>{disposed=true;cancelAnimationFrame(raf);observer.disconnect();disposeObject(scene);environment.dispose();renderer.dispose();renderer.domElement.remove();};
 },[from,to,hull]);
 return <section className={styles.transit} aria-label="Checkpoint transfer"><div ref={mount}/><div ref={label} className="portal-label" aria-hidden="true">Warp Gate</div><article><span>CHECKPOINT {from} COMPLETE</span><h1>{stageEnvironment(from).name}</h1><p>{planning?'Planning the next section…':`Jumping to ${stageEnvironment(to).gateName}.`}</p><small>Stage {to} · Hull fully repaired · {Math.ceil(cargo)}% cargo remaining</small>{error&&<small>Ship preview restored locally.</small>}<button className="quiet-button" onClick={onPause}>{paused?'Resume jump':'Pause jump'}</button></article></section>;
}
