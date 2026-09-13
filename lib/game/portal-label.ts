import * as THREE from 'three';
export type ScreenRect={left:number;top:number;right:number;bottom:number};
export const overlaps=(a:ScreenRect,b:ScreenRect)=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top;
/** Compact world-anchored lettering above the physical rim, never across the opening. */
export function portalLabelLayout(gate:{x:number;y:number;z:number;radius:number},camera:THREE.PerspectiveCamera,width:number,height:number,aim?:ScreenRect){
 const center=new THREE.Vector3(gate.x,gate.y,gate.z),view=center.clone().applyMatrix4(camera.matrixWorldInverse),distance=-view.z;
 if(distance<=32)return null;
 const point=center.clone().add(new THREE.Vector3(0,gate.radius*1.3,0)).project(camera);
 if(point.z< -1||point.z>1)return null;
 const proximity=1-THREE.MathUtils.smoothstep(distance,45,320),scale=.72+.38*proximity;
 const x=(point.x*.5+.5)*width,boxWidth=104*scale,boxHeight=22*scale;
 let bottom=(-point.y*.5+.5)*height-8;
 const rect={left:x-boxWidth/2,right:x+boxWidth/2,top:bottom-boxHeight,bottom};
 // A distant gate can sit beside the reticle: lift its label above the actual glyph bounds.
 if(aim&&overlaps(rect,aim)){bottom=aim.top-8;rect.bottom=bottom;rect.top=bottom-boxHeight;}
 if(rect.left<12||rect.right>width-12||rect.top<12||rect.bottom>height-12)return null;
 return {x,bottom,scale,opacity:.9*THREE.MathUtils.smoothstep(distance,32,90),rect};
}
/** Conservative projected bounds let an obscuring hazard suppress the label. */
export function projectedBodyRect(body:{x:number;y:number;z:number;radius:number},camera:THREE.PerspectiveCamera,width:number,height:number):ScreenRect|null{
 const p=new THREE.Vector3(body.x,body.y,body.z),distance=-p.clone().applyMatrix4(camera.matrixWorldInverse).z;
 if(distance<=0)return null;p.project(camera);if(p.z< -1||p.z>1)return null;
 const radius=height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*body.radius/distance+4,x=(p.x*.5+.5)*width,y=(-p.y*.5+.5)*height;
 return {left:x-radius,right:x+radius,top:y-radius,bottom:y+radius};
}
