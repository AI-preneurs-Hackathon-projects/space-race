"use client";
import {Box, Check, Crosshair} from 'lucide-react';
import {CARGO} from '@/lib/game/contracts';
import type {Flight} from '@/lib/game/simulation';
import {deliveryElapsed} from '@/lib/game/expedition-runtime';
import {deliverySpeedReward} from '@/lib/game/delivery-timing';
import {deliveryTime} from './delivery-speed-terms';

export default function ContractHUD({flight}:{flight:Flight}) {
 const runtime=flight.expedition;if(!runtime)return null;
 const objectives=runtime.objectives.filter(o=>o.status==='active');
 const recent=runtime.objectives.filter(o=>o.status!=='active').at(-1);
 const event=runtime.events.at(-1);
 const elapsed=deliveryElapsed(flight),terms=runtime.contract.speedBonus,remaining=terms?Math.max(0,terms.expiresSeconds-elapsed):0;
 const speedReward=deliverySpeedReward(runtime.contract,elapsed);
 return <aside className={`contract-hud ${runtime.contract.cargoType==='volatile_fuel'?'has-instability':''}`} aria-label="Delivery contract">
  <div className="cargo-status"><Box size={14}/><span>{CARGO[runtime.contract.cargoType].label}</span>{runtime.contract.minimumCargoIntegrity!==null&&<b className={flight.cargo<runtime.contract.minimumCargoIntegrity?'cargo-below-minimum':''}>≥ {runtime.contract.minimumCargoIntegrity}%</b>}</div>
  {runtime.contract.cargoType==='volatile_fuel'&&<div className={`instability-meter ${runtime.instability>=65?'unstable':''}`}><span>INSTABILITY</span><meter min={0} max={100} value={runtime.instability}/><b>{Math.round(runtime.instability)}%</b></div>}
  {terms&&<div className={`delivery-speed ${remaining===0?'expired':''}`} aria-label="Delivery speed bonus">
   <span><i>DELIVERY CLOCK</i><b>{deliveryTime(elapsed)}</b></span>
   <span><i className="speed-label-full">{remaining>0?'SPEED BONUS AVAILABLE':'SPEED WINDOW CLOSED'}</i><i className="speed-label-short">{remaining>0?'SPEED BONUS':'EXPIRED'}</i><b>+{speedReward.toLocaleString('en-US')} cr</b></span>
   <small>{remaining===0?'Deliver cargo for eligible base pay':`Full by ${deliveryTime(terms.fullBonusSeconds)} · ends ${deliveryTime(terms.expiresSeconds)} · cargo required`}</small>
  </div>}
  {event&&!['pirate_ambush','enemy_reinforcement','bounty_hunter','pirate_pursuit'].includes(event.type)&&flight.time-event.at<8&&<div className="director-event" role="status">{event.type.replaceAll('_',' ').toUpperCase()}</div>}
  {objectives.map(objective=>{
   const durations=objective.definition.conditions.filter((_,index)=>!objective.conditionsComplete[index]).map(c=>c.duration).filter((d):d is number=>d!==null);
   const remaining=durations.length?Math.max(0,Math.ceil(Math.min(...durations)-(flight.time-objective.startedAt))):null;
   return <div className="bonus-objective" key={objective.definition.id}><span><Crosshair size={12}/> BONUS OBJECTIVE <b>+{objective.definition.reward} cr</b></span><p>{objective.definition.uiText}</p>{remaining!==null?<small>{remaining}s remaining</small>:objective.definition.conditions.some(c=>c.type==='REACH_WARP_GATE'||c.type==='MAINTAIN_CARGO_INTEGRITY')&&<small>Finish at the warp gate</small>}</div>;
  })}
  {!objectives.length&&recent&&<div className={`objective-outcome ${recent.status}`}><Check size={12}/>{recent.status==='completed'?'BONUS COMPLETE':'BONUS MISSED'} · {recent.status==='completed'?`+${recent.definition.reward} cr`:'Keep flying'}</div>}
 </aside>;
}
