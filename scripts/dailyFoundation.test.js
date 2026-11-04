import { designedDailyPuzzles } from "../src/data/daily/designed/index.js";
import { dailyDesignBankConfig } from "../src/data/daily/designConfig.js";
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { addDailyDays, getDailyDateKey, millisecondsUntilNextDaily, parseDateKey } from '../src/utils/dailyDate.js';
import { dailyPuzzles, dailySchedule, getDailyPuzzle, getDailyPuzzleForDate, MissingDailyPuzzleError } from './lib/dailyCatalog.js';
import { generatedDailyPuzzles } from '../src/data/daily/generated/index.js';
import { handcraftedPuzzles } from '../src/data/daily/handcrafted.js';
import { dailyOverrides } from '../src/data/daily/overrides.js';
import { dailyBankConfig as config } from '../src/data/daily/config.js';
import { createDailyProgressService, DAILY_PROGRESS_KEY, LEGACY_DAILY_KEY, mergeDailyProgress } from '../src/services/dailyProgress.js';
import { calibrateDaily } from './lib/dailyCalibration.js';
import { generateCandidate } from './lib/dailyCandidate.js';
import { isBipartite, solveThreeColoring } from './lib/dailyGraph.js';
import { validateDailyBank, validateDailyPuzzle } from './lib/dailyValidation.js';
import { planDailyReplacement } from './lib/dailyScheduling.js';

const ledger = JSON.parse(await readFile(new URL('../src/data/daily/integrity.json',import.meta.url),'utf8'));
const calibration = calibrateDaily();
const options = {puzzles:dailyPuzzles,schedule:dailySchedule,generated:generatedDailyPuzzles,designed:designedDailyPuzzles,designConfig:dailyDesignBankConfig,overrides:dailyOverrides,config,ledger,calibration,today:'2026-11-03'};
const puzzle = generatedDailyPuzzles[0];
const result = (time=1000,recolors=2,resets=1,completedAt='2026-11-04T18:00:00.000Z') => ({timeMilliseconds:time,recolors,resets,completedAt});
function storage() {
  const data = new Map();
  return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),data};
}
function service(store, now='2026-11-04T17:00:00.000Z') {
  return createDailyProgressService({storage:store,now:()=>now});
}

test('New York midnight is canonical in winter/summer and across DST boundaries',()=>{
  for(const [instant,key]of [
    ['2026-11-04T04:59:59.999Z','2026-11-03'],['2026-11-04T05:00:00.000Z','2026-11-04'],
    ['2027-07-01T03:59:59.999Z','2027-06-30'],['2027-07-01T04:00:00.000Z','2027-07-01'],
    ['2027-03-14T06:59:59.999Z','2027-03-14'],['2027-03-14T07:00:00.000Z','2027-03-14'],
    ['2027-11-07T05:59:59.999Z','2027-11-07'],['2027-11-07T06:00:00.000Z','2027-11-07'],
  ]) assert.equal(getDailyDateKey(new Date(instant)),key);
  assert.equal(millisecondsUntilNextDaily(new Date('2027-03-14T05:00:00.000Z')),23*3600000);
  assert.equal(millisecondsUntilNextDaily(new Date('2027-11-07T04:00:00.000Z')),25*3600000);
  assert.equal(millisecondsUntilNextDaily(new Date('2026-11-04T04:59:59.999Z')),1);
  assert.equal(addDailyDays('2027-02-28',1),'2027-03-01');
  assert.throws(()=>parseDateKey('2027-02-29'));
});

test('every date has an exact frozen puzzle, original historical IDs survive, and missing dates never fall back',()=>{
  assert.equal(generatedDailyPuzzles.length,365);
  assert.equal(generatedDailyPuzzles[0].dateKey,'2026-11-04');
  assert.equal(generatedDailyPuzzles.at(-1).dateKey,'2027-11-03');
  assert.equal(new Set(generatedDailyPuzzles.map(p=>p.id)).size,365);
  for(let i=0;i<365;i++) {
    const key=addDailyDays(config.rolloutDate,i);
    const current=getDailyPuzzleForDate(key);
    assert.equal(current.dateKey,key);
    assert.equal(current.id,dailySchedule[key]);
    assert.ok(Object.isFrozen(current.vertices));
  }
  assert.equal(getDailyPuzzleForDate('2026-09-03').id,'daily-001');
  assert.equal(getDailyPuzzleForDate('2026-09-22').id,'daily-002');
  assert.equal(getDailyPuzzleForDate('2026-11-03').id,'daily-002');
  assert.equal(getDailyPuzzle(new Date('2026-11-04T04:30Z')).id,'daily-002');
  assert.equal(handcraftedPuzzles[1].theme.id,'fox');
  assert.throws(()=>getDailyPuzzleForDate('2027-11-04'),MissingDailyPuzzleError);
  assert.throws(()=>getDailyPuzzleForDate('2026-09-02'),MissingDailyPuzzleError);
});

