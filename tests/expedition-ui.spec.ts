import {expect, test, type Page} from '@playwright/test';
import type {Flight} from '../lib/game/simulation';
import type {Mission} from '../lib/game/types';
import type {DirectorContext} from '../lib/game/contracts';
import {difficulty} from '../lib/game/progression';
import {fallbackContracts, fallbackDecision, validateContracts, validateDecision} from '../lib/game/contract-director';

declare global {
  interface Window {__expeditionQA?:{state:Flight;mission:Mission;ready:boolean;arrive:()=>void}}
}

/** Instrument only the fetched development module; production has no testing shortcuts. */
async function exposeFlight(page:Page) {
  await page.route('**/components/space-scene.tsx*',async route=>{
    const response=await route.fetch();let body=await response.text();
    const needle='const loop = (now) => {';expect(body).toContain(needle);
    body=body.replace(needle,'if (playing) { state.immune=1000; window.__expeditionQA={state,mission,get ready(){return ready},arrive(){disposeFlight(state);state.progress=149.95;state.cargo=81.5;state.hull=41;}}; } '+needle);
    await route.fulfill({response,body});
  });
}
async function readyFlight(page:Page,stage:number) {
  await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage',String(stage));
  await page.waitForFunction(stage=>window.__expeditionQA?.ready&&window.__expeditionQA.mission.stage===stage,stage);
}
async function reachGate(page:Page) {
  await page.evaluate(()=>window.__expeditionQA!.arrive());
  await expect(page.getByRole('heading',{name:'Delivery complete',exact:true})).toBeVisible();
}
async function mockRoutePlanning(page:Page,mockStatus=true) {
  if(mockStatus)await page.route('**/api/ai-status',route=>route.fulfill({json:{available:true}}));
  await page.route('**/api/mission',route=>{
    const summary=route.request().postDataJSON();
    return route.fulfill({json:{plan:{title:'Test sector route',beats:Array.from({length:difficulty(summary.stage,summary.difficulty).waves-2},(_,i)=>({objectType:i%4===0?'pirate':i%2?'ice-asteroid':'fuel-tank',pace:'steady'}))}}});
  });
}

test('offline expedition delivers, pauses at three contracts, loads fresh cargo, then dies and immediately retries',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/ai-status',route=>route.fulfill({json:{available:false}}));
  await exposeFlight(page);await page.goto('/');
  await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await readyFlight(page,1);
  const firstId=await page.evaluate(()=>window.__expeditionQA!.state.expedition!.contract.id);
  await page.evaluate(()=>{window.__expeditionQA!.state.time=8.1;});
  await expect.poll(()=>page.evaluate(()=>window.__expeditionQA!.state.expedition!.events.length)).toBeGreaterThan(0);
  await expect.poll(()=>page.evaluate(()=>window.__expeditionQA!.state.expedition!.objectives.length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.__expeditionQA!.state.expedition!.events[0].source)).toBe('fallback');
  await expect(page.getByRole('complementary',{name:'Delivery contract'})).toContainText('BONUS OBJECTIVE');
  await reachGate(page);
  await expect(page.locator('.delivery-ledger')).toContainText('81.5%');await expect(page.locator('.contract-option')).toHaveCount(3);
  const stoppedAt=await page.evaluate(()=>window.__expeditionQA!.state.time);await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.__expeditionQA!.state.time)).toBe(stoppedAt);
  await expect(page.getByRole('button',{name:'Enter Warp',exact:true})).toBeDisabled();
  const next=page.locator('.contract-option.risk-high');await next.focus();await page.keyboard.press('Space');await expect(next).toHaveAttribute('aria-pressed','true');
  await page.getByRole('button',{name:'Enter Warp',exact:true}).focus();await page.keyboard.press('Tab');await expect(page.locator('.contract-option').first()).toBeFocused();
  await expect(page.getByRole('heading',{name:'Delivery complete',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Hull 100 → 115',exact:true}).click();
  await page.screenshot({path:'outputs/expedition-gate-desktop.png',fullPage:true});
  await page.getByRole('button',{name:'Enter Warp',exact:true}).click();
  await expect(page.getByRole('region',{name:'Checkpoint transfer'})).toBeVisible();
  await readyFlight(page,2);
  const nextFlight=await page.evaluate(()=>({cargo:window.__expeditionQA!.state.cargo,maxHull:window.__expeditionQA!.state.maxHull,cargoType:window.__expeditionQA!.state.expedition!.contract.cargoType}));
  expect(nextFlight).toEqual({cargo:100,maxHull:115,cargoType:'volatile_fuel'});
  await page.evaluate(()=>{window.__expeditionQA!.state.hull=0;});
  await expect(page.getByRole('heading',{name:'Expedition over',exact:true})).toBeVisible();
  await expect(page.locator('.expedition-stats')).toContainText('SECTORS COMPLETED');
  expect(await page.locator('.expedition-stats > div').nth(0).locator('b').innerText()).toBe('1');
  await page.getByRole('button',{name:'Retry',exact:true}).click();await readyFlight(page,1);
  const restart=await page.evaluate(()=>{const state=window.__expeditionQA!.state;return {hull:state.hull,maxHull:state.maxHull,cargo:state.cargo,id:state.expedition!.contract.id,eventCount:state.expedition!.events.length,objectives:state.expedition!.objectives.length};});
  expect(restart).toMatchObject({hull:100,maxHull:100,cargo:100,eventCount:0,objectives:0});expect(restart.id).not.toBe(firstId);
  expect(errors).toEqual([]);
});

test('mobile delivery gate keeps all three choices and departure usable without horizontal overflow',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.route('**/api/ai-status',route=>route.fulfill({json:{available:false}}));
  await exposeFlight(page);await page.goto('/');await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await readyFlight(page,1);
  await reachGate(page);await expect(page.locator('.contract-option')).toHaveCount(3);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.locator('.contract-option.risk-medium').click();await page.getByRole('button',{name:'Enter Warp',exact:true}).scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'Enter Warp',exact:true})).toBeEnabled();
  await page.screenshot({path:'outputs/expedition-gate-mobile.png'});
});

