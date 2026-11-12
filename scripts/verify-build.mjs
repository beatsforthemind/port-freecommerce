import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join, relative, resolve, sep } from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=resolve(root,'dist');
const publicDir=join(root,'public');
const digest=buffer=>createHash('sha256').update(buffer).digest('hex');
const requiredPublicFiles=[
  'models/poly-pizza/animated-robot.glb',
  'models/poly-pizza/scifi-computer.glb',
  'models/poly-pizza/tree-spiral.glb',
  'models/poly-pizza/cooking-pot.glb',
  'models/poly-pizza/credits.txt',
  'fonts/OFL.txt',
];
// Typefaces are served from this site; nothing may reach for a font service.
const typefaces=['Space Grotesk','Barlow Condensed'];
const fontServices=/fonts\.(googleapis|gstatic)\.com|use\.typekit\.net|fonts\.bunny\.net/i;

async function publicFiles(directory) {
  const files=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=join(directory,entry.name);
    if(entry.isDirectory())files.push(...await publicFiles(path));
    else files.push(path);
  }
  return files;
}

try {
  const html=await readFile(join(output,'index.html'),'utf8');
  const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(match=>match[1]);
  const styles=[...html.matchAll(/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"/g)].map(match=>match[1]);
  const local=[...scripts,...styles].filter(path=>path.startsWith('/'));
  if(!scripts.some(path=>path.startsWith('/assets/'))||!styles.some(path=>path.startsWith('/assets/')))throw new Error('Missing compiled script or stylesheet in dist/index.html.');
  for(const url of local) {
    const file=resolve(output,'.'+new URL(url,'https://build.invalid').pathname);
    if(!file.startsWith(output+sep))throw new Error(`Asset escapes output directory: ${url}`);
    const data=await readFile(file);
    if(!data.length)throw new Error(`Empty compiled asset: ${url}`);
  }
  // Every typeface the stylesheet names must arrive as a WOFF2 file in this build.
  if(fontServices.test(html))throw new Error('dist/index.html still references a font service.');
  let fonts=0;
  for(const url of styles.filter(path=>path.startsWith('/'))) {
    const css=await readFile(resolve(output,'.'+url),'utf8');
    if(fontServices.test(css))throw new Error(`Stylesheet still references a font service: ${url}`);
    const faces=[...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(match=>match[1]);
    for(const family of typefaces)if(!faces.some(face=>face.includes(family)))throw new Error(`No @font-face for ${family} in ${url}.`);
    for(const face of faces) for(const [,source] of face.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
      if(!source.startsWith('/assets/'))throw new Error(`Typeface is not a fingerprinted local asset: ${source}`);
      const data=await readFile(resolve(output,'.'+source));
      if(data.toString('ascii',0,4)!=='wOF2')throw new Error(`Typeface is not WOFF2: ${source}`);
      fonts++;
    }
  }
  if(!fonts)throw new Error('No packaged typefaces found.');
  for(const [,href] of html.matchAll(/<link\b[^>]*\brel="preload"[^>]*\bhref="([^"]+)"/g)) {
    if(!href.startsWith('/assets/'))throw new Error(`Preload is not a fingerprinted local asset: ${href}`);
    await readFile(resolve(output,'.'+href));
  }
  const files=await publicFiles(publicDir);
  for(const path of requiredPublicFiles) {
    await readFile(join(publicDir,path));
    await readFile(join(output,path));
  }
  let models=0;
  for(const file of files) {
    const path=relative(publicDir,file);
    const [source,built]=await Promise.all([readFile(file),readFile(join(output,path))]);
    if(digest(source)!==digest(built))throw new Error(`Public asset changed or was not copied correctly: ${path}`);
    if(path.endsWith('.glb')) {
      if(built.length<12||built.toString('ascii',0,4)!=='glTF'||built.readUInt32LE(4)!==2||built.readUInt32LE(8)!==built.length)throw new Error(`Invalid GLB output: ${path}`);
      models++;
    }
  }
  if(!models)throw new Error('No packaged GLB models found.');
  console.log(`Production output verified: ${local.length} compiled assets, ${fonts} typefaces, ${models} GLBs, ${files.length} byte-identical public files.`);
} catch(error) {
  console.error(`Production verification failed: ${error.message}`);
  process.exitCode=1;
}
