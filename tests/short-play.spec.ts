import {test,expect} from '@playwright/test';
import {evasivePilot} from './pilot';
test('short real-time flights at baseline and stage 25 accept steering and fire under pressure',async({browser})=>{
 test.setTimeout(100000);const reports=[];
 for(const stage of [1,25]){
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/components/cargo-game.tsx*',async route=>{const response=await route.fetch(),body=await response.text();expect(body.split('newCampaign(initialSeed)')).toHaveLength(2);await route.fulfill({response,body:body.replace('newCampaign(initialSeed)',`({...newCampaign(initialSeed),stage:${stage}})`).replace('starterContract(initialSeed)',`fallbackContracts(contractContext({...newCampaign(initialSeed),stage:${stage}},newRun(initialSeed),null),${stage})[0]`)});});
  await page.route('**/api/ai-status',route=>route.fulfill({json:{available:false}}));
  await page.goto('/');await page.getByRole('button',{name:stage===1?'Launch delivery':`Launch stage ${stage}`}).click();await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');
  const seen=new Set<number>(),deadline=Date.now()+25000;let xMin=0,xMax=0,frames=0,lastProgress=0;
  while(Date.now()<deadline){
   const raw=await page.locator('canvas').getAttribute('data-flight-state');
   if(raw){const s=JSON.parse(raw),action=evasivePilot(s);lastProgress=s.progress;xMin=Math.min(xMin,s.x);xMax=Math.max(xMax,s.x);frames++;
    for(const e of s.entities)if(e.kind==='hostile')seen.add(e.id);
    await page.evaluate(a=>{for(const [code,pressed] of [['KeyD',a.x>.2],['KeyA',a.x<-.2],['KeyW',a.y>.2],['KeyS',a.y<-.2],['Space',true]] as const)window.dispatchEvent(new KeyboardEvent(pressed?'keydown':'keyup',{code,bubbles:true}));},action);
   }
   await page.waitForTimeout(130);
  }
  await page.getByRole('button',{name:'Pause game'}).click();await page.screenshot({path:`outputs/real-play-stage-${stage}.png`});reports.push({stage,shotsSeen:seen.size,progress:lastProgress,steeringRange:xMax-xMin,vitals:await page.locator('.hud-vitals').innerText(),samples:frames});
  expect(seen.size).toBeGreaterThan(0);expect(lastProgress).toBeGreaterThan(15);expect(xMax-xMin).toBeGreaterThan(1);expect(errors).toEqual([]);await expect(page.getByRole('heading',{name:'Expedition over',exact:true})).not.toBeVisible();await page.close();
 }
 console.log(JSON.stringify(reports));
});
