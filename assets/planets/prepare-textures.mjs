/** Re-encode the preserved original generated maps as compact runtime JPEGs (macOS sips). */
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {execFileSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),dest=path.resolve(here,'../../public/planet-maps');
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),manifest=JSON.parse(fs.readFileSync(path.join(here,'prompts.json'),'utf8')),checks={};
fs.mkdirSync(dest,{recursive:true});
for(const item of manifest.assets){const source=path.join(here,item.source),output=path.join(dest,item.name.toLowerCase()+'.jpg');execFileSync('sips',['-s','format','jpeg','-s','formatOptions','92',source,'--out',output],{stdio:'pipe'});checks[item.name]={sourceSha256:hash(source),runtimeSha256:hash(output)};}
fs.writeFileSync(path.join(here,'source-sha256.json'),JSON.stringify(checks,null,2)+'\n');console.log(JSON.stringify({fictionalMaps:manifest.assets.length}));
