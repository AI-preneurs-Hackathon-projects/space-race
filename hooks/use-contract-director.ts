"use client";
import {useEffect} from 'react';
import type {RefObject} from 'react';
import type {Flight} from '@/lib/game/simulation';
import type {Campaign} from '@/lib/game/progression';
import type {RunState} from '@/lib/game/run-manager';
import {contractContext} from '@/lib/game/expedition-context';
import {fallbackDecision,validateDecision} from '@/lib/game/contract-director';
import {ContractDirector} from '@/lib/game/director-client';
import {directorTrigger,markDirectorRequested,queueDirectorDecision} from '@/lib/game/expedition-runtime';

/** Dispatch is outside requestAnimationFrame and never advances the world itself. */
export function useContractDirector({enabled,paused,available,session,flightRef,campaignRef,runRef}:{
 enabled:boolean; paused:boolean; available:boolean; session:number; flightRef:RefObject<Flight>; campaignRef:RefObject<Campaign>; runRef:RefObject<RunState>;
}) {
 useEffect(()=>{
  if(!enabled||paused)return;
  const director=new ContractDirector(available),controller=new AbortController();let pending=false;
  const timer=setInterval(()=>{
   const flight=flightRef.current;
   if(pending||!directorTrigger(flight)||!flight.expedition)return;
   markDirectorRequested(flight);
   const context=contractContext(campaignRef.current,runRef.current,flight.expedition.contract,flight);
   const contractId=flight.expedition.contract.id;pending=true;
   void director.live(context,controller.signal).then(result=>{
    if(controller.signal.aborted||flightRef.current!==flight||flight.status!=='flying'||flight.expedition?.contract.id!==contractId)return;
    const current=contractContext(campaignRef.current,runRef.current,flight.expedition.contract,flight);
    // A valid response can become inapplicable while the ship keeps flying.
    try{queueDirectorDecision(flight,validateDecision(result.value,current),contractId,result.source,current);}
    catch{queueDirectorDecision(flight,fallbackDecision(current),contractId,'fallback',current);}
   }).catch(()=>{}).finally(()=>{pending=false;});
  },500);
  return()=>{clearInterval(timer);controller.abort();};
 },[enabled,paused,available,session,flightRef,campaignRef,runRef]);
}
