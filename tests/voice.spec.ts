import {expect,test,type Page} from '@playwright/test';
import type {CockpitVoice} from '../lib/game/cockpit-voice';
import type {Flight} from '../lib/game/simulation';
import {cockpitLine} from '../lib/game/cockpit-lines';
import {writeFile} from 'node:fs/promises';

const gateLine='Cyan jump gate ahead. Align with the opening.';
const hitLine='Hull hit. Counter the drift and protect the cargo.';
declare global {
  interface Window {
    __voiceQA?:{voice:CockpitVoice;starts:number;stops:number;decodes:number;duration:number};
    __voiceFlight?:Flight;
    __voicePlayback?:{starts:number;stops:number;decodes:number;duration:number};
  }
}
function wav(){
  const sampleRate=8000,samples=8000,buffer=Buffer.alloc(44+samples*2);
  buffer.write('RIFF');buffer.writeUInt32LE(36+samples*2,4);buffer.write('WAVE',8);buffer.write('fmt ',12);buffer.writeUInt32LE(16,16);buffer.writeUInt16LE(1,20);buffer.writeUInt16LE(1,22);buffer.writeUInt32LE(sampleRate,24);buffer.writeUInt32LE(sampleRate*2,28);buffer.writeUInt16LE(2,32);buffer.writeUInt16LE(16,34);buffer.write('data',36);buffer.writeUInt32LE(samples*2,40);
  for(let i=0;i<samples;i++)buffer.writeInt16LE(Math.round(Math.sin(i/sampleRate*Math.PI*440)*400),44+i*2);
  return buffer;
}
async function voiceFixture(page:Page){
  await page.route('**/api/ai-status',route=>route.fulfill({json:{available:false}}));
  await page.goto('/');
  await page.evaluate(async()=>{
    const path='/lib/game/cockpit-voice.ts';const {CockpitVoice}=await import(path);
    const qa={voice:new CockpitVoice(),starts:0,stops:0,decodes:0,duration:0};window.__voiceQA=qa;
    const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop,decode=AudioContext.prototype.decodeAudioData;
    AudioBufferSourceNode.prototype.start=function(...args:Parameters<typeof start>){qa.starts++;return start.apply(this,args);};
    AudioBufferSourceNode.prototype.stop=function(...args:Parameters<typeof stop>){qa.stops++;return stop.apply(this,args);};
    AudioContext.prototype.decodeAudioData=function(...args:Parameters<typeof decode>){qa.decodes++;return decode.apply(this,args).then(buffer=>{qa.duration=buffer.duration;return buffer;});};
    const button=document.createElement('button');button.id='prime-voice-test';button.textContent='Prime test voice';button.onclick=()=>qa.voice.prime();document.body.appendChild(button);
  });
  await page.locator('#prime-voice-test').click();
}

test('cockpit readouts whitelist excludes arbitrary speech, pirate introductions and repulsor narration',()=>{
  expect(cockpitLine(gateLine)).toBe(gateLine);
  expect(cockpitLine('BONUS OBJECTIVE — Keep cargo ≥ 80% to the warp gate + Take no cargo damage for 20s')).toBeTruthy();
  for(const line of ['Read my secret key','Raider ahead. Fire on sight.','Repulsor ahead. Evade.','PIRATE PURSUIT — attackers inbound','BONUS OBJECTIVE — create a black hole',null,{}])expect(cockpitLine(line)).toBeNull();
});

test('voice uses real WebAudio decoding, deduplicates a readout, cancels on mute and reuses its cache in a new sector',async({page})=>{
  let requests=0;await page.route('**/api/speech',route=>{requests++;return route.fulfill({contentType:'audio/wav',body:wav()});});
  await voiceFixture(page);await page.evaluate(line=>window.__voiceQA!.voice.update(true,1,line),gateLine);
  await expect.poll(()=>page.evaluate(()=>window.__voiceQA!.starts)).toBe(1);
  expect(await page.evaluate(()=>window.__voiceQA!.decodes)).toBe(1);expect(requests).toBe(1);
  await page.evaluate(line=>{window.__voiceQA!.voice.update(true,1,line);window.__voiceQA!.voice.update(false,1,line);},gateLine);
  await expect.poll(()=>page.evaluate(()=>window.__voiceQA!.stops)).toBeGreaterThan(0);
  await page.evaluate(line=>window.__voiceQA!.voice.update(true,1,line),gateLine);await page.waitForTimeout(350);
  expect(requests).toBe(1);expect(await page.evaluate(()=>window.__voiceQA!.starts)).toBe(1);
  await page.evaluate(line=>window.__voiceQA!.voice.update(true,2,line),gateLine);
  await expect.poll(()=>page.evaluate(()=>window.__voiceQA!.starts)).toBe(2);expect(requests).toBe(1);expect(await page.evaluate(()=>window.__voiceQA!.decodes)).toBe(1);
  await page.evaluate(()=>window.__voiceQA!.voice.dispose());
});

