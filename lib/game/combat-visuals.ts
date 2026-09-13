import * as THREE from 'three';
import { cloneModel } from './assets';
import { buildPortal } from './meshes';
import { OBJECTS, isField } from './objects';
import { typeOf, type Entity, type Flight, type FlightEffect } from './simulation';

const impactColor=new THREE.Color('#ffb58c');
const glow=(color:string,opacity=.8)=>new THREE.MeshBasicMaterial({color:new THREE.Color(color).multiplyScalar(1.8),transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
function fieldMesh(e:Entity){
 const id=typeOf(e),g=new THREE.Group();
 if(id==='moon')g.add(cloneModel('rogue-moon'));
 else if(id==='repulsor'){
  const core=cloneModel('iron-asteroid');core.traverse(o=>{if(o instanceof THREE.Mesh){const m=o.material as THREE.MeshStandardMaterial;m.color.set('#75a995');m.metalness=.35;m.emissive.set('#164236');m.emissiveIntensity=.2;}});g.add(core);
 }else{
  g.add(new THREE.Mesh(new THREE.SphereGeometry(1,48,32),new THREE.MeshBasicMaterial({color:'#010108'})));
  // Diffuse, uneven accretion dust, with no rigid orbit lines or corridor-sized arcs.
  const positions=new Float32Array(450*3),colors=new Float32Array(450*3);
  for(let i=0;i<450;i++){const a=i*2.39996,r=1.16+(.5+.5*Math.sin(i*71.17))*.85;positions[i*3]=Math.cos(a)*r;positions[i*3+1]=Math.sin(a)*r*.28+Math.sin(i*12.4)*.065;positions[i*3+2]=Math.sin(a)*r*.72;const c=new THREE.Color().setHSL(.065+.035*Math.sin(i),.5,.25+.25*Math.sin(i*1.7)**2);colors.set([c.r,c.g,c.b],i*3);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
  g.add(new THREE.Points(geo,new THREE.PointsMaterial({size:.04,vertexColors:true,transparent:true,opacity:.4,depthWrite:false,blending:THREE.AdditiveBlending})));
 }
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
  const model=cloneModel(OBJECTS[id].model!);model.scale.setScalar(id==='pirate'?.6:e.radius);if(e.kind==='pirate')model.rotation.y=Math.PI;body.add(model);
 }
 const bar=new THREE.Group();bar.name='healthbar';bar.position.y=e.radius+.7;
 const back=new THREE.Mesh(new THREE.PlaneGeometry(2.3,.14),new THREE.MeshBasicMaterial({color:'#081823',transparent:true,opacity:.8,depthTest:false}));back.renderOrder=3;bar.add(back);
 const fill=new THREE.Mesh(new THREE.PlaneGeometry(2.2,.085),new THREE.MeshBasicMaterial({color:OBJECTS[id].color,depthTest:false}));fill.name='fill';fill.position.z=.005;fill.renderOrder=4;bar.add(fill);root.add(bar);bar.visible=false;
 const materials:THREE.MeshStandardMaterial[]=[];body.traverse(o=>{if(o instanceof THREE.Mesh){for(const m of Array.isArray(o.material)?o.material:[o.material])if(m instanceof THREE.MeshStandardMaterial){m.userData.baseColor=m.color.clone();m.userData.baseEmissive=m.emissive.clone();m.userData.baseIntensity=m.emissiveIntensity;materials.push(m);}}});root.userData.materials=materials;
 if(e.expeditionRole==='repair'){
  const color='#9cf8c4';
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=64;
  const ctx=canvas.getContext('2d')!;ctx.fillStyle='#071923dd';ctx.fillRect(0,0,256,64);ctx.strokeStyle=color;ctx.lineWidth=3;ctx.strokeRect(2,2,252,60);ctx.fillStyle=color;ctx.font='bold 23px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('RELIEF CAPSULE',128,33);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const marker=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));marker.name='contract-marker';marker.position.y=e.radius+2;marker.scale.set(7,1.75,1);root.add(marker);
  for(const material of materials){material.userData.baseEmissive=new THREE.Color('#25c976');material.userData.baseIntensity=.8;}
 }
 return root;
}
export function updateEncounterVisual(e:Entity,obj:THREE.Object3D,time:number,camera:THREE.Camera){
 obj.position.set(e.x,e.y,e.z);const body=obj.getObjectByName('body')!;
 if(e.qw!==undefined&&e.kind!=='shot'&&e.kind!=='hostile')body.quaternion.set(e.qx??0,e.qy??0,e.qz??0,e.qw);
 if(e.kind==='portal'){const membrane=obj.getObjectByName('portal_membrane') as THREE.Mesh<THREE.BufferGeometry,THREE.ShaderMaterial>;membrane.material.uniforms.time.value=time;}
 const bar=obj.getObjectByName('healthbar');if(bar){bar.visible=(e.hitAge??0)>0&&e.hp>0&&!isField(typeOf(e))&&e.z< -2&&e.z> -150;bar.quaternion.copy(camera.quaternion);const fill=bar.getObjectByName('fill')!;fill.scale.x=Math.max(0,e.hp/(e.maxHp??OBJECTS[typeOf(e)].hp));fill.position.x=-(1-fill.scale.x)*1.1;}
 const marker=obj.getObjectByName('contract-marker');if(marker){marker.visible=e.hp>0&&e.z< -8&&e.z> -360;const scale=THREE.MathUtils.clamp(-e.z/85,.7,3);marker.scale.set(7*scale,1.75*scale,1);}
 let target=obj.getObjectByName('objective-target');
 if(e.objectiveTarget&&!target){target=new THREE.Mesh(new THREE.ConeGeometry(.3,.6,3),glow('#ffd19b'));target.name='objective-target';target.rotation.z=Math.PI;target.position.y=e.radius+1.5;obj.add(target);}
 if(target)target.visible=!!e.objectiveTarget&&e.hp>0&&e.z< -8&&e.z> -300;
 const flash=Math.min(1,(e.hitAge??0)*5),damage=e.hp/(e.maxHp??OBJECTS[typeOf(e)].hp);
 for(const m of (obj.userData.materials??[]) as THREE.MeshStandardMaterial[]){m.color.copy(m.userData.baseColor).multiplyScalar(.55+.45*Math.max(0,damage));m.emissive.copy(m.userData.baseEmissive).lerp(impactColor,flash);m.emissiveIntensity=(m.userData.baseIntensity??0)+flash*2;}
}
function sparkMaterial(color:string){return new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,uniforms:{color:{value:new THREE.Color(color)},alpha:{value:1},size:{value:5}},vertexShader:'uniform float size; void main(){vec4 mv=modelViewMatrix*vec4(position,1.0); gl_Position=projectionMatrix*mv; gl_PointSize=clamp(size*120.0/max(1.0,-mv.z),1.0,35.0);}',fragmentShader:'uniform vec3 color; uniform float alpha; void main(){float d=length(gl_PointCoord-.5)*2.0;gl_FragColor=vec4(color*2.0,alpha*(1.0-smoothstep(0.05,1.0,d)));}'});}
export function buildEffectVisual(fx:FlightEffect){
 // Jump presentation is the normal ship/exhaust and longitudinal star streaks.
 if(fx.kind==='jump')return new THREE.Group();
 const g=new THREE.Group(),geo=new THREE.BufferGeometry(),arr=new Float32Array(18*3);for(let i=0;i<18;i++){const y=1-2*(i+.5)/18,a=i*2.399+fx.seed,r=Math.sqrt(1-y*y);arr[i*3]=Math.cos(a)*r;arr[i*3+1]=y;arr[i*3+2]=Math.sin(a)*r;}geo.setAttribute('position',new THREE.BufferAttribute(arr,3));const sparks=new THREE.Points(geo,sparkMaterial(fx.color));sparks.name='sparks';g.add(sparks);
 if(fx.kind!=='muzzle'){const ring=new THREE.Mesh(new THREE.TorusGeometry(1,.025,4,48),glow(fx.color,.6));ring.name='shockwave';ring.rotation.x=.4;g.add(ring);}return g;
}
export function updateEffectVisual(fx:FlightEffect,g:THREE.Object3D){if(fx.kind==='jump')return;const t=fx.age/fx.life;g.position.set(fx.x,fx.y,fx.z);g.scale.setScalar(Math.max(.04,fx.size*(fx.kind==='muzzle'?.2:t)));const sparks=g.getObjectByName('sparks') as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>;sparks.material.uniforms.alpha.value=(1-t)**2;sparks.material.uniforms.size.value=fx.kind==='explosion'?9:5;const ring=g.getObjectByName('shockwave') as THREE.Mesh<THREE.BufferGeometry,THREE.MeshBasicMaterial>|undefined;if(ring)ring.material.opacity=(1-t)*.55;}
export function createDamageTrail(){
 const g=new THREE.Group();const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(new Float32Array(36*3),3));geo.setAttribute('heat',new THREE.BufferAttribute(new Float32Array(36),1));
 const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{intensity:{value:0}},vertexShader:'attribute float heat; varying float vHeat; uniform float intensity; void main(){vHeat=heat;vec4 mv=modelViewMatrix*vec4(position,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((1.0-heat)*160.0/max(1.0,-mv.z),2.0,55.0)*intensity;}',fragmentShader:'varying float vHeat;uniform float intensity;void main(){float d=length(gl_PointCoord-.5)*2.0;vec3 color=mix(vec3(.12,.16,.19),vec3(1.0,.36,.06),pow(vHeat,4.0));gl_FragColor=vec4(color,(1.0-smoothstep(.05,1.0,d))*(.35+vHeat*.5)*intensity);}'});
 const points=new THREE.Points(geo,material);points.frustumCulled=false;g.add(points);return g;
}
export function updateShipDamage(ship:THREE.Group,trail:THREE.Group,s:Flight,time:number){
 const ratio=s.hull/s.maxHull,damage=THREE.MathUtils.clamp((.7-ratio)/.7,0,1);
 const pts=trail.children[0] as THREE.Points<THREE.BufferGeometry,THREE.ShaderMaterial>,pos=pts.geometry.getAttribute('position'),heat=pts.geometry.getAttribute('heat');pts.visible=damage>0;pts.material.uniforms.intensity.value=damage;
 for(let i=0;i<36;i++){const a=(time*(ratio<.3?1.7:1.1)+i/36)%1;pos.setXYZ(i,s.x+.38*Math.sin(i*2.4)+Math.sin(i+a*3)*a*.7,s.y+.12+a*1.7,s.shotAge<.08?1.8+a*6:1.2+a*6);heat.setX(i,(1-a)*(ratio<.3?1:.3));}pos.needsUpdate=true;heat.needsUpdate=true;
}
