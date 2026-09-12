import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ENCOUNTER_MODELS } from "./objects";
const MODELS=[...new Set(["kestrel","wraith","atlas",...ENCOUNTER_MODELS])];
const cache=new Map<string,THREE.Group>();
let pending:Promise<void>|null=null;
export function preloadModels(){
 if(!pending){const loader=new GLTFLoader();pending=Promise.all(MODELS.map(async name=>{const model=await loader.loadAsync(`/models/${name}.glb`);model.scene.userData.source="blender";cache.set(name,model.scene);})).then(()=>undefined).catch(error=>{pending=null;throw error;});}
 return pending;
}
export function cloneModel(name:string):THREE.Group {
 const source=cache.get(name);if(!source)throw new Error(`Model ${name} is not loaded`);
 const root=source.clone(true);root.traverse(o=>{if(o instanceof THREE.Mesh){o.geometry=o.geometry.clone();o.material=Array.isArray(o.material)?o.material.map(m=>m.clone()):o.material.clone();o.castShadow=true;o.receiveShadow=true;}});
 return root;
}