test('AI proposals affect live play and next manifests while movement and shooting continue during requests',async({page})=>{
  await mockRoutePlanning(page);await exposeFlight(page);
  const requests:{mode:string;context:DirectorContext;targetSector?:number}[]=[];
  let release!:()=>void;const held=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/director',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(body.mode==='live'){
      if(requests.filter(request=>request.mode==='live').length===1)await held;
      await route.fulfill({json:{decision:fallbackDecision(body.context),source:'openai'}});
    }else await route.fulfill({json:{contracts:fallbackContracts(body.context,body.targetSector).map((contract,i)=>({...contract,title:`Dispatch ${i+1}: ${contract.title}`})),source:'openai'}});
  });
  await page.goto('/');await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await readyFlight(page,1);
  await page.evaluate(()=>{window.__expeditionQA!.state.time=8.1;});
  await expect.poll(()=>requests.filter(request=>request.mode==='live').length).toBe(1);
  const before=await page.evaluate(()=>({progress:window.__expeditionQA!.state.progress,shots:window.__expeditionQA!.state.shots}));
  await page.keyboard.down('Space');await page.waitForTimeout(400);await page.keyboard.up('Space');
  const during=await page.evaluate(()=>({progress:window.__expeditionQA!.state.progress,shots:window.__expeditionQA!.state.shots,events:window.__expeditionQA!.state.expedition!.events.length}));
  expect(during.progress).toBeGreaterThan(before.progress);expect(during.shots).toBeGreaterThan(before.shots);expect(during.events).toBe(0);
  release();await expect.poll(()=>page.evaluate(()=>window.__expeditionQA!.state.expedition!.events[0]?.source)).toBe('openai');
  expect(await page.evaluate(()=>window.__expeditionQA!.state.expedition!.objectives[0].source)).toBe('openai');
  await reachGate(page);await expect(page.locator('.contract-option')).toHaveCount(3);await expect(page.locator('.contract-option').first()).toContainText('Dispatch 1:');
  await page.locator('.contract-option.risk-medium').click();await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await readyFlight(page,2);
  await page.evaluate(()=>{window.__expeditionQA!.state.time=8.1;});
  await expect.poll(()=>page.evaluate(()=>window.__expeditionQA!.state.expedition!.events[0]?.type)).toBe('bounty_hunter');
  expect(await page.evaluate(()=>window.__expeditionQA!.state.expedition!.objectives[0].definition.conditions[0].type)).toBe('DESTROY_TARGET');
  await page.screenshot({path:'outputs/expedition-ai-bounty.png'});
});

