import {test,expect} from '@playwright/test';
import {difficulty} from '../lib/game/progression';
import type {DirectorContext} from '../lib/game/section-director';
const authored=(context:DirectorContext)=>({title:'Section '+context.stage,beats:Array.from({length:difficulty(context.stage,context.difficulty).waves-2},(_,i)=>({objectType:i%4===0?'pirate':i%4===1?'ice-asteroid':context.stage===1?'fuel-tank':'solar-satellite',pace:i%4===0?'calm':i%3===0?'intense':'steady'}))});
async function fixture(page:import('@playwright/test').Page){
 await page.route('**/components/space-scene.tsx*',async route=>{
  const response=await route.fetch();let body=await response.text();const needle='const state = createFlight(hull, initialCondition);';expect(body).toContain(needle);
  body=body.replace(needle,`${needle} if(playing && stage === 1){state.progress=149.7;state.hull=41;state.cargo=37.25;state.immune=1000;} if(playing && stage>1)state.immune=1000;`);
  expect(body).toContain('const loop = (now) => {');body=body.replace('const loop = (now) => {','window.__sectionQA={state,mission,ship,damageTrail,station,get ready(){return ready}}; const loop = (now) => {');
  await route.fulfill({response,body});
 });
 await page.route('**/components/gate-transit.tsx*',async route=>{const response=await route.fetch();let body=await response.text();expect(body).toContain('const loop = (now) => {');body=body.replace('const loop = (now) => {','window.__transferQA={ship,gate,stars}; const loop = (now) => {');await route.fulfill({response,body});});
}
for(const fallback of [false,true])test(`checkpoint transfer carries cargo, repairs only at gate, and requests fresh ship-aware section plan${fallback?' with fallback':''}`,async({page})=>{
 page.setDefaultTimeout(15000);if(fallback)await page.setViewportSize({width:390,height:844});
 const errors:string[]=[],requests:DirectorContext[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/ai-status',r=>r.fulfill({json:{available:true}}));
 await page.route('**/api/mission',async r=>{const c=r.request().postDataJSON() as DirectorContext;requests.push(c);await r.fulfill(fallback&&c.stage===2?{status:503,json:{error:'Test provider outage'}}:{json:{plan:authored(c)}});});
 let releaseMap!:()=>void;const waitMap=new Promise<void>(resolve=>releaseMap=resolve);await page.route('**/planet-maps/selene.jpg',async r=>{await waitMap;await r.continue();});
 await fixture(page);await page.goto('/');await page.getByRole('button',{name:'Hard',exact:true}).click();await page.getByRole('button',{name:/Wraith/}).click();await page.getByRole('button',{name:'Launch delivery'}).click();
 await expect(page.locator('.result-panel')).toContainText('Verdant checkpoint reached');await expect(page.locator('.result-stats')).toContainText('38%');
 expect(requests).toHaveLength(1);expect(requests[0]).toMatchObject({stage:1,difficulty:'hard',ship:{id:'wraith',armor:80},condition:{hull:80,cargo:100}});
 await page.getByRole('button',{name:/Reinforce hull/}).click();const transfer=page.getByRole('region',{name:'Checkpoint transfer'});await expect(transfer).toContainText('38% cargo remaining');
 await expect(page.locator('canvas[data-ready]')).toHaveAttribute('data-ship','wraith');await page.getByRole('button',{name:'Pause jump'}).click();
 const visual=await page.evaluate(()=>{const q=(window as any).__transferQA;return {ship:q.ship.children.length,exhaust:q.ship.getObjectsByProperty('name','engine_plume').length,membrane:q.gate.getObjectByName('portal_membrane').visible};});expect(visual.ship).toBeGreaterThan(0);expect(visual.exhaust).toBe(2);expect(visual.membrane).toBe(false);
 await page.screenshot({path:`outputs/section-transfer-${fallback?'fallback':'ai'}.png`});await page.waitForTimeout(3500);await expect(transfer).toBeVisible();expect(requests).toHaveLength(1);
 await page.getByRole('button',{name:'Resume jump'}).click();await page.waitForFunction(()=>(window as any).__sectionQA?.mission.stage===2);
 expect(requests).toHaveLength(2);expect(requests[1]).toMatchObject({stage:2,difficulty:'hard',ship:{id:'wraith',armor:95},condition:{hull:95,cargo:37.25},previousArrival:{stage:1,hull:41,maxHull:80,cargo:37.25},upgrades:{hull:1,cruise:0}});
 const loading=await page.evaluate(()=>{const q=(window as any).__sectionQA;return {ready:q.ready,shield:q.damageTrail.getObjectByName('shield').visible,cargo:q.state.cargo,hull:q.state.hull};});expect(loading).toEqual({ready:false,shield:false,cargo:37.25,hull:95});
 await page.screenshot({path:'outputs/section-loading-no-sphere.png'});releaseMap();await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','2');
 await expect(page.locator('.hud-vitals')).toContainText('95');await expect(page.locator('.hud-vitals')).toContainText('38%');await expect(page.locator('.flight-bottom')).toContainText('0/2 JUMPS');await expect(page.getByRole('region',{name:'Checkpoint route map'})).toHaveCount(0);
 const consumed=await page.evaluate(()=>{const q=(window as any).__sectionQA;return {source:q.mission.source,third:q.mission.events[2].objectType,ship:q.ship.children.length,shield:q.damageTrail.getObjectByName('shield').visible};});expect(consumed.source).toBe(fallback?'practice':'openai');if(!fallback)expect(consumed.third).toBe('solar-satellite');expect(consumed.ship).toBeGreaterThan(0);expect(consumed.shield).toBe(false);
 // Change the actual physics state and leave synchronously before the throttled HUD callback.
 await page.evaluate(()=>{const s=(window as any).__sectionQA.state;s.hull=44;s.cargo=19.5;(document.querySelector('.wordmark') as HTMLElement).click();});
 await expect(page.locator('.mission-metrics')).toContainText('20');await expect(page.locator('.ship-specs')).toContainText('44');await expect(page.getByRole('button',{name:'Hard',exact:true})).toHaveAttribute('aria-pressed','true');expect(errors).toEqual([]);
});

test('each difficulty is sent on launch and accepted; cancelling a pending plan cannot start a flight',async({page})=>{
 const requests:DirectorContext[]=[];let release!:()=>void;let block=false;
 await page.route('**/api/ai-status',r=>r.fulfill({json:{available:true}}));
 await page.route('**/api/mission',async r=>{const c=r.request().postDataJSON() as DirectorContext;requests.push(c);if(block)await new Promise<void>(resolve=>release=resolve);await r.fulfill({json:{plan:authored(c)}}).catch(()=>{});});
 await page.goto('/');
 for(const label of ['Easy','Normal','Hard']){await page.getByRole('button',{name:label,exact:true}).click();await page.getByRole('button',{name:'Launch delivery'}).click();await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','1');expect(requests.at(-1)?.difficulty).toBe(label.toLowerCase());await expect(page.locator('.route-progress')).toContainText('AI ROUTE');await page.getByRole('button',{name:'Pause game'}).click();await page.getByRole('button',{name:'Return to hangar'}).click();}
 block=true;await page.getByRole('button',{name:'Launch delivery'}).click();await expect(page.getByRole('button',{name:'Planning this section…'})).toBeDisabled();await page.getByRole('link',{name:'Space Race home'}).click();release();await page.waitForTimeout(500);await expect(page.getByRole('button',{name:'Launch delivery'})).toBeVisible();await expect(page.getByRole('button',{name:'Pause game'})).toHaveCount(0);
});

test('difficulty and essential launch controls fit laptop layouts and remain accessible on mobile',async({page})=>{
 await page.route('**/api/ai-status',r=>r.fulfill({json:{available:false}}));await page.goto('/');
 for(const [width,height] of [[1280,720],[1330,768],[390,844]]){
  await page.setViewportSize({width,height});await expect(page.getByRole('button',{name:'Launch delivery'})).toBeEnabled();
  await expect(page.getByRole('button',{name:'Normal',exact:true})).toHaveAttribute('aria-pressed','true');
  if(width>600)for(const selector of ['.mission-card .primary-button','.difficulty-picker','.fleet-grid']){const b=await page.locator(selector).boundingBox();expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.y+b!.height).toBeLessThanOrEqual(height+1);}
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await page.screenshot({path:`outputs/section-hangar-${width}.png`,fullPage:width<600});
 }
});
