import * as THREE from 'three';
import {CRUISE_SPEED,DURATION,clamp} from './types';
export const PLANET_RADIUS=175;
/** Fixed world radius and one-to-one route displacement produce perspective growth. */
export function planetPosition(progress:number){return {x:285,y:190,z:-(720+(DURATION-clamp(progress,0,DURATION))*CRUISE_SPEED)};}
export function buildDestinationPlanet(){
 const group=new THREE.Group();group.name='destination_planet';
 const texture=new THREE.TextureLoader().load('/destination-planet-albedo.png');texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
 const material=new THREE.MeshStandardMaterial({map:texture,bumpMap:texture,bumpScale:1.2,roughness:.78,metalness:.03,envMapIntensity:.12,fog:false});
 const globe=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS,96,64),material);globe.rotation.y=1.8;group.add(globe);
 const vertex=`varying vec3 vWorld;varying vec3 vNormal;varying vec3 vLocal;void main(){vLocal=position;vWorld=(modelMatrix*vec4(position,1.)).xyz;vNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`;
 const sunlight=new THREE.Vector3(-.7,.35,.65).normalize();
 const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS*1.025,64,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,side:THREE.BackSide,blending:THREE.AdditiveBlending,uniforms:{sun:{value:sunlight}},vertexShader:vertex,fragmentShader:`varying vec3 vWorld;varying vec3 vNormal;uniform vec3 sun;void main(){vec3 n=normalize(vNormal),v=normalize(cameraPosition-vWorld);float rim=pow(1.-abs(dot(n,v)),3.);float day=smoothstep(-.25,.4,dot(n,sun));gl_FragColor=vec4(vec3(.12,.42,.85)*rim*(.1+day*.9),rim*.8);}`}));group.add(atmosphere);
 const clouds=new THREE.Mesh(new THREE.SphereGeometry(PLANET_RADIUS*1.009,64,48),new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{sun:{value:sunlight}},vertexShader:vertex,fragmentShader:`varying vec3 vWorld;varying vec3 vNormal;varying vec3 vLocal;uniform vec3 sun;float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}void main(){vec3 p=normalize(vLocal)*13.;float f=noise(p)*.55+noise(p*2.1)*.28+noise(p*4.2)*.17;float alpha=smoothstep(.54,.7,f)*.58;float light=max(0.,dot(normalize(vNormal),sun));gl_FragColor=vec4(vec3(.8,.86,.91)*(.035+light),alpha);}`}));group.add(clouds);
 // A separate distant sun gives the planet a readable terminator without altering ship lighting.
 const light=new THREE.DirectionalLight('#e5efff',2);light.position.copy(sunlight).multiplyScalar(1000);light.target=group;light.layers.set(1);group.add(light);globe.layers.set(1);
 return {group,update(progress:number,time:number){const p=planetPosition(progress);group.position.set(p.x,p.y,p.z);globe.rotation.y=1.8+time*.0008;clouds.rotation.y=time*.0012;},dispose(){texture.dispose();}};
}
