import assert from "node:assert/strict";
import test from "node:test";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { preview } from "vite";
import { connect, pause, waitFor } from "./lib/browserHarness.js";
import { levels } from "../src/data/levels.js";
import { colorThemes } from "../src/data/colorThemes.js";
import { getDailyPuzzleForDate } from "./lib/dailyCatalog.js";
import { solveThreeColoring } from "./lib/dailyGraph.js";
import { serializeGraph } from "../src/utils/graphSharing.js";

const phase = process.env.MOBILE_CAPTURE_PHASE ?? "after";
const output = process.env.MOBILE_CAPTURE_DIR ?? "/private/tmp/3color-mobile-rework";
const sizes = [[320,568],[375,812],[390,844],[430,932],[1440,1000]];
const randomPuzzle = {width:600,height:480,...levels.find(level=>level.vertices.length===8)};
const today = getDailyPuzzleForDate("2026-11-09");
const puzzles = [["tutorial","/levels/1",levels[0]],["level25","/levels/25",levels[24]],["level30","/levels/30",levels[29]],["daily","/daily",today],["random",`/custom?seed=${serializeGraph(randomPuzzle)}`,randomPuzzle]];

test("mobile game shell, native menu and complete game interactions", {timeout:180000}, async t=>{
  await mkdir(output,{recursive:true});
  let binary;
  for(const path of [process.env.CHROME_PATH,"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome","/usr/bin/google-chrome","/usr/bin/chromium"].filter(Boolean)) {try{await access(path);binary=path;break;}catch{/* Next browser. */}}
  assert.ok(binary,"Install Chrome or set CHROME_PATH.");
  const profile=await mkdtemp(join(tmpdir(),"3color-mobile-review-"));
  const server=await preview({preview:{host:"127.0.0.1",port:0,strictPort:true},logLevel:"silent"});
  const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  const chrome=spawn(binary,["--headless=new","--no-first-run","--no-default-browser-check","--disable-background-networking","--disable-sync","--remote-debugging-port=0",`--user-data-dir=${profile}`,"about:blank"],{stdio:"ignore"});
  let browser;
  t.after(async()=>{browser?.close();if(chrome.exitCode===null){const exited=new Promise(resolve=>chrome.once("exit",resolve));chrome.kill("SIGTERM");await exited;}await server.close();await rm(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});});
  const port=await waitFor(async()=>{try{return(await readFile(join(profile,"DevToolsActivePort"),"utf8")).split("\n")[0];}catch{return null;}},"Chrome");
  const pages=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  browser=await connect(pages.find(page=>page.type==="page").webSocketDebuggerUrl);
  const {send,evaluate:ev}=browser;
  const until=expression=>waitFor(()=>ev(expression),expression);
  const go=async path=>{const previous=await ev("window.__reviewDocument");await send("Page.navigate",{url:base+path});await until(`window.__reviewDocument && window.__reviewDocument !== ${JSON.stringify(previous)} && !!document.querySelector('main')`);};
  const key=async name=>{const code={Tab:9,Enter:13,Escape:27}[name];await send("Input.dispatchKeyEvent",{type:"keyDown",key:name,code:name,windowsVirtualKeyCode:code});await send("Input.dispatchKeyEvent",{type:"keyUp",key:name,code:name,windowsVirtualKeyCode:code});};
  const action=label=>ev(`document.querySelector('[aria-label=${JSON.stringify(label)}]').click()`);
  const button=text=>ev(`[...document.querySelectorAll('button')].find(button=>button.textContent.trim()===${JSON.stringify(text)}).click()`);
  const click=index=>ev(`(()=>{const vertex=document.querySelectorAll('.vertexGroup')[${index}];vertex.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerType:'mouse'}));vertex.dispatchEvent(new MouseEvent('click',{bubbles:true}));})()`);
  const menu=async()=>{await action("Open game menu");await until("!!document.querySelector('.gameMenu[open]')");};
  const close=async()=>{await action("Close game menu");await until("!document.querySelector('.gameMenu[open]')");};
  const setSelect=(selector,value)=>ev(`(()=>{const select=document.querySelector(${JSON.stringify(selector)});select.value=${JSON.stringify(value)};select.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const graph=async puzzle=>until(`document.querySelectorAll('.vertex').length===${puzzle.vertices.length}`);
  const overview=async puzzle=>{
    await until("document.querySelector('.graphCanvasWrap').dataset.zoom==='100'");
    const view=await ev("(()=>{const p=document.querySelector('.graphViewport'),r=p.getBoundingClientRect();return{left:p.scrollLeft,top:p.scrollTop,visible:[...document.querySelectorAll('.vertex')].filter(v=>{const c=v.getBoundingClientRect();return c.left>=Math.max(0,r.left)-0.1&&c.right<=Math.min(innerWidth,r.right)+0.1&&c.top>=Math.max(0,r.top)-0.1&&c.bottom<=Math.min(innerHeight,r.bottom)+0.1}).length};})()");
    assert.equal(view.left,0);assert.equal(view.top,0);assert.equal(view.visible,puzzle.vertices.length,"Fit must show every circle inside the viewport");
  };
  const screen=async name=>{const {data}=await send("Page.captureScreenshot",{format:"png",captureBeyondViewport:false});await writeFile(join(output,`${phase}-${name}.png`),Buffer.from(data,"base64"));};
  const solve=async puzzle=>{const solution=solveThreeColoring(puzzle,{dynamic:true}).solution;assert.ok(solution);for(let i=0;i<puzzle.vertices.length;i++){const color=await ev(`document.querySelectorAll('.vertexGroup')[${i}].getAttribute('aria-label').split(', ')[1]`);const steps=(solution[puzzle.vertices[i].id]+1-["uncolored","red","blue","yellow"].indexOf(color)+4)%4;for(let n=0;n<steps;n++)await click(i);}await until("!!document.querySelector('.completionCard')");};
  await send("Page.enable");await send("Runtime.enable");await send("Network.enable");
  await send("Network.setBlockedURLs",{urls:["*googletagmanager.com*","*google-analytics.com*","*vercel-insights.com*"]});
  await send("Page.addScriptToEvaluateOnNewDocument",{source:`window.__reviewDocument=crypto.randomUUID();const NativeDate=Date;window.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:['2026-11-09T17:00:00Z']));}static now(){return NativeDate.parse('2026-11-09T17:00:00Z');}};if(!localStorage.getItem('review-fixture')){localStorage.setItem('review-fixture','1');localStorage.setItem('3color-highest-completed-level','29');localStorage.setItem('3color-sound-enabled','false');localStorage.setItem('3color-appearance','light');}`});
  await go("/");
  const measurements=[];
  await t.test("initial 100% overview, manual zoom and Fit, full viewport and menu at four phone sizes and desktop",async()=>{
    for(const[width,height]of sizes){
      await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:width<=600});
      for(const[name,path,puzzle]of puzzles){
        if(name==="tutorial")await ev("localStorage.removeItem('3color-campaign-tutorial')");
        await go(path);await graph(puzzle);if(name==="tutorial")await until("!!document.querySelector('.tutorialGuidance')");await pause(80);
        const measure=await ev(`(()=>{const g=document.querySelector('.graphCanvas').getBoundingClientRect();const h=document.querySelector('.mobileGameHeader,.siteHeader').getBoundingClientRect();return{name:${JSON.stringify(name)},width:${width},height:${height},graphTop:g.y+scrollY,graphWidth:g.width,graphHeight:g.height,headerHeight:h.height,documentHeight:document.documentElement.scrollHeight,zoom:Number(document.querySelector('.graphCanvasWrap').dataset.zoom),panLeft:document.querySelector('.graphViewport').scrollLeft,contentScroll:document.querySelector('.mobileGameContent') ? document.querySelector('.mobileGameContent').scrollHeight-document.querySelector('.mobileGameContent').clientHeight:0,minCircle:Math.min(...[...document.querySelectorAll('.vertex')].map(v=>v.getBoundingClientRect().width)),fullyVisibleCircles:[...document.querySelectorAll('.vertex')].filter(v=>{const r=v.getBoundingClientRect(),p=document.querySelector('.graphViewport').getBoundingClientRect();return r.left>=Math.max(0,p.left)&&r.right<=Math.min(innerWidth,p.right)&&r.top>=Math.max(0,p.top)&&r.bottom<=Math.min(innerHeight,p.bottom)}).length,overflow:document.documentElement.scrollWidth>innerWidth+1,labels:document.querySelectorAll('.vertexGroup text').length};})()`);
        assert.equal(measure.overflow,false);assert.equal(measure.labels,0);
        if(width<=600){assert.equal(measure.zoom,100);assert.equal(measure.fullyVisibleCircles,puzzle.vertices.length);await overview(puzzle);assert.ok(measure.documentHeight<=height+1);assert.equal(await ev("document.querySelector('.siteHeader')"),null);assert.equal(await ev("document.querySelectorAll('.gameSettings').length"),0);assert.equal(await ev("!!document.querySelector('.gameMenu[open]')"),false);for(const size of await ev("[...document.querySelectorAll('.gameIconButton')].map(b=>b.getBoundingClientRect().height)"))assert.ok(size>=44);}
        assert.ok(Math.abs(measure.graphWidth/measure.graphHeight-(puzzle.width??600)/(puzzle.height??480))<0.001);
        measurements.push(measure);await ev("scrollTo(0,0)");await screen(`${name}-${width}x${height}`);await ev("scrollTo(0,document.documentElement.scrollHeight)");await screen(`${name}-${width}x${height}-bottom`);
        if(width<=600){
          await action("Zoom in");await until("document.querySelector('.graphCanvasWrap').dataset.zoom==='110'");
          await action("Zoom out");await overview(puzzle);
          for(let i=0;i<10;i++)await action("Zoom in");
          await until("document.querySelector('.graphCanvasWrap').dataset.zoom==='200'");
          await action("Fit graph to screen");await overview(puzzle);await pause(30);const fit=await ev("(()=>{const r=document.querySelector('.graphCanvas').getBoundingClientRect();return{width:r.width,height:r.height,top:r.y};})()");measure.fit=fit;await screen(`${name}-${width}x${height}-fit`); }
        if(width<=600){await menu();await screen(`${name}-${width}x${height}-menu`);await ev("document.querySelector('.gameMenu').scrollTop=document.querySelector('.gameMenu').scrollHeight");await screen(`${name}-${width}x${height}-menu-bottom`);await close();}
      }
    }
    await writeFile(join(output,`${phase}-measurements.json`),JSON.stringify(measurements,null,2));
  });
  await t.test("native menu contains focus, restores it, scrolls, dismisses by Escape and backdrop",async()=>{
    await send("Emulation.setDeviceMetricsOverride",{width:320,height:568,deviceScaleFactor:1,mobile:true});await go("/levels/25");await graph(levels[24]);await menu();
    assert.equal(await ev("document.activeElement.getAttribute('aria-label')"),"Close game menu");assert.equal(await ev("document.body.style.overflow"),"hidden");
    for(let i=0;i<25;i++){await key("Tab");assert.equal(await ev("document.querySelector('.gameMenu').contains(document.activeElement)"),true);}
    await ev("document.querySelector('.gameMenu').scrollTop=300");assert.ok(await ev("document.querySelector('.gameMenu').scrollTop>0"));await key("Escape");await until("!document.querySelector('.gameMenu[open]')");assert.equal(await ev("document.activeElement.getAttribute('aria-label')"),"Open game menu");assert.equal(await ev("document.body.style.overflow"),"");
    await menu();await send("Input.dispatchMouseEvent",{type:"mousePressed",x:3,y:200,button:"left",clickCount:1});await send("Input.dispatchMouseEvent",{type:"mouseReleased",x:3,y:200,button:"left",clickCount:1});await until("!document.querySelector('.gameMenu[open]')");
  });
  await t.test("all four tutorial steps, blocked moves, completion, replay, skip and progression",async()=>{
    await ev("localStorage.removeItem('3color-campaign-tutorial');localStorage.removeItem('3color-highest-completed-level')");await go("/levels/1");await until("document.querySelector('.tutorialGuidance')?.textContent.includes('Step 1')");await click(2);assert.match(await ev("document.querySelectorAll('.vertexGroup')[2].getAttribute('aria-label')"),/uncolored/);
    await click(0);await until("document.querySelector('.tutorialGuidance').textContent.includes('Step 2')");await click(1);await until("document.querySelector('.tutorialGuidance').textContent.includes('Step 3')");assert.ok(await ev("!!document.querySelector('.conflictEdge')"));await click(1);await until("document.querySelector('.tutorialGuidance').textContent.includes('Step 4')");await click(2);await click(2);await click(2);await until("!!document.querySelector('.completionCard')");await until("JSON.parse(localStorage.getItem('3color-campaign-tutorial')).completed");assert.equal(await ev("localStorage.getItem('3color-highest-completed-level')"),"0");await pause(400);await screen("tutorial-complete-320x568");
    await action("Zoom in");await until("document.querySelector('.graphCanvasWrap').dataset.zoom==='110'");await button("Replay tutorial");await until("document.querySelector('.tutorialGuidance')?.textContent.includes('Step 1')");await overview(levels[0]);await button("Skip tutorial");await go("/levels/1");await graph(levels[0]);assert.equal(await ev("document.querySelector('.tutorialGuidance')"),null);await menu();await button("Replay tutorial");await until("!document.querySelector('.gameMenu[open]') && !!document.querySelector('.tutorialGuidance')");await overview(levels[0]);await button("Skip tutorial");await solve(levels[0]);await button("Continue to Level 2 →");await until("location.pathname==='/levels/2'");
  });
  await t.test("settings reuse persisted color, sound and appearance state without offscreen duplicates",async()=>{
    await ev("localStorage.setItem('3color-highest-completed-level','29')");await go("/levels/25");await graph(levels[24]);await menu();await setSelect(".gameMenu .appearanceControl select","dark");await until("document.documentElement.dataset.appearance==='dark'");await ev("document.querySelector('.gameMenu .soundToggle').click();document.querySelectorAll('.themePresetButton')[1].click()");await until("localStorage.getItem('3color-sound-enabled')==='true'");await close();await click(0);assert.equal(await ev("document.querySelector('.vertex').getAttribute('fill')"),colorThemes[1].colors.red);
    await menu();await ev("(()=>{const input=document.querySelector('input[type=color]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'#123456');input.dispatchEvent(new Event('input',{bubbles:true}));})()");await until("localStorage.getItem('3color-theme-id')==='custom'");await ev("document.querySelector('.menuSettings').scrollIntoView({block:'start'})");await screen("settings-dark-320x568");await setSelect(".gameMenu .appearanceControl select","light");await until("document.documentElement.dataset.appearance==='light'");await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-color-scheme",value:"dark"}]});await setSelect(".gameMenu .appearanceControl select","system");await until("document.documentElement.dataset.appearance==='dark'");await send("Emulation.setEmulatedMedia",{features:[{name:"prefers-color-scheme",value:"light"}]});await until("document.documentElement.dataset.appearance==='light'");
    await go("/levels/25");await graph(levels[24]);await click(0);assert.equal(await ev("document.querySelector('.vertex').getAttribute('fill')"),"#123456");await menu();assert.equal(await ev("document.querySelector('.gameMenu .soundToggle').getAttribute('aria-pressed')"),"true");await close();
    await go("/daily");await graph(today);await click(0);const fill=await ev("document.querySelector('.vertex').getAttribute('fill')");await send("Emulation.setDeviceMetricsOverride",{width:1100,height:850,deviceScaleFactor:1,mobile:false});await until("!!document.querySelector('.siteHeader')");assert.equal(await ev("document.querySelector('.vertex').getAttribute('fill')"),fill);await send("Emulation.setDeviceMetricsOverride",{width:390,height:844,deviceScaleFactor:1,mobile:true});await until("!!document.querySelector('.menuTrigger')");assert.equal(await ev("document.querySelector('.vertex').getAttribute('fill')"),fill);await menu();await ev("document.querySelector('.gameMenu .soundToggle').click()");await until("localStorage.getItem('3color-sound-enabled')==='false'");await close();
  });
  await t.test("touch trace/tap, conflicts, icon reset, zoom/pan, fit, solves and sharing at each phone size",async()=>{
    for(const[width,height]of sizes.filter(([width])=>width<=600)){
      await send("Emulation.setDeviceMetricsOverride",{width,height,deviceScaleFactor:1,mobile:true});
      for(const[path,puzzle]of [["/levels/25",levels[24]],["/levels/30",levels[29]],["/daily",today]]){
        await go(path);await graph(puzzle);await action("Fit graph to screen");const[a,b]=puzzle.edges[0];const ia=puzzle.vertices.findIndex(v=>v.id===a),ib=puzzle.vertices.findIndex(v=>v.id===b);const point=async index=>ev(`(()=>{const v=document.querySelectorAll('.vertexGroup')[${index}];const r=v.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
        await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[await point(ia)]});await until("document.querySelector('.traceStatus').textContent.includes('Tracing')");assert.equal(await ev("document.querySelectorAll('.activeEdge').length"),puzzle.edges.filter(e=>e.includes(a)).length);await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});
        for(const index of[ia,ib]){await send("Input.dispatchTouchEvent",{type:"touchStart",touchPoints:[await point(index)]});await send("Input.dispatchTouchEvent",{type:"touchEnd",touchPoints:[]});await until(`document.querySelectorAll('.vertexGroup')[${index}].getAttribute('aria-label').includes(', red,')`);}
        assert.ok(await ev("Number(document.querySelector('.conflictStat strong').textContent)>0"));for(let i=0;i<10;i++)await action("Zoom in");await until("document.querySelector('.graphCanvasWrap').dataset.zoom==='200'");assert.ok(await ev("document.querySelector('.graphViewport').scrollWidth>document.querySelector('.graphViewport').clientWidth"));await ev("document.querySelector('.graphViewport').scrollLeft=0");const p=await ev("(()=>{const r=document.querySelector('.graphViewport').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+70};})()");await send("Input.synthesizeScrollGesture",{...p,xDistance:-100,yDistance:0,gestureSourceType:"touch"});await until("document.querySelector('.graphViewport').scrollLeft>0");await action("Fit graph to screen");await action("Reset puzzle");await solve(puzzle);
        if(path==="/daily"){await ev("window.__shared=[];Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.__shared.push(data)})");await button("Share Result");await until("window.__shared.length===1");assert.equal(await ev("window.__shared[0].url"),"https://3color.app/daily/2026-11-09");await button("Replay Daily Puzzle");}else await button("Replay Level");await until("!document.querySelector('.completionCard')");
      }
    }
  });
  await t.test("campaign/calendar navigation, menu mode changes, fullscreen and Random generation",async()=>{
    await go("/levels/25");await graph(levels[24]);await menu();await setSelect('[aria-label="Campaign level"]',"30");await until("location.pathname==='/levels/30' && !document.querySelector('.gameMenu[open]')");await action("Previous level");await until("location.pathname==='/levels/29'");await go("/daily");await graph(today);await menu();await ev("document.querySelector('.dailyDateButton').click()");await until("!!document.querySelector('.dailyCalendar')");await key("Escape");assert.equal(await ev("!!document.querySelector('.gameMenu[open]')"),true);await ev("document.querySelector('.dailyDateButton').click()");await ev("document.querySelector('[data-date=\"2026-11-04\"]').click()");await until("location.pathname==='/daily/2026-11-04' && !document.querySelector('.gameMenu[open]')");await menu();await button("Back to Today");await until("location.pathname==='/daily' && !document.querySelector('.gameMenu[open]')");await graph(today);
    if(await ev("document.fullscreenEnabled")){await send("Runtime.evaluate",{expression:"document.querySelector('[aria-label=\"Expand puzzle to full screen\"]').click()",userGesture:true});await until("!!document.fullscreenElement");await until("!!document.querySelector('[aria-label=\"Exit full screen\"]')");await ev("document.exitFullscreen()");await until("!document.fullscreenElement");}
    await menu();await ev("document.querySelector('.gameMenuModes a[href=\"/custom\"]').click()");await until("location.pathname==='/custom' && !document.querySelector('.gameMenu[open]')");await until("document.querySelectorAll('.vertex').length===8");await menu();await ev("document.querySelector('.generatorSettings').open=true;const input=document.querySelector('#vertexCount');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'12');input.dispatchEvent(new Event('input',{bubbles:true}))");await button("Generate Graph");await until("document.querySelectorAll('.vertex').length===12 && !document.querySelector('.gameMenu[open]')");
    const triangle={...levels[0],width:600,height:480};await go(`/custom?seed=${serializeGraph(triangle)}`);await graph(triangle);await solve(triangle);await action("Reset colors");await until("!document.querySelector('.completionCard')");
  });
  assert.deepEqual(browser.errors,[]);
});
