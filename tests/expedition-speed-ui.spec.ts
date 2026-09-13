import {expect,test,type Page} from '@playwright/test';
import type {Flight} from '../lib/game/simulation';
import type {Mission} from '../lib/game/types';
import {fallbackContracts,fallbackDecision} from '../lib/game/contract-director';
import type {DirectorDecision} from '../lib/game/contracts';

declare global {
  interface Window {__holdSpeedReady?:boolean;__releaseSpeedReady?:()=>void;__speedQA?:{
    state:Flight;mission:Mission;ready:boolean;elapsed:number;
    clearRoute:(progress?:number)=>void;arrive:(elapsed?:number)=>void;
    queue:(decision:DirectorDecision)=>boolean;collectShortcut:()=>void;repulsor:()=>void;
  }}
}

/** Controls are injected into the development response; the shipped game has no test hooks. */
async function fixture(page:Page,online=false){
  page.setDefaultTimeout(15000);
  await page.route('**/api/ai-status',route=>route.fulfill({json:{available:online}}));
  await page.route('**/api/speech',route=>route.fulfill({status:503,json:{error:'Text-only test'}}));
  if(online){
    await page.route('**/api/mission',route=>route.fulfill({status:503,json:{error:'Use the seeded route for this test'}}));
    await page.route('**/api/director',route=>{
      const body=route.request().postDataJSON();
      return route.fulfill({json:body.mode==='contracts'?{contracts:fallbackContracts(body.context,body.targetSector),source:'openai'}:{decision:fallbackDecision(body.context),source:'openai'}});
    });
  }
  await page.route('**/components/space-scene.tsx*',async route=>{
    const response=await route.fetch();let body=await response.text();
    const needle='const loop = (now) => {';expect(body.includes(needle)).toBe(true);expect(body.includes('destination?.ready')).toBe(true);
    body=body.replace('destination?.ready','destination?.ready, playing&&window.__holdSpeedReady?new Promise(resolve=>window.__releaseSpeedReady=resolve):Promise.resolve()');
    body='import * as speedTestRuntime from "/lib/game/expedition-runtime.ts";\n'+body.replace(needle,`
      if (playing) {
        state.immune=1000;
        const clearRoute=(progress=state.progress)=>{disposeFlight(state);state.entities=[];state.next=mission.events.length;state.progress=progress;state.vx=0;state.vy=0;};
        window.__speedQA={state,mission,get ready(){return ready},get elapsed(){return speedTestRuntime.deliveryElapsed(state)},clearRoute,
          arrive(elapsed){clearRoute(149.95);state.cargo=100;state.hull=70;state.immune=0;if(elapsed!==undefined)state.time=elapsed-(state.expedition?.elapsedOffset??0);},
          queue(decision){return speedTestRuntime.queueDirectorDecision(state,decision,state.expedition.contract.id,'openai')},
          collectShortcut(){const gate=state.entities.find(e=>e.expeditionRole==='shortcut'&&e.hp>0);if(!gate)throw Error('No live shortcut');disposeFlight(state);gate.x=state.x;gate.y=state.y;gate.z=-.1;},
          repulsor(){clearRoute(20);state.x=0;state.y=0;state.immune=0;state.warning='Keep the delivery on course.';spawnObject(state,'repulsor',7,0,-12);}
        };
      }
    `+needle);
    await route.fulfill({response,body});
  });
}
async function ready(page:Page,stage=1){
  await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage',String(stage));
  await page.waitForFunction(stage=>window.__speedQA?.ready&&window.__speedQA.mission.stage===stage&&!!window.__speedQA.state.expedition,stage);
}
async function launch(page:Page){await page.goto('/');await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await ready(page);}
async function arrive(page:Page,elapsed?:number){await page.evaluate(elapsed=>window.__speedQA!.arrive(elapsed),elapsed);await expect(page.getByRole('heading',{name:'Delivery complete',exact:true})).toBeVisible();await expect(page.locator('.contract-option')).toHaveCount(3);}
function ledger(page:Page,label:string){return page.locator('.delivery-ledger > div').filter({has:page.locator('span',{hasText:new RegExp(`^${label}$`)})});}
async function amount(page:Page,label:string){return Number((await ledger(page,label).locator('b').innerText()).replace(/[^\d]/g,''));}