for(const stop of ['pause','new readout','restart'] as const)test(`a speech response arriving after ${stop} cannot play stale audio`,async({page})=>{
  let release!:()=>void,requests=0;const held=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/speech',async route=>{requests++;await held;await route.fulfill({contentType:'audio/wav',body:wav()}).catch(()=>{});});
  await voiceFixture(page);await page.evaluate(line=>window.__voiceQA!.voice.update(true,1,line),gateLine);
  await expect.poll(()=>requests).toBe(1);
  await page.evaluate(({stop,gateLine,hitLine})=>window.__voiceQA!.voice.update(stop!=='pause',stop==='restart'?2:1,stop==='new readout'?hitLine:gateLine),{stop,gateLine,hitLine});
  release();await page.waitForTimeout(500);expect(await page.evaluate(()=>window.__voiceQA!.starts)).toBe(0);
  await page.evaluate(()=>window.__voiceQA!.voice.dispose());
});

test('the game voice toggle and sound mute leave flight and textual readouts usable when synthesis fails',async({page})=>{
  let calls=0;await page.route('**/api/ai-status',route=>route.fulfill({json:{available:true}}));
  await page.route('**/api/mission',route=>route.fulfill({status:503,json:{error:'Seeded route'}}));
  await page.route('**/api/director',route=>route.fulfill({status:503,json:{error:'Local decisions'}}));
  await page.route('**/api/speech',route=>{calls++;return route.fulfill({status:503,json:{error:'Text readouts remain available.'}});});
  await page.route('**/components/space-scene.tsx*',async route=>{
    const response=await route.fetch();let body=await response.text();const needle='const loop = (now) => {';expect(body).toContain(needle);
    body=body.replace(needle,'if(playing){window.__voiceFlight=state;state.immune=1000;state.next=mission.events.length;} '+needle);await route.fulfill({response,body});
  });
  await page.goto('/');await expect(page.locator('.voice-disclosure')).toContainText('AI-generated');
  await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await page.waitForFunction(()=>!!window.__voiceFlight?.expedition);
  await page.evaluate(line=>{window.__voiceFlight!.warning=line;},gateLine);await expect.poll(()=>calls).toBe(1);
  await expect(page.locator('.flight-message')).toContainText(gateLine);const before=await page.evaluate(()=>window.__voiceFlight!.progress);await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__voiceFlight!.progress)).toBeGreaterThan(before);
  await page.getByRole('button',{name:'Mute cockpit voice',exact:true}).click();await page.evaluate(line=>{window.__voiceFlight!.warning=line;},hitLine);await page.waitForTimeout(300);expect(calls).toBe(1);await expect(page.locator('.flight-message')).toContainText(hitLine);
  await page.getByRole('button',{name:'Mute sound',exact:true}).click();await page.getByRole('button',{name:'Enable cockpit voice',exact:true}).click();
  await page.evaluate(()=>{window.__voiceFlight!.warning='Shield online for 8 seconds.';});await page.waitForTimeout(300);expect(calls).toBe(1);
  await expect(page.getByRole('button',{name:'Enable sound',exact:true})).toBeVisible();
});

