import {cockpitLine} from './cockpit-lines';

/** Speech is a best-effort observer; it never awaits or updates gameplay. */
export class CockpitVoice {
 private context:AudioContext|null=null;
 private source:AudioBufferSourceNode|null=null;
 private gain:GainNode|null=null;
 private request:AbortController|null=null;
 private timer:ReturnType<typeof setTimeout>|null=null;
 private cache=new Map<string,AudioBuffer>();
 private seen=new Set<string>();
 private session=-1;
 private enabled=false;
 private message='';
 private nextRequest=0;
 private generation=0;

 prime(){
  try{this.context??=new AudioContext();void this.context.resume().catch(()=>{});}catch{/* Text remains available if audio is unsupported. */}
 }
 stop(){
  this.generation++;this.request?.abort();this.request=null;
  if(this.timer!==null)clearTimeout(this.timer);this.timer=null;
  const source=this.source,gain=this.gain;this.source=null;this.gain=null;
  if(source)source.onended=null;
  try{source?.stop();}catch{}try{source?.disconnect();}catch{}try{gain?.disconnect();}catch{}
 }
 update(enabled:boolean,session:number,message:string){
  const changedSession=session!==this.session;
  if(changedSession){this.stop();this.session=session;this.seen.clear();this.message='';}
  this.enabled=enabled;
  if(!enabled){this.stop();this.message=message;this.seen.add(message);return;}
  if(message===this.message)return;
  this.stop();this.message=message;
  const line=cockpitLine(message);
  if(!line||this.seen.has(line)||!this.context||this.context.state!=='running')return;
  const generation=this.generation;
  this.timer=setTimeout(()=>{this.timer=null;void this.speak(line,generation);},250);
 }
 private async speak(message:string,generation:number){
  const context=this.context;if(!context||!this.enabled||generation!==this.generation)return;
  let buffer=this.cache.get(message);
  if(!buffer){
   if(Date.now()<this.nextRequest)return;this.nextRequest=Date.now()+4000;
   const controller=new AbortController();this.request=controller;
   try{
    const response=await fetch('/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(6000)])});
    if(!response.ok)return;
    const bytes=await response.arrayBuffer();if(bytes.byteLength>1000000||generation!==this.generation||!this.enabled||context!==this.context)return;
    buffer=await context.decodeAudioData(bytes);
    if(buffer.duration>22||generation!==this.generation||!this.enabled||context!==this.context)return;
    if(this.cache.size>=32)this.cache.delete(this.cache.keys().next().value!);this.cache.set(message,buffer);
   }catch{return;}finally{if(this.request===controller)this.request=null;}
  }
  if(!this.enabled||generation!==this.generation||context.state!=='running')return;
  let source:AudioBufferSourceNode|null=null,gain:GainNode|null=null;
  try{
   source=context.createBufferSource();gain=context.createGain();gain.gain.value=.72;source.buffer=buffer;source.connect(gain);gain.connect(context.destination);
   const playing=source,volume=gain;this.source=playing;this.gain=volume;
   playing.onended=()=>{playing.disconnect();volume.disconnect();if(this.source===playing){this.source=null;this.gain=null;}};playing.start();this.seen.add(message);
  }catch{
   if(source)source.onended=null;
   try{source?.stop();}catch{}try{source?.disconnect();}catch{}try{gain?.disconnect();}catch{}
   if(this.source===source){this.source=null;this.gain=null;}
  }
 }
 dispose(){this.enabled=false;this.stop();this.cache.clear();void this.context?.close().catch(()=>{});this.context=null;}
}
