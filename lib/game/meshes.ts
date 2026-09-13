import * as THREE from "three";
import type { Hull } from "./types";
const material=(color:string,metal=.65)=>new THREE.MeshStandardMaterial({color,metalness:metal,roughness:.34,flatShading:false});
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
export function buildPortal(){
 const g=new THREE.Group();
 const metal=new THREE.MeshStandardMaterial({color:"#466572",metalness:.85,roughness:.25});
 const glow=new THREE.MeshBasicMaterial({color:new THREE.Color("#57d5ff").multiplyScalar(3)});
 const frame=new THREE.Mesh(new THREE.TorusGeometry(4.95,.22,12,96),metal);g.add(frame);
 for(const radius of [4.57,5.22])g.add(new THREE.Mesh(new THREE.TorusGeometry(radius,.065,8,96),glow));
 for(let i=0;i<12;i++){const angle=i*Math.PI/6;const block=new THREE.Mesh(new THREE.BoxGeometry(.68,.42,.7),metal);block.position.set(Math.cos(angle)*4.96,Math.sin(angle)*4.96,0);block.rotation.z=angle;g.add(block);const lamp=new THREE.Mesh(new THREE.BoxGeometry(.22,.45,.73),glow);lamp.position.copy(block.position);lamp.rotation.copy(block.rotation);g.add(lamp);}
 const membrane=new THREE.Mesh(new THREE.CircleGeometry(4.53,96),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.DoubleSide,blending:THREE.AdditiveBlending,uniforms:{time:{value:0}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,fragmentShader:`varying vec2 vUv;uniform float time;void main(){vec2 p=vUv*2.-1.;float r=length(p);float a=atan(p.y,p.x);float ripple=sin(r*38.-time*4.+sin(a*5.+time)*1.4)*.5+.5;float rim=pow(r,5.);float wisps=pow(sin(a*9.+time*.8-r*12.)*.5+.5,5.);float glow=rim*(.3+ripple*.55+wisps*.5);gl_FragColor=vec4(vec3(.18,.65,1.1)*(glow+.04),(.08+glow*.55)*(1.-smoothstep(.97,1.,r)));}`}));membrane.name="portal_membrane";g.add(membrane);return g;
}
export function disposeObject(obj:THREE.Object3D){obj.traverse(o=>{if(o instanceof THREE.Sprite){o.material.map?.dispose();o.material.dispose();}else if(o instanceof THREE.Mesh||o instanceof THREE.Points||o instanceof THREE.LineSegments){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});}
