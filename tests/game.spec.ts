import {createFlight} from './support';
import {test,expect} from '@playwright/test';
import {FLEET,DURATION,practiceMission,validateHull,validateMission} from '../lib/game/types';
import {stepFlight,damage,warpSpeed,courseStep,type Entity} from '../lib/game/simulation';
import {buildShip,disposeObject} from '../lib/game/meshes';
import * as THREE from 'three';
const idle={x:0,y:0,fire:false};
test('flight physics, combat, cargo damage, loss, delivery and reset',()=>{
 const hull=FLEET[0],m=practiceMission(),s=createFlight(hull);
 for(let i=0;i<20;i++)stepFlight(s,{x:1,y:1,fire:true},hull,m,.05);
 expect(s.x).toBeGreaterThan(8);expect(s.y).toBeGreaterThan(4.8);expect(s.y).toBeLessThan(5.6);expect(s.shots).toBeGreaterThan(4);
 damage(s,26,16);expect(s.hull).toBe(74);expect(s.cargo).toBe(84);damage(s,26,16);expect(s.hull).toBe(74);
 s.immune=0;damage(s,100,100);expect(s.status).toBe('lost');expect(s.cargo).toBe(0);
 const won=createFlight(hull);const empty={...m,events:[]};for(let i=0;i<3001;i++)stepFlight(won,idle,hull,empty,.05);expect(won.status).toBe('delivered');expect(won.time).toBeCloseTo(DURATION,0);expect(createFlight(hull).time).toBe(0);
 const combat=createFlight(hull);const pirate:Entity={id:1,kind:'pirate',x:0,y:0,z:-25,vx:0,vy:0,radius:1.3,hp:3,age:0,fire:99};combat.entities=[pirate];combat.serial=2;
 for(let i=0;i<20;i++)stepFlight(combat,{...idle,fire:true},hull,empty,.025);expect(combat.kills).toBe(1);
 const impact=createFlight(hull);impact.entities=[{...pirate,kind:'asteroid',z:-1,hp:2}];stepFlight(impact,idle,hull,empty,.05);expect(impact.hull).toBeLessThan(100);expect(impact.cargo).toBeLessThan(100);

});
test('AI output constraints and real geometry',()=>{
 expect(()=>validateHull({widths:[1]})).toThrow();expect(()=>validateMission({events:[]})).toThrow();
 const h=validateHull({name:'Sketch',widths:[.1,.3,.6,1,8,1.8,1,.6,.4],thickness:20,engines:200});expect(h.widths[4]).toBe(2.2);expect(h.thickness).toBe(.8);expect(h.engines).toBe(3);
 for(const ship of [...FLEET,h]){const mesh=buildShip(ship);const bounds=new THREE.Box3().setFromObject(mesh);const size=bounds.getSize(new THREE.Vector3());expect(size.x).toBeGreaterThan(1);expect(size.x).toBeLessThan(5);expect(size.z).toBeLessThan(9);let triangles=0;mesh.traverse(o=>{if(o instanceof THREE.Mesh)triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;});expect(triangles).toBeLessThan(10000);disposeObject(mesh);}
 const m=validateMission(practiceMission());expect(m.events.length).toBeGreaterThan(9);for(let i=1;i<m.events.length;i++)expect(m.events[i].at-m.events[i-1].at).toBeGreaterThanOrEqual(2.999);
});
test('hangar, drawing, ship selection, launch, pause and restart',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.getByRole('button',{name:'Launch delivery'})).toBeVisible();await expect(page.locator('canvas')).toHaveAttribute('data-model-source','blender');await page.screenshot({path:'outputs/hangar-desktop.png',fullPage:true});
 await page.getByRole('button',{name:/02 Wraith/}).click();await expect(page.locator('.ship-name h2')).toHaveText('Wraith');await page.getByRole('button',{name:/03 Atlas/}).click();await expect(page.locator('.ship-name h2')).toHaveText('Atlas');
 await page.getByRole('button',{name:/Build your own/}).click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('button',{name:'Build local 3D preview'})).toBeDisabled();
 const canvas=page.getByLabel('Draw a top-down spaceship outline'),b=await canvas.boundingBox();if(!b)throw Error('No drawing surface');
 const pts=[[.5,.14],[.38,.36],[.17,.68],[.26,.83],[.48,.72],[.74,.83],[.83,.68],[.62,.36],[.5,.14]];
 await page.mouse.move(b.x+b.width*pts[0][0],b.y+b.height*pts[0][1]);await page.mouse.down();for(const [x,y] of pts.slice(1))await page.mouse.move(b.x+b.width*x,b.y+b.height*y,{steps:12});await page.mouse.up();
 await page.screenshot({path:'outputs/sketch-pad.png'});await page.getByRole('button',{name:'Build local 3D preview'}).click();await expect(page.locator('.ship-name h2')).toHaveText('Sketch 01');await page.screenshot({path:'outputs/custom-hull.png',fullPage:true});
 await page.getByRole('button',{name:'Launch delivery'}).click();await page.keyboard.down('KeyD');await page.keyboard.down('KeyW');await page.keyboard.down('Space');await page.waitForTimeout(1700);await page.keyboard.up('KeyD');await page.keyboard.up('KeyW');await page.keyboard.up('Space');
 await page.screenshot({path:'outputs/flight.png'});await page.getByRole('button',{name:'Pause game'}).click();await expect(page.getByText('Take a breath.')).toBeVisible();await page.getByRole('button',{name:'Resume delivery'}).click();await page.keyboard.press('Escape');await page.getByRole('button',{name:'Return to hangar'}).click();await expect(page.locator('.ship-name h2')).toHaveText('Sketch 01');
 await page.getByRole('button',{name:'Launch delivery'}).click();await expect(page.locator('.hud-vitals')).toContainText('100');expect(errors).toEqual([]);
});
test('mobile layout and API offline/error handling',async({page,request})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await expect(page.getByRole('button',{name:'Launch delivery'})).toBeVisible();await page.screenshot({path:'outputs/hangar-mobile.png',fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 const status=await request.get('/api/ai-status');expect(await status.json()).toEqual({available:false});
 const unavailable=await request.post('/api/mission',{data:{}});expect(unavailable.status()).toBe(503);expect((await unavailable.json()).error).toContain('not connected');
 const invalid=await request.post('/api/ship',{data:{image:'not-an-image'}});expect(invalid.status()).toBe(400);
 const crossOrigin=await request.post('/api/mission',{data:{},headers:{Origin:'https://example.com'}});expect(crossOrigin.status()).toBe(403);
 await page.getByRole('button',{name:'Launch delivery'}).click();await expect(page.getByRole('button',{name:'FIRE',exact:true})).toBeVisible();await page.screenshot({path:'outputs/flight-mobile.png'});
});
test('failed delivery reaches its result and can restart',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Launch delivery'}).click();
 await expect(page.getByRole('button',{name:'Retry stage 1'})).toBeVisible({timeout:180000});
 await page.screenshot({path:'outputs/mission-result.png'});await page.getByRole('button',{name:'Retry stage 1'}).click();await expect(page.getByRole('button',{name:'Pause game'})).toBeVisible();await expect(page.getByRole('button',{name:'Retry stage 1'})).not.toBeVisible();
});

