import * as THREE from "three";
import type { Hull } from "./types";
const material=(color:string,metal=.65)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:.38,flatShading:true});
export function buildShip(h:Hull){
 const g=new THREE.Group();const shell=material("#71848c"),trim=material(h.color),dark=material("#162631"),glow=new THREE.MeshBasicMaterial({color:"#83fff3"});
 const shape=new THREE.Shape();h.widths.forEach((w,i)=>{const z=2.7-i*.675;if(i===0)shape.moveTo(-w,z);else shape.lineTo(-w,z);});
 [...h.widths].reverse().forEach((w,i)=>shape.lineTo(w,-2.7+i*.675));shape.closePath();
 const geometry=new THREE.ExtrudeGeometry(shape,{depth:h.thickness,bevelEnabled:true,bevelSegments:1,steps:1,bevelSize:.13,bevelThickness:.13});geometry.rotateX(-Math.PI/2);
 const body=new THREE.Mesh(geometry,shell);g.add(body);
 const nose=new THREE.Mesh(new THREE.ConeGeometry(.53,2.8,4),trim);nose.rotation.x=-Math.PI/2;nose.rotation.z=Math.PI/4;nose.position.set(0,h.thickness*.75,-.8);g.add(nose);
 const cockpit=new THREE.Mesh(new THREE.SphereGeometry(.52,8,6),material("#123c4a",.95));cockpit.scale.set(.72,.55,1.45);cockpit.position.set(0,h.thickness+.13,-.7);g.add(cockpit);
 for(let i=0;i<h.engines;i++){
  const x=(i-(h.engines-1)/2)*1.13;const e=new THREE.Mesh(new THREE.CylinderGeometry(.32,.4,1.6,8),dark);e.rotation.x=Math.PI/2;e.position.set(x,.14,1.9);g.add(e);
  const fire=new THREE.Mesh(new THREE.ConeGeometry(.27,1.8,8),glow);fire.rotation.x=Math.PI/2;fire.position.set(x,.14,3.05);fire.name="engine";g.add(fire);
 }
 for(const side of [-1,1]){const gun=new THREE.Mesh(new THREE.BoxGeometry(.16,.19,1.3),dark);gun.position.set(side*Math.max(.65,h.widths[5]*.7),.19,-.15);g.add(gun);
 const cargo=new THREE.Mesh(new THREE.BoxGeometry(.48,.35,1.05),trim);cargo.position.set(side*.65,h.thickness+.08,.9);g.add(cargo);}
 return g;
}
export function buildAsteroid(radius:number){const geometry=new THREE.IcosahedronGeometry(radius,1);const p=geometry.attributes.position;for(let i=0;i<p.count;i++){const scale=.85+Math.sin(i*12.3)*.16;p.setXYZ(i,p.getX(i)*scale,p.getY(i)*scale,p.getZ(i)*scale);}geometry.computeVertexNormals();return new THREE.Mesh(geometry,material("#80776e",.13));}
export function buildBlackhole(){const g=new THREE.Group();g.add(new THREE.Mesh(new THREE.SphereGeometry(2.3,20,16),new THREE.MeshBasicMaterial({color:"#010208"})));
 for(let i=0;i<3;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(2.7+i*.6,.08+i*.03,8,72),new THREE.MeshBasicMaterial({color:i===0?"#fff3c1":i===1?"#ffb960":"#b4562e",transparent:true,opacity:1-i*.2}));ring.rotation.x=.24;g.add(ring);}return g;
}
export function disposeObject(obj:THREE.Object3D){obj.traverse(o=>{if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.LineSegments){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});}
