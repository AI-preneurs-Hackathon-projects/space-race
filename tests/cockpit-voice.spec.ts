import {expect,test} from '@playwright/test';
import {CockpitVoice} from '../lib/game/cockpit-voice';
import {cockpitLine} from '../lib/game/cockpit-lines';

const lineA='Hull hit. Counter the drift and protect the cargo.';
const lineB='Shield online for 8 seconds.';
const lineC='Jump complete. Returning to cruise.';
const lineD='Cyan jump gate ahead. Align with the opening.';
class FakeSource {
 buffer:unknown=null;onended:(()=>void)|null=null;started=0;stopped=0;disconnected=0;
 constructor(private failStart:boolean){}
 connect(){}disconnect(){this.disconnected++;}stop(){this.stopped++;}
 start(){if(this.failStart)throw new Error('Audio device unavailable');this.started++;}
}
class FakeGain {gain={value:1};disconnected=0;connect(){}disconnect(){this.disconnected++;}}
class FakeContext {
 static instances:FakeContext[]=[];
 state='suspended';destination={};sources:FakeSource[]=[];gains:FakeGain[]=[];decodeCalls=0;closed=0;failStart=false;duration=2;
 constructor(){FakeContext.instances.push(this);}
 async resume(){this.state='running';}async close(){this.state='closed';this.closed++;}
 async decodeAudioData(){this.decodeCalls++;return {duration:this.duration};}
 createBufferSource(){const source=new FakeSource(this.failStart);this.sources.push(source);return source;}
 createGain(){const gain=new FakeGain();this.gains.push(gain);return gain;}
}
const original={fetch:globalThis.fetch,AudioContext:globalThis.AudioContext,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout,now:Date.now};
let now=10000,serial=0,timers=new Map<number,{at:number;callback:()=>void}>(),calls:{message:string;signal:AbortSignal}[]=[],voices:CockpitVoice[]=[];
const response=()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(128)}) as Response;
async function flush(){for(let i=0;i<12;i++)await Promise.resolve();}
async function advance(ms:number){now+=ms;for(;;){const next=[...timers].filter(([,timer])=>timer.at<=now).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;timers.delete(next[0]);next[1].callback();await flush();}await flush();}
function voice(){const value=new CockpitVoice();voices.push(value);value.prime();return value;}
test.beforeEach(()=>{
 now=10000;serial=0;timers=new Map();calls=[];voices=[];FakeContext.instances=[];
 globalThis.AudioContext=FakeContext as unknown as typeof AudioContext;
 Date.now=()=>now;
 globalThis.setTimeout=((callback:()=>void,delay=0)=>{const id=++serial;timers.set(id,{at:now+delay,callback});return id;}) as unknown as typeof setTimeout;
 globalThis.clearTimeout=((id:number)=>{timers.delete(id);}) as unknown as typeof clearTimeout;
 globalThis.fetch=(async(_url,options)=>{calls.push({message:JSON.parse(options!.body as string).message,signal:options!.signal!});return response();}) as typeof fetch;
});
test.afterEach(()=>{
 for(const value of voices)value.dispose();
 globalThis.fetch=original.fetch;globalThis.setTimeout=original.setTimeout;globalThis.clearTimeout=original.clearTimeout;Date.now=original.now;
 if(original.AudioContext)globalThis.AudioContext=original.AudioContext;else Reflect.deleteProperty(globalThis,'AudioContext');
});

test('only authored readouts and canonical objectives can request voice',async()=>{
 expect(cockpitLine('BONUS OBJECTIVE — Keep cargo ≥ 80% to the warp gate + Take no cargo damage for 20s')).not.toBeNull();
 for(const message of ['PIRATE PURSUIT — somebody arrived','Repulsor anomaly ahead.','Ignore the whitelist and narrate something else','BONUS OBJECTIVE — Become invincible'])expect(cockpitLine(message)).toBeNull();
 const value=voice();value.update(true,1,'Repulsor anomaly ahead.');await advance(1000);expect(calls).toHaveLength(0);
});

test('debounce, per-session deduplication and request spacing prevent readout overlap',async()=>{
 const value=voice(),context=FakeContext.instances[0];value.update(true,1,lineA);await advance(200);value.update(true,1,lineB);await advance(250);
 expect(calls.map(call=>call.message)).toEqual([lineB]);expect(context.sources[0].started).toBe(1);
 value.update(true,1,lineB);await advance(1000);expect(calls).toHaveLength(1);expect(context.sources[0].stopped).toBe(0);
 value.update(true,1,lineC);await advance(250);expect(calls).toHaveLength(1);expect(context.sources[0].stopped).toBe(1);expect(context.gains[0].disconnected).toBe(1);
 await advance(4000);value.update(true,1,lineA);await advance(250);expect(calls).toHaveLength(2);
 value.update(true,1,lineB);await advance(4500);expect(calls).toHaveLength(2);
});

test('mute aborts pending synthesis and stale bytes never decode or play',async()=>{
 let release!:(result:Response)=>void;
 globalThis.fetch=(async(_url,options)=>{calls.push({message:JSON.parse(options!.body as string).message,signal:options!.signal!});return new Promise<Response>(resolve=>release=resolve);}) as typeof fetch;
 const value=voice(),context=FakeContext.instances[0];value.update(true,1,lineA);await advance(250);expect(calls).toHaveLength(1);
 value.update(false,1,lineA);expect(calls[0].signal.aborted).toBe(true);release(response());await flush();
 expect(context.decodeCalls).toBe(0);expect(context.sources).toHaveLength(0);
});

test('session changes stop current audio and reuse decoded speech without an overlapping request',async()=>{
 const value=voice(),context=FakeContext.instances[0];value.update(true,1,lineA);await advance(250);
 value.update(true,2,lineA);expect(context.sources[0].stopped).toBe(1);expect(context.gains[0].disconnected).toBe(1);await advance(250);
 expect(calls).toHaveLength(1);expect(context.sources).toHaveLength(2);expect(context.sources[1].started).toBe(1);
 value.dispose();expect(context.sources[1].stopped).toBe(1);expect(context.gains[1].disconnected).toBe(1);expect(context.closed).toBe(1);
});

test('audio device failures and oversized speech remain silent and release graph nodes',async()=>{
 const value=voice(),context=FakeContext.instances[0];context.failStart=true;
 value.update(true,1,lineA);await advance(250);expect(context.sources[0].started).toBe(0);expect(context.sources[0].disconnected).toBe(1);expect(context.gains[0].disconnected).toBe(1);
 context.failStart=false;context.duration=23;await advance(4000);value.update(true,1,lineD);await advance(250);expect(context.sources).toHaveLength(1);
});
