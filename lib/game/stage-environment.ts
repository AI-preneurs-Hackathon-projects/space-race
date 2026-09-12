/** Full stage number controls geography independently of encounter/retry seeds. */
export const WORLD_TYPES=['temperate','moon','desert','ice','gas','volcanic'] as const;
export type WorldType=typeof WORLD_TYPES[number];
const palettes=['#508bb9','#a58964','#bd777a','#519cae','#967cbc','#b16650'];
export function stageEnvironment(stage:number){
 const level=Math.max(1,Math.floor(Number.isFinite(stage)?stage:1)),index=(level-1)%WORLD_TYPES.length;
 return {stage:level,kind:WORLD_TYPES[index],seed:Math.imul(level,0x45d9f3b)>>>0,nebula:palettes[index],star:palettes[(index+3)%6],atmosphere:index!==1,clouds:index===0,rotation:1.8+level*1.173};
}
export type StageEnvironment=ReturnType<typeof stageEnvironment>;
export function seededRandom(seed:number){let n=seed>>>0;return()=>{n+=0x6d2b79f5;let t=n;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296;};}
function hash(x:number,y:number,z:number){let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,1442695041);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;}
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export function noise(x:number,y:number,z:number){const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z);let u=x-a,v=y-b,w=z-c;u=u*u*(3-2*u);v=v*v*(3-2*v);w=w*w*(3-2*w);return mix(mix(mix(hash(a,b,c),hash(a+1,b,c),u),mix(hash(a,b+1,c),hash(a+1,b+1,c),u),v),mix(mix(hash(a,b,c+1),hash(a+1,b,c+1),u),mix(hash(a,b+1,c+1),hash(a+1,b+1,c+1),u),v),w);}
export function terrainNoise(x:number,y:number,z:number){return noise(x,y,z)*.56+noise(x*2.03,y*2.03,z*2.03)*.27+noise(x*4.11,y*4.11,z*4.11)*.12+noise(x*8.21,y*8.21,z*8.21)*.05;}