test('the complete bank passes calibrated graph/layout/identity validation',()=>{
  assert.deepEqual(validateDailyBank(options),[]);
  assert.deepEqual(calibration.campaign.map(p=>p.id),[25,26,27,28,29,30]);
  assert.ok(calibration.campaign.some(p=>p.meanBacktracks>40));
});

test('validation rejects gaps, duplicates, tampering, invalid graphs, missing metadata, and expired coverage',()=>{
  assert.ok(validateDailyBank({...options,generated:generatedDailyPuzzles.slice(1)}).some(e=>e.includes('Missing generated date')));
  assert.ok(validateDailyBank({...options,generated:[...generatedDailyPuzzles,puzzle]}).some(e=>e.includes('Duplicate')));
  const schedule={...dailySchedule};delete schedule[config.rolloutDate];
  assert.ok(validateDailyBank({...options,schedule}).some(e=>e.includes('Missing scheduled')));
  assert.ok(validateDailyBank({...options,today:'2027-11-04'}).some(e=>e.includes("Today's Daily is missing")));
  const changed={...puzzle,version:undefined,edges:[...puzzle.edges,[0,0]]};
  assert.ok(validateDailyPuzzle(changed,{calibration}).some(e=>e.includes('version')));
  assert.ok(validateDailyPuzzle(changed,{calibration}).some(e=>e.includes('edge')));
  assert.ok(validateDailyPuzzle({...puzzle,edges:[...puzzle.edges,puzzle.edges[0]]},{calibration}).some(e=>e.includes('Duplicate')));
  assert.ok(validateDailyBank({...options,puzzles:dailyPuzzles.map(p=>p.id===puzzle.id?{...p,name:'changed'}:p)}).some(e=>e.includes('Frozen puzzle changed')));
  const k4={vertices:[0,1,2,3].map(id=>({id})),edges:[[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]]};
  assert.equal(solveThreeColoring(k4,{dynamic:true}).solution,null);
  assert.equal(isBipartite({vertices:k4.vertices,edges:[[0,1],[1,2],[2,3]]}),true);
  const completeK4={...puzzle,source:'handcrafted',vertices:k4.vertices.map((v,index)=>({...v,x:100+(index%2)*500,y:100+Math.floor(index/2)*400,color:null})),edges:k4.edges};
  assert.ok(validateDailyPuzzle(completeK4,{calibration}).some(e=>e.includes('3-coloring')));
  const twoColor={...completeK4,edges:[[0,1],[1,2],[2,3]]};
  assert.ok(validateDailyPuzzle(twoColor,{calibration}).some(e=>e.includes('require three')));
  assert.ok(validateDailyPuzzle({...twoColor,edges:[[0,1]]},{calibration}).some(e=>e.includes('Disconnected')));
  const collinear={...completeK4,vertices:[100,300,500].map((x,id)=>({id,x,y:100,color:null})),edges:[[0,1],[1,2],[0,2]]};
  assert.ok(validateDailyPuzzle(collinear,{calibration}).some(e=>e.includes('too close')));
  assert.ok(validateDailyBank({...options,puzzles:[...dailyPuzzles,puzzle]}).some(e=>e.includes('Duplicate id')));
});

test('accepted candidates are reproducible without Math.random',()=>{
  const original=Math.random;
  Math.random=()=>{throw new Error('Unseeded randomness');};
  try {
    const candidate=generateCandidate(puzzle.generation.seed,calibration);
    assert.deepEqual(candidate,generateCandidate(puzzle.generation.seed,calibration));
    for(const key of ['vertices','edges','metrics','width','height','difficulty'])assert.deepEqual(candidate[key],puzzle[key]);
  } finally {Math.random=original;}
});

