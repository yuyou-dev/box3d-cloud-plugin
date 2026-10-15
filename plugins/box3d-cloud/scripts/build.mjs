import {build} from 'esbuild';
import fs from 'node:fs/promises';
const result=await build({metafile:true,entryPoints:['scripts/start-mcp.mjs','scripts/cli.mjs'],outdir:'dist',bundle:true,platform:'node',format:'esm',outExtension:{'.js':'.mjs'},target:'node20',banner:{js:"import {createRequire as __box3dRequire} from 'node:module';const require=__box3dRequire(import.meta.url);"},legalComments:'eof'});
const licenses=[];
const packages=new Set(Object.keys(result.metafile.inputs).filter(f=>f.includes('node_modules/')).map(f=>{const tail=f.split('node_modules/').at(-1).split('/');return tail[0].startsWith('@')?tail.slice(0,2).join('/'):tail[0];}));
for(const p of [...packages].sort()){
 const directory='node_modules/'+p;
 const files=await fs.readdir(directory),file=files.find(f=>/^licen[cs]e(\.|$)/i.test(f));
 if(!file)throw Error('Bundled dependency has no license file: '+p);
 licenses.push(p+'\n'+await fs.readFile(directory+'/'+file,'utf8'));
}
await fs.writeFile('dist/THIRD-PARTY-NOTICES.txt',licenses.join('\n\n---\n\n'));
