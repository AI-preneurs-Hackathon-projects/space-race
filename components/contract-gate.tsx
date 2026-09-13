"use client";
import {useEffect,useRef,useState} from 'react';
import {ArrowUpRight, Box, Check, Shield, Zap} from 'lucide-react';
import {CARGO, type Contract} from '@/lib/game/contracts';
import {effectiveHull, HULL_CAP, CRUISE_CAP, type Campaign, type Upgrade} from '@/lib/game/progression';
import type {Hull} from '@/lib/game/types';
import type {DeliveryResult} from '@/lib/game/run-manager';

const credits = (value:number) => value.toLocaleString('en-US');

/** Only mounted at a stopped terminal gate. A selection never starts flight by itself. */
export default function ContractGate({result,contracts,loading,campaign,hull,onDepart}:{
  result:DeliveryResult; contracts:Contract[]; loading:boolean; campaign:Campaign; hull:Hull;
  onDepart:(contract:Contract,upgrade:Upgrade|'continue')=>void;
}) {
  const [selected,setSelected]=useState<string|null>(null);
  const [upgrade,setUpgrade]=useState<Upgrade|'continue'>('continue');
  const panel=useRef<HTMLElement>(null);
  useEffect(()=>{if(!loading)panel.current?.querySelector<HTMLButtonElement>('.contract-option')?.focus();},[loading]);
  const chosen=contracts.find(c=>c.id===selected), ship=effectiveHull(hull,campaign);
  return <section ref={panel} className="result-panel contract-gate" role="dialog" aria-modal="true" aria-labelledby="gate-title" onKeyDown={event=>{
    if(event.key!=='Tab')return;
    const buttons=Array.from(panel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')??[]),first=buttons[0],last=buttons.at(-1);
    if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}
  }}>
    <div className="gate-heading"><div><span className="eyebrow">WARP GATE · SECTOR {result.sector}</span><h2 id="gate-title">Delivery complete</h2><p>{result.title} · {result.success?'Shipment accepted.':'Delivery requirement missed.'} Hull repaired.</p></div><Box size={30}/></div>
    <div className="delivery-ledger" aria-label="Delivery results">
      <div><span>Cargo integrity</span><b>{Math.floor(result.cargoIntegrity*10)/10}%{result.minimumCargoIntegrity!==null&&<small> / {result.minimumCargoIntegrity}% required</small>}</b></div>
      <div><span>Base reward{!result.success?' · forfeited':''}</span><b>{credits(result.baseReward)} cr</b></div>
      <div><span>Bonus reward</span><b>{credits(result.bonusReward)} cr</b></div>
      <div><span>Hull damage taken</span><b>{Math.ceil(result.damageTaken)}</b></div>
      <div className="ledger-total"><span>Final total</span><b>+{credits(result.totalReward)} cr</b></div>
    </div>
    <div className="resolved-objectives"><span>{result.objectivesCompleted.length} OBJECTIVES COMPLETED</span>{result.objectivesCompleted.map((text,i)=><small key={i}><Check size={12}/>{text}</small>)}{result.objectivesFailed.length>0&&<small>{result.objectivesFailed.length} optional {result.objectivesFailed.length===1?'objective missed':'objectives missed'}</small>}</div>
    <div className="contract-section-heading"><div><span className="eyebrow">INCOMING CONTRACTS</span><h3>Choose your next delivery</h3></div><span>SECTOR {campaign.stage+1}</span></div>
    {loading?<div className="contract-loading" role="status"><span className="contract-pulse"/> Receiving incoming contracts…</div>:<div className="contract-options" aria-label="Next contracts">
      {contracts.map(contract=><button key={contract.id} className={`contract-option risk-${contract.risk} ${selected===contract.id?'selected':''}`} aria-pressed={selected===contract.id} onClick={()=>setSelected(contract.id)}>
        <span className="contract-risk">{contract.risk.toUpperCase()} RISK <span>{selected===contract.id?<Check size={16}/>:<ArrowUpRight size={16}/>}</span></span>
        <h4>{contract.title}</h4><span className="contract-cargo">{CARGO[contract.cargoType].label}</span><p>{contract.description}</p>
        <span className="contract-condition">{contract.minimumCargoIntegrity!==null?`Deliver at ≥ ${contract.minimumCargoIntegrity}% integrity`:'Payment for any surviving cargo'}</span>
        <span className="contract-threats">{contract.possibleThreats.map(t=>t.replaceAll('_',' ')).join(' · ')}</span>
        {contract.mystery&&<span className="contract-mystery">Manifest flag · {contract.mystery}</span>}
        <strong>{credits(contract.reward)} <small>cr</small></strong><span className="contract-destination">{contract.destination} · Sector {contract.sector}</span>
      </button>)}
    </div>}
    <div className="gate-departure"><fieldset className="gate-upgrades"><legend>ONE COMPLIMENTARY UPGRADE · OPTIONAL</legend>
      <button aria-pressed={upgrade==='continue'} onClick={()=>setUpgrade('continue')}>Keep loadout</button>
      <button aria-pressed={upgrade==='hull'} disabled={campaign.hullUpgrades>=HULL_CAP} onClick={()=>setUpgrade('hull')}><Shield size={14}/> {campaign.hullUpgrades>=HULL_CAP?'Hull maxed':`Hull ${ship.armor} → ${ship.armor+15}`}</button>
      <button aria-pressed={upgrade==='cruise'} disabled={campaign.cruiseUpgrades>=CRUISE_CAP} onClick={()=>setUpgrade('cruise')}><Zap size={14}/> {campaign.cruiseUpgrades>=CRUISE_CAP?'Cruise maxed':'+5% cruise'}</button>
    </fieldset><button className="primary-button" disabled={!chosen||loading} onClick={()=>chosen&&onDepart(chosen,upgrade)}>Enter Warp <ArrowUpRight size={20}/></button></div>
    <small className="gate-footnote">Fresh cargo loaded for your next contract. Flight stays paused until departure.</small>
  </section>;
}