test('handcrafted replacements only change future schedule entries and use new stable IDs',()=>{
  const handcrafted={id:'handcrafted-test-v1',version:1,dateKey:config.rolloutDate,source:'handcrafted',difficulty:'Challenging',name:'Triangle',description:'Test',width:900,height:650,
    vertices:[{id:0,x:200,y:100,color:null},{id:1,x:700,y:100,color:null},{id:2,x:450,y:500,color:null}],edges:[[0,1],[1,2],[0,2]],theme:{id:'test',name:'Test',colors:{red:'#ff0000',blue:'#0000ff',yellow:'#ffff00'}}};
  const args={puzzle:handcrafted,overrides:[],puzzles:dailyPuzzles,config,ledger,calibration,today:'2026-11-03'};
  const plan=planDailyReplacement(args);
  assert.equal(plan.ledger.schedule[config.rolloutDate],handcrafted.id);
  assert.equal(ledger.schedule[config.rolloutDate],dailySchedule[config.rolloutDate]);
  assert.deepEqual(validateDailyBank({...options,puzzles:[...dailyPuzzles,handcrafted],overrides:plan.overrides,ledger:plan.ledger,schedule:{...dailySchedule,[config.rolloutDate]:handcrafted.id}}),[]);
  assert.throws(()=>planDailyReplacement({...args,today:config.rolloutDate}),/Published/);
  assert.throws(()=>planDailyReplacement({...args,puzzle:{...handcrafted,id:puzzle.id}}),/immutable/);
});

test('legacy results retain all dates, historical IDs, bests, and original storage',async()=>{
  const store=storage();
  const legacy={
    '2026-09-03':{...result(),dateKey:'2026-09-03',sourceLevelId:'daily-001'},
    '2026-11-02':{...result(1200),dateKey:'2026-11-02',sourceLevelId:'daily-002'},
    '2026-11-03':{...result(900),dateKey:'2026-11-03',sourceLevelId:'daily-002'},
    '2026-11-04':{...result(800),dateKey:'2026-11-04',sourceLevelId:'daily-002'},
    broken:{nonsense:true},
  };
  const raw=JSON.stringify(legacy);store.setItem(LEGACY_DAILY_KEY,raw);
  const progress=service(store);
  for(const [key,old] of Object.entries(legacy).filter(([key])=>key!=='broken')) {
    const record=await progress.getProgress({id:old.sourceLevelId,version:1,dateKey:key});
    assert.equal(record.completed,true);assert.equal(record.best.timeMilliseconds,old.timeMilliseconds);assert.equal(record.attempts.length,1);
  }
  assert.equal((await progress.getProgress(puzzle)).completed,false,'An old UTC completion cannot mark a different new puzzle complete');
  assert.equal(store.getItem(LEGACY_DAILY_KEY),raw);
  const schema=JSON.parse(store.getItem(DAILY_PROGRESS_KEY));
  assert.equal(schema.schemaVersion,1);assert.deepEqual(schema.unmappedLegacy.broken,legacy.broken);
  assert.equal((await service(store).getProgress({id:'daily-002',version:1,dateKey:'2026-11-03'})).attempts.length,1);
});

test('migration preserves records without source IDs/timestamps and uses the last known historical graph',async()=>{
  const store=storage();store.setItem(LEGACY_DAILY_KEY,JSON.stringify({'2026-11-03':{timeMilliseconds:0,recolors:0,resets:0}}));
  const record=await service(store).getProgress({id:'daily-002',version:1,dateKey:'2026-11-03'});
  assert.equal(record.completed,true);assert.equal(record.firstCompletedAt,'2026-11-03T12:00:00.000Z');
  assert.equal(record.attempts[0].timestampEstimated,true);
});

test('attempt IDs make writes idempotent; first completion and old best comparison are preserved',async()=>{
  const progress=service(storage());
  await progress.recordActivity(puzzle,'attempt-1');await progress.recordActivity(puzzle,'attempt-1');
  let record=await progress.completeAttempt(puzzle,'attempt-1',result());
  const first=record.firstCompletedAt;
  await progress.completeAttempt(puzzle,'attempt-1',result());
  record=await progress.completeAttempt(puzzle,'attempt-2',result(1000,1,5,'2026-11-05T18:00Z'));
  assert.equal(record.best.recolors,1);assert.equal(record.best.resets,5);assert.equal(record.firstCompletedAt,first);
  record=await progress.completeAttempt(puzzle,'attempt-3',result(1000,1,2));
  assert.equal(record.best.resets,2);
  record=await progress.completeAttempt(puzzle,'attempt-4',result(2000,0,0));
  assert.equal(record.best.timeMilliseconds,1000);
  record=await progress.completeAttempt(puzzle,'attempt-5',result(500,99,99));
  assert.equal(record.best.timeMilliseconds,500);assert.equal(record.attempts.length,5);
  assert.deepEqual(mergeDailyProgress(record,record),record);
  await assert.rejects(()=>progress.completeAttempt(puzzle,'bad',result(NaN)));
});

