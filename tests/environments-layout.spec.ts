import {test,expect,type Page} from '@playwright/test';
import {stageEnvironment,WORLD_TYPES} from '../lib/game/stage-environment';
import {planetPosition,PLANET_RADIUS} from '../lib/game/space-environment';

/** Reach a real terminal transition using only an intercepted development module. */
async function campaignFixture(page:Page,stage:number,maxed=false){
 await page.route('**/api/ai-status',route=>route.fulfill({json:{available:false}}));
 await page.route('**/components/cargo-game.tsx*',async route=>{
  const response=await route.fetch();let body=await response.text();
  expect(body.split('newCampaign(initialSeed)')).toHaveLength(2);expect(body).toContain('starterContract(initialSeed)');
  body=body.replace('newCampaign(initialSeed)',`({...newCampaign(initialSeed),stage:${stage},hullUpgrades:${maxed?5:1},cruiseUpgrades:${maxed?4:1},status:'ready'})`);
  body=body.replace('starterContract(initialSeed)',`fallbackContracts(contractContext({...newCampaign(initialSeed),stage:${stage}},newRun(initialSeed),null),${stage})[0]`);
  await route.fulfill({response,body});
 });
 await page.route('**/components/space-scene.tsx*',async route=>{
  const response=await route.fetch();let body=await response.text();const needle='const state = createFlight(hull, initialCondition);';expect(body).toContain(needle);
  body=body.replace(needle,`${needle} if(playing)state.immune=1000; if(playing && stage===${stage}){state.progress=149.7;state.hull=41;state.cargo=81.5;}`);
  await route.fulfill({response,body});
 });
}
async function inViewport(page:Page,selector:string){for(const element of await page.locator(selector).all()){const b=await element.boundingBox();expect(b).not.toBeNull();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);expect(b!.y+b!.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);}}
test('stage geography is deterministic and continues beyond stage nine; fixed body approaches',()=>{
 expect(Array.from({length:10},(_,i)=>stageEnvironment(i+1).kind)).toEqual(WORLD_TYPES);
 for(const stage of [1,2,3,4,5,6,9,10,25,26,100]){expect(stageEnvironment(stage)).toEqual(stageEnvironment(stage));expect(stageEnvironment(stage).seed).not.toBe(stageEnvironment(stage+10).seed);expect(stageEnvironment(stage).kind).not.toBe(stageEnvironment(stage+1).kind);}
 const angle=(p:number)=>Math.atan(PLANET_RADIUS/Math.abs(planetPosition(p).z));expect(angle(138)).toBeGreaterThan(angle(75));expect(angle(75)).toBeGreaterThan(angle(0));
});
for(const viewport of [{width:1330,height:768},{width:1280,height:720},{width:1440,height:900}])test(`gate contracts, upgrades and next launch remain accessible ${viewport.width}×${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);await campaignFixture(page,3);await page.goto('/');await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');
 await inViewport(page,'.ship-specs, .fleet-grid button, .hangar-footer');await page.getByRole('button',{name:'Launch stage 3',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Delivery complete',exact:true})).toBeVisible();await expect(page.locator('.contract-option')).toHaveCount(3);await expect(page.getByRole('heading',{name:'Delivery complete',exact:true})).toBeInViewport();
 for(const card of await page.locator('.contract-option').all()){await card.scrollIntoViewIfNeeded();await expect(card).toBeInViewport();}
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 await page.locator('.contract-option.risk-low').click();const upgrade=page.getByRole('button',{name:'Hull 115 → 130',exact:true});await upgrade.scrollIntoViewIfNeeded();await expect(upgrade).toBeInViewport();await upgrade.click();
 const depart=page.getByRole('button',{name:'Enter Warp',exact:true});await depart.scrollIntoViewIfNeeded();await expect(depart).toBeInViewport();await expect(depart).toBeEnabled();await page.screenshot({path:`outputs/upgrades-${viewport.width}.png`});
 await depart.click();await expect(page.getByRole('region',{name:'Checkpoint transfer'})).toBeVisible();await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','4',{timeout:15000});await expect(page.locator('.hud-vitals')).toContainText('130');await expect(page.locator('.hud-vitals')).toContainText('100%');
});
test('small viewports keep all contracts reachable and maxed upgrades allow departure',async({page})=>{
 await campaignFixture(page,12,true);await page.goto('/');await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');await page.getByRole('button',{name:'Launch stage 12',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Delivery complete',exact:true})).toBeVisible();await expect(page.locator('.contract-option')).toHaveCount(3);
 await expect(page.getByRole('button',{name:'Hull maxed',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Cruise maxed',exact:true})).toBeDisabled();
 for(const viewport of [{width:1280,height:720},{width:640,height:450},{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(viewport);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  for(const card of await page.locator('.contract-option').all()){await card.scrollIntoViewIfNeeded();await expect(card).toBeInViewport();}
  await page.locator('.contract-option.risk-high').click();const button=page.getByRole('button',{name:'Enter Warp',exact:true});await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();await expect(button).toBeEnabled();await page.screenshot({path:`outputs/upgrades-small-${viewport.width}.png`});
 }
 await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await expect(page.getByRole('region',{name:'Checkpoint transfer'})).toBeVisible();await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','13',{timeout:15000});
});