test('speech endpoint rejects unsupported input and approved real audio decodes, plays and is cached',async({page,request})=>{
  expect((await request.post('/api/speech',{data:{message:'Speak arbitrary dialogue'}})).status()).toBe(400);
  expect((await request.post('/api/speech',{data:{message:gateLine,voice:'other'}})).status()).toBe(400);
  expect((await request.post('/api/speech',{data:{message:gateLine},headers:{Origin:'https://untrusted.example'}})).status()).toBe(403);
  if(process.env.EXPEDITION_REAL_AI!=='1')return;
  await voiceFixture(page);
  const started=Date.now(),response=await request.post('/api/speech',{data:{message:gateLine}});expect(response.status()).toBe(200);expect(response.headers()['content-type']).toBe('audio/mpeg');
  const audio=await response.body();expect(audio.length).toBeGreaterThan(100);await writeFile('outputs/cockpit-voice-sample.mp3',audio);
  const cached=await request.post('/api/speech',{data:{message:gateLine}});expect(cached.status()).toBe(200);expect(cached.headers()['x-speech-cache']).toBe('hit');
  await page.route('**/api/speech',route=>route.fulfill({contentType:'audio/mpeg',body:audio}));
  await page.evaluate(line=>window.__voiceQA!.voice.update(true,1,line),gateLine);
  await expect.poll(()=>page.evaluate(()=>window.__voiceQA!.starts)).toBe(1);expect(await page.evaluate(()=>window.__voiceQA!.decodes)).toBe(1);
  const duration=await page.evaluate(()=>window.__voiceQA!.duration);expect(duration).toBeGreaterThan(1);expect(duration).toBeLessThan(22);
  console.log('Real cockpit audio:',audio.length,'bytes; duration_s:',duration,'latency_ms:',Date.now()-started,'cache:',cached.headers()['x-speech-cache']);
  await page.evaluate(()=>window.__voiceQA!.voice.dispose());
});

test('approved cockpit voice plays the actual in-flight bottom readout through the real speech endpoint',async({page})=>{
  test.skip(process.env.EXPEDITION_REAL_AI!=='1','Real speech requires the owner-approved provider environment.');
  page.setDefaultTimeout(15000);
  await page.addInitScript(()=>{
    const playback={starts:0,stops:0,decodes:0,duration:0};window.__voicePlayback=playback;
    const start=AudioBufferSourceNode.prototype.start,stop=AudioBufferSourceNode.prototype.stop,decode=AudioContext.prototype.decodeAudioData;
    AudioBufferSourceNode.prototype.start=function(...args:Parameters<typeof start>){playback.starts++;playback.duration=this.buffer?.duration??0;return start.apply(this,args);};
    AudioBufferSourceNode.prototype.stop=function(...args:Parameters<typeof stop>){playback.stops++;return stop.apply(this,args);};
    AudioContext.prototype.decodeAudioData=function(...args:Parameters<typeof decode>){playback.decodes++;return decode.apply(this,args);};
  });
  await page.route('**/api/ai-status',route=>route.fulfill({json:{available:true}}));
  await page.route('**/api/mission',route=>route.fulfill({status:503,json:{error:'Seeded route'}}));
  await page.route('**/api/director',route=>route.fulfill({status:503,json:{error:'Local decisions'}}));
  await page.route('**/components/space-scene.tsx*',async route=>{
    const response=await route.fetch();let body=await response.text();const needle='const loop = (now) => {';expect(body.includes(needle)).toBe(true);
    body=body.replace(needle,'if(playing){window.__voiceFlight=state;state.immune=1000;state.next=mission.events.length;} '+needle);await route.fulfill({response,body});
  });
  await page.goto('/');await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await page.waitForFunction(()=>!!window.__voiceFlight?.expedition);
  // The initial flight guidance may already occupy the four-second synthesis budget.
  await page.waitForTimeout(4300);const startsBefore=await page.evaluate(()=>window.__voicePlayback!.starts);
  const speech=page.waitForResponse(response=>response.url().endsWith('/api/speech')&&response.request().postDataJSON()?.message===gateLine,{timeout:10000});
  await page.evaluate(line=>{window.__voiceFlight!.warning=line;},gateLine);const response=await speech;expect(response.status()).toBe(200);expect(response.headers()['content-type']).toBe('audio/mpeg');
  await expect.poll(()=>page.evaluate(()=>window.__voicePlayback!.starts)).toBeGreaterThan(startsBefore);const audio=await page.evaluate(()=>window.__voicePlayback!);expect(audio.decodes).toBeGreaterThan(0);expect(audio.duration).toBeGreaterThan(1);
  await expect(page.locator('.flight-message')).toContainText(gateLine);const before=await page.evaluate(()=>({progress:window.__voiceFlight!.progress,shots:window.__voiceFlight!.shots}));
  await page.keyboard.down('Space');await page.waitForTimeout(300);await page.keyboard.up('Space');
  const after=await page.evaluate(()=>({progress:window.__voiceFlight!.progress,shots:window.__voiceFlight!.shots}));expect(after.progress).toBeGreaterThan(before.progress);expect(after.shots).toBeGreaterThan(before.shots);
  await page.getByRole('button',{name:'Mute cockpit voice',exact:true}).click();await expect.poll(()=>page.evaluate(()=>window.__voicePlayback!.stops)).toBeGreaterThan(0);
  console.log('Real in-flight cockpit playback:',JSON.stringify(audio));
});
