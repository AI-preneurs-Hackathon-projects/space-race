"use client";
import {Box, Check, Crosshair} from 'lucide-react';
import {CARGO} from '@/lib/game/contracts';
import type {Flight} from '@/lib/game/simulation';

export default function ContractHUD({flight}:{flight:Flight}) {
 const runtime=flight.expedition;if(!runtime)return null;
 const objectives=runtime.objectives.filter(o=>o.status==='active');
 const recent=runtime.objectives.filter(o=>o.status!=='active').at(-1);
 const event=runtime.events.at(-1);
 return <aside className="contract-hud" aria-label="Delivery contract">
  <div className="cargo-status"><Box size={14}/><span>{CARGO[runtime.contract.cargoType].label}</span>{runtime.contract.minimumCargoIntegrity!==null&&<b className={flight.cargo<runtime.contract.minimumCargoIntegrity?'cargo-below-minimum':''}>≥ {runtime.contract.minimumCargoIntegrity}%</b>}</div>
  {runtime.contract.cargoType==='volatile_fuel'&&<div className={`instability-meter ${runtime.instability>=65?'unstable':''}`}><span>INSTABILITY</span><meter min={0} max={100} value={runtime.instability}/><b>{Math.round(runtime.instability)}%</b></div>}
  {event&&flight.time-event.at<8&&<div className="director-event" role="status">{event.type.replaceAll('_',' ').toUpperCase()}</div>}
  {objectives.map(objective=>{
   const durations=objective.definition.conditions.filter((_,index)=>!objective.conditionsComplete[index]).map(c=>c.duration).filter((d):d is number=>d!==null);
   const remaining=durations.length?Math.max(0,Math.ceil(Math.min(...durations)-(flight.time-objective.startedAt))):null;
   return <div className="bonus-objective" key={objective.definition.id}><span><Crosshair size={12}/> BONUS OBJECTIVE <b>+{objective.definition.reward} cr</b></span><p>{objective.definition.uiText}</p>{remaining!==null?<small>{remaining}s remaining</small>:objective.definition.conditions.some(c=>c.type==='REACH_WARP_GATE'||c.type==='MAINTAIN_CARGO_INTEGRITY')&&<small>Finish at the warp gate</small>}</div>;
  })}
  {!objectives.length&&recent&&<div className={`objective-outcome ${recent.status}`}><Check size={12}/>{recent.status==='completed'?'BONUS COMPLETE':'BONUS MISSED'} · {recent.status==='completed'?`+${recent.definition.reward} cr`:'Keep flying'}</div>}
 </aside>;
}
