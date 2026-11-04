import assert from "node:assert/strict";
import test from "node:test";
import { buildDailyResultShare, shareDailyResult } from "../src/utils/dailyResultSharing.js";

const puzzle = {
  id: "daily-2026-11-04-fox-v2", dateKey: "2026-11-04", name: "Fox Face", difficulty: "Expert",
  vertices: [{ id: 42, color: "red", x: 10, y: 20 }], edges: [[42, 43]], solution: "never-share-this",
};
const details = { puzzle, result: { timeMilliseconds: 72999, recolors: 4, resets: 9 }, isToday: true, currentStreak: 3 };
const body = "3Color Daily · Nov 4\nFox Face · Expert\n✓ 1:12 · 4 recolors\n🔥 3-day streak";
const url = "https://3color.app/daily/2026-11-04";

function harness({ native, write, secure = true } = {}) {
  const nativeCalls = [], clipboard = [], events = [];
  return {
    nativeCalls, clipboard, events,
    options: {
      navigator: {
        ...(native ? { async share(data) { nativeCalls.push(data); await native(data); } } : {}),
        clipboard: { async writeText(text) { clipboard.push(text); await write?.(text); } },
      },
      isSecureContext: secure,
      track: (name, parameters) => events.push({ name, parameters }),
    },
  };
}
const analytics = share_method => ({ name: "daily_result_share", parameters: { date_key: "2026-11-04", is_today: true, difficulty: "Expert", share_method } });

test("today's result has compact date, puzzle metadata, best metrics, streak, and permanent URL", () => {
  assert.deepEqual(buildDailyResultShare(details), { title: "3Color Daily", text: body, url });
});

test("historical shares keep their exact date URL and omit the player's current streak", () => {
  const data = buildDailyResultShare({ ...details, isToday: false, currentStreak: 30 });
  assert.equal(data.text, body.split("\n").slice(0, 3).join("\n"));
  assert.equal(data.url, url);
  assert.doesNotMatch(data.text, /🔥|streak/);
  const another = buildDailyResultShare({ ...details, puzzle: { ...puzzle, dateKey: "2026-11-05", name: "Butterfly" } });
  assert.match(another.text, /^3Color Daily · Nov 5\nButterfly/);
  assert.equal(another.url, "https://3color.app/daily/2026-11-05");
});

test("one-day and multi-day streaks use the same concise singular day modifier", () => {
  for (const count of [1, 2, 7]) assert.ok(buildDailyResultShare({ ...details, currentStreak: count }).text.endsWith(`🔥 ${count}-day streak`));
});

test("uncredited, loading, unavailable, or zero streaks do not add a streak line", () => {
  for (const currentStreak of [0, undefined, null, -1]) assert.doesNotMatch(buildDailyResultShare({ ...details, currentStreak }).text, /🔥|streak/);
});

test("share-only time formatting is compact and handles sub-minute and long results", () => {
  for (const [timeMilliseconds, time] of [[0, "0:00"], [999, "0:00"], [9000, "0:09"], [59999, "0:59"], [60000, "1:00"], [3601000, "60:01"]]) {
    assert.ok(buildDailyResultShare({ ...details, result: { timeMilliseconds, recolors: 1 } }).text.includes(`✓ ${time} · 1 recolor\n`));
  }
});

test("sharing exposes no puzzle number, reset count, colors, coordinates, connections, or solution", () => {
  const original = structuredClone(details);
  const data = buildDailyResultShare(details);
  assert.doesNotMatch(JSON.stringify(data), /Daily #|daily-2026|reset|vertices|edges|never-share-this|"red"|"x"/);
  assert.deepEqual(details, original);
  assert.equal(data.text.split("\n").length, 4);
});

test("native share uses the concise title/body/dated URL and tracks one completed native share", async () => {
  const h = harness({ native: async () => {} });
  assert.equal(await shareDailyResult(details, h.options), "Thanks for sharing!");
  assert.deepEqual(h.nativeCalls, [{ title: "3Color Daily", text: body, url }]);
  assert.deepEqual(h.clipboard, []);
  assert.deepEqual(h.events, [analytics("native")]);
});

test("success analytics wait until the native share promise resolves", async () => {
  let finish;
  const h = harness({ native: () => new Promise(resolve => { finish = resolve; }) });
  const pending = shareDailyResult(details, h.options);
  assert.equal(h.nativeCalls.length, 1);
  assert.deepEqual(h.events, []);
  finish();
  await pending;
  assert.deepEqual(h.events, [analytics("native")]);
});

test("native cancellation preserves feedback and triggers neither clipboard fallback nor success analytics", async () => {
  const h = harness({ native: async () => { throw Object.assign(new Error("Cancelled"), { name: "AbortError" }); } });
  assert.equal(await shareDailyResult(details, h.options), null);
  assert.equal(h.nativeCalls.length, 1);
  assert.deepEqual(h.clipboard, []);
  assert.deepEqual(h.events, []);
});

test("a failed native share falls back to the identical canonical result and URL once", async () => {
  const h = harness({ native: async () => { throw new Error("Unsupported"); } });
  assert.equal(await shareDailyResult(details, h.options), "Result copied!");
  assert.deepEqual(h.clipboard, [`${h.nativeCalls[0].text}\n${h.nativeCalls[0].url}`]);
  assert.deepEqual(h.events, [analytics("clipboard")]);
});

test("clipboard-only and insecure-context sharing use canonical text and successful-share metadata", async () => {
  for (const config of [{}, { secure: false, native: async () => { assert.fail("Native share requires a secure context"); } }]) {
    const h = harness(config);
    assert.equal(await shareDailyResult(details, h.options), "Result copied!");
    assert.deepEqual(h.clipboard, [`${body}\n${url}`]);
    assert.deepEqual(h.events, [analytics("clipboard")]);
    assert.deepEqual(h.nativeCalls, []);
  }
});

test("historical clipboard success tracks the selected date without claiming it is today", async () => {
  const h = harness();
  await shareDailyResult({ ...details, isToday: false }, h.options);
  assert.equal(h.events[0].parameters.is_today, false);
  assert.equal(h.events[0].parameters.date_key, puzzle.dateKey);
  assert.doesNotMatch(h.clipboard[0], /streak/);
});

test("clipboard denial or missing APIs show a manual-copy result and never count as a successful share", async () => {
  const h = harness({ native: async () => { throw new Error("Native failed"); }, write: async () => { throw new Error("Clipboard denied"); } });
  const feedback = await shareDailyResult(details, h.options);
  assert.equal(feedback, `Could not share automatically. Copy this result:\n${body}\n${url}`);
  assert.deepEqual(h.events, []);
  assert.equal(await shareDailyResult(details, { ...h.options, navigator: {} }), feedback);
  assert.deepEqual(h.events, []);
});
