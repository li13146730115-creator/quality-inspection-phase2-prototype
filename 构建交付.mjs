import {execFileSync} from 'node:child_process';
import {cpSync,readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=path.dirname(fileURLToPath(import.meta.url));
const baseArg=process.argv.find(arg=>arg.startsWith('--base='));
const base=baseArg?baseArg.slice(7):'/';
if(!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(base))throw new Error('Invalid deployment base');
const mobile=path.join(root,'移动端'),pc=path.join(root,'PC端');
const run=(cwd,...args)=>execFileSync('npm',args,{cwd,stdio:'inherit'});
run(mobile,'run','check:runtime');
run(mobile,'exec','tsc','--','--noEmit');
run(mobile,'exec','vite','build','--',`--base=${base}mobile/`);
// Prefix protected runtime's root asset references in build output only.
for(const name of readdirSync(path.join(mobile,'dist/client/assets'))){if(/\.(js|css)$/.test(name)){const file=path.join(mobile,'dist/client/assets',name);writeFileSync(file,readFileSync(file,'utf8').replaceAll('\"/assets/','\"'+base+'assets/').replaceAll("'/assets/","'"+base+'assets/'));}}
mkdirSync(path.join(pc,'public/mobile'),{recursive:true});
cpSync(path.join(mobile,'dist/client'),path.join(pc,'public/mobile'),{recursive:true});
cpSync(path.join(mobile,'public/assets'),path.join(pc,'public/assets'),{recursive:true});
const index=path.join(pc,'public/mobile/index.html');
writeFileSync(index,readFileSync(index,'utf8').replace('lang="en"','lang="zh-CN"').replace('Mobile Prototype Boilerplate','品质巡检二期 · 小程序原型'));
run(pc,'exec','vite','build','--',`--base=${base}`);
execFileSync(process.execPath,['scripts/prepare-sites-build.mjs'],{cwd:pc,stdio:'inherit'});
