import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

test('development preview can select a future Daily and all campaign levels without a saved unlock',async()=>{
  const vite=await createServer({server:{middlewareMode:true,hmr:false,ws:false,watch:null},appType:'custom'});
  try{
    const {default:DevPreview}=await vite.ssrLoadModule('/src/dev/DevPreview.jsx');
    const {default:LevelMode}=await vite.ssrLoadModule('/src/components/LevelMode.jsx');
    const preview=url=>renderToString(createElement(MemoryRouter,{initialEntries:[url]},createElement(DevPreview)));
    const campaign=preview('/dev/preview?mode=campaign&level=30');
    assert.match(campaign,/Endgame Relay/);
    const campaignButtons=campaign.match(/<button[^>]*class="levelButton[^>]*>/g);
    assert.equal(campaignButtons.length,30);
    assert.ok(campaignButtons.every(button=>!button.includes('disabled')));
    const official=renderToString(createElement(MemoryRouter,{initialEntries:['/levels/1']},createElement(Routes,null,createElement(Route,{path:'/levels/:levelId',element:createElement(LevelMode)}))));
    const officialButtons=official.match(/<button[^>]*class="levelButton[^>]*>/g);
    assert.equal(officialButtons.filter(button=>button.includes('disabled')).length,29);
    const daily=preview('/dev/preview?mode=daily&date=2026-11-05');
    assert.match(daily,/Daily Puzzle Preview/);
    assert.match(daily,/Butterfly/);
    assert.match(daily,/daily-2026-11-05-design-v2/);
    assert.match(daily,/Session-only test progress/);
    assert.doesNotMatch(daily,/Daily progress could not/);
  }finally{await vite.close();}
});