test('evasive flight can deliver the full practice mission',()=>{
 const hull=FLEET[0],state=createFlight(hull),mission=practiceMission();
 for(let i=0;i<3001;i++){const t=i*.05;const phase=(t-1)%6.8;const action=t<1?{x:0,y:1,fire:true}:phase<2?{x:1,y:0,fire:true}:phase<3.4?{x:0,y:-1,fire:true}:phase<5.4?{x:-1,y:0,fire:true}:{x:0,y:1,fire:true};stepFlight(state,action,hull,mission,.05);}
 console.log('Full route:',state.status,'hull',state.hull,'cargo',state.cargo,'cleared',state.kills);expect(state.status).toBe('delivered');
});
test('AI service failure is visible and leaves practice playable',async({page})=>{
 await page.route('**/api/ai-status',route=>route.fulfill({json:{available:true}}));
 await page.route('**/api/mission',route=>route.fulfill({status:503,json:{error:'OpenAI could not complete this request.'}}));
 await page.goto('/');await expect(page.locator('.notice')).toContainText('Practice route is ready to fly.');await expect(page.getByRole('button',{name:'Launch delivery'})).toBeEnabled();await page.getByRole('button',{name:'Launch delivery'}).click();await expect(page.locator('.route-progress')).toContainText('PRACTICE ROUTE');
});

