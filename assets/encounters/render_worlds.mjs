/** Actual destination materials: ten appearances, full rotations/poles, and gameplay close approaches. */
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const dir='outputs/destination-worlds';fs.mkdirSync(dir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:720,height:720}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|compil/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/api/ai-status',route=>route.fulfill({json:{available:false}}));
 await page.goto('http://localhost:5173');await page.locator('canvas[data-model-source="blender"]').waitFor();
 await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{buildDestinationPlanet,stageEnvironment}=await import('/lib/game/space-environment.ts');
  const panel=document.createElement('div');panel.id='world-panel';panel.style='position:fixed;inset:0;background:#07111b;z-index:99999';document.body.appendChild(panel);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(720,720);renderer.setPixelRatio(1);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.outputColorSpace=T.SRGBColorSpace;panel.appendChild(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#07111b');const camera=new T.PerspectiveCamera(42,1,.1,10000);camera.layers.enable(1);
  let world;window.previewWorld=async(stage,mobile=false)=>{
   if(world){scene.remove(world.group);world.dispose();const seen=new Set();world.group.traverse(o=>{if(o.isMesh){if(!seen.has(o.geometry)){o.geometry.dispose();seen.add(o.geometry);}o.material.dispose();}});}
   const start=performance.now(),profile=stageEnvironment(stage);world=buildDestinationPlanet(profile,mobile);await world.ready;scene.add(world.group);world.update(150,0);
   const globe=world.group.getObjectByName('destination_surface'),map=globe.material.map,detail=globe.material.bumpMap,data=map.image.data,w=map.image.width,h=map.image.height;
   let opaque=true,poles=true,seam=true,hash=2166136261;for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619);if(i%4===3&&data[i]!==255)opaque=false;}
   for(const row of [0,h-1])for(let x=1;x<w;x++)for(let c=0;c<4;c++)if(data[(row*w+x)*4+c]!==data[row*w*4+c])poles=false;
   for(let y=0;y<h;y++)for(let c=0;c<4;c++)if(data[(y*w)*4+c]!==data[(y*w+w-1)*4+c])seam=false;
   const stats={stage,name:profile.name,kind:profile.kind,mobile,buildMs:performance.now()-start,width:w,height:h,opaque,poles,seam,hash:hash>>>0,position:world.group.position.toArray(),textures:2+(profile.clouds?1:0)+(profile.kind==='volcanic'?1:0),roughness:!!globe.material.roughnessMap};
   window.worldAngle=(angle,pole=0)=>{globe.rotation.y=profile.rotation+angle;camera.position.copy(world.group.position).add(pole?new T.Vector3(.1,pole*510,.1):new T.Vector3(0,0,510));camera.up.set(0,pole?0:1,pole?-1:0);camera.lookAt(world.group.position);camera.updateProjectionMatrix();renderer.render(scene,camera);return {triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls};};
   window.worldAngle(0);return stats;
  };
 });
 const report=[];
 for(let stage=1;stage<=10;stage++){
  const stats=await page.evaluate(stage=>window.previewWorld(stage),stage);if(!stats.opaque||!stats.poles||!stats.seam)throw Error('Surface coverage: '+stage);report.push(stats);
  for(const [name,angle,pole] of [['front',0,0],['quarter',Math.PI/2,0],['back',Math.PI,0],['three-quarter',Math.PI*1.5,0],['north',0,1],['south',0,-1]]){await page.evaluate(({angle,pole})=>window.worldAngle(angle,pole),{angle,pole});await page.locator('#world-panel canvas').screenshot({path:`${dir}/stage-${stage}-${name}.png`});}
  const mobile=await page.evaluate(stage=>window.previewWorld(stage,true),stage);if(!mobile.opaque||!mobile.poles||!mobile.seam)throw Error('Mobile coverage');report.push(mobile);await page.locator('#world-panel canvas').screenshot({path:`${dir}/stage-${stage}-mobile.png`});
 }
 if(new Set(report.filter(r=>!r.mobile).map(r=>r.hash)).size!==10)throw Error('Duplicate surfaces');
 fs.writeFileSync(`${dir}/report.json`,JSON.stringify({errors,worlds:report},null,2));
 const html=`<!doctype html><meta charset="utf-8"><title>Ten Space Race destinations</title><style>body{margin:0;padding:30px;background:#07111b;color:#d1e5ee;font:14px system-ui}h1{margin:0 0 8px;font-size:28px}p{color:#85a4b3;margin:0 0 25px}.grid{display:grid;grid-template-columns:repeat(5,1fr);gap:14px}article{background:#0b1c27;border:1px solid #253b49;border-radius:9px;overflow:hidden}img{width:100%;display:block}b,small{display:block;margin:10px 14px}small{color:#83a8b9;font-size:11px}</style><h1>Ten fictional destinations · Original geography</h1><p>Original invented surfaces rendered on the actual game sphere. Complete coverage, separate terrain and atmosphere.</p><div class="grid">${report.filter(r=>!r.mobile).map(r=>`<article><img src="data:image/png;base64,${fs.readFileSync(`${dir}/stage-${r.stage}-front.png`).toString('base64')}"><b>${String(r.stage).padStart(2,'0')} · ${r.name}</b><small>${r.kind.toUpperCase()}</small></article>`).join('')}</div>`;
 fs.writeFileSync(`${dir}/ten-worlds.html`,html);await page.setViewportSize({width:1700,height:1000});await page.setContent(html);await page.screenshot({path:`${dir}/ten-worlds.png`,fullPage:true});
 console.log(JSON.stringify({worlds:10,renders:70,errors,buildMs:report.map(r=>Math.round(r.buildMs))}));
}finally{await browser.close();}
