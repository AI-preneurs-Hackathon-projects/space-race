import type {Contract, DirectorContext, DirectorDecision} from './contracts';
import {fallbackContracts,fallbackDecision,validateContracts,validateDecision} from './contract-director';

export type DirectorResult<T>={value:T;source:'openai'|'fallback'};
/** The network layer only returns proposals. It has no dependency on Flight or the physics engine. */
export class ContractDirector {
 constructor(private readonly available:boolean) {}
 private async request(mode:'contracts'|'live',context:DirectorContext,signal:AbortSignal,targetSector?:number):Promise<Record<string,unknown>> {
  const response=await fetch('/api/director',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode,context,...(targetSector===undefined?{}:{targetSector})}),signal:AbortSignal.any([signal,AbortSignal.timeout(6800)])});
  if(!response.ok)throw new Error('Contract uplink unavailable');
  return await response.json() as Record<string,unknown>;
 }
 async contracts(context:DirectorContext,targetSector:number,signal:AbortSignal):Promise<DirectorResult<Contract[]>> {
  if(this.available)try {
   const response=await this.request('contracts',context,signal,targetSector);
   return {value:validateContracts({contracts:response.contracts},context,targetSector),source:response.source==='openai'?'openai':'fallback'};
  }catch{if(signal.aborted)throw new DOMException('Director request cancelled','AbortError');}
  return {value:fallbackContracts(context,targetSector),source:'fallback'};
 }
 async live(context:DirectorContext,signal:AbortSignal):Promise<DirectorResult<DirectorDecision>> {
  if(this.available)try {
   const response=await this.request('live',context,signal);
   return {value:validateDecision(response.decision,context),source:response.source==='openai'?'openai':'fallback'};
  }catch{if(signal.aborted)throw new DOMException('Director request cancelled','AbortError');}
  return {value:fallbackDecision(context),source:'fallback'};
 }
}