test('portal crossing, smooth boost, safety clearance, miss and reset',()=>{
 const hull=FLEET[0],empty={...practiceMission(),events:[]},s=createFlight(hull);
 const portal:Entity={id:1,kind:'portal',x:0,y:0,z:-.5,vx:0,vy:0,radius:4.3,hp:2,age:0,fire:0};
 s.entities=[portal,{...portal,id:2,kind:'asteroid',z:-10,radius:2}];s.serial=3;
 stepFlight(s,idle,hull,empty,.05);expect(s.portalsUsed).toBe(1);expect(s.warpAge).toBeLessThan(.05);expect(s.hull).toBe(100);expect(s.entities.find(e=>e.id===2)!.vx).toBeGreaterThan(15);
 const start=s.progress;for(let i=0;i<20;i++)stepFlight(s,idle,hull,empty,.05);expect(s.speed).toBeGreaterThan(2.8);expect(s.speed).toBeLessThanOrEqual(3.001);
 for(let i=0;i<100;i++)stepFlight(s,idle,hull,empty,.05);expect(s.speed).toBeCloseTo(3,3);
 for(let i=0;i<40;i++)stepFlight(s,idle,hull,empty,.05);expect(s.speed).toBeCloseTo(1,1);expect(s.progress-start).toBeGreaterThan(20.8);expect(s.progress-start).toBeLessThan(21.2);expect(s.portalsUsed).toBe(1);
 const miss=createFlight(hull);miss.x=8;miss.entities=[{...portal,hp:2,z:-.5}];stepFlight(miss,idle,hull,empty,.05);expect(miss.portalsUsed).toBe(0);expect(miss.hull).toBe(100);expect(miss.x).toBe(8);
 const reset=createFlight(hull);expect(reset.warpAge).toBeNull();expect(reset.portalsUsed).toBe(0);expect(reset.progress).toBe(0);expect(reset.speed).toBe(1);
 for(const dt of [.05,.02,.01]){let progress=0;for(let age=0;age<8-1e-8;age+=dt)progress+=courseStep(age,dt);expect(progress).toBeCloseTo(21,6);}
 expect(warpSpeed(.5)).toBeCloseTo(2);expect(warpSpeed(7)).toBeCloseTo(2);
});
test('boost preserves controls, combat clocks, event order and safe spawn distance',()=>{
 const hull=FLEET[0],empty={...practiceMission(),events:[]},a=createFlight(hull),b=createFlight(hull);b.warpAge=0;
 for(let i=0;i<10;i++){const input={x:.2,y:.2,fire:true};stepFlight(a,input,hull,empty,.05);stepFlight(b,input,hull,empty,.05);}
 expect(a.x).toBeCloseTo(b.x);expect(a.y).toBeCloseTo(b.y);expect(a.shots).toBe(b.shots);expect(b.progress).toBeGreaterThan(a.progress);
 const c=createFlight(hull);c.progress=20;c.warpAge=2;const mission={...empty,events:[{at:20,kind:'asteroid' as const,x:5,y:3,count:1},{at:20.1,kind:'pirate' as const,x:-5,y:3,count:1}]};stepFlight(c,idle,hull,mission,.1);stepFlight(c,idle,hull,mission,.05);expect(c.next).toBe(2);
 const threats=c.entities.filter(e=>e.kind==='asteroid'||e.kind==='pirate');expect(threats).toHaveLength(2);for(const e of threats)expect(-e.z/(29*3)).toBeGreaterThan(4.8);
 stepFlight(c,idle,hull,mission,.05);expect(c.next).toBe(2);expect(c.entities.filter(e=>e.kind==='asteroid'||e.kind==='pirate')).toHaveLength(2);
});
test('two jumps shorten the longer course while preserving arrival and restart',()=>{
 const hull=FLEET[0],s=createFlight(hull),m={...practiceMission(),events:[{at:22,kind:'portal' as const,x:0,y:0,count:1},{at:86,kind:'portal' as const,x:0,y:0,count:1}]};
 for(let i=0;i<3100&&s.status==='flying';i++)stepFlight(s,idle,hull,m,.05);
 expect(s.status).toBe('delivered');expect(s.progress).toBe(150);expect(s.portalsUsed).toBe(2);expect(s.time).toBeGreaterThan(123);expect(s.time).toBeLessThan(126);expect(s.warpAge).toBeNull();expect(s.speed).toBeCloseTo(1,4);
 const legacy={events:Array.from({length:16},(_,i)=>({at:4+i*4,kind:i===4||i===10?'blackhole':'asteroid',x:0,y:0,count:1}))};const updated=validateMission(legacy);expect(updated.events.filter(e=>e.kind==='portal')).toHaveLength(2);expect(updated.events.at(-1)!.at).toBeGreaterThan(120);expect(updated.events.every(e=>e.at<=134)).toBe(true);
});