test('live replies arriving after pause or death cannot change a stopped flight or a restarted expedition',async({page})=>{
  await mockRoutePlanning(page);await exposeFlight(page);
  let requestCount=0;const releases:(()=>void)[]=[];
  await page.route('**/api/director',async route=>{
    const body=route.request().postDataJSON();
    if(body.mode==='contracts')return route.fulfill({json:{contracts:fallbackContracts(body.context,body.targetSector),source:'openai'}});
    requestCount++;await new Promise<void>(resolve=>releases.push(resolve));
    await route.fulfill({json:{decision:fallbackDecision(body.context),source:'openai'}}).catch(()=>{});
  });
  await page.goto('/');await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await readyFlight(page,1);
  await page.evaluate(()=>{window.__expeditionQA!.state.time=8.1;});await expect.poll(()=>requestCount).toBe(1);
  await page.getByRole('button',{name:'Pause game',exact:true}).click();const pausedAt=await page.evaluate(()=>window.__expeditionQA!.state.time);releases[0]();
  await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__expeditionQA!.state.time)).toBe(pausedAt);
  expect(await page.evaluate(()=>window.__expeditionQA!.state.expedition!.events.length)).toBe(0);
  await page.getByRole('button',{name:'Resume delivery',exact:true}).click();
  await page.evaluate(()=>{window.__expeditionQA!.state.time+=23;});await expect.poll(()=>requestCount).toBe(2);
  const oldId=await page.evaluate(()=>window.__expeditionQA!.state.expedition!.contract.id);
  await page.evaluate(()=>{window.__expeditionQA!.state.hull=0;});await expect(page.getByRole('heading',{name:'Expedition over',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retry',exact:true}).click();await readyFlight(page,1);releases[1]();await page.waitForTimeout(300);
  const fresh=await page.evaluate(()=>({id:window.__expeditionQA!.state.expedition!.contract.id,events:window.__expeditionQA!.state.expedition!.events.length,objectives:window.__expeditionQA!.state.expedition!.objectives.length}));
  expect(fresh.id).not.toBe(oldId);expect(fresh.events).toBe(0);expect(fresh.objectives).toBe(0);expect(requestCount).toBe(2);
});

test('director endpoint validates request boundaries and returns legal provider or fallback decisions and contracts',async({request})=>{
  const invalid=await request.post('/api/director',{data:{mode:'live',context:{hull:100}}});expect(invalid.status()).toBe(400);
  const origin=await request.post('/api/director',{data:{},headers:{Origin:'https://untrusted.example'}});expect(origin.status()).toBe(403);
  const summary:DirectorContext={sector:1,difficulty:'normal',hull:100,maxHull:100,cargoIntegrity:100,currentCargo:'medical_supplies',upgrades:{hull:0,cruise:0},credits:0,performance:{damageTaken:0,kills:0,itemsCollected:0,objectivesCompleted:0,objectivesFailed:0},enemies:{active:0,bountyHunter:false},notableEvents:[],recentBehavior:['careful_flying'],previousContracts:[],recentObjectives:[],elapsed:20,routeProgress:.2,instability:0,seed:111};
  const atGate={...summary,routeProgress:.95},fallback=await request.post('/api/director',{data:{mode:'live',context:atGate}});
  expect(fallback.status()).toBe(200);const local=await fallback.json();expect(local.source).toBe('fallback');expect(()=>validateDecision(local.decision,atGate)).not.toThrow();
  if(process.env.EXPEDITION_REAL_AI!=='1')return;
  const started=Date.now(),response=await request.post('/api/director',{data:{mode:'live',context:summary}});expect(response.status()).toBe(200);
  const result=await response.json();expect(['openai','fallback']).toContain(result.source);expect(()=>validateDecision(result.decision,summary)).not.toThrow();
  console.log('Director live source:',result.source,'latency_ms:',Date.now()-started);
  // Respect the existing isolate request spacing before checking the second output schema.
  await new Promise(resolve=>setTimeout(resolve,2600));
  const contractStarted=Date.now(),contractResponse=await request.post('/api/director',{data:{mode:'contracts',context:summary,targetSector:2}});expect(contractResponse.status()).toBe(200);
  const choices=await contractResponse.json();expect(['openai','fallback']).toContain(choices.source);expect(()=>validateContracts({contracts:choices.contracts},summary,2)).not.toThrow();
  console.log('Director contracts source:',choices.source,'latency_ms:',Date.now()-contractStarted);
});

test('a timed-out contract uplink offers local choices promptly and ignores its late reply after departure',async({page})=>{
  await mockRoutePlanning(page);await exposeFlight(page);let release!:()=>void;
  const held=new Promise<void>(resolve=>release=resolve);
  await page.route('**/api/director',async route=>{
    const body=route.request().postDataJSON();
    if(body.mode==='live')return route.fulfill({json:{decision:fallbackDecision(body.context),source:'openai'}});
    await held;await route.fulfill({json:{contracts:fallbackContracts(body.context,body.targetSector).map(contract=>({...contract,title:'Late manifest must be ignored'})),source:'openai'}}).catch(()=>{});
  });
  await page.goto('/');await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await readyFlight(page,1);
  const start=Date.now();await reachGate(page);await expect(page.locator('.contract-loading')).toBeVisible();
  await expect(page.locator('.contract-option')).toHaveCount(3,{timeout:8000});expect(Date.now()-start).toBeLessThan(8500);
  await page.locator('.contract-option.risk-medium').click();await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await readyFlight(page,2);
  const selected=await page.evaluate(()=>window.__expeditionQA!.state.expedition!.contract.id);release();await page.waitForTimeout(300);
  expect(await page.evaluate(()=>window.__expeditionQA!.state.expedition!.contract.id)).toBe(selected);await expect(page.getByText('Late manifest must be ignored')).toHaveCount(0);
});

test('small-screen live objectives remain readable above the touch controls',async({page})=>{
  await page.setViewportSize({width:390,height:844});await mockRoutePlanning(page);await exposeFlight(page);
  await page.route('**/api/director',route=>{
    const body=route.request().postDataJSON();return route.fulfill({json:body.mode==='live'?{decision:fallbackDecision(body.context),source:'openai'}:{contracts:fallbackContracts(body.context,body.targetSector),source:'openai'}});
  });
  await page.goto('/');await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await readyFlight(page,1);
  await page.evaluate(()=>{window.__expeditionQA!.state.time=8.1;});await expect.poll(()=>page.evaluate(()=>window.__expeditionQA!.state.expedition!.objectives.length)).toBe(1);
  await page.evaluate(()=>{const state=window.__expeditionQA!.state;state.time+=23;state.hull=70;});
  await expect.poll(()=>page.evaluate(()=>window.__expeditionQA!.state.expedition!.objectives.length)).toBe(2);
  await expect(page.locator('.bonus-objective')).toHaveCount(2);
  for(const [width,height] of [[390,844],[375,667]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>{window.__expeditionQA!.state.immune=0;});await page.screenshot({path:`outputs/expedition-live-mobile-${width}.png`});
    const hud=await page.locator('.contract-hud').boundingBox(),steer=await page.locator('.steer-pad').boundingBox();
    expect(hud!.y+hud!.height).toBeLessThanOrEqual(steer!.y);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  }
});

test('approved live provider decisions reach the engine and the next sector through the real Director API',async({page,request})=>{
  test.skip(process.env.EXPEDITION_REAL_AI!=='1','Opt in only when the game owner has approved real provider calls.');
  expect(await (await request.get('/api/ai-status')).json()).toEqual({available:true});
  await mockRoutePlanning(page,false);await exposeFlight(page);
  const responses:{mode:string;source:string;contracts?:{title:string;cargoType:string}[]}[]=[];
  page.on('response',response=>{
    if(response.url().endsWith('/api/director'))void response.json().then(body=>{
      const mode=response.request().postDataJSON().mode;responses.push({mode,...body});
      console.log('Real gameplay response:',mode,body.source,body.decision?.event?.type??'no event');
    }).catch(()=>{});
  });
  await page.goto('/');await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await readyFlight(page,1);
  await page.evaluate(()=>{const state=window.__expeditionQA!.state;state.time=8.1;state.hull=55;state.cargo=60;});
  await expect.poll(()=>page.evaluate(()=>window.__expeditionQA!.state.expedition!.events[0]?.source),{timeout:12000}).toBe('openai');
  await expect.poll(()=>page.evaluate(()=>window.__expeditionQA!.state.expedition!.objectives[0]?.source),{timeout:12000}).toBe('openai');
  const event=await page.evaluate(()=>({type:window.__expeditionQA!.state.expedition!.events[0].type,objective:window.__expeditionQA!.state.expedition!.objectives[0].definition.uiText}));
  console.log('Real gameplay event:',event.type,'objective:',event.objective);
  await reachGate(page);await expect(page.locator('.contract-option')).toHaveCount(3,{timeout:12000});
  await expect.poll(()=>responses.find(response=>response.mode==='contracts')?.source).toBe('openai');
  const deliveredChoices=responses.find(response=>response.mode==='contracts')!.contracts!;
  await expect(page.locator('.contract-option.risk-medium')).toContainText(deliveredChoices[1].title);
  await page.screenshot({path:'outputs/expedition-real-provider-gate.png'});
  await page.locator('.contract-option.risk-medium').click();await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await readyFlight(page,2);
  expect(await page.evaluate(()=>window.__expeditionQA!.state.expedition!.contract.cargoType)).toBe(deliveredChoices[1].cargoType);
  console.log('Real provider next cargo:',deliveredChoices[1].cargoType);
});
