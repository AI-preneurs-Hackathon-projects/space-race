import {test,expect,type Page} from '@playwright/test';
import {stageEnvironment,WORLD_TYPES} from '../lib/game/stage-environment';
import {planetPosition,PLANET_RADIUS} from '../lib/game/space-environment';

async function campaignFixture(page:Page,stage:number,status='cleared',maxed=false){
 await page.route('**/components/cargo-game.tsx*',async route=>{
  const response=await route.fetch(),body=await response.text();
  expect(body.split('newCampaign(1979)')).toHaveLength(2);
  await route.fulfill({response,body:body.replace('newCampaign(1979)',`({...newCampaign(1979),stage:${stage},hullUpgrades:${maxed?5:1},cruiseUpgrades:${maxed?4:1},status:'${status}'})`)});
 });
}
async function inViewport(page:Page,selector:string){for(const element of await page.locator(selector).all()){const b=await element.boundingBox();expect(b).not.toBeNull();expect(b!.x).toBeGreaterThanOrEqual(0);expect(b!.y).toBeGreaterThanOrEqual(0);expect(b!.x+b!.width).toBeLessThanOrEqual(page.viewportSize()!.width+1);expect(b!.y+b!.height).toBeLessThanOrEqual(page.viewportSize()!.height+1);}}
test('stage geography is deterministic and continues beyond stage nine; fixed body approaches',()=>{
 expect(Array.from({length:10},(_,i)=>stageEnvironment(i+1).kind)).toEqual(WORLD_TYPES);
 for(const stage of [1,2,3,4,5,6,9,10,25,26,100]){expect(stageEnvironment(stage)).toEqual(stageEnvironment(stage));expect(stageEnvironment(stage).seed).not.toBe(stageEnvironment(stage+10).seed);expect(stageEnvironment(stage).kind).not.toBe(stageEnvironment(stage+1).kind);}
 const angle=(p:number)=>Math.atan(PLANET_RADIUS/Math.abs(planetPosition(p).z));expect(angle(138)).toBeGreaterThan(angle(75));expect(angle(75)).toBeGreaterThan(angle(0));
});
for(const viewport of [{width:1330,height:768},{width:1280,height:720},{width:1440,height:900}])test(`pending upgrades and next launch fit ${viewport.width}×${viewport.height}`,async({page})=>{
 await page.setViewportSize(viewport);await campaignFixture(page,3);await page.goto('/');await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');
 await inViewport(page,'.ship-specs, .fleet-grid button, .upgrade-choice, .stage-upgrades>p, .hangar-footer');await page.screenshot({path:`outputs/upgrades-${viewport.width}.png`});
 await page.getByRole('button',{name:/Reinforce hull/}).click();await expect(page.getByRole('region',{name:'Checkpoint transfer'})).toBeVisible();await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','4',{timeout:15000});await expect(page.locator('.hud-vitals')).toContainText('130');
});
test('small viewports keep stats and upgrade controls reachable; maxed rewards allow continue',async({page})=>{
 await campaignFixture(page,12,'cleared',true);await page.goto('/');await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');
 for(const viewport of [{width:1280,height:720},{width:640,height:450},{width:390,height:844},{width:320,height:568}]){
  await page.setViewportSize(viewport);await expect(page.locator('.ship-specs')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  const button=page.getByRole('button',{name:/Continue to stage/});await button.scrollIntoViewIfNeeded();await expect(button).toBeInViewport();await page.screenshot({path:`outputs/upgrades-small-${viewport.width}.png`});
 }
 await page.getByRole('button',{name:/Continue to stage/}).click();await expect(page.getByRole('region',{name:'Checkpoint transfer'})).toBeVisible();await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','13',{timeout:15000});
});
