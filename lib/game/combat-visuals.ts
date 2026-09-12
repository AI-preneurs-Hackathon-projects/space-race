import * as THREE from 'three';
import { cloneModel } from './assets';
import { buildPortal } from './meshes';
import { OBJECTS, isField } from './objects';
import { typeOf, type Entity, type Flight, type FlightEffect } from './simulation';

const impactColor=new THREE.Color('#ffb58c');
const glow=(color:string,opacity=.8)=>new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(1.8),transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
function fieldMesh(e:Entity){
 const id=typeOf(e),spec=OBJECTS[id],g=new THREE.Group();
 const core=new THREE.Mesh(new THREE.SphereGeometry(1,32,20),id==='blackhole'?new THREE.MeshBasicMaterial({color:'#010108'}):new THREE.MeshStandardMaterial({color:spec.color,roughness:id==='moon'?.95:.55,metalness:id==='repulsor'?.8:.1,emissive:id==='repulsor'?'#1c7766':'#000000',emissiveIntensity:.6}));g.add(core);
 if(id==='moon'){const craters=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.18,1),new THREE.MeshStandardMaterial({color:'#647585',roughness:1}),14);const dummy=new THREE.Object3D();for(let i=0;i<14;i++){const a=i*2.399,y=1-2*(i+.5)/14,r=Math.sqrt(1-y*y);dummy.position.set(Math.cos(a)*r*.92,y*.92,Math.sin(a)*r*.92);dummy.scale.setScalar(.5+(i%3)*.25);dummy.updateMatrix();craters.setMatrixAt(i,dummy.matrix);}g.add(craters);}
 if(id==='planet'||id==='blackhole'||id==='repulsor'){
  const rings=id==='blackhole'?3:2;for(let i=0;i<rings;i++){const ring=new THREE.Mesh(new THREE.TorusGeometry(1.25+i*.28,id==='blackhole'?.025:.06,6,80),glow(id==='blackhole'?i%2?'#fff5c0':'#ffb16f':spec.color,.55-i*.12));ring.rotation.x=id==='repulsor'?i*Math.PI/2:1.05;ring.rotation.y=.25;ring.name='field_ring';g.add(ring);}
 }
 // Faint orbit arcs show the force direction, without covering the flight corridor.
 const flow=new THREE.Group();flow.name='field_flow';
 for(let i=0;i<3;i++){const arc=new THREE.Mesh(new THREE.TorusGeometry(2.2+i*.6,.009,3,40,Math.PI*1.25),glow(spec.color,.25));arc.rotation.set(.4+i*.6,.3,i*2.1);flow.add(arc);}g.add(flow);
 g.scale.setScalar(e.radius);return g;
}
export function buildEncounterVisual(e:Entity){
 const id=typeOf(e),root=new THREE.Group(),body=new THREE.Group();body.name='body';root.add(body);
 if(e.kind==='shot'||e.kind==='hostile'){
  const beam=new THREE.Mesh(new THREE.CapsuleGeometry(e.kind==='shot'?.045:.1,e.kind==='shot'?2.1:1.2,2,6),glow(e.kind==='shot'?'#affbff':'#ff644c'));beam.rotation.x=Math.PI/2;body.add(beam);return root;
 }
 if(e.kind==='debris'){const chunk=new THREE.Mesh(new THREE.IcosahedronGeometry(e.radius,0),new THREE.MeshStandardMaterial({color:'#b59d84',emissive:'#d34e16',emissiveIntensity:.6,roughness:.9}));body.add(chunk);return root;}
 if(e.kind==='portal'){const portal=buildPortal();portal.scale.setScalar(e.radius/4.3);body.add(portal);return root;}
 if(isField(id))body.add(fieldMesh(e));else{
  const model=cloneModel(OBJECTS[id].model!);model.scale.setScalar(id==='pirate'?.6:e.radius);if(e.kind==='pirate')model.rotation.y=Math.PI;if(id==='ring-station')model.rotation.x=Math.PI/2;body.add(model);
 }
 const bar=new THREE.Group();bar.name='healthbar';bar.position.y=e.radius+.7;
 const back=new THREE.Mesh(new THREE.PlaneGeometry(2.3,.14),new THREE.MeshBasicMaterial({color:'#081823',transparent:true,opacity:.8,depthTest:false}));back.renderOrder=3;bar.add(back);
 const fill=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.085),new THREE.MeshBasicMaterial({color:OBJECTS[id].color,depthTest:false}));fill.name='fill';fill.position.z=.005;fill.renderOrder=4;bar.add(fill);root.add(bar);bar.visible=false;
 const materials:THREE.MeshStandardMaterial[]=[];body.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial){m.userData.baseColor=m.color.clone();m.userData.baseEmissive=m.emissive.clone();m.userData.baseIntensity=m.emissiveIntensity;materials.push(m);}}});root.userData.materials=materials;
 return root;
}
export function updateEncounterVisual(e:Entity,obj:THREE.Object3D,time:number,camera:THREE.Camera){
 obj.position.set(e.x,e.y,e.z);const body=obj.getObjectByName('body')!;
 if(e.qw!==undefined&&e.kind!=='shot'&&e.kind!=='hostile')body.quaternion.set(e.qx??0,e.qy??0,e.qz??0,e.qw);
 if(e.kind==='portal'){const membrane=obj.getObjectByName('portal_membrane') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;membrane.material.uniforms.time.value=time;}
 const bar=obj.getObjectByName('healthbar');if(bar){bar.visible=(e.hitAge??0)>0&&e.hp>0&&!isField(typeOf(e))&&e.z< -2&&e.z> -150;bar.quaternion.copy(camera.quaternion);const fill=bar.getObjectByName('fill')!;fill.scale.x=Math.max(0,e.hp/(e.maxHp??OBJECTS[typeOf(e)].hp));fill.position.x=-(1-fill.scale.x)*1.1;}
 const flash=Math.min(1,(e.hitAge??0)*5),damage=e.hp/(e.maxHp??OBJECTS[typeOf(e)].hp),critical=e.fuse!==undefined?(.5+Math.sin(time*30)*.5):0;
 for(const m of (obj.userData.materials??[]) as THREE.MeshStandardMaterial[]){m.color.copy(m.userData.baseColor).multiplyScalar(.55+.45*Math.max(0,damage));m.emissive.copy(m.userData.baseEmissive).lerp(impactColor,Math.max(flash,critical));m.emissiveIntensity=(m.userData.baseIntensity??0)+flash*2+critical*2;}
 const flow=obj.getObjectByName('field_flow');if(flow)flow.rotation.z=time*(typeOf(e)==='repulsor'?-.35:.35);
}
function sparkMaterial(color:string){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color(color)},alpha:{value:1},size:{value:5}},vertexShader:'uniform float size; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(size*120.0/max(1.0,-mv.z),1.0,35.0);}',fragmentShader:'uniform vec3 color; uniform float alpha; void main(){float d=length(gl_PointCoord-.5)*2.0;gl_FragColor=vec4(color*2.0,alpha*(1.0-smoothstep(0.05,1.0,d)));}'});}
export function buildEffectVisual(fx:FlightEffect){
 const g=new THREE.Group(),geo=new THREE.BufferGeometry(),arr=new Float32Array(18*3);for(let i=0;i<18;i++){const y=1-2*(i+.5)/18,a=i*2.399+fx.seed,r=Math.sqrt(1-y*y);arr[i*3]=Math.cos(a)*r;arr[i*3+1]=y;arr[i*3+2]=Math.sin(a)*r;}geo.setAttribute('position',new THREE.BufferAttribute(arr,3));const sparks=new THREE.Points(geo,sparkMaterial(fx.color));sparks.name='sparks';g.add(sparks);
 if(fx.kind!=='muzzle'){const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.025,4,48),glow(fx.color,.6));ring.name='shockwave';ring.rotation.x=.4;g.add(ring);}return g;
}
export function updateEffectVisual(fx:FlightEffect,g:THREE.Object3D){const t=fx.age/fx.life;g.position.set(fx.x,fx.y,fx.z);g.scale.setScalar(Math.max(.04,fx.size*(fx.kind==='muzzle'?.2:t)));const sparks=g.getObjectByName('sparks') as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;sparks.material.uniforms.alpha.value=(1-t)**2;sparks.material.uniforms.size.value=fx.kind==='explosion'?9:5;const ring=g.getObjectByName('shockwave') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>|undefined;if(ring)ring.material.opacity=(1-t)*.55;}
export function addShipDamageVisuals(ship:THREE.Group){
 const scars=new THREE.Group();scars.name='damage_scars';
 for(let i=0;i<5;i++){const patch=new THREE.Mesh(new THREE.SphereGeometry(.3,8,5),new THREE.MeshStandardMaterial({color:'#160f0d',roughness:1,emissive:'#ff641c',emissiveIntensity:0}));patch.scale.set(1,.07,1.3);patch.position.set((i%2?1:-1)*(.25+i*.12),.42+(i%2)*.1,1.3-i*.65);scars.add(patch);}ship.add(scars);
 const muzzle=new THREE.Group();muzzle.name='muzzle_flash';for(const x of [-.8,.8]){const sphere=new THREE.Mesh(new THREE.SphereGeometry(.16,8,5),glow('#baffff'));sphere.position.set(x,.12,-2.7);sphere.scale.z=2;muzzle.add(sphere);}ship.add(muzzle);
}
export function createDamageTrail(){
 const g=new THREE.Group();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(36*3),3));geo.setAttribute('heat',new THREE.BufferAttribute(new Float32Array(36),1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{intensity:{value:0}},vertexShader:'attribute float heat; varying float vHeat; uniform float intensity; void main(){vHeat=heat;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.0-heat)*160.0/max(1.0,-mv.z),2.0,55.0)*intensity;}',fragmentShader:'varying float vHeat;uniform float intensity;void main(){float d=length(gl_PointCoord-.5)*2.0;vec3 color=mix(vec3(.12,.16,.19),vec3(1.0,.36,.06),pow(vHeat,4.0));gl_FragColor=vec4(color,(1.0-smoothstep(.05,1.0,d))*(.35+vHeat*.5)*intensity);}'});
 const points=new THREE.Points(geo,material);points.frustumCulled=false;g.add(points);const shield=new THREE.Mesh(new THREE.SphereGeometry(1.65,24,14),new THREE.MeshBasicMaterial({color:'#82eaff',wireframe:true,transparent:true,opacity:.1,depthWrite:false}));shield.name='shield';g.add(shield);return g;
}
export function updateShipDamage(ship:THREE.Group,trail:THREE.Group,s:Flight,time:number){
 const ratio=s.hull/s.maxHull,damage=THREE.MathUtils.clamp((.7-ratio)/.7,0,1),scars=ship.getObjectByName('damage_scars');if(scars){scars.visible=ratio<.85;scars.children.forEach((o,i)=>{o.visible=ratio<.85-i*.12;const m=(o as THREE.Mesh).material as THREE.MeshStandardMaterial;m.emissiveIntensity=ratio<.3?(.4+Math.sin(time*18+i)*.2):0;});}
 const muzzle=ship.getObjectByName('muzzle_flash');if(muzzle){muzzle.visible=s.shotAge<.08;muzzle.scale.setScalar(.8+Math.sin(time*95)*.2);}
 const pts=trail.children[0] as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>,pos=pts.geometry.getAttribute('position'),heat=pts.geometry.getAttribute('heat');pts.visible=damage>0;pts.material.uniforms.intensity.value=damage;
 for(let i=0;i<36;i++){const a=(time*(ratio<.3?1.7:1.1)+i/36)%1;pos.setXYZ(i,s.x+.38*Math.sin(i*2.4)+Math.sin(i+a*3)*a*.7,s.y+.12+a*1.7,s.shotAge<.08?1.8+a*6:1.2+a*6);heat.setX(i,(1-a)*(ratio<.3?1:.3));}pos.needsUpdate=true;heat.needsUpdate=true;
 const shield=trail.getObjectByName('shield')!;shield.visible=s.shield>0;shield.position.set(s.x,s.y,0);shield.rotation.y=time*.5;
}
