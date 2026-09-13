import * as THREE from 'three';
import type {Hull} from './types';

export function addExhaust(root:THREE.Group,hull:Hull,enemy=false){
 root.updateMatrixWorld(true);const markers:THREE.Object3D[]=[];root.traverse(o=>{if(o.name.startsWith("exhaust_"))markers.push(o);});
 const exits=markers.length?markers.map(o=>root.worldToLocal(o.getWorldPosition(new THREE.Vector3()))):Array.from({length:hull.engines},(_,i)=>new THREE.Vector3((i-(hull.engines-1)/2)*1.13,.14,2.75));
 for(const point of exits){
  const plume=new THREE.Group();plume.position.copy(point);plume.name="engine_plume";
  const color=new THREE.Color(enemy?"#ff7855":"#49cfff").multiplyScalar(2.3);
  for(let i=0;i<2;i++){const cone=new THREE.Mesh(new THREE.ConeGeometry(i?.14:.27,i?1.35:2.05,16),new THREE.MeshBasicMaterial({color:i?new THREE.Color("#d7f8ff").multiplyScalar(3):color,transparent:true,opacity:i?.8:.25,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));cone.rotation.x=Math.PI/2;cone.position.z=i?.67:1.02;plume.add(cone);}root.add(plume);
 }
}
