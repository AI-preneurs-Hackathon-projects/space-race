import {AIError,generateJSON,readInput} from '@/lib/game/ai';
import {contractDirectorPrompt,contractDirectorSchema,fallbackContracts,fallbackDecision,validateContracts,validateDecision,validateDirectorContext,type DirectorMode} from '@/lib/game/contract-director';
import type {DirectorContext} from '@/lib/game/contracts';

const headers={'Cache-Control':'no-store'};
/** This endpoint proposes whitelisted decisions; it never reads or writes the simulation. */
export async function POST(request:Request){
  let mode:DirectorMode,context:DirectorContext,targetSector:number;
  try{
    const body=await readInput(request,24000);
    if(!body||typeof body!=='object'||Array.isArray(body)||!['contracts','live'].includes(body.mode)||Object.keys(body).some(key=>!['mode','context','targetSector'].includes(key)))throw new AIError('Invalid director request.',400);
    mode=body.mode;context=validateDirectorContext(body.context);
    targetSector=body.targetSector??context.sector+1;
    if(!Number.isInteger(targetSector)||targetSector<1||targetSector>100000||targetSector<context.sector||targetSector>context.sector+1)throw new AIError('Invalid destination sector.',400);
    if(context.hull<=0||mode==='live'&&context.currentCargo===null)throw new AIError('No active expedition is available.',400);
  }catch(error){
    return Response.json({error:'The expedition summary is invalid.'},{status:error instanceof AIError?error.status:400,headers});
  }
  const fallback=()=>mode==='contracts'?{contracts:fallbackContracts(context,targetSector),source:'fallback'}:{decision:fallbackDecision(context),source:'fallback'};
  // Near the final gate there is no reaction room; avoid spending a request on stale live work.
  if(mode==='live'&&(context.routeProgress>=.88||context.elapsed<5))return Response.json(fallback(),{headers});
  try{
    const value=await generateJSON(`contract_director_${mode}`,contractDirectorSchema(mode,context),contractDirectorPrompt(mode,context,targetSector),undefined,{timeoutMs:6000,maxOutputTokens:mode==='contracts'?2800:1000,signal:request.signal});
    const result=mode==='contracts'?{contracts:validateContracts(value,context,targetSector),source:'openai'}:{decision:validateDecision(value,context),source:'openai'};
    return Response.json(result,{headers});
  }catch{
    // Timeout, refusal, provider errors and malformed/unsupported output all preserve playability.
    return Response.json(fallback(),{headers});
  }
}
