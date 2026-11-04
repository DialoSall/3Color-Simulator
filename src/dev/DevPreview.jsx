import "./preview.css";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import DailyMode from "../components/DailyMode.jsx";
import LevelMode from "../components/LevelMode.jsx";
import { levels } from "../data/levels.js";
import { dailySchedule, getDailyPuzzleForDate } from "../data/dailyPuzzles.js";
import { getDailyDateKey } from "../utils/dailyDate.js";
import { createDailyProgressService } from "../services/dailyProgress.js";

const dates = Object.keys(dailySchedule).sort();

function DevPreview() {
  const [params, setParams] = useSearchParams();
  const [progressService, setProgressService] = useState(() => createDailyProgressService({storage:null}));
  const [revision, setRevision] = useState(0);
  const [copyMessage, setCopyMessage] = useState("");
  const mode = params.get('mode') === 'campaign' ? 'campaign' : 'daily';
  const today = getDailyDateKey();
  const suggestedDate = dates.find(date=>date>=today && getDailyPuzzleForDate(date).design) ?? today;
  const requestedDate = params.get('date') ?? suggestedDate;
  const date = dates.includes(requestedDate) ? requestedDate : dates[0];
  const levelId = Math.max(1, Math.min(levels.length, Number(params.get('level')) || 1));
  const puzzle = mode === 'daily' ? getDailyPuzzleForDate(date) : levels.find(level=>level.id===levelId) ?? levels[0];
  const index = mode === 'daily' ? dates.indexOf(date) : puzzle.id-1;
  const count = mode === 'daily' ? dates.length : levels.length;
  function chooseMode(value) {
    setParams({mode:value,...(value==='daily'?{date}:{level:String(puzzle.id && mode==='campaign'?puzzle.id:1)})});
    setCopyMessage('');
  }
  function chooseLevel(value) { setParams({mode:'campaign',level:String(value)}); setCopyMessage(''); }
  function chooseDate(value) {
    if (dates.includes(value)) setParams({mode:'daily',date:value});
    setCopyMessage('');
  }
  function step(direction) {
    if (mode==='daily') chooseDate(dates[index+direction]);
    else chooseLevel(levels[index+direction].id);
  }
  async function copyPuzzle() {
    try {await navigator.clipboard.writeText(JSON.stringify(puzzle,null,2));setCopyMessage('Puzzle JSON copied.');}
    catch {setCopyMessage('Clipboard unavailable. Inspect this puzzle in the source data.');}
  }
  return (
    <>
      <details className="devPreviewPanel" open>
        <summary>Development preview <span>Session-only test progress</span></summary>
        <p className="devPreviewNotice">Review any puzzle here. Real campaign unlocks and Daily records stay separate.</p>
        <div className="devPreviewControls">
          <label>Mode<select value={mode} onChange={event=>chooseMode(event.target.value)}><option value="daily">Daily bank</option><option value="campaign">Campaign (all 30)</option></select></label>
          {mode==='daily' ? <label>Daily date<input type="date" min={dates[0]} max={dates.at(-1)} value={date} onChange={event=>chooseDate(event.target.value)} /></label>
            : <label>Campaign level<select value={puzzle.id} onChange={event=>chooseLevel(Number(event.target.value))}>{levels.map(level=><option key={level.id} value={level.id}>{level.id} · {level.name}</option>)}</select></label>}
          <div className="devPreviewNavigation"><button disabled={index===0} onClick={()=>step(-1)}>← Previous</button><span>{index+1} / {count}</span><button disabled={index===count-1} onClick={()=>step(1)}>Next →</button></div>
          <button onClick={copyPuzzle}>Copy puzzle JSON</button>
          <button onClick={()=>{setProgressService(createDailyProgressService({storage:null}));setRevision(value=>value+1);}}>Reset test progress</button>
        </div>
        <dl className="devPreviewMetadata">
          <div><dt>Puzzle ID</dt><dd><code>{puzzle.id}</code></dd></div>
          <div><dt>Difficulty</dt><dd>{puzzle.difficulty}</dd></div>
          <div><dt>Design</dt><dd>{puzzle.design?.name ?? (puzzle.theme?.name || 'Original layout')}</dd></div>
          <div><dt>Graph</dt><dd>{puzzle.vertices.length} circles · {puzzle.edges.length} connections</dd></div>
          {puzzle.metrics && <div><dt>Solver score</dt><dd>{puzzle.metrics.score}</dd></div>}
        </dl>
        <p role="status" className="devPreviewMessage">{copyMessage}</p>
      </details>
      {mode==='daily'
        ? <DailyMode key={`daily:${puzzle.id}:${revision}`} previewDateKey={date} progressService={progressService} />
        : <LevelMode key={`campaign:${puzzle.id}:${revision}`} preview previewLevelId={puzzle.id} onPreviewLevelChange={chooseLevel} />}
    </>
  );
}

export default DevPreview;
