import * as THREE from 'three';
import type {StageEnvironment,WorldType} from './stage-environment';

/** Original equirectangular maps are retained with provenance in public/planet-maps/CREDITS.md. */
const SOURCES:Partial<Record<WorldType,string>>={salt:'ceres_fictional',ice:'eris_fictional',volcanic:'venus_surface',temperate:'earth_daymap',moon:'moon',desert:'mars',gas:'jupiter',cloud:'venus_atmosphere','ice-giant':'neptune'};
export function hasAuthoredSurface(kind:WorldType){return !!SOURCES[kind];}
function dataTexture(data:Uint8Array,width:number,height:number,color=false){
 const map=new THREE.DataTexture(data,width,height);map.flipY=true;map.wrapS=THREE.RepeatWrapping;map.wrapT=THREE.ClampToEdgeWrapping;map.colorSpace=color?THREE.SRGBColorSpace:THREE.NoColorSpace;map.magFilter=THREE.LinearFilter;map.minFilter=THREE.LinearMipmapLinearFilter;map.generateMipmaps=true;map.anisotropy=4;map.needsUpdate=true;return map;
}
function pixels(image:HTMLImageElement,width:number){
 const canvas=document.createElement('canvas');canvas.width=width;canvas.height=width/2;const c=canvas.getContext('2d')!;c.drawImage(image,0,0,width,width/2);const data=c.getImageData(0,0,width,width/2).data;
 // Average the exact pole texels, which converge to a single point on the sphere.
 for(const row of [0,width/2-1])for(let channel=0;channel<3;channel++){let sum=0;for(let x=0;x<width;x++)sum+=data[(row*width+x)*4+channel];for(let x=0;x<width;x++)data[(row*width+x)*4+channel]=sum/width;}
 return new Uint8Array(data);
}
export async function loadPlanetMaps(profile:StageEnvironment,mobile:boolean){
 const name=SOURCES[profile.kind],width=mobile?1024:2048,height=width/2,loader=new THREE.TextureLoader();
 const owned:THREE.Texture[]=[];let map:THREE.DataTexture|null=null,detail:THREE.DataTexture|null=null,cloud:THREE.DataTexture|null=null,emission:THREE.DataTexture|null=null;
 try{
  if(name){
   const source=await loader.loadAsync(`/planet-maps/2k_${name}.jpg`),raw=pixels(source.image,width);source.dispose();map=dataTexture(raw,width,height,true);owned.push(map);
   const packed=new Uint8Array(raw.length),isRock=['moon','desert','ice','volcanic','salt'].includes(profile.kind),isEarth=profile.kind==='temperate';
   for(let i=0;i<raw.length;i+=4){const r=raw[i],g=raw[i+1],b=raw[i+2],luma=r*.2126+g*.7152+b*.0722,ocean=isEarth&&b>r*1.14&&b>g*.9;
    // Restrained source-aligned microrelief is an art approximation, not measured elevation.
    packed[i]=isRock?luma:isEarth?(ocean?100:luma*.32+100):128;packed[i+1]=ocean?65:245;packed[i+3]=255;
   }
   detail=dataTexture(packed,width,height);owned.push(detail);
   if(profile.kind==='volcanic'){
    const heat=new Uint8Array(raw.length);
    for(let i=0;i<raw.length;i+=4){const l=raw[i]*.2126+raw[i+1]*.7152+raw[i+2]*.0722,h=Math.pow(Math.max(0,Math.min(1,(l-146)/65)),4);heat[i]=h*255;heat[i+1]=h*45;heat[i+2]=h*3;heat[i+3]=255;raw[i]=55+l*.42;raw[i+1]=40+l*.33;raw[i+2]=35+l*.26;}
    emission=dataTexture(heat,width,height,true);owned.push(emission);
   }
  }
  if(profile.kind==='temperate'||profile.kind==='ocean'){
   const source=await loader.loadAsync('/planet-maps/2k_earth_clouds.jpg'),w=mobile?512:1024,raw=pixels(source.image,w);source.dispose();
   // The grayscale source becomes alpha on a separately lit white cloud shell.
   for(let i=0;i<raw.length;i+=4){const alpha=(raw[i]+raw[i+1]+raw[i+2])/3;raw[i]=237;raw[i+1]=242;raw[i+2]=245;raw[i+3]=Math.min(235,alpha);}
   cloud=dataTexture(raw,w,w/2,true);owned.push(cloud);
  }
  return {map,detail,cloud,emission,owned};
 }catch(error){for(const texture of owned)texture.dispose();throw error;}
}
