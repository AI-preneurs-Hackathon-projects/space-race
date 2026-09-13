/** Render the actual game objects with the game's lighting in a separate QA browser.
 * Start npm run dev, then node assets/encounters/render_previews.mjs before|after.
 * No production route or user session is modified.
 */
import {chromium} from '@playwright/test';
import fs from 'node:fs';
const phase=process.argv[2]||'after',directory=`outputs/object-quality-${phase}`;
fs.mkdirSync(directory,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-angle=metal']});
const page=await browser.newPage({viewport:{width:900,height:760}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error'&&/WebGL|shader|compil/i.test(m.text()))errors.push(m.text());});
try{
 await page.route('**/api/ai-status',route=>route.fulfill({json:{available:false}}));
 await page.goto(process.env.PLAYWRIGHT_BASE_URL||'http://localhost:5173');await page.locator('canvas[data-model-source="blender"]').waitFor();
 const names=await page.evaluate(async()=>{
  const T=await import('/node_modules/three/build/three.module.js'),{RoomEnvironment}=await import('/node_modules/three/examples/jsm/environments/RoomEnvironment.js'),{buildEncounterVisual,updateEncounterVisual}=await import('/lib/game/combat-visuals.ts'),{preloadModels}=await import('/lib/game/assets.ts'),{OBJECTS,OBJECT_TYPES}=await import('/lib/game/objects.ts');
  await preloadModels();const panel=document.createElement('div');panel.id='quality-panel';panel.style='position:fixed;inset:0;background:#081019;z-index:9999;display:grid;place-items:center';document.body.append(panel);
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true,alpha:true});renderer.setSize(900,760);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1;panel.append(renderer.domElement);
  const scene=new T.Scene();scene.background=new T.Color('#081019');const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),environment=pmrem.fromScene(room,.06);room.dispose();pmrem.dispose();scene.environment=environment.texture;scene.environmentIntensity=.35;
  scene.add(new T.AmbientLight('#9eb9ce',.35));for(const [color,power,pos] of [['#fff0db',2.4,[4,9,5]],['#79b5ed',1.1,[-6,3,2]],['#c4ecff',1.3,[-2,4,-8]]]){const l=new T.DirectionalLight(color,power);l.position.set(...pos);scene.add(l);}
  const camera=new T.PerspectiveCamera(38,900/760,.1,100);camera.position.set(2.8,2.2,-4.1);camera.lookAt(0,0,0);
  let object;window.renderQuality=(id)=>{if(object)scene.remove(object);const spec=OBJECTS[id],e={id:3,kind:id==='portal'?'portal':spec.family==='ship'?'pirate':spec.family==='rock'?'asteroid':'object',objectType:id,x:0,y:0,z:0,vx:0,vy:0,radius:1,hp:spec.hp,maxHp:spec.hp,age:0,fire:0};object=buildEncounterVisual(e);if(id==='pirate')object.scale.setScalar(.45);updateEncounterVisual(e,object,2,camera);scene.add(object);if(spec.family==='field'){camera.position.set(4.5,3.6,-6.6);}else camera.position.set(2.8,2.2,-4.1);camera.lookAt(0,0,0);renderer.render(scene,camera);return {name:spec.name,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,textures:renderer.info.memory.textures};};
  window.qualityThumbnail=()=>{scene.background=null;renderer.setSize(256,256);camera.aspect=1;camera.position.set(2.8,2.2,-4.1);camera.lookAt(0,0,0);camera.updateProjectionMatrix();renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');};
  return OBJECT_TYPES;
 });
 const report=[];for(const id of names){const stats=await page.evaluate(id=>window.renderQuality(id),id);await page.locator('#quality-panel canvas').screenshot({path:`${directory}/${id}.png`});if(phase==='thumbnails'){const data=await page.evaluate(()=>window.qualityThumbnail());fs.writeFileSync(`public/object-previews/${id}.png`,Buffer.from(data.split(',')[1],'base64'));}report.push({id,...stats});}
 fs.writeFileSync(`${directory}/render-report.json`,JSON.stringify({errors,objects:report},null,2));if(errors.length)throw Error(JSON.stringify(errors));console.log(JSON.stringify({directory,objects:report.length,errors}));
}finally{await browser.close();}
