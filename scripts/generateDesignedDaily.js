import { readFile, writeFile, mkdir } from "node:fs/promises";
import { generatedDailyPuzzles as baseBank } from "../src/data/daily/generated/index.js";
import { handcraftedPuzzles } from "../src/data/daily/handcrafted.js";
import { dailyOverrides } from "../src/data/daily/overrides.js";
import { dailyDesignBankConfig as config } from "../src/data/daily/designConfig.js";
import { getDailyDateKey } from "../src/utils/dailyDate.js";
import { dailyDesigns } from "./lib/dailyDesigns.js";
import { generateDesignedCandidate } from "./lib/dailyDesignedCandidate.js";
import { calibrateDaily } from "./lib/dailyCalibration.js";
import { seededRandom, shuffle, topologySignature } from "./lib/dailyGraph.js";
import { fingerprint } from "./lib/dailyIntegrity.js";
import { validateDailyPuzzle } from "./lib/dailyValidation.js";

const root=new URL('../',import.meta.url);
const checking=process.argv.includes('--check');
const refreshing=!checking && process.argv.includes('--refresh-unpublished');
const protectedThrough=[getDailyDateKey(),config.preserveThrough].sort().at(-1);
const calibration=calibrateDaily();
const templates=shuffle(dailyDesigns,seededRandom(config.seed));
const dates=baseBank.filter(puzzle=>puzzle.dateKey>config.preserveThrough);
const signatures=new Set([...baseBank,...handcraftedPuzzles].map(topologySignature));
const bank=[];
let examined=0;
for(let day=0;day<dates.length;day++){
  const base=dates[day], template=templates[day%templates.length];
  let accepted;
  for(let candidate=0;candidate<50000;candidate++){
    examined++;
    const seed=`${config.seed}:${base.dateKey}:${template.id}:${candidate}`;
    const graph=generateDesignedCandidate(seed,template,calibration);
    if(!graph || graph.difficulty!==base.difficulty || signatures.has(graph.signature))continue;
    const {signature,...data}=graph;
    accepted={id:`daily-${base.dateKey}-design-v2`,dateKey:base.dateKey,version:2,name:template.name,
      description:`${/^[aeiou]/i.test(template.name) || template.id==='hourglass' ? 'An' : 'A'} ${template.name.toLowerCase()} made of connections. Give every circle a color without matching its neighbors.`,source:'generated',...data,generation:{version:2,seed,candidate}};
    const errors=validateDailyPuzzle(accepted,{calibration});
    if(errors.length)throw new Error(`${base.dateKey}: ${errors.join(' ')}`);
    signatures.add(signature);break;
  }
  if(!accepted)throw new Error(`No suitable ${base.difficulty} ${template.name} for ${base.dateKey}; no data was written.`);
  bank.push(accepted);
}
const groups=new Map();
for(const puzzle of bank){const month=puzzle.dateKey.slice(0,7);if(!groups.has(month))groups.set(month,[]);groups.get(month).push(puzzle);}
const outputs=new Map();
for(const [month,puzzles] of groups)outputs.set(`src/data/daily/designed/${month}.js`,`// Generated recognizable designs. Frozen data; do not edit.\nexport default [\n${puzzles.map(puzzle=>`  ${JSON.stringify(puzzle)},`).join('\n')}\n];\n`);
outputs.set('src/data/daily/designed/index.js',[...groups.keys()].map((month,i)=>`import month${i} from "./${month}.js";`).join('\n')+`\nexport const designedDailyPuzzles = [${[...groups.keys()].map((_,i)=>`...month${i}`).join(', ')}];\n`);
const counts={};const motifs={};for(const puzzle of bank){counts[puzzle.difficulty]=(counts[puzzle.difficulty]??0)+1;motifs[puzzle.design.motif]=(motifs[puzzle.design.motif]??0)+1;}
outputs.set('src/data/daily/design-report.json',JSON.stringify({version:config.version,preserveThrough:config.preserveThrough,start:bank[0].dateKey,end:bank.at(-1).dateKey,count:bank.length,counts,motifs,candidatesExamined:examined},null,2)+'\n');
for(const [path,content]of outputs){
  let previous;try{previous=await readFile(new URL(path,root),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
  if(previous!==undefined && previous!==content){
    if(!refreshing)throw new Error(`Refusing to overwrite frozen design file: ${path}`);
    if(path.endsWith('.js') && !path.endsWith('/index.js')){
      const oldPuzzles=(await import(new URL(path,root))).default;
      for(const old of oldPuzzles){
        const next=bank.find(puzzle=>puzzle.id===old.id);
        if(old.dateKey<=protectedThrough && (!next || fingerprint(old)!==fingerprint(next)))throw new Error(`Cannot refresh published/today design: ${old.dateKey}`);
      }
    }
  }
  if(checking && previous!==content)throw new Error(`Missing design output: ${path}`);
}
const ledgerPath=new URL('src/data/daily/integrity.json',root);
const ledger=JSON.parse(await readFile(ledgerPath,'utf8'));
const today=getDailyDateKey();
const overrideIds=new Map(dailyOverrides.map(puzzle=>[puzzle.dateKey,puzzle.id]));
for(const puzzle of bank){
  const hash=fingerprint(puzzle);
  const scheduledId=overrideIds.get(puzzle.dateKey) ?? puzzle.id;
  if(ledger.puzzles[puzzle.id] && ledger.puzzles[puzzle.id]!==hash && (!refreshing || puzzle.dateKey<=protectedThrough))throw new Error(`Frozen design changed: ${puzzle.id}`);
  if(ledger.schedule[puzzle.dateKey]!==scheduledId && puzzle.dateKey<=today)throw new Error(`Cannot replace published/today Daily: ${puzzle.dateKey}`);
  if(checking && (ledger.puzzles[puzzle.id]!==hash || ledger.schedule[puzzle.dateKey]!==scheduledId))throw new Error(`Design ledger is stale: ${puzzle.dateKey}`);
}
if(!checking){
  await mkdir(new URL('src/data/daily/designed/',root),{recursive:true});
  for(const [path,content]of outputs)await writeFile(new URL(path,root),content);
  for(const puzzle of bank){ledger.puzzles[puzzle.id]=fingerprint(puzzle);ledger.schedule[puzzle.dateKey]=overrideIds.get(puzzle.dateKey) ?? puzzle.id;}
  await writeFile(ledgerPath,JSON.stringify(ledger,null,2)+'\n');
}
console.log(`${checking?'Reproduced':'Generated'} ${bank.length} recognizable Dailies across ${templates.length} motifs; ${examined} candidates. ${JSON.stringify(counts)}`);
