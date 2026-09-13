import {AIError,aiConfig,readInput} from '@/lib/game/ai';
import {cockpitLine} from '@/lib/game/cockpit-lines';

const cache=new Map<string,{audio:ArrayBuffer;expires:number}>();
let nextRequest=0;
const headers={'Content-Type':'audio/mpeg','Cache-Control':'private, max-age=3600','X-Content-Type-Options':'nosniff'};

/** Fixed voice and readout whitelist: no microphone, free-form synthesis or client credentials. */
export async function POST(request:Request){
 try{
  const body=await readInput(request,1200);
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||!('message' in body))throw new AIError('Invalid cockpit readout.',400);
  const message=cockpitLine(body.message);if(!message)throw new AIError('Unsupported cockpit readout.',400);
  const now=Date.now(),hit=cache.get(message);
  if(hit&&hit.expires>now)return new Response(hit.audio.slice(0),{headers:{...headers,'X-Speech-Cache':'hit'}});
  const {key}=aiConfig();if(!key)throw new AIError('Cockpit voice unavailable.');
  if(now<nextRequest)throw new AIError('Cockpit voice is busy.',429);nextRequest=now+4000;
  const response=await fetch('https://api.openai.com/v1/audio/speech',{
   method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
   signal:AbortSignal.any([request.signal,AbortSignal.timeout(5500)]),
   body:JSON.stringify({model:'gpt-4o-mini-tts',voice:'cedar',response_format:'mp3',speed:1.08,input:message.replaceAll('≥','at least').replaceAll('×',' times ').replaceAll(' + ','. '),instructions:'Speak as an original calm, confident space cargo pilot giving a brief cockpit radio readout. Clear, grounded, lightly weathered delivery; composed under pressure. Read only the supplied words. No introductions, extra dialogue, sound effects, character impressions or shouting. Keep the pace brisk and intelligible.'}),
  });
  if(!response.ok)throw new AIError('Cockpit voice unavailable.');
  const audio=await response.arrayBuffer();if(audio.byteLength<100||audio.byteLength>1000000)throw new AIError('Cockpit voice unavailable.');
  for(const [line,entry] of cache)if(entry.expires<=now)cache.delete(line);
  if(cache.size>=48)cache.delete(cache.keys().next().value!);
  cache.set(message,{audio,expires:now+3600000});
  return new Response(audio.slice(0),{headers:{...headers,'X-Speech-Cache':'miss'}});
 }catch(error){
  return Response.json({error:'Text readouts remain available.'},{status:error instanceof AIError?error.status:503,headers:{'Cache-Control':'no-store'}});
 }
}
