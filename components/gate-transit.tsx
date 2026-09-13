"use client";
import {useEffect,useRef} from 'react';
import * as THREE from 'three';
import {buildPortal,disposeObject} from '@/lib/game/meshes';
import {stageEnvironment} from '@/lib/game/stage-environment';
import styles from './route-map.module.css';

/** Presentation only: never advances a completed physics world or consumes optional gates. */
export default function GateTransit({from,to,paused,onComplete,onPause}:{from:number;to:number;paused:boolean;onComplete:()=>void;onPause:()=>void}){
 const mount=useRef<HTMLDivElement>(null),pausedRef=useRef(paused),complete=useRef(onComplete);
 pausedRef.current=paused;complete.current=onComplete;
 useEffect(()=>{
  const el=mount.current!;const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));el.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Checkpoint gate warp');const scene=new THREE.Scene();scene.background=new THREE.Color('#06141f');const camera=new THREE.PerspectiveCamera(65,1,.1,1200);
  const gate=buildPortal();scene.add(gate);scene.add(new THREE.AmbientLight('#a4edff',2));const light=new THREE.DirectionalLight('#ffffff',3);light.position.set(4,7,5);scene.add(light);
  const a=new Float32Array(240*6);for(let i=0;i<240;i++){const t=i*2.39996,r=6+(i%29)*.8,z=-5-(i%71)*2;a.set([Math.cos(t)*r,Math.sin(t)*r,z,Math.cos(t)*r,Math.sin(t)*r,z-18],i*6);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(a,3));const stars=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:'#7bdcf1',transparent:true,opacity:.65}));scene.add(stars);
  const resize=()=>{renderer.setSize(el.clientWidth,el.clientHeight);camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();};const observer=new ResizeObserver(resize);observer.observe(el);resize();
  let raf=0,elapsed=0,last=performance.now(),done=false;
  const loop=(now:number)=>{const dt=Math.min(.06,(now-last)/1000);last=now;if(!pausedRef.current)elapsed+=dt;
   gate.position.z=-26+elapsed*10;gate.rotation.z=elapsed*.13;stars.position.z=(elapsed*90)%140;
   const membrane=gate.getObjectByName('portal_membrane') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;membrane.material.uniforms.time.value=elapsed;
   renderer.render(scene,camera);if(elapsed>=3.3&&!done){done=true;complete.current();return;}raf=requestAnimationFrame(loop);
  };raf=requestAnimationFrame(loop);
  return()=>{cancelAnimationFrame(raf);observer.disconnect();disposeObject(scene);renderer.dispose();renderer.domElement.remove();};
 },[from,to]);
 return <section className={styles.transit} aria-label="Checkpoint transfer"><div ref={mount}/><article><span>CHECKPOINT {from} COMPLETE</span><h1>{stageEnvironment(from).name}</h1><p>Supplies received. Jumping to {stageEnvironment(to).gateName}.</p><small>Stage {to} · Hull repaired · Cargo replenished</small><button className="quiet-button" onClick={onPause}>{paused?'Resume jump':'Pause jump'}</button></article></section>;
}
