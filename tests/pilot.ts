import {isThreat,type Flight,type Input} from '../lib/game/simulation';
const clamp=(v:number)=>Math.max(-1,Math.min(1,v));
/** A bounded, local look-ahead controller, using visible entities and normal thrust/fire. */
export function evasivePilot(s:Flight):Input{
 const threats=s.entities.filter(e=>isThreat(e)&&e.z<0&&e.z>-240),targets=s.entities.filter(e=>e.kind==='pirate'&&e.z<0&&e.z>-170);
 let best={x:s.x,y:s.y,score:-Infinity};
 for(let x=-8;x<=8;x+=2)for(let y=-4;y<=4;y+=1){let risk=0;
  for(const e of threats){const t=-e.z/Math.max(10,(e.vz??0)+29*s.speed),ex=e.x+e.vx*t,ey=e.y+e.vy*t,clear=Math.hypot(x-ex,y-ey)-e.radius-.8;const urgency=Math.max(0,1-t/5);risk+=Math.max(0,2.4-clear)*urgency*(clear<0?10:1);}
  const shot=targets.some(e=>Math.abs(e.x-x)<1.9&&Math.abs(e.y-y)<1.5)?.12:0,score=-risk-Math.hypot(x-s.x,y-s.y)*.16+shot;
  if(score>best.score)best={x,y,score};
 }
 return {x:clamp((best.x-s.x)*2),y:clamp((best.y-s.y)*2),fire:true};
}
