import * as THREE from 'three';
import {noise,type StageEnvironment,type WorldType} from './stage-environment';

/** Original generated geography; prompts and lossless masters live in assets/planets. */
const SOURCES:Record<WorldType,string>={temperate:'verdant',moon:'selene',desert:'ares',ice:'nivalis',gas:'aurelia',volcanic:'pyra',ocean:'pelagia',cloud:'vesper','ice-giant':'nereid',salt:'salar'};
export function hasAuthoredSurface(kind:WorldType){return !!SOURCES[kind];}
function dataTexture(data:Uint8Array,width:number,height:number,color=false){
 const map=new THREE.DataTexture(data,width,height);map.flipY=true;map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.ClampToEdgeWrapping;map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;return map;
}
function pixels(image:HTMLImageElement,width:number,icePole=false){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=width/2;const c=canvas.getContext('2d')!;c.drawImage(image,0,0,width,width/2);const data=c.getImageData(0,0,width,width/2).data;
 // Reconcile a narrow seam strip without changing the authored geography elsewhere.
 const h=width/2,band=Math.max(2,Math.round(width*.015)),cap=Math.max(2,Math.round(h*(icePole?.12:.018)));
 for(let y=0;y<h;y++)for(let x=0;x<band;x++){
  const weight=1-THREE.MathUtils.smoothstep(x,0,band-1),a=(y*width+x)*4,b=(y*width+width-1-x)*4;
  for(let c=0;c<3;c++){const mean=(data[a+c]+data[b+c])/2;data[a+c]+=weight*(mean-data[a+c]);data[b+c]+=weight*(mean-data[b+c]);}
 }
 const poleColors=[[0,0,0],[0,0,0]];
 if(icePole)for(let side=0;side<2;side++)for(let step=0;step<cap;step++)for(let x=0;x<width;x++)for(let c=0;c<3;c++)poleColors[side][c]+=data[((side?h-1-step:step)*width+x)*4+c]/(cap*width);
 // Polar texels converge continuously to a single color instead of a pinched seam.
 for(let step=0;step<cap;step++)for(const row of [step,h-1-step])for(let c=0;c<3;c++){
  let sum=0;for(let x=0;x<width;x++)sum+=data[(row*width+x)*4+c];const mean=icePole?poleColors[row<h/2?0:1][c]:sum/width,weight=1-THREE.MathUtils.smoothstep(step,icePole?cap*.16:0,cap-1);
  for(let x=0;x<width;x++){
   const k=(row*width+x)*4+c,theta=(x===width-1?0:x)/(width-1)*Math.PI*2,phi=step/(h-1)*Math.PI;
   // Spherical frost detail has a well-defined pole; stretched source striations do not.
   const frost=icePole?(noise(Math.sin(phi)*Math.cos(theta)*48+17,Math.cos(phi)*48,Math.sin(phi)*Math.sin(theta)*48+29)-.5)*12:0;
   data[k]+=weight*(mean+frost-data[k]);
  }
 }
 return new Uint8Array(data);
}
export async function loadPlanetMaps(profile:StageEnvironment,mobile:boolean){
 const name=SOURCES[profile.kind],width=mobile?1024:2048,height=width/2,loader=new THREE.TextureLoader();
 const owned:THREE.Texture[]=[];let map:THREE.DataTexture|null=null,detail:THREE.DataTexture|null=null,cloud:THREE.DataTexture|null=null,emission:THREE.DataTexture|null=null;
 try{
  if(name){
   const source=await loader.loadAsync(`/planet-maps/${name}.jpg`),raw=pixels(source.image,width,profile.kind==='ice');source.dispose();map=dataTexture(raw,width,height,true);owned.push(map);
   const packed=new Uint8Array(raw.length),isRock=['moon','desert','ice','volcanic','salt'].includes(profile.kind),hasOcean=profile.kind==='temperate'||profile.kind==='ocean';
   for(let i=0;i<raw.length;i+=4){const r=raw[i],g=raw[i+1],b=raw[i+2],luma=r*.2126+g*.7152+b*.0722,ocean=hasOcean&&b>r*1.14&&b>g*.9;
    // Restrained source-aligned microrelief is an art approximation, not measured elevation.
    packed[i]=isRock?luma:hasOcean?(ocean?100:luma*.32+100):128;packed[i+1]=ocean?110:245;packed[i+3]=255;
   }
   // Suppress divergent UV bump derivatives in the small polar caps of the sphere.
   for(let y=0;y<height;y++){const strength=THREE.MathUtils.smoothstep(Math.min(y,height-1-y)/(height-1),0,.12);for(let x=0;x<width;x++){const k=(y*width+x)*4;packed[k]=128+(packed[k]-128)*strength;}}
   detail=dataTexture(packed,width,height);owned.push(detail);
   if(profile.kind==='volcanic'){
    const heat=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i+=4){const h=Math.pow(THREE.MathUtils.clamp((raw[i]-raw[i+1]*1.2-raw[i+2]*.3-25)/150,0,1),2);heat[i]=h*255;heat[i+1]=h*65;heat[i+2]=h*5;heat[i+3]=255;}
    emission=dataTexture(heat,width,height,true);owned.push(emission);
   }
  }
  if(profile.kind==='temperate'||profile.kind==='ocean'){
   const source=await loader.loadAsync('/planet-maps/weather.jpg'),w=mobile?512:1024,raw=pixels(source.image,w);source.dispose();
   for(let i=0;i<raw.length;i+=4){const alpha=raw[i]*.2126+raw[i+1]*.7152+raw[i+2]*.0722;raw[i]=238;raw[i+1]=242;raw[i+2]=245;raw[i+3]=Math.min(230,alpha*.9);}
   cloud=dataTexture(raw,w,w/2,true);cloud.offset.x=(profile.seed&65535)/65535;owned.push(cloud);
  }
  return {map,detail,cloud,emission,owned};
 }catch(error){for(const texture of owned)texture.dispose();throw error;}
}
