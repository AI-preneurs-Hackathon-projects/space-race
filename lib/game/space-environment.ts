import * as THREE from 'three';
import {CRUISE_SPEED,DURATION,clamp} from './types';
import {stageEnvironment,seededRandom,noise,terrainNoise,type StageEnvironment} from './stage-environment';
export {stageEnvironment} from './stage-environment';
export const PLANET_RADIUS=175;
/** Fixed world radius and one-to-one route displacement produce perspective growth. */
export function planetPosition(progress:number){return {x:285,y:190,z:-(720+(DURATION-clamp(progress,0,DURATION))*CRUISE_SPEED)};}
/** Baked once, with sharp seeded stars over a low frequency nebula. No per-frame texture work. */
export function buildStageBackground(profile:StageEnvironment){
 const random=seededRandom(profile.seed),canvas=document.createElement('canvas');canvas.width=1280;canvas.height=720;
 const ctx=canvas.getContext('2d')!,small=document.createElement('canvas');small.width=320;small.height=180;
 const c=small.getContext('2d')!,data=c.createImageData(320,180),color=new THREE.Color(profile.nebula),seed=profile.seed%991;
 const angle=random()*Math.PI,ox=random()*4,oy=random()*4;
 for(let y=0;y<180;y++)for(let x=0;x<320;x++){
  const u=x/320,v=y/180,dx=u-.5,dy=v-.5,band=Math.exp(-Math.pow((dx*Math.sin(angle)+dy*Math.cos(angle))/.26,2));
  const f=terrainNoise(u*4+ox,v*4+oy,seed),wisps=Math.pow(Math.max(0,f-.27)*1.65,2),corridor=.4+.6*Math.min(1,Math.hypot(dx,dy)*2.6),light=wisps*band*corridor;
  const i=(y*320+x)*4;data.data[i]=4+light*(35+color.r*150);data.data[i+1]=8+light*(35+color.g*150);data.data[i+2]=17+light*(40+color.b*160);data.data[i+3]=255;
 }
 c.putImageData(data,0,0);ctx.drawImage(small,0,0,1280,720);
 for(let i=0;i<1150;i++){const x=random()*1280,y=random()*720,bright=random(),r=bright>.985?1.1:.25+bright*.45;ctx.fillStyle=`rgba(${i%5===0?'165,199,236':'218,230,240'},${.18+bright*.65})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();if(bright>.995){ctx.fillStyle='#b9d6e533';ctx.fillRect(x-4,y-.4,8,.8);ctx.fillRect(x-.4,y-4,.8,8);}}
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
}
function surfaceTextures(profile:StageEnvironment,mobile:boolean){
 const width=mobile?384:768,height=width/2,albedo=new Uint8Array(width*height*4),relief=new Uint8Array(albedo.length),seed=profile.seed%991,rand=seededRandom(profile.seed);
 const craters=Array.from({length:45},()=>{const y=rand()*2-1,a=rand()*Math.PI*2,r=Math.sqrt(1-y*y);return {x:r*Math.cos(a),y,z:r*Math.sin(a),radius:.018+rand()*.12};});
 const low=new THREE.Color(),high=new THREE.Color(),color=new THREE.Color();
 const colors={temperate:['#093354','#537754'],moon:['#343a41','#a8a9a4'],desert:['#4b2520','#c58f5d'],ice:['#163f58','#d3f2ec'],gas:['#554568','#dfc7a2'],volcanic:['#111b24','#5a4b48']}[profile.kind];low.set(colors[0]);high.set(colors[1]);
 for(let j=0;j<height;j++)for(let i=0;i<width;i++){
  const lat=j/height*Math.PI,lon=i/width*Math.PI*2,x=Math.sin(lat)*Math.cos(lon),y=Math.cos(lat),z=Math.sin(lat)*Math.sin(lon),n=terrainNoise(x*3+seed,y*3,z*3),fine=noise(x*65+seed,y*65,z*65);
  let h=n,t=clamp((n-.25)*1.7,0,1),lava=0;
  if(profile.kind==='temperate'){const land=clamp((n-.49)*14,0,1);color.copy(low).lerp(high,land);if(n>.66)color.lerp(new THREE.Color('#ad9e77'),(n-.66)*4);if(Math.abs(y)>.85+fine*.08)color.set('#d2e3df');h=Math.max(.49,n);}
  else{
   if(profile.kind==='moon'){for(const crater of craters){const d=Math.hypot(x-crater.x,y-crater.y,z-crater.z)/crater.radius;if(d<1.3){h+=d<.8?-.14*(1-(d/.8)**2):.07*Math.exp(-(((d-1)*8)**2));}}t=clamp((h-.18)*1.6,0,1);}
   if(profile.kind==='desert'){const dune=Math.sin(y*95+n*32)*.035;h+=dune;t=clamp(t+dune*3,0,1);}
   if(profile.kind==='ice'){const fissure=Math.abs(noise(x*9+n*3+seed,y*9,z*9)-.5);t=clamp(fissure*18,0,1);h=.5+t*.2;}
   if(profile.kind==='gas'){const band=Math.sin(y*48+n*7)+Math.sin(y*119+n*13)*.24;const storm=Math.exp(-((x-.5)**2+(y-.26)**2)/.015)*(z>0?1:0);t=clamp(.5+band*.3-storm*.55,0,1);h=.5;}
   if(profile.kind==='volcanic'){const crack=Math.abs(noise(x*10+n*4+seed,y*10,z*10)-.5);lava=(1-clamp(crack*60,0,1))*clamp((n-.42)*10,0,1);h=n-lava*.05;t=clamp(t*.6+fine*.12,0,1);}
   color.copy(low).lerp(high,t);if(lava>0)color.lerp(new THREE.Color('#fc621b'),lava);
  }
  color.multiplyScalar(.9+fine*.15);const k=(j*width+i)*4;
  // Colors are constructed in linear space, then stored as sRGB texture bytes.
  color.convertLinearToSRGB();albedo[k]=clamp(color.r,0,1)*255;albedo[k+1]=clamp(color.g,0,1)*255;albedo[k+2]=clamp(color.b,0,1)*255;albedo[k+3]=255;
  relief[k]=relief[k+1]=relief[k+2]=clamp(h*.8+fine*.035,0,1)*255;relief[k+3]=255;
 }
 const texture=new THREE.DataTexture(albedo,width,height),bump=new THREE.DataTexture(relief,width,height);
 for(const map of [texture,bump]){map.wrapS=THREE.RepeatWrapping;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.needsUpdate=true;}
 texture.colorSpace=THREE.SRGBColorSpace;return {texture,bump};
}
export function buildDestinationPlanet(profile=stageEnvironment(1),mobile=false){
 const group=new THREE.Group();group.name='destination_planet';
 const {texture,bump}=surfaceTextures(profile,mobile);texture.anisotropy=4;
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:bump,bumpScale:profile.kind==='moon'?3:profile.kind==='gas'?0:1.5,roughness:.88,metalness:.01,envMapIntensity:.12,fog:false});
 const globe=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS,96,64),material);globe.rotation.y=1.8;group.add(globe);
 const vertex=`varying vec3 vWorld;varying vec3 vNormal;varying vec3 vLocal;void main(){vLocal=position;vWorld=(modelMatrix*vec4(position,1.)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
 const sunlight=new THREE.Vector3(-.7,.35,.65).normalize();
 const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS*1.025,64,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,uniforms:{sun:{value:sunlight}},vertexShader:vertex,fragmentShader:`varying vec3 vWorld;varying vec3 vNormal;uniform vec3 sun;void main(){vec3 n=normalize(vNormal),v=normalize(cameraPosition-vWorld);float rim=pow(1.-abs(dot(n,v)),3.);float day=smoothstep(-.25,.4,dot(n,sun));gl_FragColor=vec4(vec3(.12,.42,.85)*rim*(.1+day*.9),rim*.8);}`}));group.add(atmosphere);
 const clouds=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS*1.009,64,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{sun:{value:sunlight}},vertexShader:vertex,fragmentShader:`varying vec3 vWorld;varying vec3 vNormal;varying vec3 vLocal;uniform vec3 sun;float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){vec3 p=normalize(vLocal)*13.;float f=noise(p)*.55+noise(p*2.1)*.28+noise(p*4.2)*.17;float alpha=smoothstep(.54,.7,f)*.58;float light=max(0.,dot(normalize(vNormal),sun));gl_FragColor=vec4(vec3(.8,.86,.91)*(.035+light),alpha);}`}));group.add(clouds);
 // A separate distant sun gives the planet a readable terminator without altering ship lighting.
 atmosphere.visible=profile.atmosphere;clouds.visible=profile.clouds;
 const light=new THREE.DirectionalLight('#e5efff',2);light.position.copy(sunlight).multiplyScalar(1000);light.target=group;light.layers.set(1);group.add(light);globe.layers.set(1);
 group.userData.environment=profile.kind;
 return {group,update(progress:number,time:number){const p=planetPosition(progress);group.position.set(p.x,p.y,p.z);globe.rotation.y=profile.rotation+time*.0008;clouds.rotation.y=profile.rotation+time*.0012;},dispose(){texture.dispose();bump.dispose();}};
}
