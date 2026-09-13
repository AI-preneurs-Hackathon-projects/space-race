"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, ArrowRight, Box, Crosshair, Hexagon, PencilLine, Play, Pause, RotateCcw, Shield, Zap, ChevronRight, Radio, Navigation, Volume2, VolumeX } from "lucide-react";
import SpaceScene from "./space-scene";
import Link from "next/link";
import SketchPad from "./sketch-pad";
import ContractGate from './contract-gate';
import ContractHUD from './contract-hud';
import GateTransit from './gate-transit';
import {stageEnvironment} from '@/lib/game/stage-environment';
import FieldGuide from './field-guide';
import {newCampaign,effectiveHull,beginAttempt,finishAttempt,departWithContract,leaveFlight,launchCondition,difficulty,type Upgrade,type Campaign} from '@/lib/game/progression';
import {CARGO,type Contract} from '@/lib/game/contracts';
import {fallbackContracts} from '@/lib/game/contract-director';
import {contractContext} from '@/lib/game/expedition-context';
import {newRun,resolveDelivery,finishRun,cargoSuccessRate,type RunState,type DeliveryResult} from '@/lib/game/run-manager';
import {useContractDirector} from '@/hooks/use-contract-director';
import {ContractDirector} from '@/lib/game/director-client';
import { FLEET, DURATION, CRUISE_SPEED, WARP_DURATION, WARP_MAX_SPEED, practiceMission, type Hull, type Mission, type FlightCondition, type DifficultySetting } from "@/lib/game/types";
import {sectionContext,validateSectionPlan} from '@/lib/game/section-director';
import { createFlight, type Flight, type Input } from "@/lib/game/simulation";
const PRACTICE=practiceMission();
const starterContract=(seed:number)=>fallbackContracts(contractContext(newCampaign(seed),newRun(seed),null),1)[0];
export default function CargoGame(){
 const [initialSeed]=useState(()=>crypto.getRandomValues(new Uint32Array(1))[0]);
 const [hull,setHull]=useState<Hull>(FLEET[0]),[custom,setCustom]=useState<Hull|null>(null),[mission,setMission]=useState<Mission>(PRACTICE),[flightMission,setFlightMission]=useState<Mission>(PRACTICE),[mode,setMode]=useState<"hangar"|"flight"|"transfer">("hangar"),[run,setRun]=useState(0),[flight,setFlight]=useState<Flight>(()=>createFlight(FLEET[0])),[paused,setPaused]=useState(false),[sketch,setSketch]=useState(false),[aiReady,setAIReady]=useState<boolean|null>(null),[loading,setLoading]=useState(false),[notice,setNotice]=useState(""),[graphicsError,setGraphicsError]=useState(""),[muted,setMuted]=useState(false),[modelsReady,setModelsReady]=useState(false);
 const [flightInitial,setFlightInitial]=useState<FlightCondition>({hull:100,cargo:100}),flightRef=useRef(flight),launchRequest=useRef<{controller:AbortController}|null>(null);
 const [campaign,setCampaign]=useState(()=>newCampaign(initialSeed)),campaignRef=useRef(campaign),[flightHull,setFlightHull]=useState<Hull>(FLEET[0]);
 const [expedition,setExpedition]=useState(()=>newRun(initialSeed)),expeditionRef=useRef(expedition);
 const [contract,setContract]=useState<Contract>(()=>starterContract(initialSeed)),contractRef=useRef(contract);
 const [delivery,setDelivery]=useState<DeliveryResult|null>(null),[contracts,setContracts]=useState<Contract[]>([]),[contractsLoading,setContractsLoading]=useState(false);
 const nextContracts=useRef<{contractId:string;controller:AbortController;value:Contract[]|null}|null>(null);
 function commitExpedition(next:RunState){expeditionRef.current=next;setExpedition(next);}
 function commitContract(next:Contract){contractRef.current=next;setContract(next);}
 function resetExpedition(){
  const seed=crypto.getRandomValues(new Uint32Array(1))[0];
  nextContracts.current?.controller.abort();nextContracts.current=null;
  commitCampaign({...newCampaign(seed),difficulty:campaignRef.current.difficulty});commitExpedition(newRun(seed));commitContract(starterContract(seed));setDelivery(null);setContracts([]);setContractsLoading(false);
 }
 const effective=useMemo(()=>effectiveHull(hull,campaign),[hull,campaign]);
 const stageInfo=difficulty(campaign.stage,campaign.difficulty),destination=stageEnvironment(campaign.stage),flightDestination=stageEnvironment(flightMission.stage??1);
 const [transferFrom,setTransferFrom]=useState(0);
 useContractDirector({enabled:mode==='flight'&&flight.status==='flying',paused,available:aiReady===true,session:run,flightRef,campaignRef,runRef:expeditionRef});
 useEffect(()=>{
  if((mode!=='flight'&&campaign.status!=='cleared')||flight.status==='lost'||flight.progress<DURATION*.68||nextContracts.current)return;
  const request={contractId:contractRef.current.id,controller:new AbortController(),value:null as Contract[]|null};nextContracts.current=request;
  if(campaignRef.current.status==='cleared')setContractsLoading(true);
  const context=contractContext(campaignRef.current,expeditionRef.current,contractRef.current,flightRef.current);
  void new ContractDirector(aiReady===true).contracts(context,campaignRef.current.stage+1,request.controller.signal).then(result=>{
   if(request.controller.signal.aborted||nextContracts.current!==request||contractRef.current.id!==request.contractId||expeditionRef.current.status==='over')return;
   request.value=result.value;
   if(campaignRef.current.status==='cleared'){setContracts(result.value);setContractsLoading(false);}
  }).catch(()=>{});
 },[mode,campaign.status,flight.status,flight.progress,aiReady]);
 useEffect(()=>()=>nextContracts.current?.controller.abort(),[]);
 function commitCampaign(next:Campaign){campaignRef.current=next;setCampaign(next);}
 const input=useRef<Input>({x:0,y:0,fire:false}),keys=useRef(new Set<string>()),audio=useRef<AudioContext|null>(null),lastAudio=useRef({shots:0,hits:0,status:"flying"});
 const closeSketch=useCallback(()=>setSketch(false),[]);
 useEffect(()=>{fetch("/api/ai-status",{signal:AbortSignal.timeout(6000)}).then(r=>r.json()).then(v=>setAIReady((v as {available?:boolean}).available===true)).catch(()=>setAIReady(false));},[]);
 const tone=useCallback((frequency:number,length:number,type:OscillatorType="sine")=>{if(muted||!audio.current)return;const ctx=audio.current;const o=ctx.createOscillator(),g=ctx.createGain();o.type=type;o.frequency.setValueAtTime(frequency,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*.4,ctx.currentTime+length);g.gain.setValueAtTime(.045,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+length);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+length);},[muted]);
 const update=useCallback((s:Flight)=>{
  setFlight(s);
  if(s.status!=='flying'){
   const next=finishAttempt(campaignRef.current,flightMission.attempt??0,s.status,s,true);
   if(next!==campaignRef.current){
    commitCampaign(next);
    if(s.status==='delivered'){
     const completed=s.expedition?.objectives.filter(o=>o.status==='completed')??[],failed=s.expedition?.objectives.filter(o=>o.status==='failed')??[];
     const settled=resolveDelivery(expeditionRef.current,contractRef.current,{cargoIntegrity:s.cargo,damageTaken:s.expedition?.damageTaken??s.maxHull-(s.arrivalHull??s.hull),bonusReward:completed.reduce((sum,o)=>sum+o.definition.reward,0),objectivesCompleted:completed.map(o=>o.definition.uiText),objectivesFailed:failed.map(o=>o.definition.uiText)});
     commitExpedition(settled.run);setDelivery(settled.result);
     setContracts(nextContracts.current?.value??fallbackContracts(contractContext(next,settled.run,contractRef.current,s),next.stage+1));
     setContractsLoading(!nextContracts.current?.value);
    }else {commitExpedition(finishRun(expeditionRef.current));nextContracts.current?.controller.abort();nextContracts.current=null;setContractsLoading(false);}
   }
  }
  if(s.shots>lastAudio.current.shots)tone(680,.08,"triangle");if(s.hits>lastAudio.current.hits)tone(95,.22,"sawtooth");if(s.status==="delivered"&&lastAudio.current.status!=="delivered")tone(880,.6);lastAudio.current={shots:s.shots,hits:s.hits,status:s.status};
 },[tone,flightMission]);
 useEffect(()=>{
  function sync(){input.current.x=(keys.current.has("KeyD")||keys.current.has("ArrowRight")?1:0)-(keys.current.has("KeyA")||keys.current.has("ArrowLeft")?1:0);input.current.y=(keys.current.has("KeyW")||keys.current.has("ArrowUp")?1:0)-(keys.current.has("KeyS")||keys.current.has("ArrowDown")?1:0);input.current.fire=keys.current.has("Space");}
  function keydown(e:KeyboardEvent){if(mode==='hangar'||mode==='flight'&&flightRef.current.status!=='flying')return;if(e.code==='Escape'&&!e.repeat){setPaused(p=>!p);keys.current.clear();sync();return;}if(e.target instanceof Element&&e.target.closest('button,a,input,select,textarea,[role="dialog"]'))return;if(["Space","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code))e.preventDefault();keys.current.add(e.code);sync();}
  function keyup(e:KeyboardEvent){keys.current.delete(e.code);sync();}
  function blur(){keys.current.clear();input.current={x:0,y:0,fire:false};if(mode!=="hangar")setPaused(true);}
  function visibility(){if(document.hidden)blur();}
  window.addEventListener("keydown",keydown);window.addEventListener("keyup",keyup);window.addEventListener("blur",blur);document.addEventListener("visibilitychange",visibility);
  return()=>{window.removeEventListener("keydown",keydown);window.removeEventListener("keyup",keyup);window.removeEventListener("blur",blur);document.removeEventListener("visibilitychange",visibility);};
 },[mode]);
 async function launch(){
  if(launchRequest.current||campaignRef.current.status==='cleared'||campaignRef.current.status==='flying')return;
  const retry=campaignRef.current.status==='lost'||expeditionRef.current.status==='over';
  if(retry)resetExpedition();
  const context=sectionContext(hull,campaignRef.current,contractRef.current),snapshot=campaignRef.current,request={controller:new AbortController()};launchRequest.current=request;setLoading(true);setNotice('');
  let template:Mission=PRACTICE;
  try{
   if(aiReady&&!retry){
    const res=await fetch('/api/mission',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(context),signal:AbortSignal.any([request.controller.signal,AbortSignal.timeout(6500)])});
    const data=await res.json() as {error?:string;plan?:unknown};if(!res.ok)throw new Error(data.error||'The director is unavailable.');
    const director=validateSectionPlan(data.plan,difficulty(context.stage,context.difficulty).waves);template={...PRACTICE,title:director.title,source:'openai',director,note:'AI section route ready'};
   }
  }catch{if(request.controller.signal.aborted)return;setNotice('Flight plan restored. Your selected difficulty is ready.');}
  finally{if(launchRequest.current===request)setLoading(false);}
  if(launchRequest.current!==request||request.controller.signal.aborted)return;launchRequest.current=null;
  const started=beginAttempt(snapshot,template,true);if(!started)return;
  const vessel=effectiveHull(hull,started.campaign),condition=launchCondition(started.campaign,vessel);
  started.mission.contract=contractRef.current;
  commitCampaign(started.campaign);setMission(template);setFlightHull(vessel);setFlightInitial(condition);setFlightMission(started.mission);keys.current.clear();input.current={x:0,y:0,fire:false};lastAudio.current={shots:0,hits:0,status:'flying'};
  const initial=createFlight(vessel,condition);flightRef.current=initial;setFlight(initial);setRun(r=>r+1);if(mode!=='transfer')setPaused(false);setMode('flight');
  if(!audio.current)try{audio.current=new AudioContext();}catch{}audio.current?.resume();
 }
 useEffect(()=>()=>launchRequest.current?.controller.abort(),[]);
 function hangar(){launchRequest.current?.controller.abort();launchRequest.current=null;setLoading(false);const active=flightRef.current;if(mode==='flight'&&active.status!=='flying')update(active);commitCampaign(leaveFlight(campaignRef.current,active,true));if(campaignRef.current.status==='lost')resetExpedition();setMode('hangar');setPaused(false);keys.current.clear();input.current={x:0,y:0,fire:false};}
 function depart(selected:Contract,kind:Upgrade|'continue'){
  if(!contracts.some(c=>c.id===selected.id)||selected.sector!==campaignRef.current.stage+1)return;
  const next=departWithContract(campaignRef.current,kind);if(next===campaignRef.current)return;
  nextContracts.current?.controller.abort();nextContracts.current=null;
  setTransferFrom(campaignRef.current.stage);commitCampaign(next);commitContract(selected);setDelivery(null);setContracts([]);setContractsLoading(false);setMode('transfer');setPaused(false);keys.current.clear();input.current={x:0,y:0,fire:false};setNotice('');
 }

 function useCustom(h:Hull){setCustom(h);setHull(h);setSketch(false);setNotice(h.origin==="openai"?"Your OpenAI-designed hull is ready. Preview it, then launch.":"Your local sketch-built hull is ready to fly.");}
 const ended=mode==="flight"&&flight.status!=="flying",delivered=flight.status==="delivered";
 return <main className={`game-shell ${mode!=="hangar"?"in-flight":"in-hangar"} ${campaign.status==='cleared'?'has-pending-upgrade':''}`}>
  <header className="topbar"><Link className="wordmark" href="/" onClick={e=>{e.preventDefault();hangar();}} aria-label="Space Race home"><span className="brand-mark"><Hexagon size={29}/><Navigation size={15}/></span><span>SPACE<span className="logo-light">RACE</span></span></Link><nav aria-label="Game phases"><span className={mode==="hangar"?"active":""}>01 <b>HANGAR</b></span><ChevronRight size={14}/><span className={mode==="flight"?"active":""}>02 <b>DELIVERY</b></span></nav><div className="header-right"><span className="version-label">CARGO RUN / 04</span><button className="icon-button" aria-label={muted?"Enable sound":"Mute sound"} onClick={()=>setMuted(m=>!m)}>{muted?<VolumeX size={18}/>:<Volume2 size={18}/>}</button></div></header>
  {mode==="hangar"?<>
   <section className="hangar-main"><div className="ship-info"><span className="eyebrow">STAGE {campaign.stage} / SELECT VESSEL</span><h1>Ready for <br/>the run.</h1><p className="intro">Get the supplies to {destination.name}. <br/>Keep the pirates off your cargo.</p><div className="ship-specs"><div><Shield size={17}/><span>HULL ARMOR</span><b>{Math.ceil(launchCondition(campaign,effective).hull)}<small> / {effective.armor}</small></b></div><div><Zap size={17}/><span>HANDLING</span><b>{hull.handling>1?"AGILE":hull.handling<1?"STEADY":"BALANCED"}</b></div><div><Crosshair size={17}/><span>WEAPONS</span><b>PULSE CANNONS</b></div><div><Box size={17}/><span>CRUISE SPEED</span><b>{Math.round((effective.cruise??1)*100)}%</b></div></div><span className="small-note">{hull.origin==="openai"?"OPENAI-DESIGNED HULL":hull.origin==="local"?"LOCAL SKETCH-BUILT HULL":"FLIGHT SYSTEMS READY"}</span></div>
   <div className="hangar-viewport"><span className="viewport-caption"><span className="corner"/> LIVE 3D / {hull.id.toUpperCase()}</span><SpaceScene key={`hangar-${hull.name}`} hull={effective} mission={mission} stage={campaign.stage} playing={false} paused={false} input={input} onUpdate={update} onError={setGraphicsError} onReady={setModelsReady}/><div className="ship-name"><span>{hull.role}</span><h2 style={{color:hull.color}}>{hull.name}</h2><p>READY TO FLY <span>↗</span></p></div></div>
   <aside className="mission-card"><div className="mission-top"><span className="eyebrow">STAGE {campaign.stage} CONTRACT</span><span className="contract-id">{stageInfo.label}</span></div>{campaign.status==='cleared'?<p>Delivery resolved. Choose your next contract at the gate.</p>:<><h2>{contract.title}<span>.</span></h2><p className="cargo-briefing">{contract.description}</p><div className="route"><div><span className="route-node origin-node"/><span>ORIGIN<b>{campaign.stage===1?'Port Meridian':stageEnvironment(campaign.stage-1).name}</b></span></div><div className="route-line"><span>HOSTILE TERRITORY</span></div><div><span className="route-node destination-node"/><span>DESTINATION<b>{destination.name}</b></span></div></div><div className="mission-metrics"><div><b>{Math.floor(DURATION/(effective.cruise??1)/60)}:{Math.floor(DURATION/(effective.cruise??1)%60).toString().padStart(2,"0")}<span> MIN</span></b><span>AT CRUISE SPEED</span></div><div><b>{Math.ceil(launchCondition(campaign,effective).cargo)}<span> %</span></b><span>CARGO REMAINING</span></div></div><fieldset className="difficulty-picker" disabled={loading}><legend>DIFFICULTY</legend>{(["easy","normal","hard"] as DifficultySetting[]).map(level=><button type="button" key={level} aria-pressed={campaign.difficulty===level} onClick={()=>commitCampaign({...campaignRef.current,difficulty:level})}>{level[0].toUpperCase()+level.slice(1)}</button>)}</fieldset><button className="primary-button" onClick={()=>launch()} disabled={loading||aiReady===null||!modelsReady||!!graphicsError}>{loading?'Planning this section…':modelsReady?(campaign.stage===1?'Launch delivery':`Launch stage ${campaign.stage}`):'Preparing models…'} <ArrowUpRight size={20}/></button></>}<span className="mission-source"><Radio size={13}/>{loading?'Preparing flight plan…':aiReady?'Contract uplink available':aiReady===null?'Checking contract uplink…':'Local dispatch ready'}</span><FieldGuide/></aside></section>
   <div className="progression-strip"><b>STAGE {campaign.stage} · {stageInfo.label}</b><span>{campaign.hullUpgrades}/5 HULL UPGRADES</span><span>{campaign.cruiseUpgrades}/4 CRUISE UPGRADES</span><small>Expedition upgrades last until your ship is destroyed.</small></div>
   <section className="fleet-section" aria-label="Choose your ship"><div className="fleet-heading"><span className="eyebrow">CHOOSE YOUR SHIP</span><span>03 FLEET VESSELS / {custom?"01":"00"} CUSTOM</span></div><div className="fleet-grid">{FLEET.map((s,i)=><button className={`ship-card ${hull.id===s.id?"selected":""}`} aria-pressed={hull.id===s.id} key={s.id} disabled={loading} onClick={()=>setHull(s)} style={{"--ship-color":s.color} as React.CSSProperties}><span className="ship-number">0{i+1}</span><span className="ship-card-name"><b>{s.name}</b><span>{s.role}</span></span><span className="ship-select-icon">{hull.id===s.id?<span className="selected-dot"/>:<ArrowUpRight size={18}/>}</span></button>)}<button disabled={loading} className={`ship-card custom-card ${hull.id==="custom"?"selected":""}`} onClick={()=>custom?setHull(custom):setSketch(true)}><PencilLine size={22}/><span className="ship-card-name"><b>{custom?custom.name:"Build your own"}</b><span>{custom?"Your custom 3D hull":"Sketch an optional ship shape"}</span></span><span className="ship-select-icon"><ArrowUpRight size={18}/></span></button></div>{custom&&<button disabled={loading} className="quiet-button redraw-button" onClick={()=>setSketch(true)}><PencilLine size={14}/> Draw a new ship</button>}</section>
   {notice&&<p className="notice" role="status">{notice}</p>}
   <footer className="hangar-footer"><span><kbd>W A S D</kbd> / <kbd>↑ ↓ ← →</kbd> STEER</span><span><kbd>SPACE</kbd> FIRE</span><span><kbd>ESC</kbd> PAUSE</span><span className="footer-touch">Touch controls available</span><span className="footer-goal"><Box size={14}/> THE CARGO COMES FIRST.</span></footer>
  </>:mode==='transfer'?<GateTransit from={transferFrom} to={campaign.stage} hull={effective} cargo={campaign.cargo} planning={loading} paused={paused} onPause={()=>setPaused(p=>!p)} onComplete={launch}/>:<div className="flight-main"><SpaceScene key={run} flightStateRef={flightRef} initialCondition={flightInitial} hull={flightHull} mission={flightMission} stage={flightMission.stage??1} playing paused={paused||ended} input={input} onUpdate={update} onError={setGraphicsError} onReady={setModelsReady}/><div className={`damage-flash ${flight.immune>0?"visible":""}`}/><div className="hud-top"><div className="hud-vitals"><div><Shield size={18}/><span>HULL</span><b>{Math.ceil(flight.hull)}<small> / {flightHull.armor}</small></b><meter min={0} max={flightHull.armor} value={flight.hull}/></div><div><Box size={18}/><span>CARGO</span><b>{Math.floor(flight.cargo*10)/10}<small>%</small></b><meter min={0} max={100} value={flight.cargo}/></div></div><div className="route-progress"><div><span>STAGE {flightMission.stage??1}</span><b>{flightDestination.name}</b></div><div className="progress-track"><span style={{width:`${flight.progress/DURATION*100}%`}}/></div><span>{Math.ceil((DURATION-flight.progress)*CRUISE_SPEED)} KM TO {flightDestination.name.toUpperCase()} · {CARGO[contract.cargoType].label.toUpperCase()}</span></div><button className="icon-button pause-button" onClick={()=>setPaused(p=>!p)} aria-label="Pause game"><Pause size={20}/></button></div><div className={`warp-vignette ${flight.warpAge!==null?"engaged":""}`} style={{opacity:Math.max(0,(flight.speed/flight.cruise-1)/(WARP_MAX_SPEED-1))}}/><div className={`warp-status ${flight.warpAge!==null?"engaged":""}`}><Zap size={16}/><div><b>{Math.round(CRUISE_SPEED*flight.speed)}<small> KM/S</small></b><span>{flight.speed.toFixed(2)}× CRUISE</span></div><div><span>{flight.warpAge!==null?`JUMP DRIVE · ${Math.ceil(WARP_DURATION-flight.warpAge)}s`:"FORWARD SPEED"}</span><meter aria-label="Forward speed" min={0} max={WARP_MAX_SPEED*flight.cruise} value={flight.speed}/><small>{Math.round(flight.distanceSaved)} KM GAINED</small></div></div>{flight.field&&<div className="field-status"><Navigation size={17} style={{transform:`rotate(${Math.atan2(flight.fieldX,flight.fieldY)*180/Math.PI}deg)`}}/><span>{flight.field} · {flight.field.includes("Repulsor")?"REPULSION":"GRAVITY PULL"}</span></div>}{(flight.shield>0||flight.hull/flight.maxHull<.7)&&<div className={`hull-status ${flight.hull/flight.maxHull<.3?"critical":""}`}><Shield size={15}/>{flight.shield>0?`SHIELD · ${Math.ceil(flight.shield)}s`:flight.hull/flight.maxHull<.3?"HULL CRITICAL · REACH THE WARP GATE":"HULL DAMAGED · REPAIR AT WARP GATE"}</div>}<ContractHUD flight={flight}/><div className="aim-reticle" aria-hidden="true">+</div><div className="flight-message" role="status"><Radio size={16}/>{flight.warning}</div><div className="flight-bottom"><span><b>{hull.name.toUpperCase()}</b> / FORWARD THRUST ACTIVE</span><span>{flight.kills} CLEARED · {flight.chainHits} BLAST HITS · {flight.portalsUsed}/2 JUMPS</span></div><div className="touch-controls"><div className="steer-pad" aria-label="Touch steering pad" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);const b=e.currentTarget.getBoundingClientRect();input.current.x=Math.max(-1,Math.min(1,(e.clientX-b.left-b.width/2)/(b.width*.33)));input.current.y=Math.max(-1,Math.min(1,-(e.clientY-b.top-b.height/2)/(b.height*.33)));}} onPointerMove={e=>{if(!e.currentTarget.hasPointerCapture(e.pointerId))return;const b=e.currentTarget.getBoundingClientRect();input.current.x=Math.max(-1,Math.min(1,(e.clientX-b.left-b.width/2)/(b.width*.33)));input.current.y=Math.max(-1,Math.min(1,-(e.clientY-b.top-b.height/2)/(b.height*.33)));}} onPointerUp={()=>{input.current.x=0;input.current.y=0;}} onPointerCancel={()=>{input.current.x=0;input.current.y=0;}}><span>↑</span><div>← <i/> →</div><span>↓</span></div><button className="fire-button" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);input.current.fire=true;}} onPointerUp={()=>input.current.fire=false} onPointerCancel={()=>input.current.fire=false}><Crosshair size={28}/><span>FIRE</span></button></div>
   {(paused||ended)&&!delivered&&<div className="modal-shade"><section className="result-panel" role="dialog" aria-modal="true" aria-labelledby="flight-result-title"><span className="eyebrow">{ended?"SIGNAL LOST":"FLIGHT ON HOLD"}</span><div className="result-icon">{ended?<Shield size={30}/>:<Pause size={30}/>}</div><h2 id="flight-result-title">{ended?"Expedition over":"Take a breath."}</h2><p>{ended?"Your ship was destroyed. Start a fresh expedition with a new delivery.":"Your ship and cargo are safe while paused."}</p>{ended&&<div className="expedition-stats"><div><b>{expedition.sectorsCompleted}</b><span>SECTORS COMPLETED</span></div><div><b>{expedition.deliveriesCompleted}</b><span>DELIVERIES COMPLETED</span></div><div><b>{expedition.totalReward.toLocaleString('en-US')}</b><span>TOTAL REWARD</span></div><div><b>{cargoSuccessRate(expedition)}%</b><span>CARGO SUCCESS RATE</span></div><div><b>{expedition.bestSector}</b><span>BEST SECTOR</span></div><div><b>{expedition.score.toLocaleString('en-US')}</b><span>SCORE</span></div></div>}<button className="primary-button" disabled={loading} onClick={ended?()=>launch():()=>setPaused(false)}>{ended?<RotateCcw size={18}/>:<Play size={18}/>} {loading?'Preparing expedition…':ended?'Retry':'Resume delivery'}</button><button className="quiet-button" onClick={hangar}><ArrowRight size={16}/> Return to hangar</button></section></div>}
  </div>}
  {delivery&&campaign.status==='cleared'&&<div className="modal-shade gate-shade"><ContractGate key={delivery.contractId} result={delivery} contracts={contracts} loading={contractsLoading} campaign={campaign} hull={hull} onDepart={depart}/></div>}
  {sketch&&<SketchPad onClose={closeSketch} onUse={useCustom} aiReady={aiReady===true}/>}
  {graphicsError&&<div className="modal-shade"><section className="result-panel"><h2>Flight systems offline.</h2><p role="alert">{graphicsError}</p><button className="primary-button" onClick={()=>location.reload()}>Reload game <RotateCcw size={18}/></button></section></div>}
 </main>;
}