test('encounter waves stay ordered and spaced across warp exit',()=>{
 const hull=FLEET[0],s=createFlight(hull),m={...practiceMission(),events:[{at:22,kind:'portal' as const,x:0,y:0,count:1},...[30,33.5,37,40.5,44,47.5].map(at=>({at,kind:'asteroid' as const,x:8,y:4,count:1}))]};
 const seen=new Set<number>(),arrivals:{id:number;progress:number}[]=[];
 for(let i=0;i<1400;i++){const previous=s.progress,oldZ=new Map(s.entities.map(e=>[e.id,e.z]));stepFlight(s,idle,hull,m,.05);for(const e of s.entities)if(e.kind==='asteroid'&&e.z>=0&&!seen.has(e.id)){seen.add(e.id);const z=oldZ.get(e.id)??0,f=-z/(e.z-z);arrivals.push({id:e.id,progress:previous+(s.progress-previous)*f});}}
 expect(arrivals).toHaveLength(6);expect(arrivals.map(e=>e.id)).toEqual([...arrivals.map(e=>e.id)].sort((a,b)=>a-b));
 for(let i=1;i<arrivals.length;i++)expect(arrivals[i].progress-arrivals[i-1].progress).toBeGreaterThan(3.4);
});

test('a late AI plan cannot replace the mission already in flight',async({page})=>{
 let release!:()=>void;const gate=new Promise<void>(resolve=>{release=resolve;});
 await page.route('**/api/ai-status',async route=>{await gate;await route.fulfill({json:{available:true}});});
 await page.route('**/api/mission',route=>route.fulfill({json:{mission:practiceMission()}}));
 await page.goto('/');await page.getByRole('button',{name:'Launch delivery'}).click();await page.waitForTimeout(4000);
 const distance=async()=>parseInt((await page.locator('.route-progress').innerText()).match(/(\d+) KM/)![1]);
 const before=await distance(),planned=page.waitForResponse('**/api/mission');release();await planned;await page.waitForTimeout(1000);
 await expect(page.locator('.route-progress')).toContainText('PRACTICE ROUTE');expect(await distance()).toBeLessThan(before-20);
});
