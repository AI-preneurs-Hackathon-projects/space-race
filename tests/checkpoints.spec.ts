import {test,expect} from '@playwright/test';
import {stageEnvironment} from '../lib/game/stage-environment';

test('arrival is named; one reward produces one pausable gate transfer and a fresh stage',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/components/space-scene.tsx*',async route=>{
  const response=await route.fetch(),body=await response.text();
  const needle='const state = createFlight(hull);';expect(body).toContain(needle);
  await route.fulfill({response,body:body.replace(needle,`${needle} if(playing && stage === 1){state.progress=149.7;state.immune=1000;}`)});
 });
 await page.goto('/');await expect(page.getByRole('region',{name:'Checkpoint route map'})).toHaveCount(0);
 await page.getByRole('button',{name:'Launch delivery'}).click();
 await expect(page.locator('.result-panel')).toContainText(`${stageEnvironment(1).name} checkpoint reached`);
 await expect(page.getByRole('button',{name:/Reinforce hull/})).toBeVisible();
 await page.getByRole('button',{name:/Reinforce hull/}).click();
 const transfer=page.getByRole('region',{name:'Checkpoint transfer'});await expect(transfer).toContainText(stageEnvironment(2).gateName);
 await page.getByRole('button',{name:'Pause jump'}).click();await page.waitForTimeout(3600);await expect(transfer).toBeVisible();
 await page.getByRole('button',{name:'Resume jump'}).click();await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','2',{timeout:15000});
 await expect(page.locator('.hud-vitals')).toContainText('115');await expect(page.locator('.hud-vitals')).toContainText('100%');
 await expect(page.locator('.flight-bottom')).toContainText('0/2 JUMPS');await expect(page.locator('.route-progress')).toContainText(stageEnvironment(2).name);
 await page.getByRole('button',{name:'Pause game'}).click();await page.getByRole('button',{name:'Return to hangar'}).click();
 await expect(page.getByRole('region',{name:'Checkpoint route map'})).toHaveCount(0);await expect(page.locator('.mission-card')).toContainText(stageEnvironment(2).name);
 await expect(page.getByRole('button',{name:'Launch stage 2'})).toBeEnabled();expect(errors).toEqual([]);
});
