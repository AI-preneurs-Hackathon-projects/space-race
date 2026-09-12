/** One catalog drives encounter selection, physics, rendering and the field guide. */
export const OBJECT_TYPES = ['asteroid','iron-asteroid','ice-asteroid','volatile-rock','crystal-cluster','comet','derelict','cargo-crate','fuel-tank','proximity-mine','repair-pod','shield-buoy','sputnik','solar-satellite','missile','pirate','saucer-cruiser','twinwing-fighter','wedge-destroyer','ring-station','moon','planet','blackhole','repulsor','portal'] as const;
export type ObjectType = typeof OBJECT_TYPES[number];
export type ObjectSpec = {name:string;family:'rock'|'ship'|'salvage'|'hazard'|'field'|'portal';color:string;radius:number;mass:number;hp:number;bounce:number;model?:string;blast?:number;blastDamage?:number;gravity?:number;fieldRadius?:number;collect?:'repair'|'shield'|'cargo';description:string};
export const OBJECTS:Record<ObjectType,ObjectSpec> = {
 'asteroid':{name:'Basalt asteroid',family:'rock',color:'#b49c84',radius:1.35,mass:7,hp:2,bounce:.55,model:'asteroid-1',blast:3.8,blastDamage:1,description:'Solid rock. Break it into fragments or knock it into another object.'},
 'iron-asteroid':{name:'Iron asteroid',family:'rock',color:'#97adb9',radius:1.5,mass:18,hp:5,bounce:.72,model:'iron-asteroid',blast:3.3,blastDamage:1,description:'Heavy armor and a hard rebound. Needs five pulse hits to break.'},
 'ice-asteroid':{name:'Ice asteroid',family:'rock',color:'#88e9ff',radius:1.4,mass:4,hp:1,bounce:.35,model:'ice-asteroid',blast:4.5,blastDamage:1,description:'Fragile ice shatters in one hit. Its fast fragments can hit nearby targets.'},
 'volatile-rock':{name:'Volatile asteroid',family:'rock',color:'#ff884a',radius:1.45,mass:6,hp:2,bounce:.35,model:'volatile-rock',blast:8,blastDamage:4,description:'Glowing seams warn of a large blast. Shoot it near enemies; keep your distance.'},
 'crystal-cluster':{name:'Crystal cluster',family:'rock',color:'#cc9bff',radius:1.3,mass:5,hp:3,bounce:.9,model:'crystal-cluster',blast:5,blastDamage:2,description:'Springy crystal transfers momentum and bursts into sharp shards.'},
 'comet':{name:'Ice comet',family:'rock',color:'#b3f0ff',radius:1.6,mass:9,hp:3,bounce:.3,model:'comet',blast:5,blastDamage:2,description:'Crosses the route with a long tail. Its momentum carries through an impact.'},
 'derelict':{name:'Drifting wreck',family:'salvage',color:'#b39678',radius:1.8,mass:12,hp:4,bounce:.3,model:'derelict',blast:5,blastDamage:2,description:'Unpowered wreckage tumbles freely and can shield you from hostile fire.'},
 'cargo-crate':{name:'Cargo cache',family:'salvage',color:'#e6b36e',radius:.9,mass:3,hp:2,bounce:.45,model:'cargo-crate',collect:'cargo',description:'Collect to restore 12% cargo. Shots can destroy it, so watch your fire.'},
 'fuel-tank':{name:'Fuel canister',family:'hazard',color:'#ffb153',radius:1.1,mass:4,hp:1,bounce:.4,model:'fuel-tank',blast:9,blastDamage:5,description:'One shot starts a powerful explosion. Nearby canisters can chain-react.'},
 'proximity-mine':{name:'Proximity mine',family:'hazard',color:'#ff6262',radius:.9,mass:3,hp:1,bounce:.65,model:'proximity-mine',blast:6,blastDamage:4,description:'Flashes as you approach, then detonates in a 6-unit radius. Shoot it from a safe distance.'},
 'repair-pod':{name:'Repair capsule',family:'salvage',color:'#8bffc3',radius:.85,mass:2,hp:2,bounce:.5,model:'repair-pod',collect:'repair',description:'Collect to restore 22 hull armor. Repair also reduces visible smoke and fire.'},
 'shield-buoy':{name:'Shield buoy',family:'salvage',color:'#79dfff',radius:1,mass:3,hp:3,bounce:.8,model:'shield-buoy',collect:'shield',description:'Collect for 8 seconds of impact protection. The bubble does not stop drift.'},
 'sputnik':{name:'Survey satellite',family:'salvage',color:'#e6d5ac',radius:1,mass:4,hp:2,bounce:.75,model:'sputnik',description:'A light antenna satellite. Impacts and explosions send it spinning.'},
 'solar-satellite':{name:'Solar relay',family:'salvage',color:'#76b9ff',radius:1.6,mass:7,hp:3,bounce:.4,model:'solar-satellite',blast:3.5,blastDamage:1,description:'Wide solar wings catch debris and shots. Can break apart in a collision.'},
 'missile':{name:'Seeker rocket',family:'hazard',color:'#ff815d',radius:.65,mass:2,hp:1,bounce:.1,model:'missile',blast:5.5,blastDamage:3,description:'Turns toward your last flight line with limited thrust. Shoot or dodge it.'},
 'pirate':{name:'Raider interceptor',family:'ship',color:'#ff7865',radius:1.35,mass:8,hp:3,bounce:.3,model:'wraith',blast:4.5,blastDamage:2,description:'A nimble raider with pulse cannons. Rocks block its shots and can damage its hull.'},
 'saucer-cruiser':{name:'Horizon cruiser',family:'ship',color:'#a8d8ff',radius:2,mass:18,hp:6,bounce:.25,model:'saucer-cruiser',blast:6,blastDamage:3,description:'A broad saucer and twin engines. Slow handling, heavy hull, paired pulse fire.'},
 'twinwing-fighter':{name:'Vesper fighter',family:'ship',color:'#ff9971',radius:1.3,mass:5,hp:2,bounce:.4,model:'twinwing-fighter',blast:4,blastDamage:2,description:'A fast cockpit between tall wings. Its light frame is vulnerable to debris.'},
 'wedge-destroyer':{name:'Bastion destroyer',family:'ship',color:'#c8baff',radius:2.4,mass:25,hp:8,bounce:.2,model:'wedge-destroyer',blast:7,blastDamage:3,description:'A heavy wedge with broadside guns. Use nearby explosives to crack its armor.'},
 'ring-station':{name:'Orbital relay',family:'salvage',color:'#83eadb',radius:2.2,mass:22,hp:7,bounce:.5,model:'ring-station',blast:6,blastDamage:2,description:'A massive station section. Its ring is hollow, but its rim and hub are solid.'},
 'moon':{name:'Rogue moon',family:'field',color:'#b4c2ce',radius:3,mass:90,hp:100000,bounce:.25,gravity:100,fieldRadius:22,description:'A gentle gravity well bends ships, rocks and projectiles. The surface is solid.'},
 'planet':{name:'Ringed planetoid',family:'field',color:'#81b8e4',radius:4.5,mass:240,hp:100000,bounce:.15,gravity:200,fieldRadius:28,description:'A stronger gravity well beside the route. Steer against the pull; avoid its surface.'},
 'blackhole':{name:'Black hole',family:'field',color:'#c594ff',radius:2.1,mass:500,hp:100000,bounce:0,gravity:320,fieldRadius:30,description:'A strong softened gravity well. Objects crossing the dark core are consumed.'},
 'repulsor':{name:'Repulsor anomaly',family:'field',color:'#8dffd9',radius:1.7,mass:70,hp:100000,bounce:1,gravity:-170,fieldRadius:23,description:'An outward field pushes every nearby body away, including your ship.'},
 'portal':{name:'Jump gate',family:'portal',color:'#87edff',radius:3.4,mass:0,hp:1,bounce:0,description:'Fly through the opening for real 3× forward acceleration. Entry pushes hazards aside.'},
};
export const ENCOUNTER_MODELS = [...new Set(OBJECT_TYPES.map(id=>OBJECTS[id].model).filter((v):v is string=>!!v))];
export const FIELD_TYPES:ObjectType[]=['moon','planet','blackhole','repulsor'];
export const SHIP_TYPES:ObjectType[]=['pirate','twinwing-fighter','saucer-cruiser','wedge-destroyer'];
export const isShip=(id:ObjectType)=>OBJECTS[id].family==='ship';
export const isField=(id:ObjectType)=>OBJECTS[id].family==='field';