test('unknown/corrupt new schemas and failed writes preserve existing data',async()=>{
  for(const raw of ['{broken',JSON.stringify({schemaVersion:2,byPuzzleId:{}})]) {
    const store=storage();store.setItem(DAILY_PROGRESS_KEY,raw);
    await assert.rejects(()=>service(store).getProgress(puzzle));assert.equal(store.getItem(DAILY_PROGRESS_KEY),raw);
  }
  const store=storage();const raw=JSON.stringify({'2026-11-03':result()});store.setItem(LEGACY_DAILY_KEY,raw);
  store.setItem=()=>{throw new Error('Quota exceeded');};
  const quotaService=service(store);
  assert.equal((await quotaService.getProgress({id:'daily-002',version:1,dateKey:'2026-11-03'})).best.timeMilliseconds,1000);
  await assert.rejects(()=>quotaService.recordActivity(puzzle,'unsaved'));assert.equal(store.getItem(LEGACY_DAILY_KEY),raw);
  const memory=createDailyProgressService({storage:null});
  await memory.recordActivity(puzzle,'session');assert.equal((await memory.getProgress(puzzle)).attempts.length,1);
});

test('recognizable future puzzles preserve the original frozen bank and future difficulty bands',()=>{
  assert.equal(designedDailyPuzzles.length,364);
  assert.equal(new Set(designedDailyPuzzles.map(p=>p.design.motif)).size,22);
  assert.equal(getDailyPuzzleForDate('2026-11-04').id,'daily-2026-11-04-fox-v2');
  assert.equal(getDailyPuzzleForDate('2026-11-04').design,undefined);
  const mix={Challenging:0,Hard:0,Expert:0};
  for(const original of generatedDailyPuzzles){
    const active=getDailyPuzzleForDate(original.dateKey);
    mix[active.difficulty]++;
    if(original.dateKey>dailyDesignBankConfig.preserveThrough){
      assert.equal(active.difficulty,original.difficulty);
      assert.equal(active.version,2);assert.ok(active.design);assert.notEqual(active.id,original.id);
      const edgeKeys=new Set(active.edges.map(edge=>[...edge].sort((a,b)=>a-b).join(':')));
      assert.ok(active.design.contourEdges.length>=10);
      assert.ok(active.design.contourEdges.every(edge=>edgeKeys.has([...edge].sort((a,b)=>a-b).join(':'))));
    }
  }
  assert.deepEqual(mix,{...config.difficultyCounts,Hard:config.difficultyCounts.Hard-1,Expert:config.difficultyCounts.Expert+1});
  assert.ok(validateDailyBank({...options,designed:designedDailyPuzzles.slice(1)}).some(error=>error.includes('Missing designed date')));
});

test('launch Fox uses a new locked identity with the historical graph and palette unchanged',()=>{
  const historical=handcraftedPuzzles.find(p=>p.id==='daily-002');
  const launch=getDailyPuzzleForDate('2026-11-04');
  assert.equal(historical.dateKey,'2026-09-22');
  assert.equal(historical.version,1);
  assert.deepEqual(launch,{...historical,id:'daily-2026-11-04-fox-v2',dateKey:'2026-11-04',version:2,source:'handcrafted'});
  assert.equal(dailyOverrides.find(p=>p.dateKey==='2026-11-04').id,launch.id);
  assert.equal(generatedDailyPuzzles[0].id,'daily-2026-11-04-v1');
  assert.ok(dailyPuzzles.some(p=>p.id==='daily-2026-11-04-v1'));
  assert.throws(()=>planDailyReplacement({puzzle:{...launch,id:'another-launch-fox'},overrides:dailyOverrides,puzzles:dailyPuzzles,config,ledger,calibration,today:'2026-11-04'}),/Published/);
});

test('recognizable designs reproduce exactly from the authored motif and seeded generator',async()=>{
  const {dailyDesigns}=await import('./lib/dailyDesigns.js');
  const {generateDesignedCandidate}=await import('./lib/dailyDesignedCandidate.js');
  for(const template of dailyDesigns){
    const puzzle=designedDailyPuzzles.find(p=>p.design.motif===template.id);
    const candidate=generateDesignedCandidate(puzzle.generation.seed,template,calibration);
    for(const key of ['vertices','edges','metrics','width','height','difficulty','design','theme'])assert.deepEqual(candidate[key],puzzle[key]);
  }
});