test('delivery clock excludes pause, hangar and transfer, retains same-contract time, then resets for new cargo and retry',async({page})=>{
  await fixture(page);await launch(page);
  await page.evaluate(()=>{const qa=window.__speedQA!;qa.clearRoute();qa.state.time=35;});
  await expect(page.locator('.delivery-speed')).toContainText('DELIVERY CLOCK');
  const before=await page.evaluate(()=>window.__speedQA!.elapsed);await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.__speedQA!.elapsed)).toBeGreaterThan(before);
  await page.getByRole('button',{name:'Pause game',exact:true}).click();
  const paused=await page.evaluate(()=>({elapsed:window.__speedQA!.elapsed,id:window.__speedQA!.state.expedition!.contract.id}));
  await page.waitForTimeout(350);expect(await page.evaluate(()=>window.__speedQA!.elapsed)).toBe(paused.elapsed);
  await page.getByRole('button',{name:'Return to hangar',exact:true}).click();await page.waitForTimeout(350);
  await expect(page.locator('.mission-card .contract-speed-terms')).toContainText('Full by');
  await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await ready(page);
  const resumed=await page.evaluate(()=>({offset:window.__speedQA!.state.expedition!.elapsedOffset,elapsed:window.__speedQA!.elapsed,id:window.__speedQA!.state.expedition!.contract.id}));
  expect(resumed.offset).toBe(paused.elapsed);expect(resumed.elapsed).toBeGreaterThanOrEqual(paused.elapsed);expect(resumed.elapsed).toBeLessThan(paused.elapsed+2);expect(resumed.id).toBe(paused.id);
  const maxBonus=await page.evaluate(()=>window.__speedQA!.state.expedition!.contract.speedBonus!.maxReward);
  await arrive(page,40);expect(await amount(page,'Speed bonus')).toBe(maxBonus);await expect(ledger(page,'Speed bonus')).toContainText('0:41 active flight');
  const stopped=await page.evaluate(()=>window.__speedQA!.elapsed);await page.waitForTimeout(250);expect(await page.evaluate(()=>window.__speedQA!.elapsed)).toBe(stopped);
  const offer=page.locator('.contract-option.risk-high');await offer.click();
  const termsBefore=await offer.locator('.contract-speed-terms').innerText();await page.getByRole('button',{name:'+5% cruise',exact:true}).click();
  expect(await offer.locator('.contract-speed-terms').innerText()).not.toBe(termsBefore);
  await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await page.getByRole('button',{name:'Pause jump',exact:true}).click();
  await page.waitForTimeout(300);expect(await page.evaluate(()=>window.__speedQA!.elapsed)).toBe(stopped);
  await page.getByRole('button',{name:'Resume jump',exact:true}).click();await ready(page,2);
  const next=await page.evaluate(()=>({elapsed:window.__speedQA!.elapsed,offset:window.__speedQA!.state.expedition!.elapsedOffset,cruise:window.__speedQA!.state.cruise}));
  expect(next.offset).toBe(0);expect(next.elapsed).toBeLessThan(2);expect(next.cruise).toBeCloseTo(1.05);
  await page.evaluate(()=>{window.__speedQA!.state.hull=0;});await expect(page.getByRole('heading',{name:'Expedition over',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Retry',exact:true}).click();await ready(page);
  expect(await page.evaluate(()=>window.__speedQA!.state.expedition!.elapsedOffset)).toBe(0);expect(await page.evaluate(()=>window.__speedQA!.elapsed)).toBeLessThan(2);
  await expect(page.locator('.delivery-speed')).toContainText('SPEED BONUS AVAILABLE');
});

test('an expired speed bonus keeps flight playable and pays the valid base delivery',async({page})=>{
  await fixture(page);await launch(page);
  const terms=await page.evaluate(()=>{const qa=window.__speedQA!,contract=qa.state.expedition!.contract;qa.clearRoute(30);qa.state.time=contract.speedBonus!.expiresSeconds+1;return {base:contract.reward,expiry:contract.speedBonus!.expiresSeconds};});
  await expect(page.locator('.delivery-speed')).toContainText('SPEED WINDOW CLOSED');await expect(page.locator('.delivery-speed')).toContainText('+0 cr');
  const before=await page.evaluate(()=>({time:window.__speedQA!.elapsed,progress:window.__speedQA!.state.progress}));await page.waitForTimeout(250);
  const after=await page.evaluate(()=>({time:window.__speedQA!.elapsed,progress:window.__speedQA!.state.progress,status:window.__speedQA!.state.status}));
  expect(after.status).toBe('flying');expect(after.time).toBeGreaterThan(before.time);expect(after.progress).toBeGreaterThan(before.progress);
  await arrive(page,terms.expiry+5);expect(await amount(page,'Speed bonus')).toBe(0);expect(await amount(page,'Base reward')).toBe(terms.base);
  await expect(ledger(page,'Objective bonus')).toBeVisible();expect(await amount(page,'Final total')).toBeGreaterThanOrEqual(terms.base);
  await page.screenshot({path:'outputs/expedition-speed-expired-gate.png',fullPage:true});
});

test('leaving a resumed delivery during model loading preserves its accumulated clock',async({page})=>{
  await fixture(page);await launch(page);await page.evaluate(()=>{window.__speedQA!.state.time=46;});
  await page.getByRole('button',{name:'Pause game',exact:true}).click();const saved=await page.evaluate(()=>window.__speedQA!.elapsed);
  await page.getByRole('button',{name:'Return to hangar',exact:true}).click();await page.evaluate(()=>{window.__holdSpeedReady=true;});
  await page.getByRole('button',{name:'Launch delivery',exact:true}).click();
  await page.waitForFunction(()=>window.__speedQA?.mission.attempt===2&&!window.__speedQA.ready);
  expect(await page.evaluate(()=>window.__speedQA!.state.expedition)).toBeUndefined();
  await page.getByRole('link',{name:'Space Race home',exact:true}).click();
  await page.evaluate(()=>{window.__holdSpeedReady=false;window.__releaseSpeedReady?.();});
  await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await ready(page);
  expect(await page.evaluate(()=>window.__speedQA!.state.expedition!.elapsedOffset)).toBe(saved);
});

test('a contextual shortcut is a real third boost gate after the two route jumps',async({page})=>{
  await fixture(page);await launch(page);await arrive(page,90);
  await page.locator('.contract-option.risk-medium').click();await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await ready(page,2);
  const queued=await page.evaluate(()=>{
    const qa=window.__speedQA!,state=qa.state,runtime=state.expedition!;
    qa.clearRoute(100);state.time=100;state.portalsUsed=2;state.warpAge=null;runtime.lastRequestAt=100;runtime.lastShortcutCheckAt=100;runtime.lastEventAt=0;runtime.pending=null;
    return qa.queue({event:{type:'shortcut_available',intensity:'low'},bonusObjective:null});
  });
  expect(queued).toBe(true);
  await expect.poll(()=>page.evaluate(()=>window.__speedQA!.state.expedition!.extraGatesSpawned)).toBe(1);
  await expect(page.locator('.flight-bottom')).toContainText('2/3 JUMPS');
  const gate=await page.evaluate(()=>window.__speedQA!.state.entities.find(e=>e.expeditionRole==='shortcut'));
  expect(gate?.objectType).toBe('portal');expect(gate!.z).toBeLessThan(-120);
  await page.evaluate(()=>window.__speedQA!.collectShortcut());
  await expect.poll(()=>page.evaluate(()=>window.__speedQA!.state.portalsUsed)).toBe(3);
  expect(await page.evaluate(()=>window.__speedQA!.state.expedition!.extraGatesUsed)).toBe(1);await expect(page.locator('.flight-bottom')).toContainText('3/3 JUMPS');
  const before=await page.evaluate(()=>({time:window.__speedQA!.elapsed,progress:window.__speedQA!.state.progress}));await page.waitForTimeout(1300);
  const boosted=await page.evaluate(()=>({time:window.__speedQA!.elapsed,progress:window.__speedQA!.state.progress,speed:window.__speedQA!.state.speed,cruise:window.__speedQA!.state.cruise}));
  expect(boosted.speed).toBeGreaterThan(boosted.cruise*1.5);expect(boosted.speed).toBeLessThanOrEqual(boosted.cruise*3+.001);
  expect(boosted.progress-before.progress).toBeGreaterThan((boosted.time-before.time)*1.2);
  await page.evaluate(()=>{window.__speedQA!.state.immune=0;});await page.screenshot({path:'outputs/expedition-speed-shortcut.png'});
});

test('repulsor remains a physical field without a flight popup',async({page})=>{
  await fixture(page);await launch(page);await page.evaluate(()=>window.__speedQA!.repulsor());
  await expect.poll(()=>page.evaluate(()=>window.__speedQA!.state.fieldType)).toBe('repulsor');
  await expect.poll(()=>page.evaluate(()=>window.__speedQA!.state.vx)).toBeLessThan(0);
  await expect(page.locator('.field-status')).toHaveCount(0);await expect(page.locator('.flight-message')).not.toContainText(/repulsor|repulsion/i);
  await page.screenshot({path:'outputs/expedition-repulsor-quiet.png'});
});

test('prototype navigation-computer contracts draw actual pirate pursuers without enemy introductions',async({page})=>{
  await fixture(page);await launch(page);await page.evaluate(()=>{window.__speedQA!.state.expedition!.enemyKills=3;});await arrive(page,90);
  const manifest=page.locator('.contract-option.risk-high');await expect(manifest).toContainText('Prototype navigation computers');
  await expect(manifest).toContainText('pirate pursuers');await expect(manifest).toContainText('EXPRESS');
  await expect(page.locator('.contract-options')).not.toContainText(/classified|authorit|inspection/i);
  expect(await amount(page,'Speed bonus')).toBeGreaterThan(0);await page.screenshot({path:'outputs/expedition-navigation-speed-gate.png',fullPage:true});
  await manifest.click();await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await ready(page,2);
  expect(await page.evaluate(()=>window.__speedQA!.state.expedition!.contract.cargoType)).toBe('navigation_computers');
  await page.evaluate(()=>{window.__speedQA!.state.time=8.1;});
  await expect.poll(()=>page.evaluate(()=>window.__speedQA!.state.expedition!.events.some(event=>event.type==='pirate_pursuit'))).toBe(true);
  expect(await page.evaluate(()=>window.__speedQA!.state.entities.some(entity=>entity.kind==='pirate'&&entity.expeditionRole==='pursuer'&&entity.hp>0))).toBe(true);
  await expect(page.locator('.director-event')).toHaveCount(0);await expect(page.locator('.flight-message')).not.toContainText(/pirate pursuit|raider|vesper|bastion|horizon|repulsor/i);
});

test('mobile timing, active events and two objectives stay above touch steering while difficulty remains selectable',async({page})=>{
  await page.setViewportSize({width:390,height:844});await fixture(page,true);await page.goto('/');
  for(const name of ['Easy','Normal','Hard']){await page.getByRole('button',{name,exact:true}).click();await expect(page.getByRole('button',{name,exact:true})).toHaveAttribute('aria-pressed','true');}
  await page.getByRole('button',{name:'Normal',exact:true}).click();await page.getByRole('button',{name:'Launch delivery',exact:true}).click();await ready(page);
  await page.evaluate(()=>{window.__speedQA!.state.time=8.1;});await expect.poll(()=>page.evaluate(()=>window.__speedQA!.state.expedition!.objectives.length)).toBe(1);
  await page.evaluate(()=>{window.__speedQA!.state.time+=23;window.__speedQA!.state.hull=70;});await expect.poll(()=>page.evaluate(()=>window.__speedQA!.state.expedition!.objectives.length)).toBe(2);
  await expect(page.locator('.bonus-objective')).toHaveCount(2);await expect(page.locator('.director-event')).toBeVisible();
  for(const [width,height] of [[390,844],[375,667]]){
    await page.setViewportSize({width,height});await page.evaluate(()=>{window.__speedQA!.state.immune=0;});
    await expect(page.locator('.delivery-speed')).toBeVisible();const hud=await page.locator('.contract-hud').boundingBox(),steering=await page.locator('.steer-pad').boundingBox();
    expect(hud!.y+hud!.height).toBeLessThanOrEqual(steering!.y);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    await page.screenshot({path:`outputs/expedition-speed-mobile-${width}.png`});
  }
});

test('volatile fuel instability and two composed objectives fit the short mobile HUD',async({page})=>{
  await page.setViewportSize({width:375,height:667});await fixture(page);await launch(page);await arrive(page,90);
  await page.locator('.contract-option.risk-high').click();await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await ready(page,2);
  expect(await page.evaluate(()=>window.__speedQA!.state.expedition!.contract.cargoType)).toBe('volatile_fuel');
  for(const id of ['fuel-a','fuel-b']){
    expect(await page.evaluate(id=>{const qa=window.__speedQA!;qa.clearRoute();qa.state.time=12;qa.state.expedition!.instability=45;qa.state.expedition!.lastRequestAt=12;return qa.queue({event:null,bonusObjective:{id,reward:500,uiText:'Replaced by canonical text',conditions:[{type:'AVOID_DAMAGE',target:'cargo',successCondition:1,duration:40},{type:'SURVIVE_DURATION',target:'player',successCondition:40,duration:40}]}});},id)).toBe(true);
    await expect.poll(()=>page.evaluate(()=>window.__speedQA!.state.expedition!.objectives.length)).toBe(id==='fuel-a'?1:2);
  }
  await expect(page.locator('.instability-meter')).toBeVisible();await expect(page.locator('.bonus-objective')).toHaveCount(2);
  const hud=await page.locator('.contract-hud').boundingBox(),steering=await page.locator('.steer-pad').boundingBox(),clock=await page.locator('.delivery-speed').boundingBox(),cruise=await page.locator('.warp-status').boundingBox();
  expect(hud!.y+hud!.height).toBeLessThanOrEqual(steering!.y);expect(clock!.x).toBeGreaterThanOrEqual(cruise!.x+cruise!.width);
  await page.evaluate(()=>{window.__speedQA!.state.immune=0;});await page.waitForTimeout(100);await page.screenshot({path:'outputs/expedition-speed-fuel-mobile-375.png'});
});
