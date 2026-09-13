import {createFlight} from './support';
import {test,expect} from '@playwright/test';
import {FLEET,practiceMission,type Mission} from '../lib/game/types';
import {newCampaign,beginAttempt,finishAttempt,chooseUpgrade,effectiveHull,stageMission,difficulty,leaveFlight} from '../lib/game/progression';
import {stepFlight,type Input} from '../lib/game/simulation';
import {planetPosition,PLANET_RADIUS} from '../lib/game/space-environment';
const idle={x:0,y:0,fire:false};
function pilot(state:ReturnType<typeof createFlight>,mission:Mission):Input{
 const threats=state.entities.filter(e=>(e.kind==='asteroid'||e.kind==='pirate'||e.kind==='hostile'||e.objectType==='missile')&&e.z<0&&e.z> -210);
 let best={x:state.x,y:state.y,score:-Infinity};
 for(let x=-8;x<=8;x+=1)for(let y=-4;y<=4;y+=1){let risk=0;
  for(const e of threats){const t=-e.z/((e.vz??0)+29*state.speed),ex=e.x+e.vx*t,ey=e.y+e.vy*t,dist=Math.hypot(x-ex,y-ey),clear=dist-e.radius-.8;risk+=Math.max(0,3-clear)*Math.max(0,1-t/6)*(clear<0?8:1);}
  const score=-risk-Math.hypot(x-state.x,y-state.y)*.12;
  if(score>best.score)best={x,y,score};
 }
 return {x:Math.max(-1,Math.min(1,(best.x-state.x)*2)),y:Math.max(-1,Math.min(1,(best.y-state.y)*2)),fire:true};
}
test('seeded portals vary across retries and never auto-enter at center',()=>{
 for(let seed=0;seed<80;seed++){const c=newCampaign(seed),a=beginAttempt(c)!;expect(beginAttempt(c)!.mission).toEqual(a.mission);const lost=finishAttempt(a.campaign,1,'lost'),b=beginAttempt(lost)!;
  expect(b.campaign.stage).toBe(1);const pa=a.mission.events.filter(e=>e.kind==='portal'),pb=b.mission.events.filter(e=>e.kind==='portal');expect(pa).toHaveLength(2);
  pa.forEach((p,i)=>{expect(Math.hypot(p.x,p.y)).toBeGreaterThan(p.portalRadius!);expect(Math.hypot(p.x-pb[i].x,p.y-pb[i].y)).toBeGreaterThan(3);expect(Math.abs(p.x)).toBeLessThanOrEqual(6.2);expect(Math.abs(p.y)).toBeLessThanOrEqual(2.8);});
 }
});
test('rewards are once per clear, capped, preserved across loss and independent of base ship',()=>{
 let c=newCampaign(17);const original=JSON.stringify(FLEET);
 for(let i=0;i<12;i++){const run=beginAttempt(c)!;expect(beginAttempt(run.campaign)).toBeNull();c=finishAttempt(run.campaign,run.campaign.attempt,'delivered');expect(beginAttempt(c)).toBeNull();const next=chooseUpgrade(c,i<5?'hull':i<9?'cruise':'continue');expect(next.stage).toBe(i+2);expect(chooseUpgrade(next,'hull')).toBe(next);expect(finishAttempt(next,run.campaign.attempt,'delivered')).toBe(next);c=next;}
 expect(c.hullUpgrades).toBe(5);expect(c.cruiseUpgrades).toBe(4);for(const h of FLEET){const e=effectiveHull(h,c);expect(e.armor).toBe(h.armor+75);expect(e.cruise).toBe(1.2);expect(e.handling).toBe(h.handling);expect(createFlight(e).hull).toBe(e.armor);}
 const run=beginAttempt(c)!,lost=finishAttempt(run.campaign,run.campaign.attempt,'lost'),retry=beginAttempt(lost)!;expect(retry.campaign.stage).toBe(c.stage);expect(retry.campaign.hullUpgrades).toBe(5);expect(createFlight(effectiveHull(FLEET[0],retry.campaign)).cargo).toBe(100);expect(JSON.stringify(FLEET)).toBe(original);expect(leaveFlight(retry.campaign).status).toBe('ready');
});
test('cruise upgrades move the real course faster; boost and planet approach agree',()=>{
 for(const speed of [1,1.2]){const hull={...FLEET[0],cruise:speed},s=createFlight(hull),m={...practiceMission(),events:[]};while(s.status==='flying')stepFlight(s,idle,hull,m,.05);expect(s.time).toBeCloseTo(150/speed,0);expect(s.speed).toBeCloseTo(speed,5);}
 const a=createFlight(FLEET[0]),b=createFlight({...FLEET[0],cruise:1.2});const m={...practiceMission(),events:[]};for(let i=0;i<100;i++){stepFlight(a,{x:.1,y:.1,fire:true},FLEET[0],m,.05);stepFlight(b,{x:.1,y:.1,fire:true},{...FLEET[0],cruise:1.2},m,.05);}expect(b.progress/a.progress).toBeCloseTo(1.2);expect(a.x).toBeCloseTo(b.x);expect(a.shots).toBe(b.shots);
 const angular=(p:number)=>{const v=planetPosition(p);return Math.atan(PLANET_RADIUS/Math.hypot(v.x,v.y,v.z));};expect(angular(150)).toBeGreaterThan(angular(0)*4);for(let p=1;p<150;p++)expect(angular(p)).toBeGreaterThan(angular(p-1));expect(planetPosition(b.progress).z).toBeGreaterThan(planetPosition(a.progress).z);
});
test('all generated gates have clear reachable lanes and bounded complexity',()=>{
 let smallestClearance=Infinity,biggestJumpX=0,biggestJumpY=0,biggestWave=0;
 for(const stage of [1,4,9,100])for(let seed=0;seed<40;seed++){const m=stageMission(stage,seed);let x=0,y=0;
  for(const e of m.events){if(!e.gap)continue;biggestJumpX=Math.max(biggestJumpX,Math.abs(e.gap.x-x));biggestJumpY=Math.max(biggestJumpY,Math.abs(e.gap.y-y));x=e.gap.x;y=e.gap.y;biggestWave=Math.max(biggestWave,e.points!.length);for(const p of e.points!)smallestClearance=Math.min(smallestClearance,Math.hypot(e.gap.x-p.x,e.gap.y-p.y)-p.radius-.65);}
 }
 expect(biggestJumpX).toBeLessThanOrEqual(5.001);expect(biggestJumpY).toBeLessThanOrEqual(3.001);expect(biggestWave).toBeLessThanOrEqual(40);expect(smallestClearance).toBeGreaterThan(1.5);expect(difficulty(100).pirateInterval).toBeLessThan(difficulty(9).pirateInterval);expect(difficulty(10).tier).toBe(10);
});
test('multiple seeded stages can be delivered by steering and firing',()=>{
 for(const stage of [1,4,9]){let wins=0;for(let seed=1;seed<=3;seed++){const hull=effectiveHull(FLEET[2],{...newCampaign(seed),hullUpgrades:Math.min(stage-1,5),cruiseUpgrades:stage>=9?4:0}),m=stageMission(stage,seed),s=createFlight(hull);for(let i=0;i<3100&&s.status==='flying';i++)stepFlight(s,pilot(s,m),hull,m,.05);if(s.status==='delivered')wins++;console.log('stage run',stage,seed,s.status,s.hull,s.cargo);}
 expect(wins).toBeGreaterThanOrEqual(2);}
});

