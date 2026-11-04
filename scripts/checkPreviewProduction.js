import { readdir, readFile } from 'node:fs/promises';
const directory=new URL('../dist/assets/',import.meta.url);
for(const file of await readdir(directory)){
  if(!/\.(js|css)$/.test(file))continue;
  const content=await readFile(new URL(file,directory),'utf8');
  if(/\/dev\/preview|Development preview|devPreviewPanel/.test(content))throw new Error(`Development preview leaked into production asset: ${file}`);
}
console.log('Production assets exclude the development preview route, tool, and styles.');
