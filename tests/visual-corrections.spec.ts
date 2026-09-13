import {test,expect,type Page} from '@playwright/test';
import fs from 'node:fs';
import type {Group,Object3D,PerspectiveCamera} from 'three';
import type {Flight,spawnObject} from '../lib/game/simulation';
type PortalWindow=Window&{__portalQA:{state:Flight;camera:PerspectiveCamera;ship:Group;damageTrail:Group;effects:Map<number,Object3D>;station:Group;spawnObject:typeof spawnObject}};
type PortalReport={z:number;visible:boolean;width:number;height:number;opacity:number;left:number;top:number;bottom:number};
async function fixture(page:Page){
 await page.route('**/api/ai-status',r=>r.fulfill({json:{available:false}}));
 await page.route('**/components/space-scene.tsx*',async route=>{
  const response=await route.fetch();let body=await response.text();
  expect(body).toContain('const loop = (now) => {');expect(body).toContain('if (active) stepFlight(');
  body=body.replace('const loop = (now) => {','window.__portalQA = {state,camera,ship,damageTrail,meshes,effects,station,spawnObject,portalLabelLayout,projectedBodyRect,overlaps,freeze:true}; const loop = (now) => {').replace('if (active) stepFlight(','if (active && !window.__portalQA.freeze) stepFlight(');
  await route.fulfill({response,body});
 });
 await page.goto('/');await expect(page.getByRole('region',{name:'Checkpoint route map'})).toHaveCount(0);
 await page.getByRole('button',{name:'Launch delivery'}).click();await expect(page.locator('canvas')).toHaveAttribute('data-stage','1');
}
for(const width of [1224,390])test(`gate label and jump presentation at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:width===390?844:760});await fixture(page);
 const report:PortalReport[]=[];
 expect(await page.evaluate(()=>!!(window as unknown as PortalWindow).__portalQA.damageTrail.getObjectByName('shield'))).toBe(false);
 for(const z of [-300,-100,-40,-8]){
  await page.evaluate(z=>{const q=(window as unknown as PortalWindow).__portalQA;Object.assign(q.state,{progress:10,x:0,y:0,shield:0,warpAge:null,entities:[],effects:[]});const e=q.spawnObject(q.state,'portal',-5,0,z);e.radius=3.25;},z);await page.waitForTimeout(200);
  const result=await page.locator('.portal-label').evaluate(el=>{const s=getComputedStyle(el),r=el.getBoundingClientRect();return {visible:s.display!=='none',width:r.width,height:r.height,opacity:+s.opacity,left:r.left,top:r.top,bottom:r.bottom};});
  if(z===-8)expect(result.visible).toBe(false);else{expect(result.visible).toBe(true);expect(result.width).toBeLessThanOrEqual(115);expect(result.height).toBeLessThan(25);}
  if(z===-300||z===-100||z===-40){const opening=await page.evaluate(()=>{const q=(window as unknown as PortalWindow).__portalQA,e=q.state.entities[0],v=q.camera.position.clone().set(e.x,e.y+e.radius*1.3,e.z).project(q.camera),c=document.querySelector('canvas')!.getBoundingClientRect();return c.top+(-v.y*.5+.5)*c.height;});expect(result.bottom).toBeLessThan(opening-5);}
  await page.screenshot({path:`outputs/portal-${width}-${-z}.png`});report.push({z,...result});
 }
 expect(report[1].width).toBeGreaterThan(report[0].width);expect(report[2].width).toBeGreaterThan(report[1].width);expect(report[2].opacity).toBeLessThan(report[1].opacity);
 // A nearby hazard occupying the label's projected rectangle suppresses the lettering.
 await page.evaluate(()=>{const q=(window as unknown as PortalWindow).__portalQA;Object.assign(q.state,{entities:[]});q.spawnObject(q.state,'portal',-5,0,-100).radius=3.25;});await page.waitForTimeout(100);
 await page.evaluate(()=>{const q=(window as unknown as PortalWindow).__portalQA,r=document.querySelector('.portal-label')!.getBoundingClientRect(),c=document.querySelector('canvas')!.getBoundingClientRect(),v=q.camera.position.clone().set(((r.left+r.width/2-c.left)/c.width)*2-1,1-((r.top+r.height/2-c.top)/c.height)*2,.5).unproject(q.camera).sub(q.camera.position).normalize(),p=q.camera.position.clone().addScaledVector(v,(-80-q.camera.position.z)/v.z);q.spawnObject(q.state,'iron-asteroid',p.x,p.y,p.z).radius=2;});await page.waitForTimeout(100);await expect(page.locator('.portal-label')).toBeHidden();
 // Protection still exists; no enclosing sphere is constructed during pickups, cruise, or warp.
 for(const age of [0,.7,3,7.5]){
  await page.evaluate(age=>{const q=(window as unknown as PortalWindow).__portalQA;Object.assign(q.state,{entities:[],effects:[{id:900,kind:'jump',x:0,y:0,z:0,age:.3,life:1.2,size:12,color:'#9ef1ff',seed:1}],warpAge:age,speed:age<1?1+age*2:3,shield:1.5});},age);await page.waitForTimeout(150);
  const v=await page.evaluate(()=>{const q=(window as unknown as PortalWindow).__portalQA;return {shield:!!q.damageTrail.getObjectByName('shield'),jumpChildren:q.effects.get(900)?.children.length,shipChildren:q.ship.children.length,protected:q.state.shield};});expect(v.shield).toBe(false);expect(v.jumpChildren).toBe(0);expect(v.shipChildren).toBeGreaterThan(0);expect(v.protected).toBeGreaterThan(0);await page.screenshot({path:`outputs/warp-${width}-${age}.png`});
 }
 await page.evaluate(()=>{const q=(window as unknown as PortalWindow).__portalQA;Object.assign(q.state,{warpAge:null,shield:5,effects:[],progress:141});});await page.waitForTimeout(100);
 expect(await page.evaluate(()=>!!(window as unknown as PortalWindow).__portalQA.damageTrail.getObjectByName('shield'))).toBe(false);
 await page.evaluate(()=>{(window as unknown as PortalWindow).__portalQA.state.shield=0;});await page.waitForTimeout(100);
 expect(await page.evaluate(()=>!!(window as unknown as PortalWindow).__portalQA.damageTrail.getObjectByName('shield'))).toBe(false);
 expect(await page.evaluate(()=>(window as unknown as PortalWindow).__portalQA.station.visible)).toBe(true);await expect(page.locator('.portal-label')).toHaveText('Warp Gate');await expect(page.locator('.portal-label')).toBeVisible();expect(await page.evaluate(()=>(window as unknown as PortalWindow).__portalQA.station.getObjectByName('portal_membrane')!.visible)).toBe(false);await page.screenshot({path:`outputs/final-warp-gate-${width}.png`});
 fs.writeFileSync(`outputs/portal-${width}-report.json`,JSON.stringify(report,null,2));
});