test('real delivery advances with a mobile contract and cruise choice; death retry resets the expedition',async({page})=>{
 test.setTimeout(300000);page.setDefaultTimeout(15000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error'&&/THREE.WebGLProgram|Error compiling/.test(m.text()))errors.push(m.text());});
 await page.route('**/api/ai-status',route=>route.fulfill({json:{available:false}}));
 await page.goto('/');await page.getByRole('button',{name:/03 Atlas/}).click();await page.getByRole('button',{name:'Launch delivery'}).click();
 await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');await page.screenshot({path:'outputs/stage-start.png'});
 let captured=false;const deadline=Date.now()+180000;
 while(Date.now()<deadline&&await page.getByRole('button',{name:'Pause game'}).isVisible()){
  if(await page.getByRole('heading',{name:'Delivery complete',exact:true}).isVisible())break;
  if(await page.getByRole('heading',{name:'Expedition over',exact:true}).isVisible())throw Error('Steering controller lost the delivery');
  const state=await page.locator('canvas').getAttribute('data-flight-state');if(state){const s=JSON.parse(state),action=pilot(s,stageMission(1,0));
   await page.evaluate(a=>{for(const [code,pressed] of [['KeyD',a.x>.2],['KeyA',a.x<-.2],['KeyW',a.y>.2],['KeyS',a.y<-.2],['Space',true]] as const)window.dispatchEvent(new KeyboardEvent(pressed?'keydown':'keyup',{code,bubbles:true}));},action);
   if(!captured&&s.progress>120){await page.screenshot({path:'outputs/planet-approach.png'});captured=true;}
  }await page.waitForTimeout(90);
 }
 await expect(page.getByRole('heading',{name:'Delivery complete',exact:true})).toBeVisible();await expect(page.locator('.contract-option')).toHaveCount(3);await expect(page.getByRole('button',{name:'Hull 125 → 140',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'+5% cruise',exact:true})).toBeVisible();await page.screenshot({path:'outputs/stage-cleared-desktop.png'});
 await page.setViewportSize({width:390,height:844});await page.locator('.contract-option.risk-high').click();await page.getByRole('button',{name:'+5% cruise',exact:true}).click();await page.getByRole('button',{name:'Enter Warp',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:'outputs/stage-upgrades-mobile.png'});
 await page.getByRole('button',{name:'Enter Warp',exact:true}).click();await expect(page.getByRole('region',{name:'Checkpoint transfer'})).toContainText('100% cargo remaining');await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','2',{timeout:15000});
 const firstSeed=await page.locator('canvas').getAttribute('data-seed');await expect(page.getByRole('button',{name:'FIRE',exact:true})).toBeVisible();await expect(page.locator('.warp-status')).toContainText('1.05×');await expect(page.locator('.hud-vitals')).toContainText('100%');
 await page.getByRole('button',{name:'Pause game'}).click();await page.getByRole('button',{name:'Return to hangar'}).click();await expect(page.locator('.ship-specs')).toContainText('105%');
 await page.getByRole('button',{name:/Wraith/}).click();await expect(page.locator('.ship-specs')).toContainText('80');await page.getByRole('button',{name:'Launch stage 2'}).click();await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','2');expect(await page.locator('canvas').getAttribute('data-seed')).not.toBe(firstSeed);
 const lossDeadline=Date.now()+80000;
 while(Date.now()<lossDeadline&&!await page.getByRole('button',{name:'Retry',exact:true}).isVisible()){
  const raw=await page.locator('canvas').getAttribute('data-flight-state');if(raw){const s=JSON.parse(raw),target=s.entities.filter((e:{kind:string;z:number})=>e.kind==='asteroid'&&e.z<0).sort((a:{z:number},b:{z:number})=>b.z-a.z)[0];
   const a={x:target?target.x-s.x:0,y:target?target.y-s.y:0};await page.evaluate(a=>{for(const [code,pressed] of [['KeyD',a.x>.2],['KeyA',a.x<-.2],['KeyW',a.y>.2],['KeyS',a.y<-.2],['Space',false]] as const)window.dispatchEvent(new KeyboardEvent(pressed?'keydown':'keyup',{code,bubbles:true}));},a);
  }await page.waitForTimeout(90);
 }
 await expect(page.getByRole('heading',{name:'Expedition over',exact:true})).toBeVisible();await expect(page.locator('.expedition-stats > div').first().locator('b')).toHaveText('1');await page.getByRole('button',{name:'Retry',exact:true}).click();
 await expect(page.locator('canvas[data-stage]')).toHaveAttribute('data-stage','1');await expect(page.locator('.hud-vitals')).toContainText('80');await expect(page.locator('.hud-vitals')).toContainText('100%');await expect(page.locator('.warp-status')).toContainText('1.00×');expect(errors).toEqual([]);
});

test('offset portal alignment stays safe and hostile shots leave reaction time',()=>{
 const h={...FLEET[2],cruise:1.2},m=stageMission(9,123),gate=m.events.find(e=>e.kind==='portal')!;
 for(const aligned of [true,false]){const s=createFlight(h);if(aligned){s.x=gate.x;s.y=gate.y;}s.entities=[{id:1,kind:'portal',x:gate.x,y:gate.y,z:-.3,vx:0,vy:0,radius:gate.portalRadius!,hp:2,age:0,fire:0}];stepFlight(s,idle,h,{...m,events:[]},.05);expect(s.portalsUsed).toBe(aligned?1:0);expect(s.hull).toBe(h.armor);}
 const s=createFlight(h);s.entities=[{id:1,kind:'pirate',x:5,y:2,z:-170,vx:0,vy:0,radius:1.3,hp:3,age:0,fire:0}];s.serial=2;const seen=new Set<number>();let shots=0;
 for(let i=0;i<80;i++){stepFlight(s,idle,h,{...m,events:[]},.05);for(const e of s.entities)if(e.kind==='hostile'&&!seen.has(e.id)){seen.add(e.id);shots++;expect(-e.z/((m.challenge?.bulletSpeed??29)+29*s.speed)).toBeGreaterThanOrEqual(1.35);}}expect(shots).toBeGreaterThan(0);
});
